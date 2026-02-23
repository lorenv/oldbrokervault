/**
 * Utility & Miscellaneous Routes
 *
 * Includes:
 * - Public incoming webhook handler
 * - Public health check
 * - Client error reporting
 * - Session management
 * - Support ticket submission
 * - Static file serving (user-images, logos)
 * - Config / Stripe config / Pricing endpoints
 * - Test email
 * - Email sharing & broker contact form
 * - Unsplash image search & download tracking
 * - PDF template management
 * - WordPress/Beaver Builder template fetching
 * - PDF-to-image conversion & temp image serving
 */

import type { Express } from 'express';
import * as express from 'express';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';

import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { sendEmail, sendNdaSignedEmail } from '../email';
import { sanitizeUser, sanitizeUserForSharing } from '../data-sanitizer';
import { objectStorage } from '../object-storage';
import { sendErrorReport } from '../error-reporter';
import { generateSecureToken, generateRedirectId } from '../token-utils';
import { getPricing } from '../stripe';
import { fetchBeaverBuilderTemplates } from '../wordpress-export';
import { dispatchWebhookEvent } from '../webhook-dispatcher';
import { dispatchIntegrationEvent } from '../integrations';
import { logger } from '../logger';

const execAsync = promisify(exec);

// Rate limiting storage for broker contact emails
const contactRateLimit = new Map<string, number[]>();

