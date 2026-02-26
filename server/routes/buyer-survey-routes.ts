import { Express, Request, Response } from "express";
import { db } from "../db";
import {
  buyerSurveys,
  buyerSurveyResponses,
  crmContacts,
  ndaSignatures,
  cimDocuments,
  insertBuyerSurveySchema,
  insertBuyerSurveyResponseSchema,
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// ─── Default Survey Template ──────────────────────────────────────────
const DEFAULT_SURVEY_QUESTIONS = [
  // Section: About You
  {
    id: "q_org_type",
    text: "Organization Type",
    type: "select",
    options: ["Strategic Buyer", "Private Equity", "Family Office", "Search Fund", "Individual Buyer", "Other"],
    required: true,
    section: "About You",
    crmField: "buyerType",
    placeholder: "Select your organization type",
  },
  {
    id: "q_financial_cap",
    text: "Financial Capability",
    type: "select",
    options: ["Self-funded", "Pre-approved financing", "Proof of funds available", "Seeking financing"],
    required: true,
    section: "About You",
    crmField: "financialCapability",
  },
  {
    id: "q_budget",
    text: "Estimated Budget Range",
    type: "select",
    options: ["Under $500K", "$500K - $1M", "$1M - $5M", "$5M - $10M", "$10M - $25M", "$25M+"],
    required: true,
    section: "About You",
    crmField: "estimatedBudget",
  },
  {
    id: "q_prior_acquisitions",
    text: "Number of Prior Acquisitions",
    type: "number",
    required: false,
    section: "About You",
    crmField: "priorAcquisitions",
    placeholder: "0",
  },
  {
    id: "q_linkedin",
    text: "LinkedIn Profile URL",
    type: "text",
    required: false,
    section: "About You",
    crmField: "linkedinUrl",
    placeholder: "https://linkedin.com/in/...",
  },
  {
    id: "q_phone",
    text: "Phone Number",
    type: "text",
    required: false,
    section: "About You",
    crmField: "phone",
    placeholder: "+1 (555) 123-4567",
  },
  {
    id: "q_interest",
    text: "Brief Description of Interest",
    type: "textarea",
    required: false,
    section: "About You",
    crmField: null,
    placeholder: "Tell us about your interest in this opportunity...",
  },
  // Section: Deal Criteria
  {
    id: "q_industries",
    text: "Target Industries",
    type: "multi_select",
    options: ["Technology", "Healthcare", "Manufacturing", "Services", "Retail", "Food & Beverage", "Construction", "Real Estate", "Financial Services", "Other"],
    required: false,
    section: "Deal Criteria",
    crmField: "acquisitionCriteria.industries",
  },
  {
    id: "q_revenue_range",
    text: "Target Revenue Range",
    type: "select",
    options: ["Under $500K", "$500K - $1M", "$1M - $5M", "$5M - $10M", "$10M - $25M", "$25M+"],
    required: false,
    section: "Deal Criteria",
    crmField: "acquisitionCriteria.revenueRange",
  },
  {
    id: "q_ebitda_range",
    text: "Target EBITDA Range",
    type: "select",
    options: ["Under $100K", "$100K - $250K", "$250K - $500K", "$500K - $1M", "$1M - $5M", "$5M+"],
    required: false,
    section: "Deal Criteria",
    crmField: "acquisitionCriteria.ebitdaRange",
  },
  {
    id: "q_geographies",
    text: "Preferred Geography",
    type: "multi_select",
    options: ["Northeast US", "Southeast US", "Midwest US", "Southwest US", "West Coast US", "Canada", "International"],
    required: false,
    section: "Deal Criteria",
    crmField: "acquisitionCriteria.geographies",
  },
  {
    id: "q_deal_size",
    text: "Preferred Deal Size",
    type: "select",
    options: ["Under $500K", "$500K - $1M", "$1M - $5M", "$5M - $10M", "$10M - $25M", "$25M+"],
    required: false,
    section: "Deal Criteria",
    crmField: "acquisitionCriteria.dealSize",
  },
  {
    id: "q_transaction_types",
    text: "Transaction Type Preference",
    type: "multi_select",
    options: ["Asset Purchase", "Stock Purchase", "Merger", "Management Buyout", "Leveraged Buyout", "Recapitalization"],
    required: false,
    section: "Deal Criteria",
    crmField: "acquisitionCriteria.transactionTypes",
  },
];

// ─── CRM Field Mapping Helper ─────────────────────────────────────────
function mapResponsesToCrmFields(
  questions: any[],
  responses: Record<string, any>,
  existingContact: any
): Record<string, any> {
  const updateObj: Record<string, any> = {};
  const customProps: Record<string, any> = { ...(existingContact?.customProperties || {}) };
  const existingCriteria: Record<string, any> = (existingContact?.acquisitionCriteria as any) || {};

  for (const question of questions) {
    const value = responses[question.id];
    if (value === undefined || value === null || value === "") continue;

    const crmField = question.crmField;

    if (!crmField) {
      // No CRM field mapping — store in customProperties
      customProps[question.id] = value;
      continue;
    }

    if (crmField.includes(".")) {
      // Dot-notation field (e.g., "acquisitionCriteria.industries")
      const [parent, child] = crmField.split(".");
      if (parent === "acquisitionCriteria") {
        if (!updateObj.acquisitionCriteria) {
          updateObj.acquisitionCriteria = { ...existingCriteria };
        }
        updateObj.acquisitionCriteria[child] = value;
      }
    } else {
      // Direct field mapping
      if (crmField === "priorAcquisitions") {
        updateObj[crmField] = typeof value === "number" ? value : parseInt(value, 10) || 0;
      } else {
        updateObj[crmField] = value;
      }
    }
  }

  if (Object.keys(customProps).length > 0) {
    updateObj.customProperties = customProps;
  }

  return updateObj;
}

// ─── Auto-create default survey ───────────────────────────────────────
async function ensureDefaultSurvey(userId: number) {
  const existing = await db
    .select()
    .from(buyerSurveys)
    .where(eq(buyerSurveys.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(buyerSurveys).values({
    userId,
    name: "Buyer Qualification Survey",
    questions: DEFAULT_SURVEY_QUESTIONS,
    isDefault: true,
    isRequired: false,
  });
}

export function registerBuyerSurveyRoutes(app: Express) {
  // ─── 1. GET /api/buyer-surveys ─────────────────────────────────────
  // List broker's survey templates
  app.get("/api/buyer-surveys", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;

      // Auto-create default survey on first access
      await ensureDefaultSurvey(userId);

      const surveys = await db
        .select()
        .from(buyerSurveys)
        .where(eq(buyerSurveys.userId, userId))
        .orderBy(desc(buyerSurveys.createdAt));

      return res.json(surveys);
    } catch (error) {
      console.error("Error fetching buyer surveys:", error);
      return res.status(500).json({ error: "Failed to fetch buyer surveys" });
    }
  });

  // ─── 2. POST /api/buyer-surveys ────────────────────────────────────
  // Create survey template
  app.post("/api/buyer-surveys", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const parsed = insertBuyerSurveySchema.safeParse({
        ...req.body,
        userId,
      });

      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const data = parsed.data;

      // If setting as default, unset other defaults first
      if (data.isDefault) {
        await db
          .update(buyerSurveys)
          .set({ isDefault: false })
          .where(eq(buyerSurveys.userId, userId));
      }

      const [survey] = await db
        .insert(buyerSurveys)
        .values({
          userId,
          organizationId: data.organizationId ?? null,
          cimDocumentId: data.cimDocumentId ?? null,
          name: data.name,
          questions: data.questions,
          isDefault: data.isDefault ?? false,
          isRequired: data.isRequired ?? false,
        })
        .returning();

      return res.status(201).json(survey);
    } catch (error) {
      console.error("Error creating buyer survey:", error);
      return res.status(500).json({ error: "Failed to create buyer survey" });
    }
  });

  // ─── 3. PATCH /api/buyer-surveys/:id ───────────────────────────────
  // Update survey template
  app.patch("/api/buyer-surveys/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const surveyId = parseInt(req.params.id, 10);
      if (isNaN(surveyId)) {
        return res.status(400).json({ error: "Invalid survey ID" });
      }

      const userId = req.user.id;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(buyerSurveys)
        .where(
          and(
            eq(buyerSurveys.id, surveyId),
            eq(buyerSurveys.userId, userId),
          ),
        )
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Survey not found" });
      }

      const updateData: Record<string, any> = { updatedAt: new Date() };

      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.questions !== undefined) updateData.questions = req.body.questions;
      if (req.body.isRequired !== undefined) updateData.isRequired = Boolean(req.body.isRequired);
      if (req.body.cimDocumentId !== undefined) updateData.cimDocumentId = req.body.cimDocumentId;

      if (req.body.isDefault !== undefined) {
        updateData.isDefault = Boolean(req.body.isDefault);
        if (updateData.isDefault) {
          // Unset other defaults first
          await db
            .update(buyerSurveys)
            .set({ isDefault: false })
            .where(and(eq(buyerSurveys.userId, userId), sql`${buyerSurveys.id} != ${surveyId}`));
        }
      }

      const [updated] = await db
        .update(buyerSurveys)
        .set(updateData)
        .where(eq(buyerSurveys.id, surveyId))
        .returning();

      return res.json(updated);
    } catch (error) {
      console.error("Error updating buyer survey:", error);
      return res.status(500).json({ error: "Failed to update buyer survey" });
    }
  });

  // ─── 4. DELETE /api/buyer-surveys/:id ──────────────────────────────
  // Delete survey template
  app.delete("/api/buyer-surveys/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const surveyId = parseInt(req.params.id, 10);
      if (isNaN(surveyId)) {
        return res.status(400).json({ error: "Invalid survey ID" });
      }

      const userId = req.user.id;

      const [existing] = await db
        .select()
        .from(buyerSurveys)
        .where(
          and(
            eq(buyerSurveys.id, surveyId),
            eq(buyerSurveys.userId, userId),
          ),
        )
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Survey not found" });
      }

      await db.delete(buyerSurveys).where(eq(buyerSurveys.id, surveyId));

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting buyer survey:", error);
      return res.status(500).json({ error: "Failed to delete buyer survey" });
    }
  });

  // ─── 5. GET /api/buyer-surveys/for-document/:cimDocumentId ─────────
  // Get applicable survey for a CIM (doc-specific → org default → null)
  app.get("/api/buyer-surveys/for-document/:cimDocumentId", async (req: Request, res: Response) => {
    try {
      const cimDocumentId = parseInt(req.params.cimDocumentId, 10);
      if (isNaN(cimDocumentId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      // Get the document to find the owner
      const [doc] = await db
        .select()
        .from(cimDocuments)
        .where(eq(cimDocuments.id, cimDocumentId))
        .limit(1);

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Try doc-specific survey first
      const [docSurvey] = await db
        .select()
        .from(buyerSurveys)
        .where(
          and(
            eq(buyerSurveys.userId, doc.userId),
            eq(buyerSurveys.cimDocumentId, cimDocumentId),
          ),
        )
        .limit(1);

      if (docSurvey) {
        return res.json(docSurvey);
      }

      // Fall back to default survey
      const [defaultSurvey] = await db
        .select()
        .from(buyerSurveys)
        .where(
          and(
            eq(buyerSurveys.userId, doc.userId),
            eq(buyerSurveys.isDefault, true),
          ),
        )
        .limit(1);

      if (defaultSurvey) {
        return res.json(defaultSurvey);
      }

      return res.json(null);
    } catch (error) {
      console.error("Error fetching survey for document:", error);
      return res.status(500).json({ error: "Failed to fetch survey" });
    }
  });

  // ─── 6. GET /api/buyer-form/:token ─────────────────────────────────
  // Get form + existing response by NDA status token (public)
  app.get("/api/buyer-form/:token", async (req: Request, res: Response) => {
    try {
      const token = req.params.token;

      // Find the NDA signature by status check token
      const [signature] = await db
        .select()
        .from(ndaSignatures)
        .where(eq(ndaSignatures.statusCheckToken, token))
        .limit(1);

      if (!signature) {
        return res.status(404).json({ error: "Invalid token" });
      }

      // Get the CIM document
      const [doc] = await db
        .select()
        .from(cimDocuments)
        .where(eq(cimDocuments.id, signature.cimDocumentId))
        .limit(1);

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get applicable survey
      // Try doc-specific first
      let survey = null;
      const [docSurvey] = await db
        .select()
        .from(buyerSurveys)
        .where(
          and(
            eq(buyerSurveys.userId, doc.userId),
            eq(buyerSurveys.cimDocumentId, doc.id),
          ),
        )
        .limit(1);

      if (docSurvey) {
        survey = docSurvey;
      } else {
        // Fall back to default
        const [defaultSurvey] = await db
          .select()
          .from(buyerSurveys)
          .where(
            and(
              eq(buyerSurveys.userId, doc.userId),
              eq(buyerSurveys.isDefault, true),
            ),
          )
          .limit(1);
        survey = defaultSurvey || null;
      }

      if (!survey) {
        return res.json({ survey: null, response: null, signerName: signature.signerName, documentTitle: doc.title });
      }

      // Check for existing response
      const [existingResponse] = await db
        .select()
        .from(buyerSurveyResponses)
        .where(
          and(
            eq(buyerSurveyResponses.surveyId, survey.id),
            sql`LOWER(${buyerSurveyResponses.signerEmail}) = ${signature.signerEmail.toLowerCase()}`,
          ),
        )
        .limit(1);

      return res.json({
        survey,
        response: existingResponse || null,
        signerName: signature.signerName,
        documentTitle: doc.title,
      });
    } catch (error) {
      console.error("Error fetching buyer form:", error);
      return res.status(500).json({ error: "Failed to fetch buyer form" });
    }
  });

  // ─── 7. POST /api/buyer-form/:token ────────────────────────────────
  // Submit form — saves response + updates CRM contact
  app.post("/api/buyer-form/:token", async (req: Request, res: Response) => {
    try {
      const token = req.params.token;

      // Find NDA signature
      const [signature] = await db
        .select()
        .from(ndaSignatures)
        .where(eq(ndaSignatures.statusCheckToken, token))
        .limit(1);

      if (!signature) {
        return res.status(404).json({ error: "Invalid token" });
      }

      // Get the CIM document
      const [doc] = await db
        .select()
        .from(cimDocuments)
        .where(eq(cimDocuments.id, signature.cimDocumentId))
        .limit(1);

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get applicable survey
      let survey = null;
      const [docSurvey] = await db
        .select()
        .from(buyerSurveys)
        .where(
          and(
            eq(buyerSurveys.userId, doc.userId),
            eq(buyerSurveys.cimDocumentId, doc.id),
          ),
        )
        .limit(1);

      if (docSurvey) {
        survey = docSurvey;
      } else {
        const [defaultSurvey] = await db
          .select()
          .from(buyerSurveys)
          .where(
            and(
              eq(buyerSurveys.userId, doc.userId),
              eq(buyerSurveys.isDefault, true),
            ),
          )
          .limit(1);
        survey = defaultSurvey || null;
      }

      if (!survey) {
        return res.status(404).json({ error: "No survey configured" });
      }

      const { responses } = req.body;
      if (!responses || typeof responses !== "object") {
        return res.status(400).json({ error: "Responses are required" });
      }

      // Validate required questions
      const questions = survey.questions as any[];
      for (const q of questions) {
        if (q.required) {
          const val = responses[q.id];
          if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
            return res.status(400).json({ error: `"${q.text}" is required` });
          }
        }
      }

      // Find existing CRM contact
      const [contact] = await db
        .select()
        .from(crmContacts)
        .where(sql`LOWER(${crmContacts.email}) = ${signature.signerEmail.toLowerCase()}`)
        .limit(1);

      const contactId = contact?.id || null;

      // Upsert survey response
      const [existingResponse] = await db
        .select()
        .from(buyerSurveyResponses)
        .where(
          and(
            eq(buyerSurveyResponses.surveyId, survey.id),
            sql`LOWER(${buyerSurveyResponses.signerEmail}) = ${signature.signerEmail.toLowerCase()}`,
          ),
        )
        .limit(1);

      let savedResponse;
      if (existingResponse) {
        [savedResponse] = await db
          .update(buyerSurveyResponses)
          .set({
            responses,
            contactId,
            completedAt: new Date(),
          })
          .where(eq(buyerSurveyResponses.id, existingResponse.id))
          .returning();
      } else {
        [savedResponse] = await db
          .insert(buyerSurveyResponses)
          .values({
            surveyId: survey.id,
            contactId,
            cimDocumentId: doc.id,
            signerEmail: signature.signerEmail,
            responses,
          })
          .returning();
      }

      // Update CRM contact if exists
      if (contact) {
        try {
          const crmUpdate = mapResponsesToCrmFields(questions, responses, contact);
          if (Object.keys(crmUpdate).length > 0) {
            crmUpdate.updatedAt = new Date();
            await db
              .update(crmContacts)
              .set(crmUpdate)
              .where(eq(crmContacts.id, contact.id));
          }
        } catch (crmError) {
          console.error("Error updating CRM contact from survey:", crmError);
          // Don't fail the response — survey was saved successfully
        }
      }

      return res.json({ success: true, response: savedResponse });
    } catch (error) {
      console.error("Error submitting buyer form:", error);
      return res.status(500).json({ error: "Failed to submit buyer form" });
    }
  });
}
