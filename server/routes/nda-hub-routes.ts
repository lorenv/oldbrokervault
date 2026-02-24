import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { ndaSignatures, ndaAccessTokens, cimDocuments, deals, organizationMembers, dealNdas } from "@shared/schema";
import { eq, and, or, inArray, desc, asc, isNull, ilike, sql } from "drizzle-orm";
import { sendApprovalEmail, sendRejectionEmail } from "../email";
import { dispatchWebhookEvent } from "../webhook-dispatcher";
import { dispatchIntegrationEvent } from "../integrations";
import { advanceBuyerOnApproval } from "./nda-signing-routes";

export function registerNdaHubRoutes(app: Express) {
  // GET /api/ndas — All NDA signatures across all user's CIM documents
  app.get("/api/ndas", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const {
        status = "all",
        search = "",
        cimDocumentId,
        dealId,
        page = "1",
        pageSize = "25",
        sortField = "signedAt",
        sortOrder = "desc",
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page));
      const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
      const offset = (pageNum - 1) * pageSizeNum;

      // Get all user's CIM documents
      const userDocs = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title,
          dealId: cimDocuments.dealId,
        })
        .from(cimDocuments)
        .where(
          and(eq(cimDocuments.userId, req.user.id), isNull(cimDocuments.deletedAt))
        );

      if (userDocs.length === 0) {
        return res.json({ signatures: [], total: 0, page: pageNum, pageSize: pageSizeNum });
      }

      let docIds = userDocs.map((doc) => doc.id);

      // Filter by specific CIM document
      if (cimDocumentId) {
        const cimId = parseInt(cimDocumentId);
        if (docIds.includes(cimId)) {
          docIds = [cimId];
        } else {
          return res.json({ signatures: [], total: 0, page: pageNum, pageSize: pageSizeNum });
        }
      }

      // Filter by deal — find which documents belong to that deal
      if (dealId) {
        const dId = parseInt(dealId);
        const dealDocIds = userDocs.filter((d) => d.dealId === dId).map((d) => d.id);
        if (dealDocIds.length === 0) {
          return res.json({ signatures: [], total: 0, page: pageNum, pageSize: pageSizeNum });
        }
        docIds = docIds.filter((id) => dealDocIds.includes(id));
      }

      // Build conditions
      const conditions: any[] = [inArray(ndaSignatures.cimDocumentId, docIds)];

      // Status filter
      if (status === "pending") {
        conditions.push(eq(ndaSignatures.approved, false));
        conditions.push(eq(ndaSignatures.rejected, false));
      } else if (status === "approved") {
        conditions.push(eq(ndaSignatures.approved, true));
      } else if (status === "rejected") {
        conditions.push(eq(ndaSignatures.rejected, true));
      }

      // Search filter
      if (search) {
        conditions.push(
          or(
            ilike(ndaSignatures.signerName, `%${search}%`),
            ilike(ndaSignatures.signerEmail, `%${search}%`)
          )
        );
      }

      const whereClause = and(...conditions);

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(ndaSignatures)
        .where(whereClause);
      const total = Number(countResult.count);

      // Determine sort
      const sortCol =
        sortField === "signerName"
          ? ndaSignatures.signerName
          : sortField === "signerEmail"
          ? ndaSignatures.signerEmail
          : sortField === "approved"
          ? ndaSignatures.approved
          : ndaSignatures.signedAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      // Get signatures (including dealNdaId for deal-level NDA tracking)
      const signatures = await db
        .select({
          id: ndaSignatures.id,
          cimDocumentId: ndaSignatures.cimDocumentId,
          dealNdaId: ndaSignatures.dealNdaId,
          signerName: ndaSignatures.signerName,
          signerEmail: ndaSignatures.signerEmail,
          signerLocation: ndaSignatures.signerLocation,
          signedAt: ndaSignatures.signedAt,
          approved: ndaSignatures.approved,
          approvedAt: ndaSignatures.approvedAt,
          rejected: ndaSignatures.rejected,
          rejectedAt: ndaSignatures.rejectedAt,
          stage: ndaSignatures.stage,
          fieldValues: ndaSignatures.fieldValues,
        })
        .from(ndaSignatures)
        .where(whereClause)
        .orderBy(orderFn(sortCol))
        .limit(pageSizeNum)
        .offset(offset);

      // Build lookup maps
      const docMap = new Map(userDocs.map((d) => [d.id, d]));

      // Get deal names for documents that have dealId
      const dealIds = Array.from(new Set(userDocs.filter((d) => d.dealId).map((d) => d.dealId!)));
      let dealMap = new Map<number, string>();
      if (dealIds.length > 0) {
        const dealRows = await db
          .select({ id: deals.id, name: deals.name })
          .from(deals)
          .where(inArray(deals.id, dealIds));
        dealMap = new Map(dealRows.map((d) => [d.id, d.name]));
      }

      // Get deal NDA names for signatures that came through deal NDAs
      const dealNdaIds = Array.from(new Set(signatures.filter((s) => s.dealNdaId).map((s) => s.dealNdaId!)));
      let dealNdaMap = new Map<number, { name: string | null; dealId: number }>();
      if (dealNdaIds.length > 0) {
        const ndaRows = await db
          .select({ id: dealNdas.id, name: dealNdas.name, dealId: dealNdas.dealId })
          .from(dealNdas)
          .where(inArray(dealNdas.id, dealNdaIds));
        dealNdaMap = new Map(ndaRows.map((n) => [n.id, { name: n.name, dealId: n.dealId }]));
      }

      // Format response
      const formattedSignatures = signatures.map((sig) => {
        const doc = docMap.get(sig.cimDocumentId);
        const ndaInfo = sig.dealNdaId ? dealNdaMap.get(sig.dealNdaId) : null;
        const sigDealId = ndaInfo?.dealId || doc?.dealId || null;
        return {
          id: sig.id,
          signerName: sig.signerName,
          signerEmail: sig.signerEmail,
          signerLocation: sig.signerLocation || "",
          signedAt: sig.signedAt.toISOString(),
          approved: sig.approved,
          approvedAt: sig.approvedAt?.toISOString() || null,
          rejected: sig.rejected,
          rejectedAt: sig.rejectedAt?.toISOString() || null,
          stage: sig.stage,
          cimDocumentId: sig.cimDocumentId,
          documentTitle: doc?.title || "Unknown Document",
          dealId: sigDealId,
          dealName: sigDealId ? dealMap.get(sigDealId) || null : null,
          dealNdaId: sig.dealNdaId || null,
          dealNdaName: ndaInfo?.name || null,
        };
      });

      res.json({
        signatures: formattedSignatures,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
      });
    } catch (error) {
      console.error("Error fetching NDA signatures:", error);
      res.status(500).json({ error: "Failed to fetch NDA signatures" });
    }
  });

  // GET /api/ndas/summary — Stats for summary cards
  app.get("/api/ndas/summary", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userDocs = await db
        .select({ id: cimDocuments.id })
        .from(cimDocuments)
        .where(
          and(eq(cimDocuments.userId, req.user.id), isNull(cimDocuments.deletedAt))
        );

      if (userDocs.length === 0) {
        return res.json({ total: 0, pending: 0, approved: 0, rejected: 0 });
      }

      const docIds = userDocs.map((d) => d.id);

      const [stats] = await db
        .select({
          total: sql<number>`count(*)`,
          pending: sql<number>`count(*) filter (where ${ndaSignatures.approved} = false and ${ndaSignatures.rejected} = false)`,
          approved: sql<number>`count(*) filter (where ${ndaSignatures.approved} = true)`,
          rejected: sql<number>`count(*) filter (where ${ndaSignatures.rejected} = true)`,
        })
        .from(ndaSignatures)
        .where(inArray(ndaSignatures.cimDocumentId, docIds));

      res.json({
        total: Number(stats.total),
        pending: Number(stats.pending),
        approved: Number(stats.approved),
        rejected: Number(stats.rejected),
      });
    } catch (error) {
      console.error("Error fetching NDA summary:", error);
      res.status(500).json({ error: "Failed to fetch NDA summary" });
    }
  });

  // GET /api/ndas/:id — Single NDA signature with full context
  app.get("/api/ndas/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getNdaSignatureById(signatureId);

      if (!signature) {
        return res.status(404).json({ error: "Signature not found" });
      }

      // Verify ownership through document
      const doc = await storage.getCimDocument(signature.cimDocumentId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Signature not found" });
      }

      // Get deal info
      let dealName: string | null = null;
      if (doc.dealId) {
        const [deal] = await db
          .select({ name: deals.name })
          .from(deals)
          .where(eq(deals.id, doc.dealId));
        dealName = deal?.name || null;
      }

      // Get access token
      const [accessToken] = await db
        .select({
          token: ndaAccessTokens.token,
          isActive: ndaAccessTokens.isActive,
          lastAccessedAt: ndaAccessTokens.lastAccessedAt,
        })
        .from(ndaAccessTokens)
        .where(eq(ndaAccessTokens.ndaSignatureId, signatureId));

      // Get NDA template name if available
      let templateName: string | null = null;
      if (doc.ndaTemplateId) {
        const template = await storage.getNdaTemplate(doc.ndaTemplateId);
        templateName = template?.name || null;
      }

      res.json({
        id: signature.id,
        signerName: signature.signerName,
        signerEmail: signature.signerEmail,
        signerIpAddress: signature.signerIpAddress,
        signerLocation: signature.signerLocation || "",
        signedAt: signature.signedAt.toISOString(),
        approved: signature.approved,
        approvedAt: signature.approvedAt?.toISOString() || null,
        rejected: signature.rejected,
        rejectedAt: signature.rejectedAt?.toISOString() || null,
        stage: signature.stage,
        fieldValues: signature.fieldValues,
        statusCheckToken: signature.statusCheckToken,
        cimDocumentId: signature.cimDocumentId,
        documentTitle: doc.title,
        dealId: doc.dealId || null,
        dealName,
        templateName,
        ndaApprovalRequired: doc.ndaApprovalRequired,
        accessToken: accessToken
          ? {
              token: accessToken.token,
              isActive: accessToken.isActive,
              lastAccessedAt: accessToken.lastAccessedAt?.toISOString() || null,
            }
          : null,
      });
    } catch (error) {
      console.error("Error fetching NDA signature:", error);
      res.status(500).json({ error: "Failed to fetch NDA signature" });
    }
  });

  // POST /api/ndas/:id/approve — Approve from global view
  app.post("/api/ndas/:id/approve", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getNdaSignatureById(signatureId);

      if (!signature) {
        return res.status(404).json({ error: "Signature not found" });
      }

      // Verify ownership through document
      const doc = await storage.getCimDocument(signature.cimDocumentId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Signature not found" });
      }

      const approvedSignature = await storage.approveNdaSignature(signatureId, req.user.id);

      // Advance buyer pipeline stage from "NDA Signed" → "CIM Sent"
      const [hubOwnerMember] = await db.select().from(organizationMembers)
        .where(and(eq(organizationMembers.userId, doc.userId), eq(organizationMembers.status, 'active')))
        .limit(1);
      if (hubOwnerMember && approvedSignature.signerEmail) {
        advanceBuyerOnApproval(approvedSignature.signerEmail, signature.cimDocumentId, hubOwnerMember.organizationId);
      }

      const ownerProfile = await storage.getUserProfile(doc.userId);
      await sendApprovalEmail(approvedSignature, doc, ownerProfile);

      res.json({
        success: true,
        signature: approvedSignature,
        message: "Signer approved and notified",
      });
    } catch (error) {
      console.error("Error approving NDA signature:", error);
      res.status(500).json({ error: "Failed to approve signature" });
    }
  });

  // POST /api/ndas/:id/reject — Reject from global view
  app.post("/api/ndas/:id/reject", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getNdaSignatureById(signatureId);

      if (!signature) {
        return res.status(404).json({ error: "Signature not found" });
      }

      const doc = await storage.getCimDocument(signature.cimDocumentId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Signature not found" });
      }

      const rejectedSignature = await storage.rejectNdaSignature(signatureId, req.user.id);
      const ownerProfile = await storage.getUserProfile(doc.userId);

      await sendRejectionEmail(
        rejectedSignature.signerEmail,
        rejectedSignature.signerName,
        doc.title,
        {
          name: req.user.name || req.user.email,
          email: req.user.email,
          businessName: ownerProfile?.businessName || undefined,
        }
      );

      // Dispatch events
      const ndaDeclinedPayload = {
        cim_id: signature.cimDocumentId,
        document_title: doc.title,
        recipient_email: rejectedSignature.signerEmail,
        recipient_name: rejectedSignature.signerName,
        decline_reason: "Rejected by document owner",
        declined_at: new Date().toISOString(),
      };
      dispatchIntegrationEvent(req.user.id, "nda.declined", ndaDeclinedPayload).catch(
        (err) => console.error("Integration dispatch error:", err)
      );
      dispatchWebhookEvent(req.user.id, "nda.declined", ndaDeclinedPayload).catch(
        (err) => console.error("Webhook dispatch error:", err)
      );

      res.json({
        success: true,
        signature: rejectedSignature,
        message: "Signer rejected and notified",
      });
    } catch (error) {
      console.error("Error rejecting NDA signature:", error);
      res.status(500).json({ error: "Failed to reject signature" });
    }
  });

  // POST /api/ndas/approve-batch — Batch approve
  app.post("/api/ndas/approve-batch", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { signatureIds } = req.body;
      if (!Array.isArray(signatureIds) || signatureIds.length === 0) {
        return res.status(400).json({ error: "Invalid signature IDs" });
      }

      // Verify all signatures belong to user's documents
      const sigs = await db
        .select({
          id: ndaSignatures.id,
          cimDocumentId: ndaSignatures.cimDocumentId,
        })
        .from(ndaSignatures)
        .where(inArray(ndaSignatures.id, signatureIds));

      const docIds = Array.from(new Set(sigs.map((s) => s.cimDocumentId)));
      const userDocs = await db
        .select({ id: cimDocuments.id })
        .from(cimDocuments)
        .where(
          and(
            eq(cimDocuments.userId, req.user.id),
            inArray(cimDocuments.id, docIds),
            isNull(cimDocuments.deletedAt)
          )
        );
      const ownedDocIds = new Set(userDocs.map((d) => d.id));
      const validIds = sigs.filter((s) => ownedDocIds.has(s.cimDocumentId)).map((s) => s.id);

      if (validIds.length === 0) {
        return res.status(400).json({ error: "No valid signatures to approve" });
      }

      const approvedSignatures = await storage.approveNdaSignaturesBatch(validIds, req.user.id);

      // Advance buyer pipeline stages and send approval emails
      const [hubBatchOwnerMember] = await db.select().from(organizationMembers)
        .where(and(eq(organizationMembers.userId, req.user.id), eq(organizationMembers.status, 'active')))
        .limit(1);

      for (const sig of approvedSignatures) {
        // Advance buyer pipeline stage from "NDA Signed" → "CIM Sent"
        if (hubBatchOwnerMember && sig.signerEmail) {
          advanceBuyerOnApproval(sig.signerEmail, sig.cimDocumentId, hubBatchOwnerMember.organizationId);
        }

        const doc = await storage.getCimDocument(sig.cimDocumentId);
        if (doc) {
          const ownerProfile = await storage.getUserProfile(doc.userId);
          await sendApprovalEmail(sig, doc, ownerProfile);
        }
      }

      res.json({
        success: true,
        count: approvedSignatures.length,
        message: `${approvedSignatures.length} signers approved and notified`,
      });
    } catch (error) {
      console.error("Error batch approving NDA signatures:", error);
      res.status(500).json({ error: "Failed to approve signatures" });
    }
  });

  // POST /api/ndas/reject-batch — Batch reject
  app.post("/api/ndas/reject-batch", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { signatureIds } = req.body;
      if (!Array.isArray(signatureIds) || signatureIds.length === 0) {
        return res.status(400).json({ error: "Invalid signature IDs" });
      }

      // Verify all signatures belong to user's documents
      const sigs = await db
        .select({
          id: ndaSignatures.id,
          cimDocumentId: ndaSignatures.cimDocumentId,
        })
        .from(ndaSignatures)
        .where(inArray(ndaSignatures.id, signatureIds));

      const docIds = Array.from(new Set(sigs.map((s) => s.cimDocumentId)));
      const userDocs = await db
        .select({ id: cimDocuments.id })
        .from(cimDocuments)
        .where(
          and(
            eq(cimDocuments.userId, req.user.id),
            inArray(cimDocuments.id, docIds),
            isNull(cimDocuments.deletedAt)
          )
        );
      const ownedDocIds = new Set(userDocs.map((d) => d.id));
      const validIds = sigs.filter((s) => ownedDocIds.has(s.cimDocumentId)).map((s) => s.id);

      if (validIds.length === 0) {
        return res.status(400).json({ error: "No valid signatures to reject" });
      }

      const rejectedSignatures = await storage.rejectNdaSignaturesBatch(validIds, req.user.id);

      // Send rejection emails
      for (const sig of rejectedSignatures) {
        const doc = await storage.getCimDocument(sig.cimDocumentId);
        if (doc) {
          const ownerProfile = await storage.getUserProfile(doc.userId);
          await sendRejectionEmail(sig.signerEmail, sig.signerName, doc.title, {
            name: req.user.name || req.user.email,
            email: req.user.email,
            businessName: ownerProfile?.businessName || undefined,
          });
        }
      }

      res.json({
        success: true,
        count: rejectedSignatures.length,
        message: `${rejectedSignatures.length} signers rejected and notified`,
      });
    } catch (error) {
      console.error("Error batch rejecting NDA signatures:", error);
      res.status(500).json({ error: "Failed to reject signatures" });
    }
  });
}