export function registerUtilityRoutes(app: Express) {

  // ─── Public Incoming Webhook ───────────────────────────────────────────

  app.post('/api/webhooks/incoming/:token', express.json({ limit: '1mb' }), async (req, res) => {
    const { token } = req.params;
    const startTime = Date.now();

    try {
      // Import dependencies
      const { incomingWebhooks } = await import('@shared/schema');
      const { processIncomingWebhook, generateRequestId, verifySignature } = await import('../services/incoming-webhook-processor');

      // Find webhook by token
      const [webhook] = await db
        .select()
        .from(incomingWebhooks)
        .where(eq(incomingWebhooks.token, token));

      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      if (!webhook.isActive) {
        return res.status(403).json({ error: 'Webhook is disabled' });
      }

      // Verify signature if secret is configured
      if (webhook.secret) {
        const signature = req.get('X-Webhook-Signature') || req.get('X-Hub-Signature-256');
        const rawBody = JSON.stringify(req.body);

        if (!verifySignature(rawBody, signature, webhook.secret)) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Generate request ID
      const requestId = generateRequestId();

      // Return 200 immediately for reliability
      res.status(200).json({
        success: true,
        requestId,
        message: 'Webhook received and queued for processing'
      });

      // Process asynchronously
      const sourceIp = req.ip || req.get('x-forwarded-for') || 'unknown';
      processIncomingWebhook(webhook, req.body, requestId, sourceIp)
        .then(result => {
          if (result.success) {
            console.log(`[Incoming Webhook] Processed ${requestId}: Created ${result.entityType} #${result.entityId}`);
          } else {
            console.error(`[Incoming Webhook] Failed ${requestId}: ${result.error}`);
          }
        })
        .catch(err => {
          console.error(`[Incoming Webhook] Error processing ${requestId}:`, err);
        });

    } catch (error: any) {
      console.error('[Incoming Webhook] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Public Health Check ───────────────────────────────────────────────

  app.get("/api/public-health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Public endpoint accessible without authentication",
      headers: {
        host: req.get('host'),
        userAgent: req.get('user-agent'),
        origin: req.get('origin'),
        referer: req.get('referer')
      }
    });
  });

  // ─── Client Error Reporting ────────────────────────────────────────────

  app.post("/api/error-report", express.json(), async (req, res) => {
    try {
      const { error, stack, page, componentStack, additionalInfo } = req.body;

      if (!error || !page) {
        return res.status(400).json({ error: 'Missing required fields: error and page' });
      }

      // Get user info if authenticated
      let userEmail: string | undefined;
      let userId: number | undefined;
      if (req.isAuthenticated() && req.user) {
        userId = req.user.id;
        const user = await storage.getUser(req.user.id);
        userEmail = user?.email;
      }

      await sendErrorReport({
        error: String(error).substring(0, 2000), // Limit error length
        stack: stack ? String(stack).substring(0, 5000) : undefined,
        page: String(page).substring(0, 500),
        userEmail,
        userId,
        timestamp: new Date().toISOString(),
        userAgent: req.get('user-agent'),
        componentStack: componentStack ? String(componentStack).substring(0, 3000) : undefined,
        additionalInfo,
      });

      res.json({ success: true });
    } catch (err) {
      logger.error('Error handling error report:', err);
      res.status(500).json({ error: 'Failed to process error report' });
    }
  });

  // ─── Emergency Session Clear ───────────────────────────────────────────

  app.post("/api/clear-session", (req, res) => {
    console.log('🧹 Clearing corrupted session');
    req.session.destroy((err: any) => {
      if (err) {
        console.error('❌ Failed to destroy session:', err);
        return res.status(500).json({ error: 'Failed to clear session' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Session cleared successfully' });
    });
  });

  // ─── Support Ticket Submission ─────────────────────────────────────────

  app.post("/api/support/ticket", express.json(), async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { type, subject, description, attachments, browserInfo, pageUrl } = req.body;

      if (!subject || !description) {
        return res.status(400).json({ error: 'Subject and description are required' });
      }

      // Get user's organization if they have one
      let organizationId: number | null = null;
      try {
        const { organizationMembers } = await import("@shared/schema");
        const { db } = await import("../db");
        const { eq } = await import("drizzle-orm");
        const [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, req.user.id));
        organizationId = membership?.organizationId || null;
      } catch (e) {
        // Organization lookup failed, continue without it
      }

      const ticket = await storage.createSupportTicket({
        userId: req.user.id,
        organizationId,
        type: type || 'bug',
        subject,
        description,
        attachments: attachments || [],
        browserInfo,
        pageUrl,
      });

      res.json({ success: true, ticketId: ticket.id });
    } catch (err) {
      logger.error('Error creating support ticket:', err);
      res.status(500).json({ error: 'Failed to submit support ticket' });
    }
  });

  // ─── Static File Serving ───────────────────────────────────────────────

  app.use('/user-images', express.static(path.join(process.cwd(), 'public', 'user-images')));
  app.use('/logos', express.static(path.join(process.cwd(), 'public', 'logos')));

  // ─── Config & Stripe Config ────────────────────────────────────────────

  app.get("/api/config", (req, res) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey || publishableKey.includes('YOUR_') || publishableKey === 'pk_test_YOUR_PUBLISHABLE_KEY_HERE') {
      console.error('❌ Stripe publishable key not properly configured');
      return res.status(500).json({
        error: "Stripe configuration incomplete",
        message: "Payment processing is temporarily unavailable"
      });
    }

    const supportEmail = process.env.SUPPORT_EMAIL || 'contact@brokervault.ai';
    const companyName = process.env.COMPANY_NAME || 'Broker Vault';

    res.json({
      stripe: {
        publishableKey: publishableKey
      },
      company: {
        supportEmail,
        name: companyName
      }
    });
  });

  // Legacy endpoint for backward compatibility
  app.get("/api/stripe-config", (req, res) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey || publishableKey.includes('YOUR_') || publishableKey === 'pk_test_YOUR_PUBLISHABLE_KEY_HERE') {
      return res.status(500).json({
        error: "Stripe configuration incomplete",
        message: "Payment processing is temporarily unavailable"
      });
    }

    res.json({
      publishableKey: publishableKey
    });
  });

  // ─── Pricing (static fallback) ────────────────────────────────────────

  app.get("/api/pricing", async (req, res) => {
    res.json({
      free: {
        amount: 0,
        currency: 'usd',
        limit: 1,
        regenerationLimit: 2
      },
      standard: {
        amount: 99,
        currency: 'usd',
        limit: 3,
        regenerationLimit: 20
      },
      enterprise: {
        amount: 'Contact Us',
        currency: 'usd',
        limit: 'Unlimited',
        regenerationLimit: 'Unlimited'
      }
    });
  });

  // ─── Test Email ────────────────────────────────────────────────────────

  app.post("/api/test-email", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { to } = req.body;
      const user = req.user;

      console.log('=== EMAIL TEST DEBUG ===');
      console.log('Test email to:', to);
      console.log('From user:', user.email);

      const testEmailSent = await sendEmail({
        to: to,
        from: 'system@brokervault.ai',
        subject: 'Test Message from Broker Vault',
        text: 'Hello! This is a simple test message to verify email delivery is working correctly. Please reply if you receive this.',
        html: '<p>Hello!</p><p>This is a simple test message to verify email delivery is working correctly.</p><p>Please reply if you receive this.</p>',
        replyTo: user.email
      });

      if (testEmailSent) {
        res.json({
          success: true,
          message: "Test email sent successfully"
        });
      } else {
        res.status(500).json({
          error: "Test email failed to send"
        });
      }

    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Email Sharing ─────────────────────────────────────────────────────

  app.post("/api/share/email", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { recipientEmail, shareUrl, documentTitle, customMessage, senderName, documentId } = req.body;

      // Input validation
      if (!recipientEmail?.trim() || !shareUrl?.trim() || !documentTitle?.trim()) {
        return res.status(400).json({
          error: "Recipient email, share URL, and document title are required"
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail.trim())) {
        return res.status(400).json({
          error: "Invalid email address format"
        });
      }

      // Get sender information
      const [sender] = await db.select().from(users).where(eq(users.id, req.user!.id));
      if (!sender) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get CIM document for PDF generation (if documentId provided)
      let cimDocument = null;
      let customSections: any[] = [];
      if (documentId) {
        try {
          cimDocument = await storage.getCimDocument(parseInt(documentId));
          if (cimDocument && cimDocument.userId === req.user!.id) {
            // Get custom sections if they exist
            customSections = await storage.getCustomSections(parseInt(documentId)) || [];
          } else {
            cimDocument = null; // Not authorized or not found
          }
        } catch (error) {
          console.error('Error retrieving CIM document for email:', error);
          cimDocument = null;
        }
      }

      // Convert relative URLs to absolute URLs for email images
      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://brokervault.ai' : req.protocol + '://' + req.get('host');
      const profilePhotoUrl = sender.profilePhoto ? (sender.profilePhoto.startsWith('http') ? sender.profilePhoto : `${baseUrl}${sender.profilePhoto}`) : null;
      const businessLogoUrl = sender.businessLogo ? (sender.businessLogo.startsWith('http') ? sender.businessLogo : `${baseUrl}${sender.businessLogo}`) : null;

      const fromName = senderName || sender.name || sender.email;
      const fromEmail = 'system@brokervault.ai'; // Use verified sender email

      // Prepare email content
      const subject = `Confidential Information Memorandum - ${documentTitle}`;

      let htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            Confidential Information Memorandum
          </h2>

          <p style="color: #555; font-size: 16px;">
            You have been invited to review a confidential business information memorandum.
          </p>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">Document: ${documentTitle}</h3>
            <p style="color: #64748b; margin-bottom: 0;">Shared by: ${fromName}</p>
          </div>`;

      if (customMessage?.trim()) {
        htmlContent += `
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="color: #92400e; margin-top: 0;">Personal Message:</h4>
            <p style="color: #78350f; white-space: pre-wrap;">${customMessage.trim()}</p>
          </div>`;
      }

      htmlContent += `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${shareUrl}"
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Document
            </a>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Broker's Contact Information</h3>

            <div style="text-align: center; margin-bottom: 20px;">
              ${profilePhotoUrl ? `<img src="${profilePhotoUrl}" alt="Profile Photo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px;">` : ''}
              ${businessLogoUrl ? `<img src="${businessLogoUrl}" alt="Business Logo" style="max-width: 150px; max-height: 60px; margin-bottom: 15px;">` : ''}
            </div>

            <div style="text-align: center;">
              <h4 style="margin: 10px 0; font-size: 18px; color: #333;">${sender.name}</h4>
              ${sender.title ? `<p style="margin: 5px 0; color: #666; font-style: italic;">${sender.title}</p>` : ''}
              ${sender.businessName ? `<p style="margin: 5px 0; color: #666; font-weight: bold;">${sender.businessName}</p>` : ''}

              <div style="margin-top: 15px;">
                <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${sender.email}">${sender.email}</a></p>
                ${sender.phoneNumber ? `<p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:${sender.phoneNumber}">${sender.phoneNumber}</a></p>` : ''}
              </div>
            </div>
          </div>

          <p style="color: #666; text-align: center;">
            Please feel free to reach out if you have any questions about the opportunity.
          </p>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="color: #9ca3af; font-size: 14px; text-align: center;">
              This document contains confidential information. Please do not share this link with unauthorized parties.
            </p>
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Professional CIM Generation Platform
            </p>
          </div>
        </div>`;

      const textContent = `
Confidential Information Memorandum

You have been invited to review a confidential business information memorandum.

Document: ${documentTitle}
Shared by: ${fromName}

${customMessage?.trim() ? `Personal Message:\n${customMessage.trim()}\n\n` : ''}

Please find the confidential document attached as a PDF file.
You can also view it online at: ${shareUrl}

Broker's Contact Information:
Name: ${sender.name}
${sender.title ? `Title: ${sender.title}` : ''}
${sender.businessName ? `Business: ${sender.businessName}` : ''}
Email: ${sender.email}
${sender.phoneNumber ? `Phone: ${sender.phoneNumber}` : ''}

Please feel free to reach out if you have any questions about the opportunity.

This document contains confidential information. Please do not share without authorization.

Professional CIM Generation Platform`;

      // Generate PDF attachment
      console.log('=== GENERATING PDF ATTACHMENT ===');
      let pdfAttachment = null;

      if (cimDocument) {
        try {
          // Import PDF generation function
          const { generatePDF } = await import('../document-export');

          // Generate PDF buffer with proper parameters
          const pdfBuffer = await generatePDF(
            cimDocument.analysis,
            cimDocument.logoUrl,
            cimDocument.websiteUrl,
            cimDocument.selectedImages || [],
            sender,
            {
              enabled: cimDocument.financialsEnabled || false,
              askingPrice: cimDocument.askingPrice,
              askingPriceIncluded: cimDocument.askingPriceIncluded || false,
              revenue: cimDocument.revenue,
              revenueIncluded: cimDocument.revenueIncluded || false,
              ebitda: cimDocument.ebitda,
              ebitdaIncluded: cimDocument.ebitdaIncluded || false
            },
            [], // financialFiles - not needed for email attachments
            baseUrl,
            cimDocument.title,
            customSections,
            cimDocument.coverImageUrl,
            cimDocument.coverImagePosition,
            cimDocument.id,
            sender.pdfBackgroundTemplate || 'classic'
          );
          const filename = `${documentTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_CIM.pdf`;

          pdfAttachment = {
            content: pdfBuffer.toString('base64'),
            filename: filename,
            type: 'application/pdf',
            disposition: 'attachment'
          };

          console.log('✅ PDF attachment generated:', filename);
          console.log('PDF size:', Math.round(pdfBuffer.length / 1024), 'KB');
        } catch (pdfError) {
          console.error('❌ Failed to generate PDF attachment:', pdfError);
          console.log('Sending email with link only...');
        }
      } else {
        console.log('No CIM document found, sending email with link only...');
      }

      // Send email with comprehensive debugging
      console.log('=== EMAIL SHARE DEBUG ===');
      console.log('Sending email to:', recipientEmail.trim());
      console.log('From:', fromEmail);
      console.log('Reply-to:', sender.email);
      console.log('Subject:', subject);
      console.log('Has PDF attachment:', !!pdfAttachment);
      console.log('SendGrid API Key available:', !!process.env.SENDGRID_API_KEY);
      console.log('SendGrid API Key length:', process.env.SENDGRID_API_KEY?.length || 0);
      console.log('Text content length:', textContent.length);
      console.log('HTML content length:', htmlContent.length);

      // Check for potential spam triggers
      const spamIndicators: string[] = [];
      if (recipientEmail.includes('gmail.com')) spamIndicators.push('Gmail recipient');
      if (subject.toLowerCase().includes('confidential')) spamIndicators.push('Confidential in subject');
      if (textContent.includes('http')) spamIndicators.push('Contains links');
      if (pdfAttachment) spamIndicators.push('Has PDF attachment');

      console.log('Potential spam indicators:', spamIndicators);

      const emailSent = await sendEmail({
        to: recipientEmail.trim(),
        from: fromEmail,
        subject,
        text: textContent,
        html: htmlContent,
        replyTo: sender.email,
        attachments: pdfAttachment ? [pdfAttachment] : undefined
      });

      console.log('Email sent result:', emailSent);

      if (emailSent) {
        res.json({
          success: true,
          message: "Email sent successfully"
        });
      } else {
        console.error('❌ Email sending failed - SendGrid returned false');
        res.status(500).json({
          error: "Failed to send email. Please try again."
        });
      }
    } catch (error) {
      console.error("Email sharing error:", error);
      res.status(500).json({
        error: "Internal server error while sending email"
      });
    }
  });

  // ─── Broker Contact Form (public, with message center integration) ────

  app.post("/api/share/:shareSlug/contact", async (req, res) => {
    console.log('=== CONTACT FORM SUBMISSION RECEIVED ===');
    console.log('Share slug:', req.params.shareSlug);
    console.log('Request body:', req.body);

    try {
      const { shareSlug } = req.params;
      // Support both field name formats for compatibility
      const { viewerName, viewerEmail, viewerPhone, question, name, email, message } = req.body;

      // Use the provided fields with fallback support
      const finalName = viewerName || name;
      const finalEmail = viewerEmail || email;
      const finalQuestion = question || message;

      // Input validation
      if (!finalName?.trim() || !finalEmail?.trim() || !finalQuestion?.trim()) {
        return res.status(400).json({
          error: "Name, email, and question are required fields"
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalEmail)) {
        return res.status(400).json({
          error: "Please provide a valid email address"
        });
      }

      // Rate limiting: 2 questions per email per hour
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      const userRequests = contactRateLimit.get(finalEmail) || [];

      // Clean old requests
      const recentRequests = userRequests.filter(timestamp => timestamp > oneHourAgo);

      if (recentRequests.length >= 2) {
        return res.status(429).json({
          error: "You can only send 2 questions per hour. Please try again later."
        });
      }

      // Get the shared CIM document
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Shared document not found" });
      }

      // Create message thread using the message center system
      const { messageService } = await import("../message-service");

      const emailSubject = `Question about "${cimDoc.title}" from ${finalName}`;
      const messageContent = `
From: ${finalName}
Email: ${finalEmail}
${viewerPhone ? `Phone: ${viewerPhone}` : ''}

Question:
${finalQuestion}
      `.trim();

      const thread = await messageService.createThreadFromContactForm(
        cimDoc.userId,
        cimDoc.id,
        finalEmail,
        finalName,
        emailSubject,
        messageContent
      );

      // Update rate limiting
      recentRequests.push(now);
      contactRateLimit.set(finalEmail, recentRequests);

      // Clean up old rate limit entries periodically
      if (Math.random() < 0.1) { // 10% chance to clean up
        const emailsToClean = Array.from(contactRateLimit.keys());
        for (const email of emailsToClean) {
          const timestamps = contactRateLimit.get(email) || [];
          const validTimestamps = timestamps.filter((ts: number) => ts > oneHourAgo);
          if (validTimestamps.length === 0) {
            contactRateLimit.delete(email);
          } else {
            contactRateLimit.set(email, validTimestamps);
          }
        }
      }

      res.json({
        success: true,
        message: "Your question has been sent to the broker. You will receive a confirmation email shortly.",
        threadId: thread.id
      });

    } catch (error: any) {
      console.error("=== CONTACT FORM ERROR ===");
      console.error("Error sending broker contact:", error);
      console.error("Error details:", error);
      console.error("Share slug:", req.params.shareSlug);
      console.error("=== END CONTACT FORM ERROR ===");

      res.status(500).json({
        error: "Failed to send message. Please try again later.",
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  });

  // ─── Unsplash Image Search ─────────────────────────────────────────────

  app.get("/api/unsplash/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { query, page = 1, per_page = 12 } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }

      const accessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (!accessKey) {
        return res.status(500).json({ error: "Unsplash API key not configured" });
      }

      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}&orientation=landscape`, {
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);

    } catch (error) {
      console.error("Unsplash search error:", error);
      res.status(500).json({ error: "Failed to search images" });
    }
  });

  // ─── Unsplash Download Tracking ────────────────────────────────────────

  app.post("/api/unsplash/download", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { downloadUrl } = req.body;
      console.log("Unsplash download request received for:", downloadUrl);

      if (!downloadUrl || typeof downloadUrl !== 'string') {
        console.log("Invalid download URL provided");
        return res.status(400).json({ error: "Download URL is required" });
      }

      const accessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (!accessKey) {
        console.log("Unsplash API key not configured");
        return res.status(500).json({ error: "Unsplash API key not configured" });
      }

      // Trigger the download event as required by Unsplash API guidelines
      console.log("Sending download request to Unsplash API");
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        }
      });

      if (!response.ok) {
        console.log("Unsplash download request failed:", response.status, response.statusText);
        throw new Error(`Unsplash download tracking error: ${response.status}`);
      }

      console.log("Unsplash download tracking successful");
      res.json({ success: true });

    } catch (error) {
      console.error("Unsplash download tracking error:", error);
      res.status(500).json({ error: "Failed to track download" });
    }
  });

  // ─── PDF Template Management ───────────────────────────────────────────

  app.get("/api/pdf-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templates = [
        {
          id: 'none',
          name: 'No Background',
          description: 'Clean, plain pages without any background template',
          preview: null
        },
        {
          id: 'classic',
          name: 'Classic',
          description: 'Traditional professional background with elegant styling',
          preview: '/api/pdf-templates/classic/preview'
        },
        {
          id: 'professional-blue',
          name: 'Professional Blue',
          description: 'Modern minimal blue design for professional presentations',
          preview: '/api/pdf-templates/professional-blue/preview'
        },
        {
          id: 'modern-green',
          name: 'Modern Green',
          description: 'Contemporary green and blue design with modern appeal',
          preview: '/api/pdf-templates/modern-green/preview'
        }
      ];

      res.json({ templates });
    } catch (error) {
      console.error("Error fetching PDF templates:", error);
      res.status(500).json({ error: "Failed to fetch PDF templates" });
    }
  });

  app.get("/api/pdf-templates/:templateId/preview", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { templateId } = req.params;

      if (templateId === 'none') {
        return res.status(404).json({ error: "No preview available for 'No Background' option" });
      }

      const templatePath = path.resolve(process.cwd(), 'pdf-templates', `${templateId}.pdf`);

      if (!fsSync.existsSync(templatePath)) {
        return res.status(404).json({ error: "Template not found" });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${templateId}-preview.pdf"`);

      const templateBuffer = fsSync.readFileSync(templatePath);
      res.send(templateBuffer);
    } catch (error) {
      console.error("Error serving template preview:", error);
      res.status(500).json({ error: "Failed to serve template preview" });
    }
  });

  // PDF template thumbnail endpoint
  app.get("/api/pdf-templates/:templateId/thumbnail", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { templateId } = req.params;



      if (templateId === 'none') {
        return res.status(404).json({ error: "No thumbnail available for 'No Background' option" });
      }

      // Serve actual PNG thumbnail files
      const thumbnailPath = path.resolve(process.cwd(), 'public', 'template-thumbnails', `${templateId}.png`);
      console.log(`Thumbnail path: ${thumbnailPath}`);
      console.log(`File exists: ${fsSync.existsSync(thumbnailPath)}`);

      if (fsSync.existsSync(thumbnailPath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const thumbnailBuffer = fsSync.readFileSync(thumbnailPath);
        console.log(`Serving PNG thumbnail, size: ${thumbnailBuffer.length} bytes`);
        return res.send(thumbnailBuffer);
      } else {
        console.log(`PNG not found, serving fallback SVG for ${templateId}`);
        // Fallback SVG for missing thumbnails
        const fallbackSvg = `
          <svg width="128" height="160" viewBox="0 0 128 160" xmlns="http://www.w3.org/2000/svg">
            <rect width="128" height="160" fill="#f8f9fa" stroke="#e9ecef" stroke-width="2" rx="4"/>
            <text x="64" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6c757d">
              ${templateId}
            </text>
            <text x="64" y="100" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6c757d">
              Template
            </text>
          </svg>
        `;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(fallbackSvg);
      }
    } catch (error) {
      console.error("Error serving template thumbnail:", error);
      res.status(500).json({ error: "Failed to serve template thumbnail" });
    }
  });

  app.put("/api/user/pdf-template", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { templateId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!templateId || typeof templateId !== 'string') {
        return res.status(400).json({ error: "Template ID is required" });
      }

      // Validate template ID
      const validTemplates = ['none', 'classic', 'professional-blue', 'modern-green'];
      if (!validTemplates.includes(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }

      // Update user's PDF template preference
      await db.update(users)
        .set({ pdfBackgroundTemplate: templateId })
        .where(eq(users.id, userId));

      res.json({ success: true, templateId });
    } catch (error) {
      console.error("Error updating PDF template preference:", error);
      res.status(500).json({ error: "Failed to update PDF template preference" });
    }
  });

  // ─── WordPress / Beaver Builder Templates ─────────────────────────────

  app.post("/api/wordpress/fetch-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { wpUrl, username, password } = req.body;

      if (!wpUrl || !username || !password) {
        return res.status(400).json({
          error: "Missing WordPress credentials",
          requiredFields: ["wpUrl", "username", "password"]
        });
      }

      // Basic URL validation
      if (!wpUrl.startsWith('http://') && !wpUrl.startsWith('https://')) {
        return res.status(400).json({
          error: "WordPress URL must start with http:// or https://"
        });
      }

      try {
        const templates = await fetchBeaverBuilderTemplates(wpUrl, username, password);
        res.json({ templates });
      } catch (error) {
        // Handle specific WordPress API errors
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch templates";

        if (errorMessage.includes('HTML instead of JSON')) {
          return res.status(400).json({
            error: "The WordPress site returned HTML instead of JSON. Please check that the REST API is enabled and the site URL is correct.",
            details: "This typically happens when a WordPress site has REST API disabled or is using a security plugin that blocks API access."
          });
        }

        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          return res.status(404).json({
            error: "Beaver Builder templates not found on this WordPress site.",
            details: "Please ensure Beaver Builder is installed and activated on your WordPress site."
          });
        }

        res.status(500).json({ error: errorMessage });
      }
    } catch (error) {
      console.error("Error in template fetch route:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to process template request"
      });
    }
  });

  // ─── PDF to Image Conversion ───────────────────────────────────────────

  app.post('/api/pdf-to-image', express.json({ limit: '50mb' }), async (req, res) => {
    console.log('PDF to image endpoint hit');
    try {
      const { pdfBase64 } = req.body;

      if (!pdfBase64) {
        console.log('No PDF data provided');
        return res.status(400).json({ error: 'No PDF data provided' });
      }

      console.log('Converting PDF to image, size:', pdfBase64.length);

      const tempDir = '/tmp';
      const pdfPath = path.join(tempDir, `pdf_${Date.now()}.pdf`);
      const imagePath = path.join(tempDir, `pdf_${Date.now()}.png`);

      try {
        // Validate PDF base64 data
        if (pdfBase64.length < 1000) {
          throw new Error('PDF data appears to be incomplete or corrupted');
        }

        // Write PDF to temporary file with optimized buffer handling
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        fsSync.writeFileSync(pdfPath, pdfBuffer, { flag: 'w' });

        // Validate PDF file was written correctly
        const stats = fsSync.statSync(pdfPath);
        if (stats.size < 100) {
          throw new Error('Generated PDF file is too small');
        }

        console.log(`PDF written to temp file: ${pdfPath}, size: ${stats.size} bytes`);

        // Get total page count using pdfinfo first
        let totalPages = 1;
        try {
          const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`, { timeout: 5000 });
          const pageMatch = stdout.match(/Pages:\s+(\d+)/);
          if (pageMatch) {
            totalPages = parseInt(pageMatch[1]);
          }
        } catch (infoError) {
          console.warn('Could not get page count, defaulting to 1');
        }

        console.log(`Converting all ${totalPages} pages to images`);

        // Convert all pages to PNG using poppler-utils with optimized settings
        const baseImagePath = imagePath.replace('.png', '');
        const convertCommand = `pdftoppm -png -scale-to-x 800 -scale-to-y -1 -q -cropbox "${pdfPath}" "${baseImagePath}"`;

        console.log('Running conversion command for all pages:', convertCommand);
        await execAsync(convertCommand, { timeout: 20000 });

        // Collect all generated page images
        const pageImages: Array<{ pageNumber: number; imageUrl: string; width: number; height: number }> = [];

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          // Check multiple possible output formats
          const possiblePaths = [
            `${baseImagePath}-${pageNum.toString().padStart(2, '0')}.png`,
            `${baseImagePath}-${pageNum}.png`,
            pageNum === 1 ? `${baseImagePath}.png` : null,
            pageNum === 1 ? `${baseImagePath}-1.png` : null
          ].filter(Boolean) as string[];

          let actualImagePath = '';
          for (const possiblePath of possiblePaths) {
            if (fsSync.existsSync(possiblePath)) {
              actualImagePath = possiblePath;
              break;
            }
          }

          if (actualImagePath) {
            console.log(`Processing image file: ${actualImagePath}`);
            const imageBuffer = fsSync.readFileSync(actualImagePath);

            // Get actual image dimensions using sharp
            let actualWidth = 800;
            let actualHeight = Math.round(800 * 1.414);
            try {
              const metadata = await sharp(imageBuffer).metadata();
              if (metadata.width && metadata.height) {
                actualWidth = metadata.width;
                actualHeight = metadata.height;
                console.log(`Page ${pageNum} actual dimensions: ${actualWidth}x${actualHeight}`);
              }
            } catch (metadataError) {
              console.warn(`Could not read image metadata for page ${pageNum}, using defaults`);
            }

            // Create a unique filename for serving
            const uniqueId = `${Date.now()}_${pageNum}`;
            const serveFileName = `nda_page_${uniqueId}.png`;
            const servePath = path.join('/tmp', serveFileName);

            // Copy image to serve directory with unique name and optimization
            fsSync.writeFileSync(servePath, imageBuffer, { flag: 'w' });

            pageImages.push({
              pageNumber: pageNum,
              imageUrl: `/api/temp-image/${serveFileName}`,
              width: actualWidth,
              height: actualHeight
            });

            // Clean up the original conversion output immediately
            try {
              fsSync.unlinkSync(actualImagePath);
            } catch (cleanupError) {
              console.warn(`Failed to cleanup ${actualImagePath}:`, cleanupError);
            }
            console.log(`Page ${pageNum} processed successfully, serving at ${serveFileName}`);
          }
        }

        // Clean up PDF file
        fsSync.unlinkSync(pdfPath);

        console.log(`All ${pageImages.length} pages converted successfully`);

        return res.json({
          success: true,
          totalPages,
          pages: pageImages.map(p => ({
            pageNumber: p.pageNumber,
            filename: p.imageUrl.split('/').pop(), // Extract filename from URL
            imageUrl: p.imageUrl,
            width: p.width,
            height: p.height
          }))
        });

      } catch (conversionError: any) {
        console.error('PDF conversion error:', conversionError);

        // Clean up any temporary files
        try {
          if (fsSync.existsSync(pdfPath)) fsSync.unlinkSync(pdfPath);
          if (fsSync.existsSync(imagePath)) fsSync.unlinkSync(imagePath);
        } catch {}

        return res.status(500).json({
          error: 'PDF conversion failed',
          details: conversionError.message
        });
      }

    } catch (error: any) {
      console.error('PDF to image endpoint error:', error);
      return res.status(500).json({ error: 'Server error during PDF conversion' });
    }
  });

  // ─── Temporary Image Serving (for PDF pages) ──────────────────────────

  app.get('/api/temp-image/:filename', (req, res) => {
    try {
      const filename = req.params.filename;

      // Security: only allow specific pattern
      if (!/^nda_page_\d+_\d+\.png$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename pattern' });
      }

      const imagePath = path.join('/tmp', filename);

      if (!fsSync.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Check if file is modified since last request
      const stats = fsSync.statSync(imagePath);
      const lastModified = stats.mtime.toUTCString();
      const etag = `"${filename}-${stats.mtime.getTime()}"`;

      // Handle conditional requests
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      // Set optimized headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=7200, immutable'); // 2 hour cache
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', lastModified);
      res.setHeader('Vary', 'Accept-Encoding');

      // Send the image file
      const imageBuffer = fsSync.readFileSync(imagePath);
      res.send(imageBuffer);

      // Clean up after extended period for memory management
      setTimeout(() => {
        if (fsSync.existsSync(imagePath)) {
          fsSync.unlinkSync(imagePath);
        }
      }, 7200000); // Delete after 2 hours

    } catch (error) {
      console.error('Error serving temp image:', error);
      res.status(500).json({ error: 'Failed to serve image' });
    }
  });
}
