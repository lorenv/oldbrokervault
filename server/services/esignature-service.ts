import { db } from '../db';
import { 
  ndaSigningSessions, 
  ndaRecipients, 
  ndaFieldAssignments, 
  ndaAuditLog,
  ndaTemplates,
  cimDocuments,
  insertNdaSigningSessionSchema,
  insertNdaRecipientSchema,
  insertNdaFieldAssignmentSchema,
  insertNdaAuditLogSchema,
  NdaSigningSession,
  NdaRecipient,
  NdaFieldAssignment,
  NdaAuditLog
} from '@shared/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { generateSecureToken } from '../token-utils';
import { sendEmail, sendNdaConfirmationEmail } from '../email';
import geoip from 'geoip-lite';
import { processPDFToImages, overlaySignatureFields } from './pdf-processor';
import { ObjectStorageService } from '../object-storage';

export class ESignatureService {
  // Create a new signing session
  async createSigningSession(data: {
    templateId: number;
    title: string;
    message?: string;
    recipients: Array<{
      name: string;
      email: string;
      role: 'signer' | 'cc' | 'approver';
    }>;
    fieldAssignments: Array<{
      fieldId: string;
      recipientEmail: string;
      required?: boolean;
      prefilled?: boolean;
      prefilledValue?: string;
    }>;
    createdBy: number;
    cimDocumentId?: number;
    expiresAt?: Date;
  }) {
    try {
      return await db.transaction(async (tx) => {
        // Generate unique share slug
        const shareSlug = generateSecureToken(16);

        // Create signing session
        const [session] = await tx.insert(ndaSigningSessions).values({
          templateId: data.templateId,
          title: data.title,
          message: data.message,
          createdBy: data.createdBy,
          cimDocumentId: data.cimDocumentId,
          shareSlug,
          expiresAt: data.expiresAt,
          status: 'draft',
        }).returning();

        // Create recipients with unique access tokens
        const recipients: NdaRecipient[] = [];
        for (const recipientData of data.recipients) {
          const accessToken = generateSecureToken(32);
          const [recipient] = await tx.insert(ndaRecipients).values({
            signingSessionId: session.id,
            name: recipientData.name,
            email: recipientData.email,
            role: recipientData.role,
            accessToken,
          }).returning();
          recipients.push(recipient);
        }

        // Create field assignments
        const fieldAssignments: NdaFieldAssignment[] = [];
        for (const assignment of data.fieldAssignments) {
          const recipient = recipients.find(r => r.email === assignment.recipientEmail);
          if (recipient) {
            const [fieldAssignment] = await tx.insert(ndaFieldAssignments).values({
              fieldId: assignment.fieldId,
              recipientId: recipient.id,
              signingSessionId: session.id,
              required: assignment.required ?? true,
              prefilled: assignment.prefilled ?? false,
              prefilledValue: assignment.prefilledValue,
            }).returning();
            fieldAssignments.push(fieldAssignment);
          }
        }

        // Log creation
        await this.logAuditEvent(tx, {
          signingSessionId: session.id,
          action: 'session_created',
          details: { 
            title: data.title,
            recipientCount: recipients.length,
            fieldCount: fieldAssignments.length
          },
        });

        return {
          session,
          recipients,
          fieldAssignments,
        };
      });
    } catch (error) {
      console.error('Error creating signing session:', error);
      throw new Error('Failed to create signing session');
    }
  }

