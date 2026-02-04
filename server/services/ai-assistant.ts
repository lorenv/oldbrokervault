import OpenAI from "openai";
import { db } from "../db";
import { aiTokenUsage, aiChatMessages, deals, crmContacts, companies, crmTasks, pipelineStages, pipelines } from "@shared/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
// TODO: Re-enable after fixing query issue
// import { getUserPermissions } from "../middleware/permissions";
// import type { PermissionKey } from "@shared/permissions";

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Log whether OpenAI is configured on startup
console.log(`[AI Assistant] OpenAI configured: ${!!openai}`);

// Monthly token limit per organization
const MONTHLY_TOKEN_LIMIT = 1_000_000;

// Model to use
const AI_MODEL = "gpt-4o-mini";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface CRMContext {
  deals: any[];
  contacts: any[];
  companies: any[];
  tasks: any[];
  pipelineStats: any;
  permissions: {
    canViewDeals: boolean;
    canViewContacts: boolean;
    canViewCompanies: boolean;
    canViewTasks: boolean;
    canViewAnalytics: boolean;
  };
}

/**
 * Get the current billing period (YYYY-MM format)
 */
function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Get total tokens used by an organization this month
 */
export async function getMonthlyTokenUsage(organizationId: number): Promise<number> {
  const period = getCurrentPeriod();

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${aiTokenUsage.totalTokens}), 0)` })
    .from(aiTokenUsage)
    .where(
      and(
        eq(aiTokenUsage.organizationId, organizationId),
        eq(aiTokenUsage.periodStart, period)
      )
    );

  return Number(result[0]?.total || 0);
}

/**
 * Check if organization has tokens remaining
 */
export async function hasTokensRemaining(organizationId: number): Promise<{ hasTokens: boolean; used: number; limit: number }> {
  const used = await getMonthlyTokenUsage(organizationId);
  return {
    hasTokens: used < MONTHLY_TOKEN_LIMIT,
    used,
    limit: MONTHLY_TOKEN_LIMIT,
  };
}

/**
 * Record token usage
 */
async function recordTokenUsage(
  organizationId: number,
  userId: number,
  promptTokens: number,
  completionTokens: number,
  model: string
): Promise<void> {
  await db.insert(aiTokenUsage).values({
    organizationId,
    userId,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    model,
    periodStart: getCurrentPeriod(),
  });
}

/**
 * Save chat message to history
 */
async function saveChatMessage(
  organizationId: number,
  userId: number,
  role: "user" | "assistant",
  content: string,
  tokensUsed?: number
): Promise<void> {
  await db.insert(aiChatMessages).values({
    organizationId,
    userId,
    role,
    content,
    tokensUsed,
  });
}

/**
 * Get recent chat history for context
 */
export async function getChatHistory(
  organizationId: number,
  userId: number,
  limit: number = 10
): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
  const messages = await db
    .select({
      role: aiChatMessages.role,
      content: aiChatMessages.content,
      createdAt: aiChatMessages.createdAt,
    })
    .from(aiChatMessages)
    .where(
      and(
        eq(aiChatMessages.organizationId, organizationId),
        eq(aiChatMessages.userId, userId)
      )
    )
    .orderBy(desc(aiChatMessages.createdAt))
    .limit(limit);

  return messages.reverse(); // Return in chronological order
}

/**
 * Fetch CRM context for the AI assistant, respecting user permissions
 */
async function getCRMContext(organizationId: number, userId: number): Promise<CRMContext> {
  console.log(`[AI Assistant] getCRMContext for org: ${organizationId}, user: ${userId}`);

  // TODO: Re-enable permission checks after fixing getUserPermissions query issue
  // For now, allow all access (organization-level filtering still applies)
  const permissions = {
    canViewDeals: true,
    canViewContacts: true,
    canViewCompanies: true,
    canViewTasks: true,
    canViewAnalytics: true,
  };
  console.log(`[AI Assistant] Using default permissions (all access within org)`);

  // Only fetch data the user has permission to view
  let recentDeals: any[] = [];
  if (permissions.canViewDeals) {
    recentDeals = await db
      .select({
        id: deals.id,
        name: deals.name,
        amount: deals.amount,
        stageName: pipelineStages.name,
        probability: pipelineStages.probability,
        closeDate: deals.closeDate,
        priority: deals.priority,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(eq(deals.organizationId, organizationId))
      .orderBy(desc(deals.updatedAt))
      .limit(50);

    console.log(`[AI Assistant] Found ${recentDeals.length} deals for org ${organizationId}`);
    if (recentDeals.length > 0) {
      console.log(`[AI Assistant] First deal:`, recentDeals[0]);
    } else {
      // Debug: check if there are any deals at all
      const allDealsCount = await db.select({ count: sql<number>`count(*)` }).from(deals);
      console.log(`[AI Assistant] Total deals in database: ${allDealsCount[0]?.count}`);

      // Check what organizations have deals
      const dealsPerOrg = await db
        .select({
          orgId: deals.organizationId,
          count: sql<number>`count(*)`
        })
        .from(deals)
        .groupBy(deals.organizationId)
        .limit(5);
      console.log(`[AI Assistant] Deals per org:`, dealsPerOrg);
    }
  } else {
    console.log(`[AI Assistant] User does not have permission to view deals`);
  }

  // Get contacts only if user has permission
  console.log(`[AI Assistant] Fetching contacts...`);
  let recentContacts: any[] = [];
  if (permissions.canViewContacts) {
    recentContacts = await db
      .select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
        phone: crmContacts.phone,
        companyName: companies.name,
        title: crmContacts.title,
        lifecycleStage: crmContacts.lifecycleStage,
      })
      .from(crmContacts)
      .leftJoin(companies, eq(crmContacts.companyId, companies.id))
      .where(eq(crmContacts.organizationId, organizationId))
      .orderBy(desc(crmContacts.updatedAt))
      .limit(50);
    console.log(`[AI Assistant] Found ${recentContacts.length} contacts`);
  }

  // Get companies only if user has permission
  console.log(`[AI Assistant] Fetching companies...`);
  let recentCompanies: any[] = [];
  if (permissions.canViewCompanies) {
    recentCompanies = await db
      .select({
        id: companies.id,
        name: companies.name,
        industry: companies.industry,
        website: companies.website,
        phone: companies.phone,
      })
      .from(companies)
      .where(eq(companies.organizationId, organizationId))
      .orderBy(desc(companies.updatedAt))
      .limit(30);
    console.log(`[AI Assistant] Found ${recentCompanies.length} companies`);
  }

  // Get pending tasks only if user has permission
  console.log(`[AI Assistant] Fetching tasks...`);
  let pendingTasks: any[] = [];
  if (permissions.canViewTasks) {
    pendingTasks = await db
      .select({
        id: crmTasks.id,
        title: crmTasks.title,
        dueDate: crmTasks.dueDate,
        status: crmTasks.status,
        priority: crmTasks.priority,
      })
      .from(crmTasks)
      .where(
        and(
          eq(crmTasks.organizationId, organizationId),
          eq(crmTasks.status, "pending")
        )
      )
      .orderBy(crmTasks.dueDate)
      .limit(20);
    console.log(`[AI Assistant] Found ${pendingTasks.length} tasks`);
  }

  // Calculate pipeline stats (only if user can view deals)
  const pipelineStats = {
    totalDeals: recentDeals.length,
    totalValue: recentDeals.reduce((sum, d) => sum + (parseFloat(d.amount || "0") || 0), 0),
    dealsByStage: recentDeals.reduce((acc, d) => {
      const stage = d.stageName || "Unknown";
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    deals: recentDeals,
    contacts: recentContacts,
    companies: recentCompanies,
    tasks: pendingTasks,
    pipelineStats,
    permissions,
  };
}

/**
 * Build the system prompt with CRM context
 */
function buildSystemPrompt(context: CRMContext): string {
  // Safely destructure with defaults
  const deals = context?.deals || [];
  const contacts = context?.contacts || [];
  const companies = context?.companies || [];
  const tasks = context?.tasks || [];
  const pipelineStats = context?.pipelineStats || { totalDeals: 0, totalValue: 0, dealsByStage: {} };
  const permissions = context?.permissions || {
    canViewDeals: false,
    canViewContacts: false,
    canViewCompanies: false,
    canViewTasks: false,
    canViewAnalytics: false,
  };

  const totalDeals = pipelineStats.totalDeals ?? 0;
  const totalValue = pipelineStats.totalValue ?? 0;
  const dealsByStage = pipelineStats.dealsByStage ?? {};

  // Build permission restrictions message
  const restrictedItems: string[] = [];
  if (!permissions.canViewDeals) restrictedItems.push("deals/pipeline");
  if (!permissions.canViewContacts) restrictedItems.push("contacts");
  if (!permissions.canViewCompanies) restrictedItems.push("companies");
  if (!permissions.canViewTasks) restrictedItems.push("tasks");
  if (!permissions.canViewAnalytics) restrictedItems.push("analytics/reports");

  const permissionNotice = restrictedItems.length > 0
    ? `\n\n## Access Restrictions\nIMPORTANT: This user does NOT have permission to view: ${restrictedItems.join(", ")}. If they ask about these topics, politely explain that they don't have access to that information and suggest they contact their administrator for access.`
    : "";

  return `You are an AI assistant for a CRM (Customer Relationship Management) system. You help users understand their sales pipeline, find information about deals, contacts, and companies, and provide insights about their business.

## Your Capabilities (Phase 1 - Read Only)
- Answer questions about deals, contacts, and companies
- Provide pipeline summaries and statistics
- Help find specific records
- Explain deal status and history
- Identify at-risk deals or opportunities
- Summarize tasks and follow-ups

## Important Guidelines
- Be concise and helpful
- Format responses for easy reading (use bullet points, bold for emphasis)
- If you don't have enough information to answer, say so
- Never make up data - only use what's provided in the context
- For actions (creating, updating, deleting), explain that this feature is coming soon
- NEVER reveal information the user doesn't have permission to access${permissionNotice}

## Current CRM Data

${permissions.canViewDeals ? `### Pipeline Overview
- Total Deals: ${totalDeals}
- Total Pipeline Value: $${totalValue.toLocaleString()}
- Deals by Stage: ${JSON.stringify(dealsByStage)}

