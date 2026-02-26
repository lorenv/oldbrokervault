import { Express, Request, Response } from "express";
import { db } from "../db";
import {
  ndaWhitelistRules,
  crmContacts,
  insertNdaWhitelistRuleSchema,
  type NdaWhitelistRule,
} from "@shared/schema";
import { eq, and, or, sql } from "drizzle-orm";

/**
 * Check if a signer email matches any active whitelist rule for a given deal.
 *
 * Evaluation order:
 *   1. Domain rules  – the email's domain matches ruleValue
 *   2. Email rules   – the full email matches ruleValue (case-insensitive)
 *   3. Organization rules – a CRM contact with that email is linked to a
 *      company whose id matches ruleValue
 *
 * Both global rules (appliesToAllDeals = true) and deal-specific rules
 * (cimDocumentId matches) are considered. Only active rules are evaluated.
 *
 * @returns The first matching rule, or null if no match is found.
 */
export async function checkWhitelist(
  signerEmail: string,
  cimDocumentId: number,
  userId: number,
): Promise<NdaWhitelistRule | null> {
  const emailLower = signerEmail.toLowerCase().trim();
  const domain = emailLower.split("@")[1];

  if (!domain) {
    return null;
  }

  // Scope: rules owned by this user, active, and either global or for this deal
  const scopeCondition = and(
    eq(ndaWhitelistRules.userId, userId),
    eq(ndaWhitelistRules.isActive, true),
    or(
      eq(ndaWhitelistRules.appliesToAllDeals, true),
      eq(ndaWhitelistRules.cimDocumentId, cimDocumentId),
    ),
  );

  // 1. Domain rules
  const domainRules = await db
    .select()
    .from(ndaWhitelistRules)
    .where(
      and(
        scopeCondition,
        eq(ndaWhitelistRules.ruleType, "domain"),
        sql`LOWER(${ndaWhitelistRules.ruleValue}) = ${domain}`,
      ),
    )
    .limit(1);

  if (domainRules.length > 0) {
    return domainRules[0];
  }

  // 2. Email rules
  const emailRules = await db
    .select()
    .from(ndaWhitelistRules)
    .where(
      and(
        scopeCondition,
        eq(ndaWhitelistRules.ruleType, "email"),
        sql`LOWER(${ndaWhitelistRules.ruleValue}) = ${emailLower}`,
      ),
    )
    .limit(1);

  if (emailRules.length > 0) {
    return emailRules[0];
  }

  // 3. Organization rules – find a contact with this email whose companyId
  //    matches the ruleValue of an organization rule.
  const orgRules = await db
    .select()
    .from(ndaWhitelistRules)
    .where(
      and(
        scopeCondition,
        eq(ndaWhitelistRules.ruleType, "organization"),
      ),
    );

  if (orgRules.length > 0) {
    // Look up the contact's company
    const matchingContacts = await db
      .select({ companyId: crmContacts.companyId })
      .from(crmContacts)
      .where(sql`LOWER(${crmContacts.email}) = ${emailLower}`)
      .limit(1);

    if (matchingContacts.length > 0 && matchingContacts[0].companyId != null) {
      const contactCompanyId = matchingContacts[0].companyId;
      const matchedRule = orgRules.find(
        (rule) => String(rule.ruleValue) === String(contactCompanyId),
      );
      if (matchedRule) {
        return matchedRule;
      }
    }
  }

  return null;
}