  // Send document to recipients
  async sendDocument(sessionId: number, userBranding?: any) {
    try {
      const session = await db.select().from(ndaSigningSessions)
        .where(eq(ndaSigningSessions.id, sessionId))
        .limit(1);

      if (!session[0]) {
        throw new Error('Signing session not found');
      }

      const recipients = await db.select().from(ndaRecipients)
        .where(and(
          eq(ndaRecipients.signingSessionId, sessionId),
          eq(ndaRecipients.role, 'signer')
        ));

      for (const recipient of recipients) {
        const signingUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.com'}/sign/${recipient.accessToken}`;
        
        // Send signing invitation email
        await sendEmail({
          to: recipient.email,
          from: 'system@cimshare.com',
          subject: `Please sign: ${session[0].title}`,
          html: this.generateSigningEmailTemplate({
            recipientName: recipient.name,
            documentTitle: session[0].title,
            message: session[0].message || '',
            signingUrl,
            senderBranding: userBranding,
          }),
        });

        // Update recipient status
        await db.update(ndaRecipients)
          .set({ 
            status: 'sent',
            sentAt: new Date(),
          })
          .where(eq(ndaRecipients.id, recipient.id));

        // Log send event
        await this.logAuditEvent(null, {
          signingSessionId: sessionId,
          recipientId: recipient.id,
          action: 'document_sent',
          details: { 
            recipientEmail: recipient.email,
            signingUrl 
          },
        });
      }

      // Update session status
      await db.update(ndaSigningSessions)
        .set({ status: 'active' })
        .where(eq(ndaSigningSessions.id, sessionId));

      return { success: true, recipientCount: recipients.length };
    } catch (error) {
      console.error('Error sending document:', error);
      throw new Error('Failed to send document');
    }
  }

  // Get signing session with recipients and field assignments
  async getSigningSession(sessionId: number) {
    try {
      const session = await db.select().from(ndaSigningSessions)
        .where(eq(ndaSigningSessions.id, sessionId))
        .limit(1);

      if (!session[0]) {
        return null;
      }

      const recipients = await db.select().from(ndaRecipients)
        .where(eq(ndaRecipients.signingSessionId, sessionId))
        .orderBy(ndaRecipients.id);

      const fieldAssignments = await db.select().from(ndaFieldAssignments)
        .where(eq(ndaFieldAssignments.signingSessionId, sessionId))
        .orderBy(ndaFieldAssignments.id);

      return {
        session: session[0],
        recipients,
        fieldAssignments,
      };
    } catch (error) {
      console.error('Error getting signing session:', error);
      throw new Error('Failed to get signing session');
    }
  }

  // Get session by recipient access token
  async getSessionByToken(accessToken: string, ipAddress?: string, userAgent?: string) {
    try {
      const recipient = await db.select().from(ndaRecipients)
        .where(eq(ndaRecipients.accessToken, accessToken))
        .limit(1);

      if (!recipient[0]) {
        return null;
      }

      const session = await this.getSigningSession(recipient[0].signingSessionId);
      if (!session) {
        return null;
      }

      // Log access
      if (recipient[0].status === 'sent' && ipAddress) {
        const location = geoip.lookup(ipAddress);
        
        await db.update(ndaRecipients)
          .set({ 
            status: 'viewed',
            viewedAt: new Date(),
            ipAddress,
            userAgent,
            location: location ? `${location.city}, ${location.region}, ${location.country}` : undefined,
          })
          .where(eq(ndaRecipients.id, recipient[0].id));

        await this.logAuditEvent(null, {
          signingSessionId: session.session.id,
          recipientId: recipient[0].id,
          action: 'document_viewed',
          details: { ipAddress, userAgent, location: location?.country },
          ipAddress,
          userAgent,
        });
      }

      return {
        ...session,
        currentRecipient: recipient[0],
      };
    } catch (error) {
      console.error('Error getting session by token:', error);
      throw new Error('Failed to get session');
    }
  }

