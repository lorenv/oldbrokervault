import { MailService } from '@sendgrid/mail';
import type { Recipient, Document } from '@shared/schema';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY not found, email functionality will be disabled");
} else {
  console.log(`[SENDGRID] API key configured: ${process.env.SENDGRID_API_KEY.substring(0, 10)}...`);
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
  console.log(`[SENDGRID] MailService initialized with API key`);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'system@cimshare.com';

export async function sendSigningInvitation(recipient: Recipient, document: Document, customBranding?: {
  companyName?: string;
  companyLogo?: string;
  primaryColor?: string;
  customFooterText?: string;
}): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[MOCK] Would send email to ${recipient.email} for document ${document.title}`);
    return true;
  }

  try {
    // Use the proper Replit domain or fall back to localhost for development
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS}` 
      : process.env.APP_URL || 'http://localhost:5000';
    
    const signingUrl = `${baseUrl}/sign/${recipient.accessToken}`;
    
    console.log(`Attempting to send email to: ${recipient.email}`);
    console.log(`From email: ${FROM_EMAIL}`);
    console.log(`Document: ${document.title}`);
    console.log(`Signing URL: ${signingUrl}`);
    
    // Use custom branding or defaults
    const brandingData = {
      companyName: customBranding?.companyName || 'Undersigned',
      companyLogo: customBranding?.companyLogo,
      primaryColor: customBranding?.primaryColor || '#2563eb',
      customFooterText: customBranding?.customFooterText || 'Powered by Undersigned'
    };

    // Build logo HTML if available
    const logoHtml = brandingData.companyLogo ? `
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${brandingData.companyLogo}" alt="${brandingData.companyName}" style="max-height: 60px; max-width: 200px;" />
      </div>
    ` : '';

    // Different email content for CC recipients vs signers
    const isCCRecipient = recipient.role === 'cc';
    
    const emailContent = {
      to: recipient.email,
      from: FROM_EMAIL,
      subject: isCCRecipient 
        ? `${brandingData.companyName}: You've been copied on ${document.title}`
        : `${brandingData.companyName}: Please sign ${document.title}`,
      html: isCCRecipient ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <!-- Header with branding -->
          <div style="background-color: ${brandingData.primaryColor}; color: white; padding: 20px; text-align: center;">
            ${logoHtml}
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Document Copy Notification</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">from ${brandingData.companyName}</p>
          </div>
          
          <!-- Main content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello ${recipient.fullName},</p>
            
            <div style="background-color: #e0f2fe; border: 1px solid #0284c7; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h3 style="margin: 0 0 10px 0; color: #0c4a6e; font-size: 18px;">📋 You've been copied on this e-signature request</h3>
              <p style="margin: 0; color: #0369a1; font-size: 16px; font-weight: 500;">No action is needed from you.</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
              This is for your reference regarding the document "<strong>${document.title}</strong>".
            </p>
            
            <!-- Document info box -->
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid ${brandingData.primaryColor};">
              <p style="margin: 0; font-weight: 600; color: #1f2937;">Document Details</p>
              <p style="margin: 8px 0 0 0; color: #6b7280;"><strong>Title:</strong> ${document.title}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280;"><strong>Pages:</strong> ${document.pageCount}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280;"><strong>Your Role:</strong> Copy Recipient (No signature required)</p>
            </div>
            
            <!-- View Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signingUrl}" 
                 style="background-color: #6b7280; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                View Document
              </a>
            </div>
            
            <div style="background-color: #f0f9ff; border: 1px solid #0284c7; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #0c4a6e;">
                ℹ️ <strong>For Reference Only:</strong> You can view this document but no signature is required from you.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
              If you have any questions about this document, please contact ${brandingData.companyName} directly.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px; text-align: center;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              ${brandingData.customFooterText}
            </p>
            <p style="color: #9ca3af; font-size: 11px; margin: 10px 0 0 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      ` : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <!-- Header with branding -->
          <div style="background-color: ${brandingData.primaryColor}; color: white; padding: 20px; text-align: center;">
            ${logoHtml}
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Document Signature Request</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">from ${brandingData.companyName}</p>
          </div>
          
          <!-- Main content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello ${recipient.fullName},</p>
            
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
              You have been requested to review and sign the document "<strong>${document.title}</strong>".
            </p>
            
            <!-- Document info box -->
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid ${brandingData.primaryColor};">
              <p style="margin: 0; font-weight: 600; color: #1f2937;">Document Details</p>
              <p style="margin: 8px 0 0 0; color: #6b7280;"><strong>Title:</strong> ${document.title}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280;"><strong>Pages:</strong> ${document.pageCount}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280;"><strong>Recipient:</strong> ${recipient.fullName}</p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signingUrl}" 
                 style="background-color: ${brandingData.primaryColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                Sign Document Now
              </a>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                🔒 <strong>Secure Signing:</strong> This link is unique to you and expires after signing. Do not share with others.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
              If you have any questions about this document, please contact ${brandingData.companyName} directly.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px; text-align: center;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              ${brandingData.customFooterText}
            </p>
            <p style="color: #9ca3af; font-size: 11px; margin: 10px 0 0 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    };

    await mailService.send(emailContent);
    console.log(`✓ ${isCCRecipient ? 'CC notification' : 'Signing invitation'} sent successfully to ${recipient.email}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send signing invitation:', error);
    
    // Provide more specific error information
    if (error.code === 403) {
      console.error(`❌ SendGrid 403 Forbidden Error:`);
      console.error(`   - API Key might be invalid or lacking permissions`);
      console.error(`   - Sender email (${FROM_EMAIL}) might not be verified in SendGrid`);
      console.error(`   - Check SendGrid dashboard for sender authentication`);
      
      if (error.response?.body?.errors) {
        console.error(`   - SendGrid errors:`, JSON.stringify(error.response.body.errors, null, 2));
      }
    }
    
    return false;
  }
}

interface EmailAttachment {
  filename: string;
  content: string;
  type: string;
  disposition?: string;
}

export async function sendCompletionNotification(
  recipients: string[], 
  document: Document, 
  attachment?: EmailAttachment,
  customBranding?: {
    companyName?: string;
    companyLogo?: string;
    primaryColor?: string;
    customFooterText?: string;
  }
): Promise<boolean> {
  console.log(`[SENDGRID] 📧 sendCompletionNotification called`);
  console.log(`[SENDGRID] Recipients: ${recipients.join(', ')}`);
  console.log(`[SENDGRID] Document: ${document.title}`);
  console.log(`[SENDGRID] Custom branding:`, customBranding);

  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[MOCK] Would send completion notification to ${recipients.join(', ')} for document ${document.title}`);
    return true;
  }

  try {
    // Use custom branding or defaults
    const brandingData = {
      companyName: customBranding?.companyName || 'Undersigned',
      companyLogo: customBranding?.companyLogo,
      primaryColor: customBranding?.primaryColor || '#16a34a',
      customFooterText: customBranding?.customFooterText || 'Powered by Undersigned'
    };

    // Build logo HTML if available
    const logoHtml = brandingData.companyLogo ? `
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${brandingData.companyLogo}" alt="${brandingData.companyName}" style="max-height: 60px; max-width: 200px;" />
      </div>
    ` : '';
    
    // Prepare email content
    const emailContent: any = {
      to: recipients,
      from: FROM_EMAIL,
      subject: `${brandingData.companyName}: Document completed - ${document.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <!-- Header with branding -->
          <div style="background-color: ${brandingData.primaryColor}; color: white; padding: 20px; text-align: center;">
            ${logoHtml}
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Document Signing Complete</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">from ${brandingData.companyName}</p>
          </div>
          
          <!-- Main content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Great news!</p>
            
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
              The document "<strong>${document.title}</strong>" has been signed by all recipients and is now complete.
            </p>
            
            <!-- Document info box -->
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid ${brandingData.primaryColor};">
              <p style="margin: 0; font-weight: 600; color: #1f2937;">Completion Summary</p>
              <p style="margin: 8px 0 0 0; color: #16a34a;"><strong>Document:</strong> ${document.title}</p>
              <p style="margin: 5px 0 0 0; color: #16a34a;"><strong>Completed:</strong> ${new Date().toLocaleDateString()}</p>
              <p style="margin: 5px 0 0 0; color: #16a34a;"><strong>Total Pages:</strong> ${document.pageCount}</p>
            </div>

            ${attachment ? `
            <!-- Attachment notice -->
            <div style="background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; font-weight: 600; color: #1f2937;">📎 Completed Document Attached</p>
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                The completed document with Certificate of Completion is attached to this email for your records.
              </p>
            </div>
            ` : ''}
            
            <!-- Next steps -->
            <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 15px 0; font-weight: 600; color: #1f2937;">📄 Legal Record:</p>
              <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
                <li style="margin-bottom: 8px;">All signatures have been legally captured with full audit trail</li>
                <li style="margin-bottom: 8px;">Timestamps, IP addresses, and user agent data recorded</li>
                <li style="margin-bottom: 8px;">Certificate of Completion generated for legal compliance</li>
                <li>Document is legally binding and admissible in court</li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
              This completed document and certificate should be retained for your legal records.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px; text-align: center;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              ${brandingData.customFooterText}
            </p>
            <p style="color: #9ca3af; font-size: 11px; margin: 10px 0 0 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    };

    // Add attachment if provided
    if (attachment) {
      emailContent.attachments = [{
        filename: attachment.filename,
        content: attachment.content,
        type: attachment.type,
        disposition: attachment.disposition || 'attachment'
      }];
    }

    await mailService.send(emailContent);
    console.log(`✓ Completion notification sent to ${recipients.length} recipient(s): ${recipients.join(', ')}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send completion notification:', error);
    
    // Provide more specific error information
    if (error.code === 403) {
      console.error(`❌ SendGrid 403 Forbidden Error:`);
      console.error(`   - API Key might be invalid or lacking permissions`);
      console.error(`   - Sender email (${FROM_EMAIL}) might not be verified in SendGrid`);
      
      if (error.response?.body?.errors) {
        console.error(`   - SendGrid errors:`, JSON.stringify(error.response.body.errors, null, 2));
      }
    }
    
    return false;
  }
}
