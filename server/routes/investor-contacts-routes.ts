import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, sql, inArray, desc, asc, like, or, count } from "drizzle-orm";
import {
  investorContacts,
  ndaSignatures,
  cimDocuments,
  insertInvestorContactSchema,
  insertAnalysisTemplateSchema,
} from "@shared/schema";
import { dispatchWebhookEvent } from "../webhook-dispatcher";
import { dispatchIntegrationEvent } from "../integrations";

export function registerInvestorContactRoutes(app: Express) {
  // Get all investor contacts with pagination, search, sorting, and CIM document filtering
  app.get("/api/investor-contacts", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      const {
        search,
        status,
        cimDocumentId,
        sortBy = 'lastSeenAt',
        sortOrder = 'desc',
        page = '1',
        limit = '20'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Build conditions
      const conditions = [eq(investorContacts.userId, req.user.id)];

      if (search) {
        conditions.push(
          or(
            like(investorContacts.name, `%${search}%`),
            like(investorContacts.email, `%${search}%`)
          )
        );
      }

      if (status && status !== 'all') {
        conditions.push(eq(investorContacts.status, status as string));
      }

      // Filter by CIM document if specified
      let cimFilteredContactEmails: string[] = [];
      if (cimDocumentId && cimDocumentId !== 'all') {
        const cimId = parseInt(cimDocumentId as string);

        // Get all signatures for this specific CIM document
        const cimSignatures = await db
          .select({ signerEmail: ndaSignatures.signerEmail })
          .from(ndaSignatures)
          .where(eq(ndaSignatures.cimDocumentId, cimId));

        cimFilteredContactEmails = cimSignatures.map(sig => sig.signerEmail);

        // If no signatures found for this CIM, return empty results
        if (cimFilteredContactEmails.length === 0) {
          return res.json({
            contacts: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false
            }
          });
        }

        // Add condition to filter contacts by emails that signed this CIM
        conditions.push(inArray(investorContacts.email, cimFilteredContactEmails));
      }

      // Get total count for pagination
      const totalCountResult = await db
        .select({ count: count() })
        .from(investorContacts)
        .where(and(...conditions));

      const totalCount = totalCountResult[0]?.count || 0;

      // Build query with conditions, sorting, and pagination
      let query = db
        .select()
        .from(investorContacts)
        .where(and(...conditions))
        .limit(limitNum)
        .offset(offset);

      // Apply sorting
      if (sortBy === 'name') {
        query = sortOrder === 'desc' ? query.orderBy(desc(investorContacts.name)) : query.orderBy(asc(investorContacts.name));
      } else if (sortBy === 'email') {
        query = sortOrder === 'desc' ? query.orderBy(desc(investorContacts.email)) : query.orderBy(asc(investorContacts.email));
      } else {
        query = sortOrder === 'desc' ? query.orderBy(desc(investorContacts.lastSeenAt)) : query.orderBy(asc(investorContacts.lastSeenAt));
      }

      const contacts = await query;

      // Auto-sync from NDA signatures if no contacts exist
      if (contacts.length === 0) {
        // Get all user's CIM documents
        const userCims = await db.select().from(cimDocuments).where(eq(cimDocuments.userId, req.user.id));
        const cimIds = userCims.map(cim => cim.id);

        if (cimIds.length > 0) {
          // Get all NDA signatures for user's documents
          const signatures = await db
            .select()
            .from(ndaSignatures)
            .where(inArray(ndaSignatures.cimDocumentId, cimIds));

          // Group signatures by email and create contacts
          const signaturesByEmail = signatures.reduce((acc, sig) => {
            if (!acc[sig.signerEmail]) {
              acc[sig.signerEmail] = [];
            }
            acc[sig.signerEmail].push(sig);
            return acc;
          }, {} as Record<string, any[]>);

          // Create contacts from signatures
          for (const [email, sigs] of Object.entries(signaturesByEmail)) {
            const latestSig = sigs.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime())[0];

            await db
              .insert(investorContacts)
              .values({
                userId: req.user.id,
                email: email,
                name: latestSig.signerName,
                status: 'new',
                totalDocumentViews: sigs.length,
                firstSeenAt: new Date(sigs[0].signedAt),
                lastSeenAt: new Date(latestSig.signedAt),
                tags: []
              });
          }

          // Re-fetch contacts after auto-sync
          const updatedContacts = await db.select().from(investorContacts).where(and(...conditions));
          const allSignatures = await db.select().from(ndaSignatures);

          const enrichedContacts = updatedContacts.map(contact => {
            const contactSignatures = allSignatures.filter(sig => sig.signerEmail === contact.email);
            const contactDocuments = contactSignatures.map(sig => {
              const doc = userCims.find(d => d.id === sig.cimDocumentId);
              return {
                documentId: sig.cimDocumentId,
                documentTitle: doc?.title || 'Unknown Document',
                signedAt: sig.signedAt,
                signerName: sig.signerName,
                cimDocumentId: sig.cimDocumentId,
                signatureId: sig.id
              };
            });

            return {
              ...contact,
              totalNdaSignatures: contactSignatures.length,
              documents: contactDocuments,
              lastNdaSigned: contactSignatures.length > 0 ? Math.max(...contactSignatures.map(sig => new Date(sig.signedAt).getTime())) : null
            };
          });

          return res.json(enrichedContacts);
        }
      }

      // Efficiently get NDA signature data using joins for better performance

      // Get user's document IDs for filtering
      const userCims = await db
        .select({ id: cimDocuments.id })
        .from(cimDocuments)
        .where(eq(cimDocuments.userId, req.user.id));
      const userCimIds = userCims.map(cim => cim.id);

      // Use efficient aggregation query to get signature counts and latest dates
      const signatureStats = userCimIds.length > 0 ? await db
        .select({
          signerEmail: ndaSignatures.signerEmail,
          totalSignatures: sql<number>`COUNT(*)::int`,
          lastSignedAt: sql<Date>`MAX(${ndaSignatures.signedAt})`
        })
        .from(ndaSignatures)
        .where(
          and(
            inArray(ndaSignatures.cimDocumentId, userCimIds),
            sql`${ndaSignatures.signerEmail} IN (${sql.join(
              contacts.map(c => sql`${c.email}`),
              sql`, `
            )})`
          )
        )
        .groupBy(ndaSignatures.signerEmail) : [];

      // Get detailed document info only for contacts that need it
      const contactDocuments = userCimIds.length > 0 ? await db
        .select({
          signerEmail: ndaSignatures.signerEmail,
          documentId: ndaSignatures.cimDocumentId,
          documentTitle: cimDocuments.title,
          signedAt: ndaSignatures.signedAt,
          signerName: ndaSignatures.signerName,
          cimDocumentId: ndaSignatures.cimDocumentId,
          signatureId: ndaSignatures.id
        })
        .from(ndaSignatures)
        .innerJoin(cimDocuments, eq(ndaSignatures.cimDocumentId, cimDocuments.id))
        .where(
          and(
            inArray(ndaSignatures.cimDocumentId, userCimIds),
            sql`${ndaSignatures.signerEmail} IN (${sql.join(
              contacts.map(c => sql`${c.email}`),
              sql`, `
            )})`
          )
        ) : [];

      // Create lookup maps for O(1) access
      const statsMap = new Map(signatureStats.map(stat => [stat.signerEmail, stat]));
      const docsMap = new Map<string, typeof contactDocuments>();
      contactDocuments.forEach(doc => {
        if (!docsMap.has(doc.signerEmail)) {
          docsMap.set(doc.signerEmail, []);
        }
        docsMap.get(doc.signerEmail)!.push(doc);
      });

      // Efficiently enrich contacts using lookup maps
      const enrichedContacts = contacts.map(contact => {
        const stats = statsMap.get(contact.email);
        const docs = docsMap.get(contact.email) || [];

        return {
          ...contact,
          totalNdaSignatures: stats?.totalSignatures || 0,
          documents: docs.map(doc => ({
            documentId: doc.documentId,
            cimDocumentId: doc.documentId, // Add this for consistency
            documentTitle: doc.documentTitle,
            signedAt: doc.signedAt,
            signerName: doc.signerName,
            signatureId: doc.signatureId // Add the missing signatureId
          })),
          lastNdaSigned: stats?.lastSignedAt ? new Date(stats.lastSignedAt).getTime() : null
        };
      });

      // Return paginated response with metadata
      res.json({
        contacts: enrichedContacts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1
        }
      });
    } catch (error) {
      console.error('Error fetching investor contacts:', error);
      res.status(500).json({ error: "Failed to fetch investor contacts" });
    }
  });

  // Create investor contact manually
  app.post("/api/investor-contacts", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Validate input
      const validatedData = insertInvestorContactSchema.parse(req.body);

      // Check if contact with this email already exists for this user
      const existingContact = await db.select()
        .from(investorContacts)
        .where(and(
          eq(investorContacts.userId, req.user.id),
          eq(investorContacts.email, validatedData.email)
        ))
        .limit(1);

      if (existingContact.length > 0) {
        return res.status(400).json({ error: "A contact with this email already exists" });
      }

      // Create new contact
      const [newContact] = await db
        .insert(investorContacts)
        .values({
          userId: req.user.id,
          email: validatedData.email,
          name: validatedData.name,
          notes: validatedData.notes || '',
          tags: validatedData.tags || [],
          status: validatedData.status || 'new',
          location: req.body.location || null,
          nextFollowUpDate: validatedData.nextFollowUpDate ? new Date(validatedData.nextFollowUpDate) : null,
          lastContactDate: validatedData.lastContactDate ? new Date(validatedData.lastContactDate) : null,
          totalDocumentViews: 0,
          totalTimeSpentMinutes: 0,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          ipAddress: null,
          isPotentialVpn: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Dispatch webhook event for contact created (async, don't await)
      const contactCreatedPayload = {
        contact_id: newContact.id,
        email: newContact.email,
        name: newContact.name,
        status: newContact.status,
        created_at: newContact.createdAt,
        contact: {
          email: newContact.email,
          name: newContact.name,
          company: newContact.company,
          phone: newContact.phone,
        },
      };
      dispatchWebhookEvent(req.user!.id, 'contact.created', contactCreatedPayload)
        .catch(err => console.error('Webhook dispatch error:', err));
      dispatchIntegrationEvent(req.user!.id, 'contact.created', contactCreatedPayload)
        .catch(err => console.error('Integration dispatch error:', err));

      res.json(newContact);
    } catch (error: any) {
      console.error('Error creating investor contact:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid contact data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  // Update investor contact
  app.put("/api/investor-contacts/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      const contactId = parseInt(req.params.id);

      // Process request body to handle date fields properly
      const updateData = {
        ...req.body,
        nextFollowUpDate: req.body.nextFollowUpDate ? new Date(req.body.nextFollowUpDate) : null,
        updatedAt: new Date()
      };

      const [updated] = await db
        .update(investorContacts)
        .set(updateData)
        .where(and(
          eq(investorContacts.id, contactId),
          eq(investorContacts.userId, req.user.id)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Dispatch contact.updated event
      const contactUpdatedPayload = {
        contact_id: updated.id,
        email: updated.email,
        name: updated.name,
        company: updated.company,
        updated_fields: Object.keys(req.body),
        updated_at: new Date().toISOString(),
      };
      dispatchIntegrationEvent(req.user.id, 'contact.updated', contactUpdatedPayload)
        .catch(err => console.error('Integration dispatch error:', err));
      dispatchWebhookEvent(req.user.id, 'contact.updated', contactUpdatedPayload)
        .catch(err => console.error('Webhook dispatch error:', err));

      res.json(updated);
    } catch (error) {
      console.error('Error updating investor contact:', error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  // Bulk delete investor contacts
  app.post("/api/investor-contacts/bulk-delete", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { contactIds } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "No contact IDs provided" });
      }

      // Delete contacts belonging to this user
      const result = await db
        .delete(investorContacts)
        .where(
          and(
            eq(investorContacts.userId, req.user.id),
            inArray(investorContacts.id, contactIds)
          )
        )
        .returning();

      res.json({ deleted: result.length });
    } catch (error) {
      console.error('Error bulk deleting contacts:', error);
      res.status(500).json({ error: "Failed to delete contacts" });
    }
  });

  // Bulk update investor contacts
  app.post("/api/investor-contacts/bulk-update", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { contactIds, updates } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "No contact IDs provided" });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }

      // Update contacts belonging to this user
      const result = await db
        .update(investorContacts)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(investorContacts.userId, req.user.id),
            inArray(investorContacts.id, contactIds)
          )
        )
        .returning();

      res.json({ updated: result.length });
    } catch (error) {
      console.error('Error bulk updating contacts:', error);
      res.status(500).json({ error: "Failed to update contacts" });
    }
  });

  // Bulk add tag to investor contacts
  app.post("/api/investor-contacts/bulk-add-tag", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { contactIds, tag } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "No contact IDs provided" });
      }

      if (!tag || typeof tag !== 'string') {
        return res.status(400).json({ error: "No tag provided" });
      }

      // Get current contacts
      const currentContacts = await db
        .select()
        .from(investorContacts)
        .where(
          and(
            eq(investorContacts.userId, req.user.id),
            inArray(investorContacts.id, contactIds)
          )
        );

      // Update each contact's tags
      let updatedCount = 0;
      for (const contact of currentContacts) {
        const currentTags = contact.tags || [];
        if (!currentTags.includes(tag)) {
          await db
            .update(investorContacts)
            .set({
              tags: [...currentTags, tag],
              updatedAt: new Date()
            })
            .where(eq(investorContacts.id, contact.id));
          updatedCount++;
        }
      }

      res.json({ updated: updatedCount });
    } catch (error) {
      console.error('Error bulk adding tag:', error);
      res.status(500).json({ error: "Failed to add tag" });
    }
  });

  // Create or update investor contact from NDA signature
  app.post("/api/investor-contacts/sync-from-signatures", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      // Get all user's CIM documents
      const userCims = await db.select().from(cimDocuments).where(eq(cimDocuments.userId, req.user.id));
      const cimIds = userCims.map(cim => cim.id);

      if (cimIds.length === 0) {
        return res.json({ synced: 0 });
      }

      // Get all NDA signatures for user's documents
      const signatures = await db
        .select()
        .from(ndaSignatures)
        .where(inArray(ndaSignatures.cimDocumentId, cimIds));

      let syncedCount = 0;

      // Group signatures by email
      const signaturesByEmail = signatures.reduce((acc, sig) => {
        if (!acc[sig.signerEmail]) {
          acc[sig.signerEmail] = [];
        }
        acc[sig.signerEmail].push(sig);
        return acc;
      }, {} as Record<string, any[]>);

      // Process each unique signer
      for (const [email, sigs] of Object.entries(signaturesByEmail)) {
        const latestSig = sigs.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime())[0];

        // Check if contact already exists
        const [existingContact] = await db
          .select()
          .from(investorContacts)
          .where(and(
            eq(investorContacts.userId, req.user.id),
            eq(investorContacts.email, email)
          ));

        if (existingContact) {
          // Update existing contact with latest data
          await db
            .update(investorContacts)
            .set({
              totalDocumentViews: existingContact.totalDocumentViews + 1,
              lastSeenAt: new Date(latestSig.signedAt),
              updatedAt: new Date()
            })
            .where(eq(investorContacts.id, existingContact.id));
        } else {
          // Create new contact
          await db
            .insert(investorContacts)
            .values({
              userId: req.user.id,
              email: email,
              name: latestSig.signerName,
              status: 'new',
              totalDocumentViews: sigs.length,
              firstSeenAt: new Date(sigs[0].signedAt),
              lastSeenAt: new Date(latestSig.signedAt),
              tags: []
            });
          syncedCount++;
        }
      }

      res.json({ synced: syncedCount });
    } catch (error) {
      console.error('Error syncing investor contacts:', error);
      res.status(500).json({ error: "Failed to sync contacts" });
    }
  });

  // Get CIM documents for investor contacts filtering
  app.get("/api/investor-contacts/cim-documents", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      // Get all CIM documents for this user
      const userCims = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title,
          createdAt: cimDocuments.createdAt
        })
        .from(cimDocuments)
        .where(eq(cimDocuments.userId, req.user.id))
        .orderBy(desc(cimDocuments.createdAt));

      res.json(userCims);
    } catch (error) {
      console.error('Error fetching CIM documents:', error);
      res.status(500).json({ error: "Failed to fetch CIM documents" });
    }
  });

  // Export investor contacts to CSV
  app.get("/api/investor-contacts/export", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      const { contactIds } = req.query;

      let query = db.select().from(investorContacts).where(eq(investorContacts.userId, req.user.id));

      // If specific contacts selected, filter by IDs
      if (contactIds) {
        const ids = (contactIds as string).split(',').map(id => parseInt(id));
        query = db.select().from(investorContacts).where(
          and(
            eq(investorContacts.userId, req.user.id),
            inArray(investorContacts.id, ids)
          )
        );
      }

      const contacts = await query;

      // Get NDA signatures for additional data
      const allSignatures = await db.select().from(ndaSignatures);

      // Create CSV content
      const csvHeaders = [
        'Name',
        'Email',
        'Status',
        'Tags',
        'Total NDA Signatures',
        'Total Document Views',
        'Total Time Spent (minutes)',
        'First Seen',
        'Last Seen',
        'Last Contact Date',
        'Next Follow Up',
        'Notes'
      ];

      const csvRows = contacts.map(contact => {
        const signatures = allSignatures.filter(sig => sig.signerEmail === contact.email);
        return [
          contact.name,
          contact.email,
          contact.status,
          contact.tags.join('; '),
          signatures.length,
          contact.totalDocumentViews,
          contact.totalTimeSpentMinutes,
          contact.firstSeenAt?.toISOString() || '',
          contact.lastSeenAt?.toISOString() || '',
          contact.lastContactDate?.toISOString() || '',
          contact.nextFollowUpDate?.toISOString() || '',
          contact.notes || ''
        ];
      });

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="investor-contacts-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);

    } catch (error) {
      console.error('Error exporting investor contacts:', error);
      res.status(500).json({ error: "Failed to export contacts" });
    }
  });

  // Custom Tags API
  app.get("/api/custom-tags", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const tags = await storage.getCustomTags(req.user.id);
      res.json(tags);
    } catch (error) {
      console.error('Error fetching custom tags:', error);
      res.status(500).json({ error: "Failed to fetch custom tags" });
    }
  });

  app.post("/api/custom-tags", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { name, color } = req.body;
      if (!name || !color) {
        return res.status(400).json({ error: "Name and color are required" });
      }

      const newTag = await storage.createCustomTag(req.user.id, name, color);
      res.json(newTag);
    } catch (error) {
      console.error('Error creating custom tag:', error);
      res.status(500).json({ error: "Failed to create custom tag" });
    }
  });

  app.delete("/api/custom-tags/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const tagId = parseInt(req.params.id);
      await storage.deleteCustomTag(tagId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting custom tag:', error);
      res.status(500).json({ error: "Failed to delete custom tag" });
    }
  });

  // Analysis Templates API
  app.get("/api/analysis-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templates = await storage.getAnalysisTemplates(req.user.id);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching analysis templates:', error);
      res.status(500).json({ error: "Failed to fetch analysis templates" });
    }
  });

  app.post("/api/analysis-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templateData = insertAnalysisTemplateSchema.parse(req.body);
      const newTemplate = await storage.createAnalysisTemplate(req.user.id, templateData);
      res.json(newTemplate);
    } catch (error) {
      console.error('Error creating analysis template:', error);
      res.status(500).json({ error: "Failed to create analysis template" });
    }
  });

  app.put("/api/analysis-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templateId = parseInt(req.params.id);
      const templateData = insertAnalysisTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateAnalysisTemplate(templateId, templateData);
      res.json(updatedTemplate);
    } catch (error) {
      console.error('Error updating analysis template:', error);
      res.status(500).json({ error: "Failed to update analysis template" });
    }
  });

  app.delete("/api/analysis-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templateId = parseInt(req.params.id);
      await storage.deleteAnalysisTemplate(templateId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting analysis template:', error);
      res.status(500).json({ error: "Failed to delete analysis template" });
    }
  });

  // Content & Style Template Routes
  app.get("/api/content-style-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templates = await storage.getContentStyleTemplates(req.user!.id);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching content style templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/content-style-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      console.log("[ContentStyleTemplate] Creating template for user:", req.user!.id);
      console.log("[ContentStyleTemplate] Request body:", JSON.stringify(req.body, null, 2));

      // Validate the request body
      const { insertContentStyleTemplateSchema } = await import("@shared/schema");
      const validatedData = insertContentStyleTemplateSchema.parse(req.body);

      console.log("[ContentStyleTemplate] Validated data:", JSON.stringify(validatedData, null, 2));

      const template = await storage.createContentStyleTemplate(req.user!.id, validatedData);
      console.log("[ContentStyleTemplate] Template created successfully:", template.id);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("[ContentStyleTemplate] Error creating template:", error);

      // Check if it's a Zod validation error
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: "Validation failed",
          details: error.errors
        });
      }

      res.status(500).json({ error: "Failed to create template", message: error.message });
    }
  });

  app.patch("/api/content-style-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }

      const template = await storage.updateContentStyleTemplate(templateId, req.user!.id, req.body);
      res.json(template);
    } catch (error) {
      console.error("Error updating content style template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/content-style-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }

      await storage.deleteContentStyleTemplate(templateId, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting content style template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  app.post("/api/content-style-templates/:id/set-default", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }

      await storage.setDefaultContentStyleTemplate(templateId, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting default content style template:", error);
      res.status(500).json({ error: "Failed to set default template" });
    }
  });

  app.get("/api/content-style-templates/default", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const template = await storage.getUserDefaultContentStyleTemplate(req.user!.id);
      res.json(template || null);
    } catch (error) {
      console.error("Error fetching default content style template:", error);
      res.status(500).json({ error: "Failed to fetch default template" });
    }
  });
}