  // Sign field
  async signField(data: {
    accessToken: string;
    fieldId: string;
    value: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      const recipient = await db.select().from(ndaRecipients)
        .where(eq(ndaRecipients.accessToken, data.accessToken))
        .limit(1);

      if (!recipient[0]) {
        throw new Error('Invalid access token');
      }

      // Update field assignment
      await db.update(ndaFieldAssignments)
        .set({
          fieldValue: data.value,
          completed: true,
          completedAt: new Date(),
        })
        .where(and(
          eq(ndaFieldAssignments.recipientId, recipient[0].id),
          eq(ndaFieldAssignments.fieldId, data.fieldId)
        ));

      // Log field signing
      await this.logAuditEvent(null, {
        signingSessionId: recipient[0].signingSessionId,
        recipientId: recipient[0].id,
        action: 'field_signed',
        details: { 
          fieldId: data.fieldId,
          fieldType: data.value.includes('data:image') ? 'signature' : 'text'
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });

      // Check if all required fields for this recipient are complete
      const requiredFields = await db.select().from(ndaFieldAssignments)
        .where(and(
          eq(ndaFieldAssignments.recipientId, recipient[0].id),
          eq(ndaFieldAssignments.required, true)
        ));

      const completedFields = requiredFields.filter(f => f.completed);
      
      if (completedFields.length === requiredFields.length) {
        // Mark recipient as signed
        await db.update(ndaRecipients)
          .set({ 
            status: 'signed',
            signedAt: new Date(),
          })
          .where(eq(ndaRecipients.id, recipient[0].id));

        await this.logAuditEvent(null, {
          signingSessionId: recipient[0].signingSessionId,
          recipientId: recipient[0].id,
          action: 'recipient_completed',
          details: { completedFields: completedFields.length },
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });

        // Check if all signers have completed
        await this.checkSessionCompletion(recipient[0].signingSessionId);
      }

      return { success: true };
    } catch (error) {
      console.error('Error signing field:', error);
      throw new Error('Failed to sign field');
    }
  }

  // Check if signing session is complete
  async checkSessionCompletion(sessionId: number) {
    try {
      const signers = await db.select().from(ndaRecipients)
        .where(and(
          eq(ndaRecipients.signingSessionId, sessionId),
          eq(ndaRecipients.role, 'signer')
        ));

      const signedCount = signers.filter(s => s.status === 'signed').length;
      
      if (signedCount === signers.length) {
        // All signers have completed - mark session as completed
        await db.update(ndaSigningSessions)
          .set({ 
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(ndaSigningSessions.id, sessionId));

        await this.logAuditEvent(null, {
          signingSessionId: sessionId,
          action: 'session_completed',
          details: { totalSigners: signers.length },
        });

        // Send completion notifications
        await this.sendCompletionNotifications(sessionId);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking session completion:', error);
      return false;
    }
  }

  // Send completion notifications
  async sendCompletionNotifications(sessionId: number) {
    try {
      console.log('🔄 Starting completion notifications for session:', sessionId);
      const sessionData = await this.getSigningSession(sessionId);
      if (!sessionData) {
        console.error('❌ Session not found for completion notifications');
        return;
      }

      console.log('📋 Session data retrieved:', {
        title: sessionData.session.title,
        templateId: sessionData.session.templateId,
        recipientCount: sessionData.recipients.length
      });

      // Generate the final signed PDF with embedded signature fields
      const signedPdfBase64 = await this.generateSignedDocument(sessionId);
      if (!signedPdfBase64) {
        console.error('❌ Failed to generate signed PDF - sending error notification');
        // Send error notification instead of blank PDF
        await this.sendErrorNotification(sessionData);
        return;
      }

      console.log('✅ Generated signed PDF successfully, size:', signedPdfBase64.length);

      // Get all recipients (including CC)
      const allRecipients = sessionData.recipients;
      
      // Send to CC recipients and document owner with signed PDF attached
      for (const recipient of allRecipients) {
        if (recipient.role === 'cc' || recipient.role === 'signer') {
          console.log('📧 Sending completion email to:', recipient.email);
          await sendEmail({
            to: recipient.email,
            from: 'system@cimshare.com',
            subject: `Document Completed: ${sessionData.session.title}`,
            html: this.generateCompletionEmailTemplate({
              recipientName: recipient.name,
              documentTitle: sessionData.session.title,
              completedAt: sessionData.session.completedAt!,
            }),
            attachments: [{
              content: signedPdfBase64,
              filename: `signed-${sessionData.session.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
              type: 'application/pdf',
              disposition: 'attachment'
            }]
          });
          
          // Additionally send NDA confirmation email to signers
          if (recipient.role === 'signer') {
            console.log('📧 Sending NDA confirmation email to signer:', recipient.email);
            await sendNdaConfirmationEmail(
              recipient.email,
              recipient.name,
              sessionData.session.title,
              signedPdfBase64
            );
          }
        }
      }

      console.log('✅ Completion notifications sent successfully');
    } catch (error) {
      console.error('❌ Error sending completion notifications:', error);
      // Attempt to send error notification
      try {
        const sessionData = await this.getSigningSession(sessionId);
        if (sessionData) {
          await this.sendErrorNotification(sessionData);
        }
      } catch (fallbackError) {
        console.error('❌ Failed to send error notification:', fallbackError);
      }
    }
  }

  // Generate final signed document with embedded signature fields
  async generateSignedDocument(sessionId: number): Promise<string | null> {
    try {
      console.log('🔄 Generating signed document for session:', sessionId);
      
      const sessionData = await this.getSigningSession(sessionId);
      if (!sessionData) {
        console.error('❌ Session not found');
        return null;
      }

      // Get the original template
      const template = await db.select().from(ndaTemplates)
        .where(eq(ndaTemplates.id, sessionData.session.templateId))
        .limit(1);

      if (!template[0]) {
        console.error('❌ Template not found');
        return null;
      }

      console.log('📄 Template found:', template[0].name);

      // Get all field assignments with their values
      const fieldAssignments = await db.select().from(ndaFieldAssignments)
        .where(eq(ndaFieldAssignments.signingSessionId, sessionId));

      console.log('📝 Field assignments found:', fieldAssignments.length);

      // Prepare field values for PDF embedding
      const fieldValues: { [key: string]: string } = {};
      fieldAssignments.forEach(assignment => {
        if (assignment.fieldValue) {
          fieldValues[assignment.fieldId] = assignment.fieldValue;
        }
      });

      console.log('📊 Field values prepared:', Object.keys(fieldValues).length);

      // Load PDF processor with original template content
      const { PdfSignatureProcessor } = await import('../pdf-signature-processor');
      const processor = await PdfSignatureProcessor.fromBase64(template[0].fileContent);

      // Embed signature fields into the PDF
      const signatureFields = template[0].signatureFields || [];
      const signedContent = await processor.embedFields(signatureFields, fieldValues);

      // Get signer information
      const signer = sessionData.recipients.find(r => r.role === 'signer');
      const signerName = signer?.name || 'Unknown Signer';
      const signerEmail = signer?.email || 'unknown@email.com';
      const completedAt = sessionData.session.completedAt || new Date();
      
      // Get IP address from audit logs for the signer
      let signerIpAddress: string | undefined;
      try {
        if (signer) {
          const auditEntries = await db.select()
            .from(ndaAuditLog)
            .where(
              and(
                eq(ndaAuditLog.signingSessionId, sessionId),
                eq(ndaAuditLog.recipientId, signer.id),
                isNotNull(ndaAuditLog.ipAddress)
              )
            )
            .orderBy(desc(ndaAuditLog.timestamp))
            .limit(1);
          
          signerIpAddress = auditEntries[0]?.ipAddress || undefined;
        }
      } catch (error) {
        console.log('Could not retrieve IP address from audit logs:', error);
      }

      // Add completion certificate with grey header
      await processor.addCompletionCertificate(
        signerName,
        signerEmail,
        completedAt,
        signerIpAddress
      );

      // Save final PDF
      const finalPdfBase64 = await processor.saveAsBase64();
      
      console.log('✅ Signed document generated successfully');
      return finalPdfBase64;

    } catch (error) {
      console.error('❌ Error generating signed document:', error);
      return null;
    }
  }

  // Send error notification when PDF generation fails
  async sendErrorNotification(sessionData: any) {
    try {
      console.log('📧 Sending error notification for failed PDF generation');
      
      for (const recipient of sessionData.recipients) {
        if (recipient.role === 'cc' || recipient.role === 'signer') {
          await sendEmail({
            to: recipient.email,
            from: 'system@cimshare.com',
            subject: `Document Processing Error: ${sessionData.session.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                  <h2 style="color: #c33; margin: 0 0 10px 0;">Document Processing Error</h2>
                  <p>We encountered an issue while processing your signed document: <strong>${sessionData.session.title}</strong></p>
                </div>
                
                <p>Dear ${recipient.name},</p>
                
                <p>Your signature was successfully recorded, but we encountered a technical issue while generating the final signed document.</p>
                
                <p><strong>What this means:</strong></p>
                <ul>
                  <li>Your signature is valid and legally binding</li>
                  <li>The signing process was completed successfully</li>
                  <li>We are working to resolve the document generation issue</li>
                </ul>
                
                <p><strong>Next steps:</strong></p>
                <p>Our technical team has been notified and will provide you with the completed document shortly. If you need immediate assistance, please contact support.</p>
                
                <p>We apologize for any inconvenience this may cause.</p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                  This is an automated notification from our document signing system.
                </p>
              </div>
            `,
          });
        }
      }
      
      console.log('✅ Error notifications sent successfully');
    } catch (error) {
      console.error('❌ Failed to send error notifications:', error);
    }
  }

  // Log audit event
  async logAuditEvent(tx: any, data: {
    signingSessionId: number;
    recipientId?: number;
    action: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const dbToUse = tx || db;
    
    await dbToUse.insert(ndaAuditLog).values({
      signingSessionId: data.signingSessionId,
      recipientId: data.recipientId,
      action: data.action,
      details: data.details || {},
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  }

  // Generate signing email template
  private generateSigningEmailTemplate(data: {
    recipientName: string;
    documentTitle: string;
    message?: string;
    signingUrl: string;
    senderBranding?: any;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
          .content { padding: 20px 0; }
          .button { 
            display: inline-block; 
            background: #007bff; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { font-size: 12px; color: #666; text-align: center; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${data.senderBranding?.businessName ? `<h2>${data.senderBranding.businessName}</h2>` : ''}
            <h1>Document Ready for Signature</h1>
          </div>
          
          <div class="content">
            <p>Dear ${data.recipientName},</p>
            
            <p>You have been requested to sign the following document:</p>
            <h3>${data.documentTitle}</h3>
            
            ${data.message ? `<p><em>${data.message}</em></p>` : ''}
            
            <p>Please click the button below to review and sign the document:</p>
            
            <div style="text-align: center;">
              <a href="${data.signingUrl}" class="button">Review & Sign Document</a>
            </div>
            
            <p><strong>Important:</strong> This link is unique to you and should not be shared with others.</p>
            
            <p>If you have any questions about this document, please contact the sender directly.</p>
          </div>
          
          <div class="footer">
            <p>This email was sent from a secure document signing platform.</p>
            <p>If you believe you received this email in error, please ignore it.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate completion email template
  private generateCompletionEmailTemplate(data: {
    recipientName: string;
    documentTitle: string;
    completedAt: Date;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #d4edda; padding: 20px; text-align: center; border-radius: 8px; }
          .content { padding: 20px 0; }
          .status { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Document Signing Complete</h1>
          </div>
          
          <div class="content">
            <p>Dear ${data.recipientName},</p>
            
            <p>The following document has been successfully signed by all required parties:</p>
            <h3>${data.documentTitle}</h3>
            
            <div class="status">
              <strong>Status:</strong> Completed<br>
              <strong>Completed on:</strong> ${data.completedAt.toLocaleDateString()} at ${data.completedAt.toLocaleTimeString()}
            </div>
            
            <p>A final copy of the signed document will be provided separately.</p>
            
            <p>Thank you for participating in this signing process.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const eSignatureService = new ESignatureService();