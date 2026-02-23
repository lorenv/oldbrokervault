import type { Express } from "express";
import multer from "multer";
import { storage } from "../storage";
import { db } from "../db";
import { ndaAccessTokens, ndaSignatures, insertNdaSignatureSchema, crmContacts, organizationMembers, dealContacts, dealDocuments, cimDocuments, dealBuyers, buyerPipelineStages } from "@shared/schema";
import { eq, and, inArray, sql, asc } from "drizzle-orm";
import { sendNdaSignedEmail, sendEmail, sendApprovalEmail, sendOwnerApprovalNotification, sendRejectionEmail, sendNdaPendingEmail } from "../email";
import { generateSecureToken, generateRedirectId } from "../token-utils";
import { addCertificateToNda } from "../pdf-utils";
import { PdfSignatureProcessor } from "../pdf-signature-processor";
import { dispatchWebhookEvent } from "../webhook-dispatcher";
import { dispatchIntegrationEvent } from "../integrations";
import { checkWhitelist } from "./nda-whitelist-routes";
import { findOrCreateCompanyFromEmail, enrichCompanyFromWebsite, linkContactToCompany } from "../services/company-enrichment";
import JSZip from "jszip";

/**
 * After an NDA is approved, advance the signer's buyer pipeline stage
 * from "NDA Signed" to "CIM Sent" on all linked deals.
 */
export async function advanceBuyerOnApproval(signerEmail: string, cimDocumentId: number, organizationId: number): Promise<void> {
  try {
    // Find the CRM contact by email
    const [contact] = await db
      .select({ id: crmContacts.id })
      .from(crmContacts)
      .where(and(
        eq(crmContacts.organizationId, organizationId),
        sql`LOWER(${crmContacts.email}) = ${signerEmail.toLowerCase().trim()}`
      ))
      .limit(1);

    if (!contact) return;

    // Find the "CIM Sent" stage
    const [cimSentStage] = await db
      .select()
      .from(buyerPipelineStages)
      .where(and(
        eq(buyerPipelineStages.organizationId, organizationId),
        sql`LOWER(${buyerPipelineStages.name}) = 'cim sent'`
      ))
      .limit(1);

    if (!cimSentStage) return;

    // Find the "NDA Signed" stage to only advance buyers currently at that stage
    const [ndaSignedStage] = await db
      .select()
      .from(buyerPipelineStages)
      .where(and(
        eq(buyerPipelineStages.organizationId, organizationId),
        sql`LOWER(${buyerPipelineStages.name}) = 'nda signed'`
      ))
      .limit(1);

    if (!ndaSignedStage) return;

    // Get all deals linked to this CIM document
    const cimDoc = await storage.getCimDocument(cimDocumentId);
    if (!cimDoc) return;

    const linkedDeals = await db
      .select({ dealId: dealDocuments.dealId })
      .from(dealDocuments)
      .where(eq(dealDocuments.cimDocumentId, cimDocumentId));

    const dealIds = Array.from(new Set([
      ...linkedDeals.map(d => d.dealId),
      ...(cimDoc.dealId ? [cimDoc.dealId] : []),
    ]));

    // Advance the buyer on each linked deal (only if currently at "NDA Signed")
    for (let i = 0; i < dealIds.length; i++) {
      await db
        .update(dealBuyers)
        .set({ stageId: cimSentStage.id, updatedAt: new Date() })
        .where(and(
          eq(dealBuyers.dealId, dealIds[i]),
          eq(dealBuyers.contactId, contact.id),
          eq(dealBuyers.stageId, ndaSignedStage.id),
        ));
    }

    console.log(`[nda-approval] Advanced buyer ${signerEmail} to "CIM Sent" on ${dealIds.length} deal(s)`);
  } catch (err) {
    console.error('[nda-approval] Failed to advance buyer stage:', err);
  }
}

