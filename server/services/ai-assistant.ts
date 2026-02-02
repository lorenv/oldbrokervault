import OpenAI from "openai";
import { db } from "../db";
import { aiTokenUsage, aiChatMessages, deals, crmContacts, companies, crmTasks, pipelineStages, pipelines } from "@shared/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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
 * Fetch CRM context for the AI assistant
 */
async function getCRMContext(organizationId: number): Promise<CRMContext> {
  // Get recent deals with stage info
  const recentDeals = await db
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

  // Get contacts
  const recentContacts = await db
    .select({
      id: crmContacts.id,
      firstName: crmContacts.firstName,
      lastName: crmContacts.lastName,
      email: crmContacts.email,
      phone: crmContacts.phone,
      company: crmContacts.company,
      title: crmContacts.title,
      lifecycleStage: crmContacts.lifecycleStage,
    })
    .from(crmContacts)
    .where(eq(crmContacts.organizationId, organizationId))
    .orderBy(desc(crmContacts.updatedAt))
    .limit(50);

  // Get companies
  const recentCompanies = await db
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

  // Get pending tasks
  const pendingTasks = await db
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

  // Calculate pipeline stats
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
  };
}

/**
 * Build the system prompt with CRM context
 */
function buildSystemPrompt(context: CRMContext): string {
  const { deals, contacts, companies, tasks, pipelineStats } = context;

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

## Current CRM Data

### Pipeline Overview
- Total Deals: ${pipelineStats.totalDeals}
- Total Pipeline Value: $${pipelineStats.totalValue.toLocaleString()}
- Deals by Stage: ${JSON.stringify(pipelineStats.dealsByStage)}

### Recent Deals (${deals.length} shown)
${deals.slice(0, 20).map(d => `- "${d.name}" | Stage: ${d.stageName} | Value: $${d.amount || "0"} | Priority: ${d.priority || "normal"}`).join("\n")}

### Contacts (${contacts.length} shown)
${contacts.slice(0, 15).map(c => `- ${c.firstName} ${c.lastName} | ${c.email || "no email"} | ${c.company || "no company"} | ${c.title || ""}`).join("\n")}

### Companies (${companies.length} shown)
${companies.slice(0, 10).map(c => `- ${c.name} | ${c.industry || "no industry"}`).join("\n")}

### Pending Tasks (${tasks.length})
${tasks.slice(0, 10).map(t => `- ${t.title} | Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "no date"} | Priority: ${t.priority}`).join("\n")}

Answer the user's question based on this data.`;
}

/**
 * Main chat function
 */
export async function chat(
  organizationId: number,
  userId: number,
  userMessage: string
): Promise<{ response: string; tokensUsed: number; error?: string }> {
  // Check if OpenAI is configured
  if (!openai) {
    return {
      response: "AI assistant is not configured. Please contact support.",
      tokensUsed: 0,
      error: "openai_not_configured",
    };
  }

  // Check token limit
  const tokenStatus = await hasTokensRemaining(organizationId);
  if (!tokenStatus.hasTokens) {
    return {
      response: `You've reached your monthly AI usage limit (${tokenStatus.limit.toLocaleString()} tokens). Your limit resets at the start of next month.`,
      tokensUsed: 0,
      error: "token_limit_reached",
    };
  }

  try {
    // Get CRM context
    const context = await getCRMContext(organizationId);

    // Get recent chat history
    const history = await getChatHistory(organizationId, userId, 6);

    // Build messages array
    const messages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(context) },
      ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: userMessage },
    ];

    // Save user message
    await saveChatMessage(organizationId, userId, "user", userMessage);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const assistantMessage = completion.choices[0]?.message?.content || "I couldn't generate a response.";
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

    // Record token usage
    await recordTokenUsage(organizationId, userId, promptTokens, completionTokens, AI_MODEL);

    // Save assistant message
    await saveChatMessage(organizationId, userId, "assistant", assistantMessage, totalTokens);

    return {
      response: assistantMessage,
      tokensUsed: totalTokens,
    };
  } catch (error: any) {
    console.error("[AI Assistant] Error:", error);
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
