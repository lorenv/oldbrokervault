import type { Express } from "express";
import { db } from "../db";
import { storage } from "../storage";
import {
  dealNdas,
  dealDocuments,
  deals,
  ndaSignatures,
  ndaAccessTokens,
  ndaTemplates,
  organizationMembers,
  crmContacts,
  dealBuyers,
  buyerPipelineStages,
  cimDocuments,
  users,
} from "@shared/schema";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import { generateSecureToken, generateRedirectId } from "../token-utils";
import { checkWhitelist } from "./nda-whitelist-routes";
import {
  sendNdaSignedEmail,
  sendApprovalEmail,
  sendOwnerApprovalNotification,
  sendRejectionEmail,
  sendNdaPendingEmail,
} from "../email";
import { PdfSignatureProcessor } from "../pdf-signature-processor";
import { addCertificateToNda } from "../pdf-utils";
import { findOrCreateCompanyFromEmail, enrichCompanyFromWebsite } from "../services/company-enrichment";
import { advanceBuyerOnApproval } from "./nda-signing-routes";
import crypto from "crypto";

function generateShareSlug(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function registerDealNdaRoutes(app: Express) {
  // =========================================================
  // Authenticated endpoints
  // =========================================================

  // GET /api/deals/:dealId/ndas — List all NDAs for a deal
  app.get("/api/deals/:dealId/ndas", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const dealId = parseInt(req.params.dealId);

      // Get user's org
      const [member] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user.id), eq(organizationMembers.status, "active")))
        .limit(1);

      if (!member) return res.status(403).json({ error: "No organization" });

      // Verify the deal belongs to this org
      const [deal] = await db
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.id, dealId), eq(deals.organizationId, member.organizationId)))
        .limit(1);

      if (!deal) return res.status(404).json({ error: "Deal not found" });

      // Get all active NDAs for this deal
      const ndas = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.dealId, dealId), eq(dealNdas.isActive, true)))
        .orderBy(desc(dealNdas.createdAt));

      // Enrich with signature counts and CIM/template names
      const enriched = await Promise.all(
        ndas.map(async (nda) => {
          // Get signature counts
          const [sigCounts] = await db
            .select({
              total: sql<number>`count(*)`,
              pending: sql<number>`count(*) filter (where ${ndaSignatures.approved} = false and ${ndaSignatures.rejected} = false)`,
              approved: sql<number>`count(*) filter (where ${ndaSignatures.approved} = true)`,
            })
            .from(ndaSignatures)
            .where(eq(ndaSignatures.dealNdaId, nda.id));

          // Get CIM name
          const [cim] = await db
            .select({ title: cimDocuments.title })
            .from(cimDocuments)
            .where(eq(cimDocuments.id, nda.cimDocumentId))
            .limit(1);

          // Get template name
          let templateName: string | null = null;
          if (nda.ndaTemplateId) {
            const [tmpl] = await db
              .select({ name: ndaTemplates.name })
              .from(ndaTemplates)
              .where(eq(ndaTemplates.id, nda.ndaTemplateId))
              .limit(1);
            templateName = tmpl?.name || null;
          }

          return {
            ...nda,
            cimTitle: cim?.title || "Unknown Document",
            templateName,
            signatureStats: {
              total: Number(sigCounts?.total || 0),
              pending: Number(sigCounts?.pending || 0),
              approved: Number(sigCounts?.approved || 0),
            },
          };
        })
      );

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching deal NDAs:", error);
      res.status(500).json({ error: "Failed to fetch deal NDAs" });
    }
  });

  // POST /api/deals/:dealId/ndas — Create NDA for a deal
  app.post("/api/deals/:dealId/ndas", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const dealId = parseInt(req.params.dealId);
      const { cimDocumentId, ndaTemplateId, approvalRequired, copyMeOnEmails, name } = req.body;

      if (!cimDocumentId) {
        return res.status(400).json({ error: "cimDocumentId is required" });
      }

      // Get user's org
      const [member] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user.id), eq(organizationMembers.status, "active")))
        .limit(1);

      if (!member) return res.status(403).json({ error: "No organization" });

      // Verify the deal belongs to this org
      const [deal] = await db
        .select({ id: deals.id, name: deals.name })
        .from(deals)
        .where(and(eq(deals.id, dealId), eq(deals.organizationId, member.organizationId)))
        .limit(1);

      if (!deal) return res.status(404).json({ error: "Deal not found" });

      // Verify CIM is linked to this deal
      const [docLink] = await db
        .select()
        .from(dealDocuments)
        .where(and(eq(dealDocuments.dealId, dealId), eq(dealDocuments.cimDocumentId, cimDocumentId)))
        .limit(1);

      // Also check the cimDocuments.dealId field
      const [cimDoc] = await db
        .select({ id: cimDocuments.id, dealId: cimDocuments.dealId })
        .from(cimDocuments)
        .where(eq(cimDocuments.id, cimDocumentId))
        .limit(1);

      if (!docLink && cimDoc?.dealId !== dealId) {
        return res.status(400).json({ error: "CIM is not linked to this deal" });
      }

      const shareSlug = generateShareSlug();

      const [newNda] = await db
        .insert(dealNdas)
        .values({
          dealId,
          cimDocumentId,
          organizationId: member.organizationId,
          ndaTemplateId: ndaTemplateId || null,
          approvalRequired: approvalRequired ?? false,
          copyMeOnEmails: copyMeOnEmails ?? false,
          shareSlug,
          name: name || `${deal.name} NDA`,
        })
        .returning();

      res.json(newNda);
    } catch (error) {
      console.error("Error creating deal NDA:", error);
      res.status(500).json({ error: "Failed to create deal NDA" });
    }
  });

  // GET /api/deal-ndas/:id — Get single NDA detail
  app.get("/api/deal-ndas/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const ndaId = parseInt(req.params.id);

      const [member] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user.id), eq(organizationMembers.status, "active")))
        .limit(1);

      if (!member) return res.status(403).json({ error: "No organization" });

      const [nda] = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.id, ndaId), eq(dealNdas.organizationId, member.organizationId)))
        .limit(1);

      if (!nda) return res.status(404).json({ error: "NDA not found" });

      res.json(nda);
    } catch (error) {
      console.error("Error fetching deal NDA:", error);
      res.status(500).json({ error: "Failed to fetch deal NDA" });
    }
  });

  // PATCH /api/deal-ndas/:id — Update NDA settings
  app.patch("/api/deal-ndas/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const ndaId = parseInt(req.params.id);

      const [member] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user.id), eq(organizationMembers.status, "active")))
        .limit(1);

      if (!member) return res.status(403).json({ error: "No organization" });

      const [existing] = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.id, ndaId), eq(dealNdas.organizationId, member.organizationId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "NDA not found" });

      const { approvalRequired, copyMeOnEmails, name, ndaTemplateId, shareEnabled } = req.body;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (approvalRequired !== undefined) updates.approvalRequired = approvalRequired;
      if (copyMeOnEmails !== undefined) updates.copyMeOnEmails = copyMeOnEmails;
      if (name !== undefined) updates.name = name;
      if (ndaTemplateId !== undefined) updates.ndaTemplateId = ndaTemplateId;
      if (shareEnabled !== undefined) updates.shareEnabled = shareEnabled;

      const [updated] = await db
        .update(dealNdas)
        .set(updates)
        .where(eq(dealNdas.id, ndaId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating deal NDA:", error);
      res.status(500).json({ error: "Failed to update deal NDA" });
    }
  });

  // DELETE /api/deal-ndas/:id — Soft-delete (isActive=false)
  app.delete("/api/deal-ndas/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const ndaId = parseInt(req.params.id);

      const [member] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user.id), eq(organizationMembers.status, "active")))
        .limit(1);

      if (!member) return res.status(403).json({ error: "No organization" });

      const [existing] = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.id, ndaId), eq(dealNdas.organizationId, member.organizationId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "NDA not found" });

      await db
        .update(dealNdas)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(dealNdas.id, ndaId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting deal NDA:", error);
      res.status(500).json({ error: "Failed to delete deal NDA" });
    }
  });

  // GET /api/deal-ndas/:id/signatures — List signatures for this NDA
  app.get("/api/deal-ndas/:id/signatures", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const ndaId = parseInt(req.params.id);

      const [member] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user.id), eq(organizationMembers.status, "active")))
        .limit(1);

      if (!member) return res.status(403).json({ error: "No organization" });

      const [nda] = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.id, ndaId), eq(dealNdas.organizationId, member.organizationId)))
        .limit(1);

      if (!nda) return res.status(404).json({ error: "NDA not found" });

      const signatures = await db
        .select({
          id: ndaSignatures.id,
          signerName: ndaSignatures.signerName,
          signerEmail: ndaSignatures.signerEmail,
          signerLocation: ndaSignatures.signerLocation,
          signedAt: ndaSignatures.signedAt,
          approved: ndaSignatures.approved,
          approvedAt: ndaSignatures.approvedAt,
          rejected: ndaSignatures.rejected,
          rejectedAt: ndaSignatures.rejectedAt,
          stage: ndaSignatures.stage,
        })
        .from(ndaSignatures)
        .where(eq(ndaSignatures.dealNdaId, ndaId))
        .orderBy(desc(ndaSignatures.signedAt));

      res.json(signatures);
    } catch (error) {
      console.error("Error fetching deal NDA signatures:", error);
      res.status(500).json({ error: "Failed to fetch signatures" });
    }
  });

  // =========================================================
  // Public endpoints (no auth)
  // =========================================================

  // GET /api/nda/:shareSlug — Get NDA info for signing page
  app.get("/api/nda/:shareSlug", async (req, res) => {
    try {
      const { shareSlug } = req.params;

      const [nda] = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.shareSlug, shareSlug), eq(dealNdas.isActive, true), eq(dealNdas.shareEnabled, true)))
        .limit(1);

      if (!nda) return res.status(404).json({ error: "NDA not found" });

      // Get deal name
      const [deal] = await db
        .select({ name: deals.name })
        .from(deals)
        .where(eq(deals.id, nda.dealId))
        .limit(1);

      // Get org branding via an org member's user profile
      let businessLogo: string | null = null;
      let businessName: string | null = null;
      try {
        const [orgMember] = await db
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(eq(organizationMembers.organizationId, nda.organizationId))
          .limit(1);
        if (orgMember?.userId) {
          const [ownerUser] = await db
            .select({ businessLogo: users.businessLogo, businessName: users.businessName })
            .from(users)
            .where(eq(users.id, orgMember.userId))
            .limit(1);
          if (ownerUser) {
            businessLogo = ownerUser.businessLogo || null;
            businessName = ownerUser.businessName || null;
          }
        }
      } catch {
        // Ignore branding lookup errors
      }

      // Get template info
      let templateName: string | null = null;
      if (nda.ndaTemplateId) {
        const [tmpl] = await db
          .select({ name: ndaTemplates.name })
          .from(ndaTemplates)
          .where(eq(ndaTemplates.id, nda.ndaTemplateId))
          .limit(1);
        templateName = tmpl?.name || null;
      }

      res.json({
        id: nda.id,
        name: nda.name,
        dealName: deal?.name || "Confidential Deal",
        businessLogo,
        businessName,
        templateName,
        approvalRequired: nda.approvalRequired,
        hasTemplate: !!nda.ndaTemplateId,
      });
    } catch (error) {
      console.error("Error fetching NDA info:", error);
      res.status(500).json({ error: "Failed to fetch NDA info" });
    }
  });

  // GET /api/nda/:shareSlug/template — Get NDA template for rendering
  app.get("/api/nda/:shareSlug/template", async (req, res) => {
    try {
      const { shareSlug } = req.params;

      const [nda] = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.shareSlug, shareSlug), eq(dealNdas.isActive, true), eq(dealNdas.shareEnabled, true)))
        .limit(1);

      if (!nda) return res.status(404).json({ error: "NDA not found" });

      if (!nda.ndaTemplateId) {
        return res.status(404).json({ error: "No template configured for this NDA" });
      }

      const [template] = await db
        .select()
        .from(ndaTemplates)
        .where(eq(ndaTemplates.id, nda.ndaTemplateId))
        .limit(1);

      if (!template) return res.status(404).json({ error: "Template not found" });

      res.json({
        id: template.id,
        name: template.name,
        fileContent: template.fileContent,
        signatureFields: template.signatureFields,
        pageImages: template.pageImages,
        totalPages: template.totalPages,
      });
    } catch (error) {
      console.error("Error fetching NDA template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // POST /api/nda/:shareSlug/sign — Sign the deal NDA
  app.post("/api/nda/:shareSlug/sign", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const { signerName, signerEmail, fieldValues = {} } = req.body;

      if (!signerName?.trim() || !signerEmail?.trim()) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Find the deal NDA
      const [nda] = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.shareSlug, shareSlug), eq(dealNdas.isActive, true), eq(dealNdas.shareEnabled, true)))
        .limit(1);

      if (!nda) return res.status(404).json({ error: "NDA not found" });

      // Get IP / location
      const signerIpAddress =
        req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
        req.headers["x-real-ip"]?.toString() ||
        req.ip ||
        "unknown";

      let signerLocation = "Unknown Location";
      try {
        const { lookupIp } = await import("../services/geo-ip-service");
        const geo = await lookupIp(signerIpAddress);
        if (geo?.city && geo?.region && geo?.country) {
          signerLocation = `${geo.city}, ${geo.region}, ${geo.country}`;
        } else if (geo?.country) {
          signerLocation = geo.country;
        }
      } catch {
        // ignore
      }

      // Get template
      if (!nda.ndaTemplateId) {
        return res.status(400).json({ error: "No NDA template configured" });
      }

      const [ndaTemplate] = await db
        .select()
        .from(ndaTemplates)
        .where(eq(ndaTemplates.id, nda.ndaTemplateId))
        .limit(1);

      if (!ndaTemplate) return res.status(400).json({ error: "NDA template not found" });

      // Process signature / generate PDF
      const signedAt = new Date();
      let signedNdaContent: string;

      const signatureFields = Array.isArray(ndaTemplate.signatureFields)
        ? ndaTemplate.signatureFields
        : [];

      if (signatureFields.length > 0) {
        const processor = await PdfSignatureProcessor.fromBase64(ndaTemplate.fileContent);
        const processedFieldValues = { ...fieldValues };

        // Auto-populate standard fields
        if (signatureFields.some((f: any) => f.type === "name")) {
          const nameField = signatureFields.find((f: any) => f.type === "name");
          if (nameField && !processedFieldValues[(nameField as any).id]) {
            processedFieldValues[(nameField as any).id] = signerName;
          }
        }
        if (signatureFields.some((f: any) => f.type === "email")) {
          const emailField = signatureFields.find((f: any) => f.type === "email");
          if (emailField && !processedFieldValues[(emailField as any).id]) {
            processedFieldValues[(emailField as any).id] = signerEmail;
          }
        }
        signatureFields
          .filter((f: any) => f.type === "date")
          .forEach((field: any) => {
            if (!processedFieldValues[field.id]) {
              processedFieldValues[field.id] = signedAt.toLocaleDateString();
            }
          });

        signedNdaContent = await processor.embedFields(signatureFields, processedFieldValues);

        try {
          await processor.addCompletionCertificate(signerName, signerEmail, signedAt, signerIpAddress);
          signedNdaContent = await processor.saveAsBase64();
        } catch {
          // continue without certificate
        }
      } else {
        signedNdaContent = await addCertificateToNda(
          ndaTemplate.fileContent,
          signerName,
          signedAt,
          signerEmail,
          signerIpAddress
        );
      }

      // Save signature record
      const [signature] = await db
        .insert(ndaSignatures)
        .values({
          cimDocumentId: nda.cimDocumentId,
          dealNdaId: nda.id,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim().toLowerCase(),
          signerIpAddress,
          signerLocation,
          signedNdaContent,
          fieldValues,
        })
        .returning();

      // Generate status check token
      const statusToken = generateSecureToken();
      await db
        .update(ndaSignatures)
        .set({ statusCheckToken: statusToken })
        .where(eq(ndaSignatures.id, signature.id));

      // Get CIM owner info
      const [cimDoc] = await db
        .select()
        .from(cimDocuments)
        .where(eq(cimDocuments.id, nda.cimDocumentId))
        .limit(1);

      if (!cimDoc) {
        return res.status(500).json({ error: "CIM document not found" });
      }

      const owner = await storage.getUser(cimDoc.userId);
      if (!owner) {
        return res.status(500).json({ error: "Document owner not found" });
      }

      // Create access token
      const accessToken = generateSecureToken();
      await db.insert(ndaAccessTokens).values({
        token: accessToken,
        cimDocumentId: nda.cimDocumentId,
        ndaSignatureId: signature.id,
        dealNdaId: nda.id,
        signerEmail: signerEmail.trim().toLowerCase(),
      });

      // Create redirect link
      const redirectId = generateRedirectId();
      const [tokenRecord] = await db
        .select({ id: ndaAccessTokens.id })
        .from(ndaAccessTokens)
        .where(eq(ndaAccessTokens.token, accessToken))
        .limit(1);

      if (tokenRecord) {
        await storage.createNdaRedirectLink(
          redirectId,
          tokenRecord.id,
          nda.cimDocumentId,
          signerEmail.trim().toLowerCase()
        );
      }

      // CRM: create/find contact, link buyer to deal
      try {
        const orgId = nda.organizationId;
        const company = await findOrCreateCompanyFromEmail(signerEmail, orgId);

        const [existingContact] = await db
          .select()
          .from(crmContacts)
          .where(
            and(
              eq(crmContacts.organizationId, orgId),
              sql`LOWER(${crmContacts.email}) = ${signerEmail.toLowerCase().trim()}`
            )
          )
          .limit(1);

        const nameParts = signerName.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || null;

        let contactId: number;
        if (existingContact) {
          contactId = existingContact.id;
          await db
            .update(crmContacts)
            .set({ contactType: "buyer", updatedAt: new Date(), ...(company ? { companyId: company.id } : {}) })
            .where(eq(crmContacts.id, existingContact.id));
        } else {
          const [newContact] = await db
            .insert(crmContacts)
            .values({
              organizationId: orgId,
              email: signerEmail.toLowerCase().trim(),
              firstName,
              lastName,
              contactType: "buyer",
              source: "nda_signing",
              companyId: company?.id ?? null,
              lifecycleStage: "lead",
              leadStatus: "new",
              customProperties: {},
            })
            .returning();
          contactId = newContact.id;
        }

        if (company && company.enrichmentStatus === "pending") {
          enrichCompanyFromWebsite(company.id).catch(() => {});
        }

        // Link buyer to deal
        const [existingBuyer] = await db
          .select()
          .from(dealBuyers)
          .where(and(eq(dealBuyers.dealId, nda.dealId), eq(dealBuyers.contactId, contactId)))
          .limit(1);

        if (!existingBuyer) {
          const [ndaStage] = await db
            .select()
            .from(buyerPipelineStages)
            .where(
              and(eq(buyerPipelineStages.organizationId, orgId), sql`LOWER(${buyerPipelineStages.name}) = 'nda signed'`)
            )
            .limit(1);

          let stageId: number | null = ndaStage?.id || null;
          if (!stageId) {
            const [firstStage] = await db
              .select()
              .from(buyerPipelineStages)
              .where(eq(buyerPipelineStages.organizationId, orgId))
              .orderBy(asc(buyerPipelineStages.displayOrder))
              .limit(1);
            stageId = firstStage?.id || null;
          }

          if (stageId) {
            await db.insert(dealBuyers).values({
              dealId: nda.dealId,
              contactId,
              stageId,
            });
          }
        }
      } catch (crmErr) {
        console.error("CRM sync failed during deal NDA signing:", crmErr);
      }

      // Check approval flow
      let requiresManualApproval = nda.approvalRequired;

      if (nda.approvalRequired) {
        const whitelistMatch = await checkWhitelist(signerEmail, nda.cimDocumentId, cimDoc.userId);
        if (whitelistMatch) {
          await storage.approveNdaSignature(signature.id, cimDoc.userId);
          advanceBuyerOnApproval(signerEmail, nda.cimDocumentId, nda.organizationId);
          requiresManualApproval = false;
        }
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;

      if (requiresManualApproval) {
        // Notify owner
        await sendOwnerApprovalNotification(
          owner.email,
          owner.name || owner.email,
          cimDoc.title,
          signerName,
          signerEmail,
          signerLocation
        );

        // Send pending email to signer
        const statusUrl = `${baseUrl}/nda/status/${statusToken}`;
        const buyerFormUrl = `${baseUrl}/buyer-form/${statusToken}`;
        await sendNdaPendingEmail(signerEmail, signerName, cimDoc.title, statusUrl, buyerFormUrl);

        return res.json({
          success: true,
          requiresApproval: true,
          statusCheckToken: statusToken,
          message: "NDA signed. Your signature is pending approval.",
        });
      }

      // Auto-approved or no approval needed
      advanceBuyerOnApproval(signerEmail, nda.cimDocumentId, nda.organizationId);

      const ownerProfile = await storage.getUserProfile(cimDoc.userId);
      const redirectUrl = `${baseUrl}/nda/redirect/${redirectId}`;

      const ownerProfileData = {
        name: owner.name || owner.email,
        email: owner.email,
        phone: ownerProfile?.phoneNumber || undefined,
        title: ownerProfile?.title || undefined,
        businessName: ownerProfile?.businessName || undefined,
      };

      await sendNdaSignedEmail(
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

      res.json({
        success: true,
        requiresApproval: false,
        accessToken,
        message: "NDA signed successfully. Check your email for CIM access.",
      });
    } catch (error) {
      console.error("Error signing deal NDA:", error);
      res.status(500).json({
        error: "Failed to process NDA signature",
        details: error instanceof Error ? error.message : undefined,
      });
    }
  });

  // =========================================================
  // Approval endpoints
  // =========================================================

  // POST /api/deal-ndas/:id/signatures/:sigId/approve
  app.post("/api/deal-ndas/:id/signatures/:sigId/approve", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const ndaId = parseInt(req.params.id);
      const sigId = parseInt(req.params.sigId);

      const [member] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user.id), eq(organizationMembers.status, "active")))
        .limit(1);

      if (!member) return res.status(403).json({ error: "No organization" });

      const [nda] = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.id, ndaId), eq(dealNdas.organizationId, member.organizationId)))
        .limit(1);

      if (!nda) return res.status(404).json({ error: "NDA not found" });

      // Verify signature belongs to this NDA
      const [sig] = await db
        .select()
        .from(ndaSignatures)
        .where(and(eq(ndaSignatures.id, sigId), eq(ndaSignatures.dealNdaId, ndaId)))
        .limit(1);

      if (!sig) return res.status(404).json({ error: "Signature not found" });

      const approvedSignature = await storage.approveNdaSignature(sigId, req.user.id);

      // Advance buyer pipeline
      advanceBuyerOnApproval(approvedSignature.signerEmail, nda.cimDocumentId, nda.organizationId);

      // Send approval email
      const cimDoc = await storage.getCimDocument(nda.cimDocumentId);
      if (cimDoc) {
        const ownerProfile = await storage.getUserProfile(cimDoc.userId);
        await sendApprovalEmail(approvedSignature, cimDoc, ownerProfile);
      }

      res.json({ success: true, signature: approvedSignature });
    } catch (error) {
      console.error("Error approving deal NDA signature:", error);
      res.status(500).json({ error: "Failed to approve signature" });
    }
  });

  // POST /api/deal-ndas/:id/signatures/:sigId/reject
  app.post("/api/deal-ndas/:id/signatures/:sigId/reject", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const ndaId = parseInt(req.params.id);
      const sigId = parseInt(req.params.sigId);

      const [member] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user.id), eq(organizationMembers.status, "active")))
        .limit(1);

      if (!member) return res.status(403).json({ error: "No organization" });

      const [nda] = await db
        .select()
        .from(dealNdas)
        .where(and(eq(dealNdas.id, ndaId), eq(dealNdas.organizationId, member.organizationId)))
        .limit(1);

      if (!nda) return res.status(404).json({ error: "NDA not found" });

      const [sig] = await db
        .select()
        .from(ndaSignatures)
        .where(and(eq(ndaSignatures.id, sigId), eq(ndaSignatures.dealNdaId, ndaId)))
        .limit(1);

      if (!sig) return res.status(404).json({ error: "Signature not found" });

      const rejectedSignature = await storage.rejectNdaSignature(sigId, req.user.id);

      const cimDoc = await storage.getCimDocument(nda.cimDocumentId);
      if (cimDoc) {
        const ownerProfile = await storage.getUserProfile(cimDoc.userId);
        await sendRejectionEmail(
          rejectedSignature.signerEmail,
          rejectedSignature.signerName,
          cimDoc.title,
          {
            name: req.user.name || req.user.email,
            email: req.user.email,
            businessName: ownerProfile?.businessName || undefined,
          }
        );
      }

      res.json({ success: true, signature: rejectedSignature });
    } catch (error) {
      console.error("Error rejecting deal NDA signature:", error);
      res.status(500).json({ error: "Failed to reject signature" });
    }
  });
}