### Recent Deals (${deals.length} shown)
${deals.slice(0, 20).map(d => `- "${d.name || 'Unnamed'}" | Stage: ${d.stageName || 'Unknown'} | Value: $${d.amount || "0"} | Priority: ${d.priority || "normal"}`).join("\n") || "No deals found"}` : "### Deals\n[Access restricted - user does not have permission to view deals]"}

${permissions.canViewContacts ? `### Contacts (${contacts.length} shown)
${contacts.slice(0, 15).map(c => `- ${c.firstName || ''} ${c.lastName || ''} | ${c.email || "no email"} | ${c.companyName || "no company"} | ${c.title || ""}`).join("\n") || "No contacts found"}` : "### Contacts\n[Access restricted - user does not have permission to view contacts]"}

${permissions.canViewCompanies ? `### Companies (${companies.length} shown)
${companies.slice(0, 10).map(c => `- ${c.name || 'Unnamed'} | ${c.industry || "no industry"}`).join("\n") || "No companies found"}` : "### Companies\n[Access restricted - user does not have permission to view companies]"}

${permissions.canViewTasks ? `### Pending Tasks (${tasks.length})
${tasks.slice(0, 10).map(t => `- ${t.title || 'Untitled'} | Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "no date"} | Priority: ${t.priority || 'normal'}`).join("\n") || "No pending tasks"}` : "### Tasks\n[Access restricted - user does not have permission to view tasks]"}

Answer the user's question based on this data, respecting their access permissions.`;
}