export function registerNdaSigningRoutes(app: Express) {
  // Download individual NDA signature PDF
  app.get("/api/cim/:docId/nda-signatures/:signatureId/download", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { docId, signatureId } = req.params;

      // Verify ownership
      const doc = await storage.getCimDocument(parseInt(docId));
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get the signature
      const signatures = await storage.getNdaSignatures(parseInt(docId));
      const signature = signatures.find(s => s.id === parseInt(signatureId));

      if (!signature) {
        return res.status(404).json({ error: "Signature not found" });
      }

      // Convert base64 to buffer and send as PDF
      const pdfBuffer = Buffer.from(signature.signedNdaContent, 'base64');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="nda-${signature.signerName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf"`);
      res.send(pdfBuffer);

    } catch (error) {
      console.error("Error downloading NDA signature:", error);
      res.status(500).json({ error: "Failed to download NDA signature" });
    }
  });

  // Bulk download all NDA signatures as ZIP
  app.get("/api/cim/:docId/nda-signatures/bulk-download", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { docId } = req.params;

      // Verify ownership
      const doc = await storage.getCimDocument(parseInt(docId));
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get all signatures for this document
      const signatures = await storage.getNdaSignatures(parseInt(docId));

      if (signatures.length === 0) {
        return res.status(404).json({ error: "No signatures found" });
      }

      // Create ZIP file
      const zip = new JSZip();

      signatures.forEach((signature, index) => {
        const pdfBuffer = Buffer.from(signature.signedNdaContent, 'base64');
        const fileName = `${index + 1}-nda-${signature.signerName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
        zip.file(fileName, pdfBuffer);
      });

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="nda-signatures-${docId}.zip"`);
      res.send(zipBuffer);

    } catch (error) {
      console.error("Error creating ZIP file:", error);
      res.status(500).json({ error: "Failed to create ZIP file" });
    }
  });

  // Get NDA signatures list with access tokens and view counts
  app.get("/api/cim/:id/nda-signatures", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const cimId = parseInt(req.params.id);

      // Get basic signature data
      const signatures = await storage.getNdaSignatures(cimId);

      // Import documentViews table
      const { documentViews } = await import('@shared/schema');
      const { sql, count } = await import('drizzle-orm');

      // Enhance signatures with access tokens and view count
      const enhancedSignatures = await Promise.all(signatures.map(async (signature) => {
        // Get access token for this signature
        const [accessToken] = await db
          .select()
          .from(ndaAccessTokens)
          .where(eq(ndaAccessTokens.ndaSignatureId, signature.id));

        // Count views by this signer (matching by email)
        const viewCountResult = await db
          .select({ count: count() })
          .from(documentViews)
          .where(
            sql`${documentViews.cimDocumentId} = ${cimId}
            AND ${documentViews.viewerIdentifier} = ${signature.signerEmail}`
          );

        return {
          ...signature,
          accessToken: accessToken?.token || null,
          viewCount: viewCountResult[0]?.count || 0
        };
      }));

      res.json(enhancedSignatures);
    } catch (error) {
      console.error('Error fetching NDA signatures:', error);
      res.status(500).json({ error: "Failed to fetch NDA signatures" });
    }
  });

  // Approve NDA signature
  app.post("/api/cim/:docId/nda-signatures/:signatureId/approve", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const signatureId = parseInt(req.params.signatureId);

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Approve the signature
      const approvedSignature = await storage.approveNdaSignature(signatureId, req.user.id);

      // Advance buyer pipeline stage from "NDA Signed" → "CIM Sent"
      const [ownerMember] = await db.select().from(organizationMembers)
        .where(and(eq(organizationMembers.userId, doc.userId), eq(organizationMembers.status, 'active')))
        .limit(1);
      if (ownerMember && approvedSignature.signerEmail) {
        advanceBuyerOnApproval(approvedSignature.signerEmail, docId, ownerMember.organizationId);
      }

      // Fetch owner profile for email
      const ownerProfile = await storage.getUserProfile(doc.userId);

      // Send approval email to the signer
      await sendApprovalEmail(approvedSignature, doc, ownerProfile);

      res.json({
        success: true,
        signature: approvedSignature,
        message: "Signer approved and notified"
      });
    } catch (error) {
      console.error('Error approving NDA signature:', error);
      res.status(500).json({ error: "Failed to approve signature" });
    }
  });

  // Batch approve NDA signatures
  app.post("/api/cim/:docId/nda-signatures/approve-batch", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const { signatureIds } = req.body;

      if (!Array.isArray(signatureIds) || signatureIds.length === 0) {
        return res.status(400).json({ error: "Invalid signature IDs" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Batch approve signatures
      const approvedSignatures = await storage.approveNdaSignaturesBatch(signatureIds, req.user.id);

      // Advance buyer pipeline stages from "NDA Signed" → "CIM Sent"
      const [batchOwnerMember] = await db.select().from(organizationMembers)
        .where(and(eq(organizationMembers.userId, doc.userId), eq(organizationMembers.status, 'active')))
        .limit(1);
      if (batchOwnerMember) {
        for (const sig of approvedSignatures) {
          if (sig.signerEmail) {
            advanceBuyerOnApproval(sig.signerEmail, docId, batchOwnerMember.organizationId);
          }
        }
      }

      // Fetch owner profile for email
      const ownerProfile = await storage.getUserProfile(doc.userId);

      // Send approval emails to all signers
      await Promise.all(
        approvedSignatures.map(signature => sendApprovalEmail(signature, doc, ownerProfile))
      );

      res.json({
        success: true,
        signatures: approvedSignatures,
        message: `${approvedSignatures.length} signers approved and notified`
      });
    } catch (error) {
      console.error('Error batch approving NDA signatures:', error);
      res.status(500).json({ error: "Failed to approve signatures" });
    }
  });

  // Reject single NDA signature
  app.post("/api/cim/:docId/nda-signatures/:signatureId/reject", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const signatureId = parseInt(req.params.signatureId);

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Reject the signature
      const rejectedSignature = await storage.rejectNdaSignature(signatureId, req.user.id);

      // Fetch owner profile for email
      const ownerProfile = await storage.getUserProfile(doc.userId);

      // Send rejection email to the signer
      await sendRejectionEmail(
        rejectedSignature.signerEmail,
        rejectedSignature.signerName,
        doc.title,
        {
          name: req.user.name || req.user.email,
          email: req.user.email,
          businessName: ownerProfile?.businessName || undefined
        }
      );

      // Dispatch nda.declined event
      const ndaDeclinedPayload = {
        cim_id: docId,
        document_title: doc.title,
        recipient_email: rejectedSignature.signerEmail,
        recipient_name: rejectedSignature.signerName,
        decline_reason: 'Rejected by document owner',
        declined_at: new Date().toISOString(),
      };
      dispatchIntegrationEvent(req.user.id, 'nda.declined', ndaDeclinedPayload)
        .catch(err => console.error('Integration dispatch error:', err));
      dispatchWebhookEvent(req.user.id, 'nda.declined', ndaDeclinedPayload)
        .catch(err => console.error('Webhook dispatch error:', err));

      res.json({
        success: true,
        signature: rejectedSignature,
        message: "Signer rejected and notified"
      });
    } catch (error) {
      console.error('Error rejecting NDA signature:', error);
      res.status(500).json({ error: "Failed to reject signature" });
    }
  });

  // Batch reject NDA signatures
  app.post("/api/cim/:docId/nda-signatures/reject-batch", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const { signatureIds } = req.body;

      if (!Array.isArray(signatureIds) || signatureIds.length === 0) {
        return res.status(400).json({ error: "Invalid signature IDs" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Batch reject signatures
      const rejectedSignatures = await storage.rejectNdaSignaturesBatch(signatureIds, req.user.id);

      // Fetch owner profile for email
      const ownerProfile = await storage.getUserProfile(doc.userId);

      // Send rejection emails to all signers
      await Promise.all(
        rejectedSignatures.map(signature => sendRejectionEmail(
          signature.signerEmail,
          signature.signerName,
          doc.title,
          {
            name: req.user.name || req.user.email,
            email: req.user.email,
            businessName: ownerProfile?.businessName || undefined
          }
        ))
      );

      res.json({
        success: true,
        signatures: rejectedSignatures,
        message: `${rejectedSignatures.length} signers rejected and notified`
      });
    } catch (error) {
      console.error('Error batch rejecting NDA signatures:', error);
      res.status(500).json({ error: "Failed to reject signatures" });
    }
  });

  // Update NDA signature stage (for Kanban drag-and-drop)
  app.patch("/api/nda-signatures/:signatureId/stage", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const signatureId = parseInt(req.params.signatureId);
      const { stage } = req.body;

      // Get the signature to verify document ownership
      const signature = await storage.getNdaSignatureById(signatureId);
      if (!signature) {
        return res.status(404).json({ error: "Signature not found" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(signature.cimDocumentId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Update the stage
      const updatedSignature = await storage.updateNdaSignatureStage(signatureId, stage);

      res.json({ success: true, signature: updatedSignature });
    } catch (error) {
      console.error('Error updating signature stage:', error);
      res.status(500).json({ error: "Failed to update signature stage" });
    }
  });

  // Resend share link email to NDA signer
  app.post("/api/cim/:docId/nda-signatures/:signatureId/resend-email", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const signatureId = parseInt(req.params.signatureId);

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get the signature with access token
      const signatures = await storage.getNdaSignatures(docId);
      const signature = signatures.find(s => s.id === signatureId);

      if (!signature) {
        return res.status(404).json({ error: "Signature not found" });
      }

      // Get access token for this signature
      const [accessToken] = await db
        .select()
        .from(ndaAccessTokens)
        .where(eq(ndaAccessTokens.ndaSignatureId, signatureId));

      const signatureWithToken = {
        ...signature,
        accessToken: accessToken?.token || ''
      };

      // Send the appropriate email based on approval status
      let emailSent = false;
      if (doc.ndaApprovalRequired && !signature.approved) {
        // Send "pending approval" email with status + buyer form links
        const statusToken = signature.statusCheckToken;
        if (statusToken) {
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          emailSent = await sendNdaPendingEmail(
            signature.signerEmail,
            signature.signerName,
            doc.title,
            `${baseUrl}/nda/status/${statusToken}`,
            `${baseUrl}/buyer-form/${statusToken}`
          );
        } else {
          // Fallback if no status token
          emailSent = await sendEmail({
            to: signature.signerEmail,
            from: 'system@brokervault.ai',
            replyTo: 'system@brokervault.ai',
            subject: `NDA Signature Received - ${doc.title}`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>NDA Signature Received</h2><p>Hello ${signature.signerName},</p><p>Thank you for signing the NDA for <strong>${doc.title}</strong>.</p><p>Your signature has been received and is currently pending approval.</p></div>`,
            text: `NDA Signature Received\n\nHello ${signature.signerName},\n\nThank you for signing the NDA for ${doc.title}.\n\nYour signature is pending approval.`
          });
        }
      } else {
        // Send access email (approved or no approval required)
        emailSent = await sendApprovalEmail(signatureWithToken, doc);
      }

      if (emailSent) {
        res.json({
          success: true,
          message: "Email sent successfully"
        });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      console.error('Error resending email:', error);
      res.status(500).json({ error: "Failed to resend email" });
    }
  });

  // Bulk resend emails to NDA signers
  app.post("/api/cim/:docId/nda-signatures/resend-batch", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const { signatureIds } = req.body;

      if (!Array.isArray(signatureIds) || signatureIds.length === 0) {
        return res.status(400).json({ error: "Invalid signature IDs" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get signatures with access tokens
      const signatures = await storage.getNdaSignatures(docId);
      const selectedSignatures = signatures.filter(s => signatureIds.includes(s.id));

      // Get access tokens for all signatures
      const tokensResult = await db
        .select()
        .from(ndaAccessTokens)
        .where(inArray(ndaAccessTokens.ndaSignatureId, signatureIds));

      const tokenMap = new Map(tokensResult.map(t => [t.ndaSignatureId, t.token]));

      // Send emails
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const emailPromises = selectedSignatures.map(async (signature) => {
        const signatureWithToken = {
          ...signature,
          accessToken: tokenMap.get(signature.id) || ''
        };

        if (doc.ndaApprovalRequired && !signature.approved) {
          // Send "pending approval" email with status + buyer form links
          const statusToken = signature.statusCheckToken;
          if (statusToken) {
            return await sendNdaPendingEmail(
              signature.signerEmail,
              signature.signerName,
              doc.title,
              `${baseUrl}/nda/status/${statusToken}`,
              `${baseUrl}/buyer-form/${statusToken}`
            );
          }
          return await sendEmail({
            to: signature.signerEmail,
            from: 'system@brokervault.ai',
            replyTo: 'system@brokervault.ai',
            subject: `NDA Signature Received - ${doc.title}`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>NDA Signature Received</h2><p>Hello ${signature.signerName},</p><p>Thank you for signing the NDA for <strong>${doc.title}</strong>.</p><p>Your signature is pending approval.</p></div>`,
            text: `NDA Signature Received\n\nHello ${signature.signerName},\n\nThank you for signing the NDA for ${doc.title}.\n\nYour signature is pending approval.`
          });
        } else {
          // Send access email
          return await sendApprovalEmail(signatureWithToken, doc);
        }
      });

      const results = await Promise.allSettled(emailPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

      res.json({
        success: true,
        message: `${successCount} of ${selectedSignatures.length} emails sent successfully`
      });
    } catch (error) {
      console.error('Error bulk resending emails:', error);
      res.status(500).json({ error: "Failed to resend emails" });
    }
  });

  // Add manual NDA signer - File upload is OPTIONAL
  app.post("/api/cim/:docId/nda-signatures/manual",
    // Use multer but make it completely optional
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }
    }).none(), // Use .none() to handle FormData without files
    async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const { signerName, signerEmail, signedDate } = req.body;
      // No file handling needed - we're using .none()
      const ndaFile = null;

      if (!signerName) {
        return res.status(400).json({ error: "Signer name is required" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Generate a unique token for this manual signer
      const accessToken = generateSecureToken();

      // Convert file buffer to base64 for storage, or use a placeholder if no file
      const signedNdaContent = ndaFile
        ? `data:application/pdf;base64,${ndaFile.buffer.toString('base64')}`
        : 'data:text/plain;base64,' + Buffer.from('Manual entry - no document uploaded').toString('base64');

      // Create the NDA signature record
      const signatureData = {
        cimDocumentId: docId,
        signerName,
        signerEmail: signerEmail || `manual_${Date.now()}@offline.local`, // Use placeholder email if not provided
        signerIpAddress: 'Manual Entry',
        signerLocation: 'Offline Signature',
        signedNdaContent,
        fieldValues: {
          manualEntry: true,
          signedDate: signedDate || new Date().toISOString(),
          uploadedBy: req.user.id,
          uploadedAt: new Date().toISOString(),
          hasDocument: !!ndaFile
        }
      };

      const signature = await storage.createNdaSignature(signatureData);

      // Now approve the signature since it's being added manually by the document owner
      const approvedSignature = await storage.approveNdaSignature(signature.id, req.user.id);

      // Advance buyer pipeline stage from "NDA Signed" → "CIM Sent"
      const [manualOwnerMember] = await db.select().from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user!.id), eq(organizationMembers.status, 'active')))
        .limit(1);
      if (manualOwnerMember && signatureData.signerEmail) {
        advanceBuyerOnApproval(signatureData.signerEmail, docId, manualOwnerMember.organizationId);
      }

      // Create access token for this signature
      await storage.createNdaAccessToken(
        accessToken,
        docId,
        signature.id,
        signatureData.signerEmail,
        undefined // Never expires for manual entries
      );

      // Add contact to CRM (investor database)
      try {
        const { investorContacts } = await import('@shared/schema');

        // Check if contact already exists
        const existingContact = await db.select()
          .from(investorContacts)
          .where(and(
            eq(investorContacts.userId, req.user.id),
            eq(investorContacts.email, signatureData.signerEmail)
          ))
          .limit(1);

        if (existingContact.length === 0) {
          // Create new contact in CRM
          await db.insert(investorContacts).values({
            userId: req.user.id,
            email: signatureData.signerEmail,
            name: signerName,
            notes: 'Added via manual NDA signature entry',
            tags: [],
            status: 'new',
            location: 'Offline Signature',
            totalDocumentViews: 0,
            totalTimeSpentMinutes: 0,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            ipAddress: 'Manual Entry',
            isPotentialVpn: false,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } catch (crmError) {
        console.error('Error adding contact to CRM:', crmError);
        // Don't fail the whole request if CRM addition fails
      }

      // Return the approved signature with access token
      res.json({
        success: true,
        signature: {
          ...approvedSignature,
          accessToken
        }
      });

    } catch (error) {
      console.error('Error adding manual NDA signer:', error);
      res.status(500).json({ error: "Failed to add manual signer" });
    }
  });

  // Sign NDA - the main public signing endpoint
  app.post("/api/share/:shareSlug/sign-nda", async (req, res) => {
    console.log("=== NDA SIGNING REQUEST STARTED ===");
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Request params:", req.params);
    console.log("=====================================");

    try {
      const { shareSlug } = req.params;
      const { signerName, signerEmail, fieldValues = {} } = req.body;

      console.log("=== EMAIL DEBUG - INITIAL VALUES ===");
      console.log("signerName from request body:", signerName);
      console.log("signerEmail from request body:", signerEmail);
      console.log("fieldValues from request body:", fieldValues);
      console.log("shareSlug from params:", shareSlug);
      console.log("====================================");
      // Get real client IP address, not proxy IP
      const signerIpAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] ||
                             req.headers['x-real-ip']?.toString() ||
                             req.headers['cf-connecting-ip']?.toString() ||
                             req.ip ||
                             req.connection.remoteAddress ||
                             'unknown';

      // Get location information from IP address
      let signerLocation = 'Unknown Location';
      let geo = null;

      try {
        const { lookupIp } = await import('../services/geo-ip-service');
        geo = await lookupIp(signerIpAddress);
        if (geo && geo.city && geo.region && geo.country) {
          signerLocation = `${geo.city}, ${geo.region}, ${geo.country}`;
        } else if (geo && geo.country) {
          signerLocation = `${geo.country}`;
        }
        console.log('Geolocation lookup successful:', geo);
      } catch (geoError: any) {
        console.log('Geolocation lookup failed:', geoError?.message || 'Unknown error');
      }

      console.log("Share slug:", shareSlug);
      console.log("Signer name:", signerName);
      console.log("Signer email:", signerEmail);
      console.log("Field values:", fieldValues);
      console.log("Email validation:", {
        hasName: !!signerName && signerName.trim().length > 0,
        hasEmail: !!signerEmail && signerEmail.trim().length > 0,
        emailFormat: signerEmail ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail) : false
      });
      console.log("Headers:", {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'req.ip': req.ip,
        'remoteAddress': req.connection.remoteAddress
      });
      console.log("Final IP address:", signerIpAddress);
      console.log("Geo location:", geo);
      console.log("Formatted location:", signerLocation);

      // Get CIM document by share slug
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      console.log("Found CIM doc:", !!cimDoc, cimDoc?.id);

      if (!cimDoc) {
        console.log("ERROR: CIM document not found");
        return res.status(404).json({ error: "CIM document not found" });
      }

      // Check if NDA is required

      if (!cimDoc.ndaProtected || !cimDoc.ndaTemplateId) {
        return res.status(400).json({ error: "This CIM does not require NDA signing" });
      }

      // Always process NDA signing and send all emails (no distinction between new/existing signers)

      // Get NDA template
      const templates = await storage.getNdaTemplates(cimDoc.userId);
      console.log("Found templates:", templates.length);

      const ndaTemplate = templates.find(t => t.id === cimDoc.ndaTemplateId);

      if (!ndaTemplate) {
        return res.status(400).json({ error: "NDA template not found" });
      }

      // Create signed NDA
      const signedAt = new Date();

      try {
        // Enhanced signature processing with field values
        let signedNdaContent: string;

        // Ensure signatureFields is an array (JSONB field might return object)
        const signatureFields = Array.isArray(ndaTemplate.signatureFields)
          ? ndaTemplate.signatureFields
          : [];

        if (signatureFields && signatureFields.length > 0) {
          console.log("=== PDF GENERATION START ===");
          console.log("Processing signature using enhanced field-based system");
          console.log("Template file content length:", ndaTemplate.fileContent?.length || 0);

          const processor = await PdfSignatureProcessor.fromBase64(ndaTemplate.fileContent);

          // Prepare field values with signature data
          const processedFieldValues = { ...fieldValues };

          // Auto-populate standard fields if not provided
          if (!processedFieldValues.name && signatureFields.some((f: any) => f.type === 'name')) {
            const nameField = signatureFields.find((f: any) => f.type === 'name');
            if (nameField) processedFieldValues[nameField.id] = signerName;
          }

          if (!processedFieldValues.email && signatureFields.some((f: any) => f.type === 'email')) {
            const emailField = signatureFields.find((f: any) => f.type === 'email');
            if (emailField) processedFieldValues[emailField.id] = signerEmail;
          }

          // Process date fields
          signatureFields.filter((f: any) => f.type === 'date').forEach((field: any) => {
            if (!processedFieldValues[field.id]) {
              processedFieldValues[field.id] = signedAt.toLocaleDateString();
            }
          });

          // Embed fields into PDF
          console.log("Embedding fields into PDF...");
          signedNdaContent = await processor.embedFields(signatureFields, processedFieldValues);
          console.log("Fields embedded, PDF length:", signedNdaContent?.length || 0);

          // Add completion certificate
          try {
            console.log("Adding completion certificate...");
            await processor.addCompletionCertificate(signerName, signerEmail, signedAt, signerIpAddress);
            signedNdaContent = await processor.saveAsBase64();
            console.log("Certificate added successfully, final PDF length:", signedNdaContent?.length || 0);
          } catch (certError) {
            console.error('Error adding completion certificate:', certError);
            console.error('Certificate error details:', {
              message: certError instanceof Error ? certError.message : String(certError),
              stack: certError instanceof Error ? certError.stack : undefined
            });
            // Continue without certificate if it fails
            console.log('Continuing without completion certificate, using PDF without certificate');
            console.log('PDF length without certificate:', signedNdaContent?.length || 0);
          }

          console.log("=== PDF GENERATION COMPLETE ===");
        } else {
          console.log("=== PDF GENERATION START (CERTIFICATE ONLY) ===");
          console.log("Using certificate-only processing (no signature fields)");
          console.log("Template file content length:", ndaTemplate.fileContent?.length || 0);

          signedNdaContent = await addCertificateToNda(
            ndaTemplate.fileContent,
            signerName,
            signedAt,
            signerEmail,
            signerIpAddress
          );

          console.log("Certificate added, final PDF length:", signedNdaContent?.length || 0);
          console.log("=== PDF GENERATION COMPLETE ===");
        }

        // Validate PDF before proceeding
        console.log("=== VALIDATING GENERATED PDF ===");
        if (!signedNdaContent || signedNdaContent.length === 0) {
          console.error("CRITICAL ERROR: Generated PDF is empty!");
          throw new Error("PDF generation failed - resulting content is empty");
        }

        try {
          const pdfBuffer = Buffer.from(signedNdaContent, 'base64');
          const pdfHeader = pdfBuffer.toString('utf8', 0, 4);
          console.log("PDF header check:", pdfHeader);

          if (!pdfHeader.startsWith('%PDF')) {
            console.error("CRITICAL ERROR: Generated PDF has invalid header!");
            console.error("First 100 chars:", signedNdaContent.substring(0, 100));
            throw new Error("PDF generation failed - invalid PDF format");
          }

          console.log("PDF validation passed - header is correct");
        } catch (validationError) {
          console.error("PDF validation failed:", validationError);
          throw new Error("PDF validation failed: " + (validationError instanceof Error ? validationError.message : String(validationError)));
        }

        // Save signature record
        console.log("Preparing signature data...");

        const signatureData = {
          cimDocumentId: cimDoc.id,
          signerName,
          signerEmail,
          signerIpAddress,
          signerLocation,
          signedNdaContent,
          fieldValues
        };

        const validatedData = insertNdaSignatureSchema.parse(signatureData);
        const signature = await storage.createNdaSignature(validatedData);

        // Generate a status check token for the signer to check their NDA status
        const statusToken = generateSecureToken();
        await db.update(ndaSignatures)
          .set({ statusCheckToken: statusToken })
          .where(eq(ndaSignatures.id, signature.id));

        // Get owner information for email
        console.log("Getting document owner information...");
        const owner = await storage.getUser(cimDoc.userId);
        if (!owner) {
          console.log("ERROR: Document owner not found");
          return res.status(500).json({ error: "Document owner not found" });
        }
        console.log("Owner found:", owner.email);



        // Auto-sync to investor database after successful NDA signing
        console.log("Auto-syncing new contact to investor database...");
        try {
          const { investorContacts } = await import('@shared/schema');
          const { and } = await import('drizzle-orm');

          // Check if contact already exists
          const [existingContact] = await db
            .select()
            .from(investorContacts)
            .where(and(
              eq(investorContacts.userId, cimDoc.userId),
              eq(investorContacts.email, signerEmail)
            ));

          if (existingContact) {
            // Update existing contact with latest activity and location info
            await db
              .update(investorContacts)
              .set({
                totalDocumentViews: existingContact.totalDocumentViews + 1,
                lastSeenAt: new Date(),
                ipAddress: signerIpAddress,
                location: signerLocation,
                updatedAt: new Date()
              })
              .where(eq(investorContacts.id, existingContact.id));
            console.log("Updated existing investor contact with location:", signerEmail, signerLocation);
          } else {
            // Create new contact with location info
            await db
              .insert(investorContacts)
              .values({
                userId: cimDoc.userId,
                email: signerEmail,
                name: signerName,
                status: 'new',
                totalDocumentViews: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                ipAddress: signerIpAddress,
                location: signerLocation,
                tags: []
              });
            console.log("Created new investor contact with location:", signerEmail, signerLocation);
          }
        } catch (syncError) {
          console.error('Auto-sync to investor database failed:', syncError);
          // Don't fail the NDA signing if sync fails
        }

        // Look up the CIM owner's organization (needed for CRM, whitelist, and pipeline operations)
        let orgId: number | null = null;
        try {
          const [ownerMembership] = await db
            .select({ organizationId: organizationMembers.organizationId })
            .from(organizationMembers)
            .where(and(
              eq(organizationMembers.userId, cimDoc.userId),
              eq(organizationMembers.status, 'active')
            ))
            .limit(1);
          if (ownerMembership) {
            orgId = ownerMembership.organizationId;
          }
        } catch (orgLookupError) {
          console.error('Failed to look up owner organization:', orgLookupError);
        }

        // Auto-create company from signer's email domain and link CRM contact
        try {
          if (orgId) {

            // Find or create company from signer's email domain
            const company = await findOrCreateCompanyFromEmail(signerEmail, orgId);

            // Find or create CRM contact for the signer
            const [existingCrmContact] = await db
              .select()
              .from(crmContacts)
              .where(and(
                eq(crmContacts.organizationId, orgId),
                sql`LOWER(${crmContacts.email}) = ${signerEmail.toLowerCase().trim()}`
              ))
              .limit(1);

            const nameParts = signerName.trim().split(/\s+/);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || null;

            if (existingCrmContact) {
              // Update existing CRM contact with buyer info
              const updateFields: Record<string, unknown> = {
                contactType: 'buyer',
                updatedAt: new Date(),
              };
              if (company) {
                updateFields.companyId = company.id;
              }
              await db.update(crmContacts)
                .set(updateFields)
                .where(eq(crmContacts.id, existingCrmContact.id));
              console.log(`Updated CRM contact ${existingCrmContact.id} as buyer`);
            } else {
              // Create new CRM contact
              await db.insert(crmContacts).values({
                organizationId: orgId,
                email: signerEmail.toLowerCase().trim(),
                firstName,
                lastName,
                contactType: 'buyer',
                source: 'nda_signing',
                companyId: company?.id ?? null,
                lifecycleStage: 'lead',
                leadStatus: 'new',
                customProperties: {},
              });
              console.log(`Created CRM contact for NDA signer: ${signerEmail}`);
            }

            // Queue background enrichment for newly created companies
            if (company && company.enrichmentStatus === 'pending') {
              enrichCompanyFromWebsite(company.id).catch(err =>
                console.error(`Background enrichment failed for company ${company.id}:`, err)
              );
            }

            // Auto-link signer as buyer on the deal's Buyers tab (dealBuyers)
            try {
              const [contactRecord] = await db
                .select({ id: crmContacts.id })
                .from(crmContacts)
                .where(and(
                  eq(crmContacts.organizationId, orgId),
                  sql`LOWER(${crmContacts.email}) = ${signerEmail.toLowerCase().trim()}`
                ))
                .limit(1);

              if (contactRecord) {
                // Find all deals linked to this CIM document
                const linkedDeals = await db
                  .select({ dealId: dealDocuments.dealId })
                  .from(dealDocuments)
                  .where(eq(dealDocuments.cimDocumentId, cimDoc.id));

                const dealIdSet = new Set(linkedDeals.map(d => d.dealId));
                if (cimDoc.dealId) {
                  dealIdSet.add(cimDoc.dealId);
                }
                const dealIds = Array.from(dealIdSet);

                for (let i = 0; i < dealIds.length; i++) {
                  const dealId = dealIds[i];
                  // Check if already in dealBuyers
                  const [existingBuyer] = await db
                    .select()
                    .from(dealBuyers)
                    .where(and(
                      eq(dealBuyers.dealId, dealId),
                      eq(dealBuyers.contactId, contactRecord.id)
                    ))
                    .limit(1);

                  if (!existingBuyer) {
                    // Get the "NDA Signed" stage, or fall back to the first stage
                    let stageId: number | null = null;
                    const [ndaStage] = await db
                      .select()
                      .from(buyerPipelineStages)
                      .where(and(
                        eq(buyerPipelineStages.organizationId, orgId),
                        sql`LOWER(${buyerPipelineStages.name}) = 'nda signed'`
                      ))
                      .limit(1);

                    if (ndaStage) {
                      stageId = ndaStage.id;
                    } else {
                      // Fall back to first stage
                      const [firstStage] = await db
                        .select()
                        .from(buyerPipelineStages)
                        .where(eq(buyerPipelineStages.organizationId, orgId))
                        .orderBy(asc(buyerPipelineStages.displayOrder))
                        .limit(1);
                      if (firstStage) stageId = firstStage.id;
                    }

                    if (stageId) {
                      await db.insert(dealBuyers).values({
                        dealId,
                        contactId: contactRecord.id,
                        stageId,
                      });
                      console.log(`Auto-linked contact ${contactRecord.id} as buyer on deal ${dealId} (Buyers tab, stage ${stageId})`);
                    }
                  }
                }
              }
            } catch (linkError) {
              console.error('Auto-link signer to deal failed:', linkError);
              // Don't fail the NDA signing if deal linking fails
            }
          }
        } catch (crmError) {
          console.error('Auto-create company/CRM contact failed:', crmError);
          // Don't fail the NDA signing if CRM sync fails
        }

        // Create access token for the signed user
        const accessToken = generateSecureToken();
        const ndaAccessToken = await storage.createNdaAccessToken(
          accessToken,
          cimDoc.id,
          signature.id,
          signerEmail
        );

        // Create redirect link
        console.log("Creating redirect link...");
        const redirectId = generateRedirectId();
        const redirectLink = await storage.createNdaRedirectLink(
          redirectId,
          ndaAccessToken.id,
          cimDoc.id,
          signerEmail
        );

        // Check if manual approval is required (with whitelist auto-approval)
        let requiresManualApproval = cimDoc.ndaApprovalRequired;

        if (cimDoc.ndaApprovalRequired) {
          // Check if the signer is whitelisted for auto-approval
          const whitelistMatch = await checkWhitelist(signerEmail, cimDoc.id, cimDoc.userId);
          if (whitelistMatch) {
            console.log(`Signer ${signerEmail} auto-approved via whitelist rule ${whitelistMatch.id} (${whitelistMatch.ruleType}: ${whitelistMatch.ruleValue})`);
            // Auto-approve the signature
            await storage.approveNdaSignature(signature.id, cimDoc.userId);
            // Advance buyer pipeline stage from "NDA Signed" → "CIM Sent"
            if (orgId) advanceBuyerOnApproval(signerEmail, cimDoc.id, orgId);
            requiresManualApproval = false;
          }
        }

        if (requiresManualApproval) {
          console.log("Manual approval required - not sending immediate access email");

          // Send notification to owner about new signature requiring approval
          const ownerNotificationSent = await sendOwnerApprovalNotification(
            owner.email,
            owner.name || owner.email,
            cimDoc.title,
            signerName,
            signerEmail,
            signerLocation
          );

          if (!ownerNotificationSent) {
            console.error('Failed to send owner approval notification');
          }

          const statusUrl = `${req.protocol}://${req.get('host')}/nda/status/${statusToken}`;
          const buyerFormUrl = `${req.protocol}://${req.get('host')}/buyer-form/${statusToken}`;

          // Send pending NDA email to signer with status + buyer form links
          const pendingEmailSent = await sendNdaPendingEmail(
            signerEmail,
            signerName,
            cimDoc.title,
            statusUrl,
            buyerFormUrl
          );
          if (!pendingEmailSent) {
            console.error('Failed to send NDA pending email to signer');
          }

          res.json({
            success: true,
            signature,
            requiresApproval: true,
            statusUrl,
            message: "Thank you for signing the NDA. Your signature has been received and someone will follow up as soon as possible to share the document once it is approved."
          });
        } else {
          // No approval required — advance buyer pipeline stage to "CIM Sent"
          if (orgId) advanceBuyerOnApproval(signerEmail, cimDoc.id, orgId);

          // Get owner's complete profile information for CIM link email
          console.log("Fetching owner profile information...");
          const ownerProfile = await storage.getUserProfile(cimDoc.userId);

          // Prepare owner profile data for email with full URLs for images
          const processImageUrlForEmail = (url: string | null) => {
            if (!url) return undefined;
            if (url.startsWith('data:') || url.startsWith('http')) return url;

            // Handle object storage URLs - convert to full domain URLs for emails
            if (url.startsWith('/api/object-storage/')) {
              return `https://brokervault.ai${url}`;
            }

            return url;
          };

          const ownerProfileData = {
            name: owner.name || owner.email,
            email: owner.email,
            phone: ownerProfile?.phoneNumber || undefined,
            title: ownerProfile?.title || undefined,
            businessName: ownerProfile?.businessName || undefined,
            profilePhotoUrl: processImageUrlForEmail(ownerProfile?.profilePhoto),
            businessLogoUrl: processImageUrlForEmail(ownerProfile?.businessLogo)
          };

          // Send immediate access email with separate NDA confirmation and CIM link emails
          const redirectUrl = `${req.protocol}://${req.get('host')}/nda/redirect/${redirectId}`;

          // Enhanced email validation and logging
          console.log("=== EMAIL SENDING VALIDATION ===");
          console.log("Signer email (final):", signerEmail);
          console.log("Signer name (final):", signerName);
          console.log("Owner email:", owner.email);
          console.log("CIM title:", cimDoc.title);
          console.log("Redirect URL:", redirectUrl);
          console.log("Owner profile data:", ownerProfileData);

          // Validate required data before sending
          if (!signerEmail || !signerEmail.trim()) {
            console.error("ERROR: Signer email is empty or undefined");
            throw new Error("Signer email is required for email sending");
          }

          if (!signerName || !signerName.trim()) {
            console.error("ERROR: Signer name is empty or undefined");
            throw new Error("Signer name is required for email sending");
          }

          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())) {
            console.error("ERROR: Invalid email format:", signerEmail);
            throw new Error("Invalid email format");
          }

          console.log("Email validation passed, proceeding with email sending...");

          const finalEmailSent = await sendNdaSignedEmail(
            signerEmail.trim(),
            owner.email,
            owner.name || owner.email,
            cimDoc.title,
            redirectUrl,
            signedNdaContent,
            signerName.trim(),
            ownerProfileData,
            cimDoc.userId
          );

          if (!finalEmailSent) {
            console.error('Failed to send NDA confirmation emails - check email debug logs above');
          } else {
          }

          // Dispatch webhook event for NDA signed (async, don't await)
          const ndaEventPayload = {
            nda_id: signature.id,
            cim_id: cimDoc.id,
            cim_title: cimDoc.title,
            signer_email: signerEmail,
            signer_name: signerName,
            signer_location: signerLocation,
            signed_at: signature.signedAt,
            // Add additional fields for integrations
            signer: {
              email: signerEmail,
              name: signerName,
            },
            document: {
              id: cimDoc.id,
              title: cimDoc.title,
            },
          };

          dispatchWebhookEvent(cimDoc.userId, 'nda.signed', ndaEventPayload)
            .catch(err => console.error('Webhook dispatch error:', err));

          // Dispatch to integration automations (HubSpot, etc.)
          dispatchIntegrationEvent(cimDoc.userId, 'nda.signed', ndaEventPayload)
            .catch(err => console.error('Integration dispatch error:', err));

          res.json({
            success: true,
            signature,
            requiresApproval: false,
            message: "NDA signed successfully. Check your email for confirmation and CIM access."
          });
        }

      } catch (innerError) {
        console.error('Inner NDA signing error:', innerError);
        console.error('Inner error message:', innerError instanceof Error ? innerError.message : String(innerError));
        console.error('Inner error stack:', innerError instanceof Error ? innerError.stack : 'No stack trace');
        throw innerError;
      }

    } catch (error) {
      console.error('NDA signing error:', error);

      // Return more detailed error in development
      const errorMessage = error instanceof Error ? error.message : "Failed to process NDA signature";
      const errorStack = error instanceof Error ? error.stack : undefined;

      res.status(500).json({
        error: "Failed to process NDA signature",
        details: errorMessage, // Always return details for debugging
        stack: errorStack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack
      });
    }
  });

  // NDA Redirect handler - stable URL that redirects to current token
  app.get("/api/nda/redirect/:redirectId", async (req, res) => {
    try {
      const { redirectId } = req.params;

      console.log("Redirect ID:", redirectId);

      // Get redirect link
      const redirectLink = await storage.getNdaRedirectLink(redirectId);
      if (!redirectLink || !redirectLink.isActive) {
        console.log("ERROR: Redirect link not found or inactive");
        return res.status(404).json({ error: "Invalid or expired redirect link" });
      }

      console.log("Found redirect link:", redirectLink.id);

      // Get current access token by ID using storage method
      console.log("Looking up access token by ID:", redirectLink.currentTokenId);
      const accessTokens = await db.select().from(ndaAccessTokens).where(eq(ndaAccessTokens.id, redirectLink.currentTokenId));

      if (!accessTokens || accessTokens.length === 0) {
        console.log("ERROR: Access token record not found");
        return res.status(404).json({ error: "Invalid or expired access token" });
      }

      const accessToken = accessTokens[0];

      if (!accessToken.isActive) {
        console.log("ERROR: Access token is inactive");
        return res.status(404).json({ error: "Invalid or expired access token" });
      }

      console.log("Found access token record:", accessToken.id, "Token:", accessToken.token.substring(0, 10) + "...");

      console.log("Found access token:", accessToken.id);

      // Update token last accessed and track NDA signer view
      await storage.updateTokenLastAccessed(accessToken.token);

      // Note: Views are tracked only when users access the actual CIM content, not the NDA page

      // Get CIM document
      const cimDoc = await storage.getCimDocument(accessToken.cimDocumentId);
      if (!cimDoc) {
        console.log("ERROR: CIM document not found");
        return res.status(404).json({ error: "Document not found" });
      }

      console.log("Redirecting to document with token:", accessToken.token);

      // Redirect to document with token
      const documentUrl = `/cims/${cimDoc.shareSlug}?token=${accessToken.token}`;
      res.redirect(documentUrl);

    } catch (error) {
      console.error('NDA redirect error:', error);
      res.status(500).json({ error: "Failed to process redirect" });
    }
  });

  // Validate NDA access token
  app.get("/api/nda/validate-token/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const accessToken = await storage.getNdaAccessToken(token);
      console.log("Token lookup result:", !!accessToken, accessToken?.isActive);

      if (!accessToken) {
        console.log("Token not found in database");
        return res.status(401).json({ error: "Invalid token", valid: false });
      }

      if (!accessToken.isActive) {
        console.log("Token is inactive");
        return res.status(401).json({ error: "Token has been deactivated", valid: false });
      }

      // Check if token has expired (only if expiresAt is set)
      if (accessToken.expiresAt && new Date() > accessToken.expiresAt) {
        console.log("Token has expired:", accessToken.expiresAt);
        return res.status(401).json({ error: "Token has expired", valid: false });
      }

      // Update last accessed
      await storage.updateTokenLastAccessed(token);

      // Get CIM document
      const cimDoc = await storage.getCimDocument(accessToken.cimDocumentId);
      if (!cimDoc) {
        console.log("CIM document not found for token");
        return res.status(404).json({ error: "Document not found", valid: false });
      }

      console.log("Token validation successful");
      res.json({
        valid: true,
        cimDocument: {
          id: cimDoc.id,
          title: cimDoc.title,
          shareSlug: cimDoc.shareSlug
        },
        signerEmail: accessToken.signerEmail
      });

    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ error: "Failed to validate token", valid: false });
    }
  });

  // Check NDA signature status
  app.get("/api/cim/:shareSlug/nda-status", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      if (!cimDoc) {
        return res.status(404).json({ error: "CIM document not found" });
      }

      const signature = await storage.checkNdaSignature(cimDoc.id, email as string);

      res.json({
        ndaRequired: cimDoc.ndaProtected,
        hasSignature: !!signature,
        signature: signature || null
      });

    } catch (error) {
      res.status(500).json({ error: "Failed to check NDA status" });
    }
  });

  // Public NDA status check — allows signers to check their approval status
  app.get("/api/nda/status/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token || token.length < 10) {
        return res.status(400).json({ error: "Invalid status token" });
      }

      const [signature] = await db
        .select({
          id: ndaSignatures.id,
          signerName: ndaSignatures.signerName,
          signerEmail: ndaSignatures.signerEmail,
          signedAt: ndaSignatures.signedAt,
          approved: ndaSignatures.approved,
          approvedAt: ndaSignatures.approvedAt,
          rejected: ndaSignatures.rejected,
          cimDocumentId: ndaSignatures.cimDocumentId,
        })
        .from(ndaSignatures)
        .where(eq(ndaSignatures.statusCheckToken, token))
        .limit(1);

      if (!signature) {
        return res.status(404).json({ error: "NDA signature not found" });
      }

      // Get the document title (without exposing sensitive data)
      const doc = await storage.getCimDocument(signature.cimDocumentId);

      res.json({
        signerName: signature.signerName,
        signedAt: signature.signedAt,
        status: signature.rejected ? "rejected" :
                signature.approved ? "approved" : "pending",
        approvedAt: signature.approvedAt,
        documentTitle: doc?.title || "Confidential Document",
      });
    } catch (error) {
      console.error("Error checking NDA status:", error);
      res.status(500).json({ error: "Failed to check NDA status" });
    }
  });
}