export function registerNdaWhitelistRoutes(app: Express) {
  // ─── GET /api/nda-whitelist ───────────────────────────────────────────
  // List all whitelist rules for the authenticated user.
  // Optional query params: organizationId, cimDocumentId
  app.get("/api/nda-whitelist", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const conditions: ReturnType<typeof eq>[] = [
        eq(ndaWhitelistRules.userId, userId),
      ];

      if (req.query.organizationId) {
        const orgId = parseInt(req.query.organizationId as string, 10);
        if (!isNaN(orgId)) {
          conditions.push(eq(ndaWhitelistRules.organizationId, orgId));
        }
      }

      if (req.query.cimDocumentId) {
        const docId = parseInt(req.query.cimDocumentId as string, 10);
        if (!isNaN(docId)) {
          conditions.push(eq(ndaWhitelistRules.cimDocumentId, docId));
        }
      }

      const rules = await db
        .select()
        .from(ndaWhitelistRules)
        .where(and(...conditions))
        .orderBy(ndaWhitelistRules.createdAt);

      return res.json(rules);
    } catch (error) {
      console.error("Error fetching whitelist rules:", error);
      return res.status(500).json({ error: "Failed to fetch whitelist rules" });
    }
  });

  // ─── POST /api/nda-whitelist ──────────────────────────────────────────
  // Create a new whitelist rule.
  app.post("/api/nda-whitelist", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const parsed = insertNdaWhitelistRuleSchema.safeParse({
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

      const [rule] = await db
        .insert(ndaWhitelistRules)
        .values({
          userId,
          organizationId: data.organizationId ?? null,
          ruleType: data.ruleType,
          ruleValue: data.ruleValue,
          appliesToAllDeals: data.appliesToAllDeals ?? true,
          cimDocumentId: data.cimDocumentId ?? null,
          isActive: data.isActive ?? true,
          notes: data.notes ?? null,
        })
        .returning();

      return res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating whitelist rule:", error);
      return res.status(500).json({ error: "Failed to create whitelist rule" });
    }
  });

  // ─── PATCH /api/nda-whitelist/:id ─────────────────────────────────────
  // Update an existing whitelist rule.
  app.patch("/api/nda-whitelist/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const ruleId = parseInt(req.params.id, 10);
      if (isNaN(ruleId)) {
        return res.status(400).json({ error: "Invalid rule ID" });
      }

      const userId = req.user.id;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(ndaWhitelistRules)
        .where(
          and(
            eq(ndaWhitelistRules.id, ruleId),
            eq(ndaWhitelistRules.userId, userId),
          ),
        )
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Whitelist rule not found" });
      }

      // Build update payload — only include fields that were provided
      const updateData: Partial<{
        ruleType: string;
        ruleValue: string;
        organizationId: number | null;
        appliesToAllDeals: boolean;
        cimDocumentId: number | null;
        isActive: boolean;
        notes: string | null;
        updatedAt: Date;
      }> = {
        updatedAt: new Date(),
      };

      if (req.body.ruleType !== undefined) {
        const validTypes = ["domain", "email", "organization"];
        if (!validTypes.includes(req.body.ruleType)) {
          return res.status(400).json({ error: "Invalid ruleType" });
        }
        updateData.ruleType = req.body.ruleType;
      }

      if (req.body.ruleValue !== undefined) {
        if (typeof req.body.ruleValue !== "string" || req.body.ruleValue.trim().length === 0) {
          return res.status(400).json({ error: "ruleValue must be a non-empty string" });
        }
        updateData.ruleValue = req.body.ruleValue;
      }

      if (req.body.organizationId !== undefined) {
        updateData.organizationId = req.body.organizationId;
      }

      if (req.body.appliesToAllDeals !== undefined) {
        updateData.appliesToAllDeals = Boolean(req.body.appliesToAllDeals);
      }

      if (req.body.cimDocumentId !== undefined) {
        updateData.cimDocumentId = req.body.cimDocumentId;
      }

      if (req.body.isActive !== undefined) {
        updateData.isActive = Boolean(req.body.isActive);
      }

      if (req.body.notes !== undefined) {
        updateData.notes = req.body.notes;
      }

      const [updated] = await db
        .update(ndaWhitelistRules)
        .set(updateData)
        .where(eq(ndaWhitelistRules.id, ruleId))
        .returning();

      return res.json(updated);
    } catch (error) {
      console.error("Error updating whitelist rule:", error);
      return res.status(500).json({ error: "Failed to update whitelist rule" });
    }
  });

  // ─── DELETE /api/nda-whitelist/:id ────────────────────────────────────
  // Delete a whitelist rule.
  app.delete("/api/nda-whitelist/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const ruleId = parseInt(req.params.id, 10);
      if (isNaN(ruleId)) {
        return res.status(400).json({ error: "Invalid rule ID" });
      }

      const userId = req.user.id;

      // Verify ownership before deleting
      const [existing] = await db
        .select()
        .from(ndaWhitelistRules)
        .where(
          and(
            eq(ndaWhitelistRules.id, ruleId),
            eq(ndaWhitelistRules.userId, userId),
          ),
        )
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Whitelist rule not found" });
      }

      await db
        .delete(ndaWhitelistRules)
        .where(eq(ndaWhitelistRules.id, ruleId));

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting whitelist rule:", error);
      return res.status(500).json({ error: "Failed to delete whitelist rule" });
    }
  });

  // ─── POST /api/nda-whitelist/toggle-contact ──────────────────────────
  // Toggle whitelist for a contact by email. Creates or deactivates an email rule.
  app.post("/api/nda-whitelist/toggle-contact", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const { email } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }

      const emailLower = email.toLowerCase().trim();

      // Check if an email rule already exists for this user
      const [existing] = await db
        .select()
        .from(ndaWhitelistRules)
        .where(
          and(
            eq(ndaWhitelistRules.userId, userId),
            eq(ndaWhitelistRules.ruleType, "email"),
            sql`LOWER(${ndaWhitelistRules.ruleValue}) = ${emailLower}`,
          ),
        )
        .limit(1);

      if (existing) {
        // Toggle the isActive flag
        const [updated] = await db
          .update(ndaWhitelistRules)
          .set({ isActive: !existing.isActive, updatedAt: new Date() })
          .where(eq(ndaWhitelistRules.id, existing.id))
          .returning();

        return res.json({ whitelisted: updated.isActive, rule: updated });
      } else {
        // Create a new email whitelist rule
        const [rule] = await db
          .insert(ndaWhitelistRules)
          .values({
            userId,
            ruleType: "email",
            ruleValue: emailLower,
            appliesToAllDeals: true,
            isActive: true,
            notes: "Added from contact page",
          })
          .returning();

        return res.json({ whitelisted: true, rule });
      }
    } catch (error) {
      console.error("Error toggling contact whitelist:", error);
      return res.status(500).json({ error: "Failed to toggle whitelist" });
    }
  });

  // ─── POST /api/nda-whitelist/toggle-company ─────────────────────────
  // Toggle whitelist for a company by domain or company ID. Creates or deactivates a domain rule.
  app.post("/api/nda-whitelist/toggle-company", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const { companyId, domain } = req.body;

      if (!companyId && !domain) {
        return res.status(400).json({ error: "Either companyId or domain is required" });
      }

      if (domain) {
        const domainLower = domain.toLowerCase().trim();

        // Check if a domain rule already exists
        const [existing] = await db
          .select()
          .from(ndaWhitelistRules)
          .where(
            and(
              eq(ndaWhitelistRules.userId, userId),
              eq(ndaWhitelistRules.ruleType, "domain"),
              sql`LOWER(${ndaWhitelistRules.ruleValue}) = ${domainLower}`,
            ),
          )
          .limit(1);

        if (existing) {
          const [updated] = await db
            .update(ndaWhitelistRules)
            .set({ isActive: !existing.isActive, updatedAt: new Date() })
            .where(eq(ndaWhitelistRules.id, existing.id))
            .returning();

          return res.json({ whitelisted: updated.isActive, rule: updated });
        } else {
          const [rule] = await db
            .insert(ndaWhitelistRules)
            .values({
              userId,
              ruleType: "domain",
              ruleValue: domainLower,
              appliesToAllDeals: true,
              isActive: true,
              notes: "Added from company page",
            })
            .returning();

          return res.json({ whitelisted: true, rule });
        }
      }

      // Organization-based rule using companyId
      const companyIdStr = String(companyId);

      const [existing] = await db
        .select()
        .from(ndaWhitelistRules)
        .where(
          and(
            eq(ndaWhitelistRules.userId, userId),
            eq(ndaWhitelistRules.ruleType, "organization"),
            eq(ndaWhitelistRules.ruleValue, companyIdStr),
          ),
        )
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(ndaWhitelistRules)
          .set({ isActive: !existing.isActive, updatedAt: new Date() })
          .where(eq(ndaWhitelistRules.id, existing.id))
          .returning();

        return res.json({ whitelisted: updated.isActive, rule: updated });
      } else {
        const [rule] = await db
          .insert(ndaWhitelistRules)
          .values({
            userId,
            ruleType: "organization",
            ruleValue: companyIdStr,
            appliesToAllDeals: true,
            isActive: true,
            notes: "Added from company page",
          })
          .returning();

        return res.json({ whitelisted: true, rule });
      }
    } catch (error) {
      console.error("Error toggling company whitelist:", error);
      return res.status(500).json({ error: "Failed to toggle whitelist" });
    }
  });

  // ─── GET /api/nda-whitelist/check/:email ──────────────────────────────
  // Test whether an email matches any active whitelist rule for the
  // authenticated user. Accepts optional query param: cimDocumentId
  app.get("/api/nda-whitelist/check/:email", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const email = decodeURIComponent(req.params.email).trim();
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      const cimDocumentId = req.query.cimDocumentId
        ? parseInt(req.query.cimDocumentId as string, 10)
        : 0;

      const matchedRule = await checkWhitelist(email, cimDocumentId, req.user.id);

      return res.json({
        whitelisted: matchedRule !== null,
        rule: matchedRule,
      });
    } catch (error) {
      console.error("Error checking whitelist:", error);
      return res.status(500).json({ error: "Failed to check whitelist" });
    }
  });
}