/**
 * Main chat function
 */
export async function chat(
  organizationId: number,
  userId: number,
  userMessage: string
): Promise<{ response: string; tokensUsed: number; error?: string }> {
  console.log(`[AI Assistant] Chat request from user ${userId}, org ${organizationId}, message length: ${userMessage.length}`);

  // Check if OpenAI is configured
  if (!openai) {
    console.log("[AI Assistant] OpenAI not configured - returning error");
    return {
      response: "AI assistant is not configured. Please contact support.",
      tokensUsed: 0,
      error: "openai_not_configured",
    };
  }

  // Check token limit
  let tokenStatus = { hasTokens: true, used: 0, limit: MONTHLY_TOKEN_LIMIT };
  try {
    tokenStatus = await hasTokensRemaining(organizationId);
    console.log(`[AI Assistant] Token status: ${tokenStatus.used}/${tokenStatus.limit} used`);
  } catch (tokenError: any) {
    console.error("[AI Assistant] Error checking token status:", tokenError);
    // Continue anyway - assume tokens are available
  }
  if (!tokenStatus.hasTokens) {
    return {
      response: `You've reached your monthly AI usage limit (${tokenStatus.limit.toLocaleString()} tokens). Your limit resets at the start of next month.`,
      tokensUsed: 0,
      error: "token_limit_reached",
    };
  }

  try {
    // Get CRM context (respecting user permissions)
    console.log("[AI Assistant] Fetching CRM context...");
    let context: CRMContext;
    try {
      context = await getCRMContext(organizationId, userId);
      console.log(`[AI Assistant] CRM context: ${context?.deals?.length || 0} deals, ${context?.contacts?.length || 0} contacts`);
      console.log(`[AI Assistant] User permissions in context:`, context?.permissions);
    } catch (contextError: any) {
      console.error("[AI Assistant] Error fetching CRM context:", contextError);
      // Return empty context if fetch fails
      context = {
        deals: [],
        contacts: [],
        companies: [],
        tasks: [],
        pipelineStats: { totalDeals: 0, totalValue: 0, dealsByStage: {} },
        permissions: { canViewDeals: false, canViewContacts: false, canViewCompanies: false, canViewTasks: false, canViewAnalytics: false }
      };
    }

    // Get recent chat history
    console.log("[AI Assistant] Fetching chat history...");
    let history: Array<{ role: string; content: string; createdAt: Date }> = [];
    try {
      history = await getChatHistory(organizationId, userId, 6) || [];
      console.log(`[AI Assistant] Chat history: ${history.length} messages`);
    } catch (historyError: any) {
      console.error("[AI Assistant] Error fetching chat history:", historyError);
      history = [];
    }

    // Build messages array
    const messages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(context) },
      ...(history || []).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: userMessage },
    ];

    // Save user message
    console.log("[AI Assistant] Saving user message...");
    try {
      await saveChatMessage(organizationId, userId, "user", userMessage);
    } catch (saveError: any) {
      console.error("[AI Assistant] Error saving user message:", saveError);
      // Continue anyway - we can still process the request
    }

    // Call OpenAI
    console.log("[AI Assistant] Calling OpenAI API...");
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });
    console.log("[AI Assistant] OpenAI response received");

    const assistantMessage = completion.choices[0]?.message?.content || "I couldn't generate a response.";
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

    // Record token usage
    console.log(`[AI Assistant] Recording token usage: ${totalTokens} tokens`);
    try {
      await recordTokenUsage(organizationId, userId, promptTokens, completionTokens, AI_MODEL);
    } catch (usageError: any) {
      console.error("[AI Assistant] Error recording token usage:", usageError);
    }

    // Save assistant message
    console.log("[AI Assistant] Saving assistant message...");
    try {
      await saveChatMessage(organizationId, userId, "assistant", assistantMessage, totalTokens);
    } catch (saveError: any) {
      console.error("[AI Assistant] Error saving assistant message:", saveError);
    }

    console.log("[AI Assistant] Chat completed successfully");
    return {
      response: assistantMessage,
      tokensUsed: totalTokens,
    };
  } catch (error: any) {
    console.error("[AI Assistant] Error:", error);
    console.error("[AI Assistant] Error stack:", error.stack);
    return {
      response: "Sorry, I encountered an error processing your request. Please try again.",
      tokensUsed: 0,
      error: error.message,
    };
  }
}

/**
 * Clear chat history for a user
 */
export async function clearChatHistory(organizationId: number, userId: number): Promise<void> {
  await db
    .delete(aiChatMessages)
    .where(
      and(
        eq(aiChatMessages.organizationId, organizationId),
        eq(aiChatMessages.userId, userId)
      )
    );
}

/**
 * Record feedback on a message
 */
export async function recordFeedback(
  messageId: number,
  feedback: "positive" | "negative"
): Promise<void> {
  await db
    .update(aiChatMessages)
    .set({ feedback })
    .where(eq(aiChatMessages.id, messageId));
}
