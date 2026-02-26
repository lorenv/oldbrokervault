import { Express, Request, Response } from "express";
import { db } from "../db";
import {
  organizations,
  organizationMembers,
  crmContacts,
  deals,
  dealContacts,
  pipelines,
  pipelineStages,
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";

// ─── Default Seller Intake Questions ──────────────────────────────────
const DEFAULT_INTAKE_QUESTIONS = [
  {
    id: "q_full_name",
    text: "Full Name",
    type: "text",
    required: true,
    section: "About You",
    crmField: "contact.name",
    placeholder: "Your full name",
  },
  {
    id: "q_email",
    text: "Email Address",
    type: "text",
    required: true,
    section: "About You",
    crmField: "contact.email",
    placeholder: "you@example.com",
  },
  {
    id: "q_phone",
    text: "Phone Number",
    type: "text",
    required: false,
    section: "About You",
    crmField: "contact.phone",
    placeholder: "(555) 123-4567",
  },
  {
    id: "q_linkedin",
    text: "LinkedIn Profile",
    type: "text",
    required: false,
    section: "About You",
    crmField: "contact.linkedinUrl",
    placeholder: "https://linkedin.com/in/yourprofile",
  },
  {
    id: "q_business_name",
    text: "Business Name",
    type: "text",
    required: true,
    section: "About Your Business",
    crmField: "deal.name",
    placeholder: "Name of the business",
  },
  {
    id: "q_industry",
    text: "Industry",
    type: "select",
    options: [
      "Manufacturing",
      "Technology / SaaS",
      "Healthcare",
      "Professional Services",
      "Construction",
      "Retail / E-commerce",
      "Food & Beverage",
      "Transportation / Logistics",
      "Real Estate",
      "Other",
    ],
    required: true,
    section: "About Your Business",
    crmField: "deal.industry",
  },
  {
    id: "q_description",
    text: "Brief Business Description",
    type: "textarea",
    required: false,
    section: "About Your Business",
    crmField: "deal.businessDescription",
    placeholder: "Describe your business in a few sentences",
  },
  {
    id: "q_revenue",
    text: "Annual Revenue Range",
    type: "select",
    options: [
      "Under $500K",
      "$500K - $1M",
      "$1M - $5M",
      "$5M - $10M",
      "$10M - $25M",
      "$25M+",
    ],
    required: true,
    section: "About Your Business",
    crmField: "deal.revenueRange",
  },
  {
    id: "q_profit",
    text: "Annual Profit / EBITDA Range",
    type: "select",
    options: [
      "Under $100K",
      "$100K - $250K",
      "$250K - $500K",
      "$500K - $1M",
      "$1M - $5M",
      "$5M+",
    ],
    required: false,
    section: "About Your Business",
    crmField: "deal.profitRange",
  },
  {
    id: "q_asking_price",
    text: "Asking Price (if known)",
    type: "text",
    required: false,
    section: "About Your Business",
    crmField: "deal.askingPrice",
    placeholder: "e.g. $2.5M",
  },
  {
    id: "q_motivation",
    text: "Reason for Selling",
    type: "select",
    options: [
      "Retirement",
      "New Venture",
      "Burnout / Lifestyle Change",
      "Partner Dispute",
      "Health",
      "Relocation",
      "Other",
    ],
    required: true,
    section: "Selling Context",
    crmField: "deal.sellerMotivation",
  },
  {
    id: "q_timeline",
    text: "Desired Timeline",
    type: "select",
    options: ["Immediate", "3 Months", "6 Months", "12 Months", "Flexible"],
    required: true,
    section: "Selling Context",
    crmField: "deal.sellerTimeline",
  },
  {
    id: "q_source",
    text: "How did you hear about us?",
    type: "select",
    options: [
      "Referral",
      "Google Search",
      "LinkedIn",
      "Industry Event",
      "Direct Marketing",
      "Other",
    ],
    required: false,
    section: "Selling Context",
    crmField: "deal.dealSource",
  },
  {
    id: "q_referred_by",
    text: "Referred by (if applicable)",
    type: "text",
    required: false,
    section: "Selling Context",
    crmField: "deal.referredBy",
    placeholder: "Name of person or company",
  },
];

// Map select label values to database enum values
const REVENUE_LABEL_TO_DB: Record<string, string> = {
  "Under $500K": "under_500k",
  "$500K - $1M": "500k_1m",
  "$1M - $5M": "1m_5m",
  "$5M - $10M": "5m_10m",
  "$10M - $25M": "10m_25m",
  "$25M+": "25m_plus",
};

const PROFIT_LABEL_TO_DB: Record<string, string> = {
  "Under $100K": "under_100k",
  "$100K - $250K": "100k_250k",
  "$250K - $500K": "250k_500k",
  "$500K - $1M": "500k_1m",
  "$1M - $5M": "1m_5m",
  "$5M+": "5m_plus",
};

const MOTIVATION_LABEL_TO_DB: Record<string, string> = {
  Retirement: "retirement",
  "New Venture": "new_venture",
  "Burnout / Lifestyle Change": "burnout",
  "Partner Dispute": "partner_dispute",
  Health: "health",
  Relocation: "relocation",
  Other: "other",
};

const TIMELINE_LABEL_TO_DB: Record<string, string> = {
  Immediate: "immediate",
  "3 Months": "3_months",
  "6 Months": "6_months",
  "12 Months": "12_months",
  Flexible: "flexible",
};

const SOURCE_LABEL_TO_DB: Record<string, string> = {
  Referral: "referral",
  "Google Search": "inbound",
  LinkedIn: "inbound",
  "Industry Event": "direct_marketing",
  "Direct Marketing": "direct_marketing",
  Other: "other",
};

export function registerSellerIntakeRoutes(app: Express) {
  // ─── GET /api/seller-intake/:slug ─────────────────────────────────
  // Public: Returns intake form config for an organization
  app.get("/api/seller-intake/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const settings = (org.settings as any) || {};
      const intakeForm = settings.sellerIntakeForm || null;

      res.json({
        organizationName: org.name,
        logoUrl: org.logoUrl,
        questions: intakeForm?.questions || DEFAULT_INTAKE_QUESTIONS,
        formTitle: intakeForm?.formTitle || "Sell Your Business",
        formDescription:
          intakeForm?.formDescription ||
          "Interested in selling your business? Fill out the form below and a broker will be in touch.",
      });
    } catch (error) {
      console.error("[SellerIntake] Error fetching form:", error);
      res.status(500).json({ error: "Failed to load form" });
    }
  });

  // ─── POST /api/seller-intake/:slug ────────────────────────────────
  // Public: Submit the seller intake form
  app.post("/api/seller-intake/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const { responses } = req.body;

      if (!responses || typeof responses !== "object") {
        return res.status(400).json({ error: "Responses are required" });
      }

      // Look up organization
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Get intake form questions to map responses to fields
      const settings = (org.settings as any) || {};
      const intakeForm = settings.sellerIntakeForm || null;
      const questions = intakeForm?.questions || DEFAULT_INTAKE_QUESTIONS;

      // Extract contact and deal fields from responses
      const contactData: Record<string, any> = {};
      const dealData: Record<string, any> = {};

      for (const q of questions) {
        const value = responses[q.id];
        if (value === undefined || value === null || value === "") continue;

        if (q.crmField) {
          if (q.crmField.startsWith("contact.")) {
            const field = q.crmField.replace("contact.", "");
            if (field === "name") {
              // Split full name into first/last
              const parts = String(value).trim().split(/\s+/);
              contactData.firstName = parts[0] || "";
              contactData.lastName = parts.slice(1).join(" ") || "";
            } else {
              contactData[field] = value;
            }
          } else if (q.crmField.startsWith("deal.")) {
            const field = q.crmField.replace("deal.", "");
            // Map select labels to DB enum values
            if (field === "revenueRange" && REVENUE_LABEL_TO_DB[value]) {
              dealData[field] = REVENUE_LABEL_TO_DB[value];
            } else if (field === "profitRange" && PROFIT_LABEL_TO_DB[value]) {
              dealData[field] = PROFIT_LABEL_TO_DB[value];
            } else if (
              field === "sellerMotivation" &&
              MOTIVATION_LABEL_TO_DB[value]
            ) {
              dealData[field] = MOTIVATION_LABEL_TO_DB[value];
            } else if (
              field === "sellerTimeline" &&
              TIMELINE_LABEL_TO_DB[value]
            ) {
              dealData[field] = TIMELINE_LABEL_TO_DB[value];
            } else if (field === "dealSource" && SOURCE_LABEL_TO_DB[value]) {
              dealData[field] = SOURCE_LABEL_TO_DB[value];
            } else {
              dealData[field] = value;
            }
          }
        }
      }

      // Validate required fields
      if (!contactData.email) {
        return res.status(400).json({ error: "Email is required" });
      }
      if (!dealData.name) {
        return res
          .status(400)
          .json({ error: "Business name is required" });
      }

      // Get org owner for contact ownership
      const [ownerMember] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, org.id),
            eq(organizationMembers.role, "owner")
          )
        )
        .limit(1);

      // Get default pipeline and first stage
      const [defaultPipeline] = await db
        .select()
        .from(pipelines)
        .where(
          and(
            eq(pipelines.organizationId, org.id),
            eq(pipelines.isDefault, true)
          )
        )
        .limit(1);

      if (!defaultPipeline) {
        return res
          .status(500)
          .json({ error: "No pipeline configured for this organization" });
      }

      const [firstStage] = await db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, defaultPipeline.id))
        .orderBy(asc(pipelineStages.displayOrder))
        .limit(1);

      if (!firstStage) {
        return res
          .status(500)
          .json({ error: "No pipeline stages configured" });
      }

      // Create seller contact
      const [newContact] = await db
        .insert(crmContacts)
        .values({
          organizationId: org.id,
          email: contactData.email,
          firstName: contactData.firstName || null,
          lastName: contactData.lastName || null,
          phone: contactData.phone || null,
          linkedinUrl: contactData.linkedinUrl || null,
          contactType: "seller",
          source: "intake_form",
        })
        .returning();

      // Create deal with business fields
      const [newDeal] = await db
        .insert(deals)
        .values({
          organizationId: org.id,
          name: dealData.name,
          pipelineId: defaultPipeline.id,
          stageId: firstStage.id,
          source: "intake_form",
          dealSource: dealData.dealSource || "inbound",
          askingPrice: dealData.askingPrice || null,
          revenueRange: dealData.revenueRange || null,
          profitRange: dealData.profitRange || null,
          industry: dealData.industry || null,
          businessDescription: dealData.businessDescription || null,
          sellerMotivation: dealData.sellerMotivation || null,
          sellerTimeline: dealData.sellerTimeline || null,
          engagementStatus: "prospect",
          referredBy: dealData.referredBy || null,
          ownerId: ownerMember?.userId || null,
        })
        .returning();

      // Link seller contact to deal
      await db.insert(dealContacts).values({
        dealId: newDeal.id,
        contactId: newContact.id,
        role: "primary",
      });

      res.json({
        success: true,
        message:
          "Thank you! Your information has been submitted. A broker will be in touch.",
      });
    } catch (error) {
      console.error("[SellerIntake] Error submitting form:", error);
      res.status(500).json({ error: "Failed to submit form" });
    }
  });

  // ─── GET /api/settings/seller-intake-form ──────────────────────────
  // Auth: Get broker's intake form configuration
  app.get(
    "/api/settings/seller-intake-form",
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      try {
        const userId = req.user.id;

        // Get user's org
        const [membership] = await db
          .select({ organization: organizations })
          .from(organizationMembers)
          .innerJoin(
            organizations,
            eq(organizations.id, organizationMembers.organizationId)
          )
          .where(eq(organizationMembers.userId, userId))
          .limit(1);

        if (!membership) {
          return res
            .status(404)
            .json({ error: "Organization not found" });
        }

        const org = membership.organization;
        const settings = (org.settings as any) || {};
        const intakeForm = settings.sellerIntakeForm || null;

        res.json({
          slug: org.slug,
          questions: intakeForm?.questions || DEFAULT_INTAKE_QUESTIONS,
          formTitle: intakeForm?.formTitle || "Sell Your Business",
          formDescription:
            intakeForm?.formDescription ||
            "Interested in selling your business? Fill out the form below and a broker will be in touch.",
        });
      } catch (error) {
        console.error(
          "[SellerIntake] Error fetching form settings:",
          error
        );
        res.status(500).json({ error: "Failed to load form settings" });
      }
    }
  );

  // ─── PUT /api/settings/seller-intake-form ──────────────────────────
  // Auth: Update broker's intake form configuration
  app.put(
    "/api/settings/seller-intake-form",
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      try {
        const userId = req.user.id;
        const { questions, formTitle, formDescription } = req.body;

        // Get user's org
        const [membership] = await db
          .select({ organization: organizations })
          .from(organizationMembers)
          .innerJoin(
            organizations,
            eq(organizations.id, organizationMembers.organizationId)
          )
          .where(eq(organizationMembers.userId, userId))
          .limit(1);

        if (!membership) {
          return res
            .status(404)
            .json({ error: "Organization not found" });
        }

        const org = membership.organization;
        const currentSettings = (org.settings as any) || {};

        const updatedSettings = {
          ...currentSettings,
          sellerIntakeForm: {
            questions: questions || DEFAULT_INTAKE_QUESTIONS,
            formTitle: formTitle || "Sell Your Business",
            formDescription:
              formDescription ||
              "Interested in selling your business? Fill out the form below and a broker will be in touch.",
            updatedAt: new Date().toISOString(),
          },
        };

        await db
          .update(organizations)
          .set({ settings: updatedSettings })
          .where(eq(organizations.id, org.id));

        res.json({
          success: true,
          slug: org.slug,
          questions: updatedSettings.sellerIntakeForm.questions,
          formTitle: updatedSettings.sellerIntakeForm.formTitle,
          formDescription:
            updatedSettings.sellerIntakeForm.formDescription,
        });
      } catch (error) {
        console.error(
          "[SellerIntake] Error saving form settings:",
          error
        );
        res.status(500).json({ error: "Failed to save form settings" });
      }
    }
  );
}
