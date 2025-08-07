import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { processDocument, getDocumentImage, getTemplateImage } from "./services/documentProcessor";
import { sendSigningInvitation, sendCompletionNotification } from "./services/sendgrid";
import { generateCertificateOfCompletion } from "./services/certificateGenerator";
import { generateSignedDocumentPDF } from "./services/signedDocumentPdfGenerator";
import { backupService, backupScheduler } from "./services/backupService";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { promises as fs } from 'fs';
import path from 'path';
import { 
  insertDocumentSchema, 
  insertRecipientSchema, 
  insertSignatureFieldSchema,
  insertAuditTrailSchema 
} from "@shared/schema";
import { z } from "zod";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for large documents
});

// Helper function to send completion emails to all parties
async function sendCompletionEmails(
  document: any, 
  recipients: any[], 
  auditTrail: any[], 
  completedAt: Date
): Promise<void> {
  console.log('🚀 [EMAIL] Starting completion email process...');
  console.log(`[EMAIL] Document: ${document.title} (ID: ${document.id})`);
  console.log(`[EMAIL] Recipients: ${recipients.length} total`);
  
  try {
    // Collect all email addresses (recipients + document owner if different)
    const emailAddresses = recipients.map(r => r.email);
    console.log(`[EMAIL] Email addresses to notify:`, emailAddresses);
    
    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.error('[EMAIL] ❌ SENDGRID_API_KEY not configured - completion emails cannot be sent');
      return;
    }
    console.log('[EMAIL] ✅ SendGrid API key is configured');
    console.log(`[EMAIL] API key starts with: ${process.env.SENDGRID_API_KEY.substring(0, 10)}...`);
    
    console.log('[EMAIL] 📄 Generating signed document PDF...');
    // Generate complete PDF with signed document + certificate
    const { generateSignedDocumentPDF } = await import('./services/signedDocumentPdfGenerator');
    
    try {
      const pdfData = await generateSignedDocumentPDF({
        document,
        recipients,
        auditTrail,
        completedAt
      });
      
      if (!pdfData || !pdfData.content) {
        throw new Error('PDF generation returned empty or invalid data');
      }
      
      console.log(`[EMAIL] ✅ PDF generated successfully: ${pdfData.filename} (${pdfData.content.length} chars base64)`);
    } catch (pdfError) {
      const error = pdfError as Error;
      console.error('[EMAIL] ❌ Critical PDF generation failure:', {
        error: error.message,
        documentId: document.id,
        documentTitle: document.title,
        pageCount: document.pageCount,
        stack: error.stack
      });
      throw new Error(`PDF generation failed for document "${document.title}": ${error.message}`);
    }
    
    const pdfData = await generateSignedDocumentPDF({
      document,
      recipients,
      auditTrail,
      completedAt
    });
    
    const attachment = {
      filename: pdfData.filename,
      content: pdfData.content,
      type: pdfData.type
    };
    console.log(`[EMAIL] ✅ PDF attachment generated: ${attachment.filename}`);

    console.log('[EMAIL] 📧 Sending completion notification emails...');
    
    // Load user's custom branding settings from document owner
    let customBranding: any = {
      companyName: 'Undersigned',
      primaryColor: '#2563eb',
      customFooterText: 'Powered by Undersigned'
    };
    
    console.log(`[EMAIL] 🔍 Document owner ID: ${document.createdById}`);
    
    try {
      // Get the document owner's settings (document.createdById contains the owner's user ID)
      const ownerUser = await storage.getUser(document.createdById);
      
      if (ownerUser) {
        const settingsPath = path.join('uploads', `user-${ownerUser.id}-settings.json`);
        console.log(`[EMAIL] 📁 Looking for settings file: ${settingsPath}`);
        const settingsData = await fs.readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(settingsData);
        console.log(`[EMAIL] 📋 Raw settings loaded:`, settings);
        
        // Convert relative logo path to absolute URL for emails
        const logoUrl = settings.companyLogo 
          ? `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000'}${settings.companyLogo}`
          : undefined;
        
        customBranding = {
          companyName: settings.companyName || customBranding.companyName,
          companyLogo: logoUrl,
          primaryColor: settings.primaryColor || customBranding.primaryColor,
          customFooterText: settings.customFooterText || customBranding.customFooterText
        };
        console.log(`[EMAIL] ✅ Final custom branding for user ${ownerUser.id}:`, customBranding);
      } else {
        console.log(`[EMAIL] ⚠️ Document owner not found for user ID: ${document.createdById}`);
      }
    } catch (error: any) {
      console.log(`[EMAIL] Using default branding settings (custom branding load failed: ${error.message})`);
    }
    
    // Send completion notification with attachment to all parties
    await sendCompletionNotification(
      emailAddresses,
      document,
      attachment,
      customBranding
    );

    console.log(`[EMAIL] ✅ Completion emails sent successfully to ${emailAddresses.length} recipients`);
  } catch (error: any) {
    console.error('[EMAIL] ❌ Failed to send completion emails:', error);
    console.error('[EMAIL] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    // Don't throw - email failure shouldn't break the signing process
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, fullName } = req.body;
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email already exists (if provided)
      if (email) {
        const existingEmailUser = await storage.getUserByEmail(email);
        if (existingEmailUser) {
          return res.status(400).json({ message: "Email already exists" });
        }
      }

      // Create user
      const user = await storage.createUser({
        username,
        email,
        fullName: fullName || username, // Use provided fullName or fallback to username
        password // Note: In production, hash the password
      });

      // Remove password from response
      const { password: _, ...userResponse } = user;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Set session
      (req as any).session.userId = user.id;
      
      // Remove password from response
      const { password: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      (req as any).session.destroy((err: any) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  app.get("/api/user", async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Remove password from response
      const { password: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Middleware to check authentication for protected routes
  const requireAuth = (req: any, res: any, next: any) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    req.userId = userId;
    next();
  };
  
  // Document upload and processing
  app.post("/api/documents/upload", requireAuth, upload.single("document"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Document title is required" });
      }

      const userId = req.userId; // From requireAuth middleware

      // Create document record first
      const document = await storage.createDocument({
        title,
        originalFileName: req.file.originalname,
        fileType: req.file.mimetype,
        pageCount: 0, // temporary, will be updated
        imageUrls: [], // temporary, will be updated
        createdById: userId,
        status: "draft"
      });

      // Process the document (convert to images) with the document ID
      const { pageCount, imageUrls, fileStorageUrl } = await processDocument(req.file, document.id);

      // Update document with processing results
      await storage.updateDocumentImages(document.id, imageUrls);
      await storage.updateDocumentPageCount(document.id, pageCount);
      await storage.updateDocumentFileStorage(document.id, fileStorageUrl);

      // Add audit trail entry
      await storage.addAuditEntry({
        documentId: document.id,
        action: "created",
        performedBy: `user_${userId}`,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "",
        details: { fileName: req.file.originalname, fileSize: req.file.size }
      });

      res.json(document);
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Get documents for user - optimized for list view
  app.get("/api/documents", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const startTime = Date.now();
      
      // Use optimized method that excludes large fileContent field
      const documents = await storage.getDocumentListByUser(userId);
      
      const duration = Date.now() - startTime;
      console.log(`[DOCUMENT_LIST] Loaded ${documents.length} documents in ${duration}ms (optimized query)`);
      
      res.json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Serve document images
  app.get("/api/documents/:id/image/:page", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const pageNumber = parseInt(req.params.page);
      const userId = req.userId;
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Security check: Only allow access if user owns the document
      if (document.createdById !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get image from object storage only
      try {
        const imageBuffer = await getDocumentImage(documentId, pageNumber);
        
        if (imageBuffer) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
          res.send(imageBuffer);
          return;
        }
        
        res.status(404).json({ message: "Document image not found" });
      } catch (imageError: any) {
        // Provide detailed error information for debugging
        console.error(`Document image retrieval error: ${imageError.message}`);
        res.status(500).json({ 
          message: "Failed to retrieve document image from storage",
          error: imageError.message,
          documentId,
          pageNumber
        });
      }
    } catch (error) {
      console.error("Serve document image error:", error);
      res.status(500).json({ message: "Failed to serve document image" });
    }
  });

  // Get specific document with recipients and fields
  app.get("/api/documents/:id", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.userId;
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Security check: Only allow access if user owns the document
      if (document.createdById !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const recipients = await storage.getRecipientsByDocument(documentId);
      const fields = await storage.getFieldsByDocument(documentId);

      res.json({ document, recipients, fields });
    } catch (error) {
      console.error("Get document error:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // Add recipient to document
  app.post("/api/documents/:id/recipients", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.userId;

      // Security check: Only allow adding recipients if user owns the document
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (document.createdById !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const recipientData = insertRecipientSchema.parse({
        ...req.body,
        documentId
      });

      const recipient = await storage.createRecipient(recipientData);
      res.json(recipient);
    } catch (error) {
      console.error("Add recipient error:", error);
      res.status(500).json({ message: "Failed to add recipient" });
    }
  });

  // Add signature field to document
  app.post("/api/documents/:id/fields", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.userId;

      // Security check: Only allow adding fields if user owns the document
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (document.createdById !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const fieldData = insertSignatureFieldSchema.parse({
        ...req.body,
        documentId
      });

      const field = await storage.createSignatureField(fieldData);
      res.json(field);
    } catch (error) {
      console.error("Add field error:", error);
      res.status(500).json({ message: "Failed to add signature field" });
    }
  });

  // Update recipient
  app.patch("/api/recipients/:id", requireAuth, async (req: any, res) => {
    try {
      const recipientId = parseInt(req.params.id);
      const updates = req.body;

      await storage.updateRecipient(recipientId, updates);
      
      res.json({ message: "Recipient updated successfully" });
    } catch (error) {
      console.error("Update recipient error:", error);
      res.status(500).json({ message: "Failed to update recipient" });
    }
  });

  // Delete recipient
  app.delete("/api/recipients/:id", requireAuth, async (req: any, res) => {
    try {
      const recipientId = parseInt(req.params.id);

      await storage.deleteRecipient(recipientId);
      
      res.json({ message: "Recipient deleted successfully" });
    } catch (error) {
      console.error("Delete recipient error:", error);
      res.status(500).json({ message: "Failed to delete recipient" });
    }
  });

  // Update signature field
  app.patch("/api/fields/:id", requireAuth, async (req: any, res) => {
    try {
      const fieldId = parseInt(req.params.id);
      const userId = req.userId;
      const updates = req.body;

      // Security check: Get field to verify document ownership
      const fields = await storage.getFieldsByDocument(0); // This is inefficient, need better method
      // Alternative: Need to add method to get field with document info
      // For now, get all fields for all user documents and find the field
      const userDocuments = await storage.getDocumentsByUser(userId);
      let hasAccess = false;
      
      for (const doc of userDocuments) {
        const docFields = await storage.getFieldsByDocument(doc.id);
        if (docFields.some(f => f.id === fieldId)) {
          hasAccess = true;
          break;
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Handle different types of updates
      if (updates.value !== undefined) {
        await storage.updateFieldValue(fieldId, updates.value);
      }
      
      if (updates.x !== undefined || updates.y !== undefined) {
        await storage.updateFieldPosition(fieldId, updates.x, updates.y);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Update field error:", error);
      res.status(500).json({ message: "Failed to update field" });
    }
  });

  // Delete signature field
  app.delete("/api/fields/:id", requireAuth, async (req: any, res) => {
    try {
      const fieldId = parseInt(req.params.id);
      const userId = req.userId;

      // Security check: Verify user owns the document containing this field
      const userDocuments = await storage.getDocumentsByUser(userId);
      let hasAccess = false;
      
      for (const doc of userDocuments) {
        const docFields = await storage.getFieldsByDocument(doc.id);
        if (docFields.some(f => f.id === fieldId)) {
          hasAccess = true;
          break;
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteSignatureField(fieldId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete field error:", error);
      res.status(500).json({ message: "Failed to delete field" });
    }
  });

  // Send document for signing
  app.post("/api/documents/:id/send", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.userId;
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Security check: Only allow sending if user owns the document
      if (document.createdById !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const recipients = await storage.getRecipientsByDocument(documentId);
      
      // Load user's custom branding settings from their profile
      let customBranding: any = {
        companyName: 'Undersigned',
        primaryColor: '#2563eb',
        customFooterText: 'Powered by Undersigned'
      };
      
      try {
        const settingsPath = path.join('uploads', `user-${userId}-settings.json`);
        const settingsData = await fs.readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(settingsData);
        
        // Convert relative logo path to absolute URL for emails
        const logoUrl = settings.companyLogo 
          ? `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000'}${settings.companyLogo}`
          : undefined;
        
        customBranding = {
          companyName: settings.companyName || customBranding.companyName,
          companyLogo: logoUrl,
          primaryColor: settings.primaryColor || customBranding.primaryColor,
          customFooterText: settings.customFooterText || customBranding.customFooterText
        };
        console.log(`[SEND] ✅ Loaded custom branding for user ${userId}:`, customBranding);
      } catch (error) {
        console.log(`[SEND] ⚠️ Could not load custom branding for user ${userId}, using defaults`);
      }
      
      // Send emails to all recipients with custom branding
      for (const recipient of recipients) {
        await sendSigningInvitation(recipient, document, customBranding);
      }

      // Update document status
      await storage.updateDocumentStatus(documentId, "sent");

      // Add audit trail entry
      await storage.addAuditEntry({
        documentId,
        action: "sent",
        performedBy: `user_${document.createdById}`,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "",
        details: { recipientCount: recipients.length }
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Send document error:", error);
      res.status(500).json({ message: "Failed to send document" });
    }
  });

  // Signing interface - get document by token
  app.get("/api/sign/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const recipient = await storage.getRecipientByToken(token);
      if (!recipient) {
        return res.status(404).json({ message: "Invalid signing link" });
      }

      const document = await storage.getDocument(recipient.documentId);
      const fields = await storage.getFieldsByRecipient(recipient.id);

      // Add audit trail entry
      await storage.addAuditEntry({
        documentId: recipient.documentId,
        action: "opened",
        performedBy: recipient.email,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || ""
      });

      res.json({ document, recipient, fields });
    } catch (error) {
      console.error("Get signing document error:", error);
      res.status(500).json({ message: "Failed to fetch signing document" });
    }
  });

  // Complete signing
  app.post("/api/sign/:token/complete", async (req, res) => {
    try {
      const { token } = req.params;
      const { signatures } = req.body;

      const recipient = await storage.getRecipientByToken(token);
      if (!recipient) {
        return res.status(404).json({ message: "Invalid signing link" });
      }

      // Update field values with signatures
      for (const signature of signatures) {
        await storage.updateFieldValue(signature.fieldId, signature.value);
      }

      // Update recipient status
      await storage.updateRecipientStatus(recipient.id, "signed");

      // Add audit trail entry
      await storage.addAuditEntry({
        documentId: recipient.documentId,
        action: "signed",
        performedBy: recipient.email,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "",
        details: { signatureCount: signatures.length }
      });

      // Check if all SIGNER recipients have signed (exclude CC recipients)
      const allRecipients = await storage.getRecipientsByDocument(recipient.documentId);
      const signerRecipients = allRecipients.filter(r => r.role === 'signer');
      const allSignersSigned = signerRecipients.every(r => r.status === "signed");
      
      console.log(`🔍 [COMPLETION] Document ${recipient.documentId} completion check:`);
      console.log(`[COMPLETION] Total recipients: ${allRecipients.length}`);
      console.log(`[COMPLETION] Signer recipients: ${signerRecipients.length}`);
      console.log(`[COMPLETION] All signers signed: ${allSignersSigned}`);
      console.log(`[COMPLETION] Recipient statuses:`, allRecipients.map(r => ({ email: r.email, role: r.role, status: r.status })));
      
      if (allSignersSigned) {
        console.log(`🎉 [COMPLETION] Document ${recipient.documentId} is fully signed by all signers! Starting completion process...`);
        const completedAt = new Date();
        
        // Update document status
        await storage.updateDocumentStatus(recipient.documentId, "completed");
        console.log(`[COMPLETION] ✅ Document status updated to 'completed'`);
        
        // Add completion audit entry
        await storage.addAuditEntry({
          documentId: recipient.documentId,
          action: "completed",
          performedBy: "system",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
          details: { completedAt: completedAt.toISOString() }
        });
        console.log(`[COMPLETION] ✅ Completion audit entry added`);
        
        // Generate Certificate of Completion and send completion emails
        try {
          console.log(`[COMPLETION] 🎓 Starting certificate generation and email process...`);
          const document = await storage.getDocument(recipient.documentId);
          const auditTrail = await storage.getAuditTrail(recipient.documentId);
          
          if (document) {
            console.log(`[COMPLETION] 📜 Certificate will be generated for email attachment only...`);
            
            // Add audit entry for completion
            await storage.addAuditEntry({
              documentId: recipient.documentId,
              action: "completion_process_started",
              performedBy: "system",
              ipAddress: req.ip,
              userAgent: req.get("User-Agent") || "",
              details: { completedAt: completedAt.toISOString() }
            });
            console.log(`[COMPLETION] ✅ Completion audit entry added`);

            // Send completion notification emails with document attachment
            // Certificate will be generated as part of the PDF attachment process
            console.log(`[COMPLETION] 📧 Starting completion email process...`);
            await sendCompletionEmails(document, allRecipients, auditTrail, completedAt);
            console.log(`[COMPLETION] ✅ Completion email process finished`);
          } else {
            console.error(`[COMPLETION] ❌ Could not find document ${recipient.documentId} for completion process`);
          }
        } catch (certificateError) {
          const error = certificateError as Error;
          console.error("[COMPLETION] ❌ Critical failure in document completion process:", error);
          console.error("[COMPLETION] Error details:", {
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace',
            documentId: recipient.documentId,
            documentTitle: document?.title || 'Unknown',
            timestamp: new Date().toISOString()
          });
          
          // Log specific error information for debugging
          if (error.message?.includes('object storage')) {
            console.error("[COMPLETION] ❌ Object storage issue detected - document images may be missing");
          }
          if (error.message?.includes('PDF')) {
            console.error("[COMPLETION] ❌ PDF generation failed - check document processing");
          }
          if (error.message?.includes('SendGrid')) {
            console.error("[COMPLETION] ❌ Email delivery failed - check SendGrid configuration");
          }
          
          // Fail the signing process if certificate generation fails - no silent failures
          throw new Error(`Document completion failed: ${error.message}`);
        }
      }

      res.json({ success: true, completed: allSignersSigned });
    } catch (error) {
      console.error("Complete signing error:", error);
      res.status(500).json({ message: "Failed to complete signing" });
    }
  });

  // Get audit trail
  app.get("/api/documents/:id/audit", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const auditTrail = await storage.getAuditTrail(documentId);
      res.json(auditTrail);
    } catch (error) {
      console.error("Get audit trail error:", error);
      res.status(500).json({ message: "Failed to fetch audit trail" });
    }
  });

  // Template routes - optimized for list view
  app.get("/api/templates", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const startTime = Date.now();
      
      // Use optimized method that excludes large fileContent field at database level
      const templates = await storage.getTemplateListByUser(userId);
      
      const duration = Date.now() - startTime;
      console.log(`[TEMPLATE_LIST] Loaded ${templates.length} templates in ${duration}ms (ultra-light query - no fileContent/imageUrls)`);
      
      res.json(templates);
    } catch (error) {
      console.error("Get templates error:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const template = await storage.getTemplate(templateId);
      const fields = await storage.getTemplateFields(templateId);
      const recipients = await storage.getTemplateRecipients(templateId);
      
      if (!template) {
        res.status(404).json({ message: "Template not found" });
        return;
      }

      res.json({
        template,
        fields,
        roles: recipients.map(recipient => ({
          id: recipient.id,
          name: recipient.name,
          title: recipient.title,
          role: recipient.role,
          signingOrder: recipient.signingOrder,
          placeholderEmail: recipient.placeholderEmail
        }))
      });
    } catch (error) {
      console.error("Get template error:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", requireAuth, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.userId;

      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const { title, description } = req.body;
      
      // Create template record first to get the ID
      const createdTemplate = await storage.createTemplate({
        title,
        description,
        category: "template", // Default category
        originalFileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileContent: undefined, // New templates use object storage only
        pageCount: 0, // Will be updated after processing
        imageUrls: [], // Will be updated after processing
        createdById: userId,
      });

      // Process the document to get images (use template ID)
      const { pageCount, imageUrls, fileStorageUrl } = await processDocument(req.file, createdTemplate.id, true);

      // Update template with processed data
      await storage.updateTemplate(createdTemplate.id, {
        pageCount: pageCount,
        imageUrls: imageUrls,
        fileStorageUrl: fileStorageUrl
      });

      // Template images are already stored during processDocument
      // No need to store them again here

      // Return template only (no document navigation)
      res.json({ 
        template: createdTemplate,
        message: "Template created successfully" 
      });
    } catch (error) {
      console.error("Create template error:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.post("/api/templates/:id/fields", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const fieldData = req.body;
      
      const field = await storage.createTemplateField({
        templateId,
        ...fieldData
      });
      
      res.json(field);
    } catch (error) {
      console.error("Create template field error:", error);
      res.status(500).json({ message: "Failed to create template field" });
    }
  });

  app.patch("/api/template-fields/:id", async (req, res) => {
    try {
      const fieldId = parseInt(req.params.id);
      const updates = req.body;
      
      await storage.updateTemplateField(fieldId, updates);
      
      res.json({ message: "Template field updated successfully" });
    } catch (error) {
      console.error("Update template field error:", error);
      res.status(500).json({ message: "Failed to update template field" });
    }
  });

  app.delete("/api/template-fields/:id", async (req, res) => {
    try {
      const fieldId = parseInt(req.params.id);
      
      await storage.deleteTemplateField(fieldId);
      
      res.json({ message: "Template field deleted successfully" });
    } catch (error) {
      console.error("Delete template field error:", error);
      res.status(500).json({ message: "Failed to delete template field" });
    }
  });

  // Template recipient routes
  app.post("/api/templates/:id/recipients", requireAuth, async (req: any, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const userId = req.userId;

      // Security check: Only allow adding recipients if user owns the template
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (template.createdById !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const recipientData = {
        templateId,
        name: req.body.fullName || req.body.name,
        title: req.body.title || "",
        role: req.body.role,
        signingOrder: req.body.signingOrder,
        placeholderEmail: req.body.email || req.body.placeholderEmail || "",
      };

      const recipient = await storage.createTemplateRecipient(recipientData);
      res.json(recipient);
    } catch (error) {
      console.error("Add template recipient error:", error);
      res.status(500).json({ message: "Failed to add template recipient" });
    }
  });

  app.delete("/api/template-recipients/:id", requireAuth, async (req: any, res) => {
    try {
      const recipientId = parseInt(req.params.id);
      
      await storage.deleteTemplateRecipient(recipientId);
      
      res.json({ message: "Template recipient deleted successfully" });
    } catch (error) {
      console.error("Delete template recipient error:", error);
      res.status(500).json({ message: "Failed to delete template recipient" });
    }
  });

  app.patch("/api/template-recipients/:id", requireAuth, async (req: any, res) => {
    try {
      const recipientId = parseInt(req.params.id);
      const updates = req.body;

      await storage.updateTemplateRecipient(recipientId, updates);
      
      res.json({ message: "Template recipient updated successfully" });
    } catch (error) {
      console.error("Update template recipient error:", error);
      res.status(500).json({ message: "Failed to update template recipient" });
    }
  });

  // Add template image serving route
  app.get("/api/templates/:id/image/:page", requireAuth, async (req: any, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const pageNumber = parseInt(req.params.page);
      const userId = req.userId;
      
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Security check: Only allow access if user owns the template
      if (template.createdById !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get image from object storage only
      try {
        const imageBuffer = await getTemplateImage(templateId, pageNumber);
        
        if (imageBuffer) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
          res.send(imageBuffer);
          return;
        }
        
        res.status(404).json({ message: "Template image not found" });
      } catch (imageError: any) {
        // Provide detailed error information for debugging
        console.error(`Template image retrieval error: ${imageError.message}`);
        res.status(500).json({ 
          message: "Failed to retrieve template image from storage",
          error: imageError.message,
          templateId,
          pageNumber
        });
      }
    } catch (error) {
      console.error("Serve template image error:", error);
      res.status(500).json({ message: "Failed to serve template image" });
    }
  });

  app.post("/api/templates/:id/use", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const templateId = parseInt(req.params.id);
      const { title } = req.body;
      
      const document = await storage.createDocumentFromTemplate(templateId, userId, title);
      
      res.json(document);
    } catch (error) {
      console.error("Use template error:", error);
      res.status(500).json({ message: "Failed to create document from template" });
    }
  });

  app.delete("/api/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const templateId = parseInt(req.params.id);
      
      // Verify user owns the template
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      if (template.createdById !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this template" });
      }
      
      await storage.deleteTemplate(templateId);
      
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Delete template error:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Test endpoint to debug completion functionality
  app.post("/api/test-completion/:documentId", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const recipients = await storage.getRecipientsByDocument(documentId);
      const auditTrail = await storage.getAuditTrail(documentId);
      
      console.log(`[TEST] Testing completion for document: ${documentId}`);
      console.log(`[TEST] Document owner ID: ${document.createdById}`);
      
      await sendCompletionEmails(document, recipients, auditTrail, new Date());
      
      res.json({ success: true, message: 'Test completion email sent', documentId });
    } catch (error: any) {
      console.error('[TEST] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Logo upload endpoint
  app.post("/api/upload-logo", upload.single("logo"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: "No logo file uploaded" });
        return;
      }

      // Save logo to uploads directory with a unique name
      const fs = await import('fs');
      const path = await import('path');
      
      const logoId = `logo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${logoId}${fileExtension}`;
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      
      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Write file to disk
      fs.writeFileSync(filePath, req.file.buffer);
      
      const logoUrl = `/uploads/${fileName}`;
      
      res.json({ 
        message: "Logo uploaded successfully", 
        logoUrl: logoUrl
      });
    } catch (error) {
      console.error("Logo upload error:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Settings routes
  app.post("/api/settings", requireAuth, async (req: any, res) => {
    try {
      const settings = req.body;
      const userId = req.userId;
      console.log(`[SETTINGS] 💾 Saving settings for user ${userId}:`);
      console.log(`[SETTINGS] Company Name: ${settings.companyName}`);
      console.log(`[SETTINGS] Primary Color: ${settings.primaryColor}`);
      console.log(`[SETTINGS] Footer Text: ${settings.customFooterText}`);
      console.log(`[SETTINGS] Logo: ${settings.companyLogo}`);
      
      // Save settings to user-specific file
      const settingsPath = path.join('uploads', `user-${userId}-settings.json`);
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      console.log(`[SETTINGS] ✅ Settings saved to: ${settingsPath}`);
      
      res.json({ message: "Settings saved successfully", settings });
    } catch (error) {
      console.error("Settings save error:", error);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  app.get("/api/settings", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const settingsPath = path.join('uploads', `user-${userId}-settings.json`);
      
      try {
        const settingsData = await fs.readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(settingsData);
        res.json(settings);
      } catch (error) {
        // Return default settings if file doesn't exist
        const user = await storage.getUser(userId);
        const defaultSettings = {
          fullName: user?.fullName || "User",
          email: user?.email || "user@example.com",
          companyName: "Undersigned",
          primaryColor: "#2563eb",
          customFooterText: "Powered by Undersigned",
          emailNotifications: true,
          documentCompleted: true,
          reminderEmails: false,
          customEmailTemplate: true,
          brandingOnSigningPage: true
        };
        res.json(defaultSettings);
      }
    } catch (error) {
      console.error("Settings load error:", error);
      res.status(500).json({ message: "Failed to load settings" });
    }
  });

  // Get all recipients for user's documents (optimized)
  app.get("/api/recipients", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const startTime = Date.now();
      
      // Use optimized method that gets all recipients in one query
      const allRecipients = await storage.getRecipientsByUserId(userId);
      
      const duration = Date.now() - startTime;
      console.log(`[RECIPIENTS_LIST] Loaded ${allRecipients.length} recipients in ${duration}ms (optimized query)`);
      
      res.json(allRecipients);
    } catch (error) {
      console.error("Get recipients error:", error);
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });

  // Document actions
  app.delete("/api/documents/:id", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.userId;
      
      const document = await storage.getDocument(documentId);
      if (!document || document.createdById !== userId) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      await storage.deleteDocument(documentId);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.post("/api/documents/:id/void", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.userId;
      
      const document = await storage.getDocument(documentId);
      if (!document || document.createdById !== userId) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.status === "completed") {
        return res.status(400).json({ message: "Cannot void completed document" });
      }
      
      await storage.updateDocumentStatus(documentId, "cancelled");
      
      // Add audit trail entry
      await storage.addAuditEntry({
        documentId,
        action: "voided",
        details: "Document voided by owner",
        performedBy: `User ${userId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.get('User-Agent') || "unknown"
      });
      
      res.json({ message: "Document voided successfully" });
    } catch (error) {
      console.error("Void document error:", error);
      res.status(500).json({ message: "Failed to void document" });
    }
  });

  app.post("/api/documents/:id/resend", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.userId;
      
      const document = await storage.getDocument(documentId);
      if (!document || document.createdById !== userId) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.status !== "sent") {
        return res.status(400).json({ message: "Can only resend documents that are currently being signed" });
      }
      
      const recipients = await storage.getRecipientsByDocument(documentId);
      const pendingRecipients = recipients.filter(r => r.status !== "completed");
      
      // Resend emails to pending recipients
      for (const recipient of pendingRecipients) {
        try {
          await sendSigningInvitation(recipient, document);
        } catch (emailError) {
          console.error(`Failed to send email to ${recipient.email}:`, emailError);
        }
      }
      
      // Add audit trail entry
      await storage.addAuditEntry({
        documentId,
        action: "resent",
        details: `Invitations resent to ${pendingRecipients.length} recipients`,
        performedBy: `User ${userId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.get('User-Agent') || "unknown"
      });
      
      res.json({ message: "Invitations resent successfully" });
    } catch (error) {
      console.error("Resend document error:", error);
      res.status(500).json({ message: "Failed to resend invitations" });
    }
  });

  app.post("/api/documents/:id/duplicate", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.userId;
      
      const originalDocument = await storage.getDocument(documentId);
      if (!originalDocument || originalDocument.createdById !== userId) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Create duplicate document
      const duplicateDocument = await storage.createDocument({
        title: `${originalDocument.title} (Copy)`,
        originalFileName: originalDocument.originalFileName,
        fileType: originalDocument.fileType,
        pageCount: originalDocument.pageCount,
        imageUrls: originalDocument.imageUrls,
        fileContent: originalDocument.fileContent, // Copy existing base64 for legacy documents
        fileStorageUrl: originalDocument.fileStorageUrl, // Copy object storage URL if exists
        createdById: userId,
        status: "draft"
      });
      
      res.json(duplicateDocument);
    } catch (error) {
      console.error("Duplicate document error:", error);
      res.status(500).json({ message: "Failed to duplicate document" });
    }
  });

  app.get("/api/documents/:id/download", requireAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.userId;
      
      const document = await storage.getDocument(documentId);
      if (!document || document.createdById !== userId) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.status === "completed") {
        // For completed documents, generate PDF with signatures and certificate
        const recipients = await storage.getRecipientsByDocument(documentId);
        const auditTrail = await storage.getAuditTrail(documentId);
        const completedAt = new Date(auditTrail.find(entry => entry.action === "completed")?.timestamp || Date.now());
        
        const pdfData = await generateSignedDocumentPDF({
          document,
          recipients,
          auditTrail,
          completedAt
        });
        
        // Convert base64 content to buffer
        const buffer = Buffer.from(pdfData.content, 'base64');
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdfData.filename}"`);
        res.send(buffer);
      } else {
        res.status(400).json({ message: "Download only available for completed documents" });
      }
    } catch (error) {
      console.error("Download document error:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Helper function for file size formatting
  function formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Backup Management Routes
  app.post('/api/backup/create', requireAuth, async (req, res) => {
    try {
      console.log('[API] Creating manual database backup...');
      const backupPath = await backupService.createBackup();
      res.json({ 
        success: true, 
        message: 'Backup created successfully',
        backupPath: path.basename(backupPath)
      });
    } catch (error: any) {
      console.error('[API] Backup creation failed:', error.message);
      res.status(500).json({ error: 'Failed to create backup: ' + error.message });
    }
  });

  app.get('/api/backup/list', requireAuth, async (req, res) => {
    try {
      const backups = await backupService.listBackups();
      const stats = await backupService.getBackupStats();
      
      res.json({
        backups: backups.map(backup => ({
          filename: backup.filename,
          size: backup.size,
          created: backup.created,
          sizeFormatted: formatFileSize(backup.size)
        })),
        stats: {
          ...stats,
          totalSizeFormatted: formatFileSize(stats.totalSize)
        }
      });
    } catch (error: any) {
      console.error('[API] Failed to list backups:', error.message);
      res.status(500).json({ error: 'Failed to list backups: ' + error.message });
    }
  });

  app.post('/api/backup/restore', requireAuth, async (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ error: 'Backup filename is required' });
      }

      const backupPath = path.join('./backups', filename);
      await backupService.restoreBackup(backupPath);
      
      res.json({ 
        success: true, 
        message: 'Database restored successfully' 
      });
    } catch (error: any) {
      console.error('[API] Backup restore failed:', error.message);
      res.status(500).json({ error: 'Failed to restore backup: ' + error.message });
    }
  });

  app.delete('/api/backup/:filename', requireAuth, async (req, res) => {
    try {
      const { filename } = req.params;
      const backupPath = path.join('./backups', filename);
      await backupService.deleteBackup(backupPath);
      
      res.json({ 
        success: true, 
        message: 'Backup deleted successfully' 
      });
    } catch (error: any) {
      console.error('[API] Backup deletion failed:', error.message);
      res.status(500).json({ error: 'Failed to delete backup: ' + error.message });
    }
  });

  app.get('/api/backup/status', requireAuth, async (req, res) => {
    try {
      const stats = await backupService.getBackupStats();
      const isSchedulerRunning = backupScheduler.isSchedulerRunning();
      
      res.json({
        schedulerRunning: isSchedulerRunning,
        stats: {
          ...stats,
          totalSizeFormatted: formatFileSize(stats.totalSize)
        }
      });
    } catch (error: any) {
      console.error('[API] Failed to get backup status:', error.message);
      res.status(500).json({ error: 'Failed to get backup status: ' + error.message });
    }
  });

  // Auth routes
  app.post("/api/auth/logout", (req: any, res) => {
    if (req.session) {
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Logout error:", err);
          res.status(500).json({ message: "Failed to logout" });
        } else {
          res.clearCookie("connect.sid");
          res.json({ message: "Logged out successfully" });
        }
      });
    } else {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    }
  });



  // Migration API endpoints
  app.post("/api/migration/start", requireAuth, async (req: any, res) => {
    try {
      const { migrationService } = await import('./services/migrationService');
      console.log('[API] Starting object storage migration...');
      
      const progress = await migrationService.runFullMigration();
      
      res.json({
        success: true,
        message: 'Migration completed',
        progress
      });
    } catch (error) {
      console.error('Migration API error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/migration/progress", requireAuth, async (req: any, res) => {
    try {
      const { migrationService } = await import('./services/migrationService');
      const progress = await migrationService.getProgress();
      
      res.json({
        success: true,
        progress
      });
    } catch (error) {
      console.error('Migration progress API error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to get migration progress',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/migration/verify", requireAuth, async (req: any, res) => {
    try {
      const { migrationService } = await import('./services/migrationService');
      const verification = await migrationService.verifyMigration();
      
      res.json({
        success: true,
        verification
      });
    } catch (error) {
      console.error('Migration verification API error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to verify migration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Object storage routes for serving public and private files
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Legacy local storage fallback route - serves files from local storage while migrating
  app.get("/storage/:bucketName/:filePath(*)", async (req, res) => {
    const { bucketName, filePath } = req.params;
    const localPath = path.join(process.cwd(), 'storage', bucketName, filePath);
    
    try {
      await fs.access(localPath);
      res.sendFile(path.resolve(localPath));
    } catch (error) {
      console.error("Local file not found:", localPath);
      res.status(404).json({ error: "File not found" });
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  // Start automated backup scheduler
  console.log('[BACKUP] Starting automated backup scheduler...');
  backupScheduler.start(24); // Run backups every 24 hours
  
  const httpServer = createServer(app);
  return httpServer;
}
