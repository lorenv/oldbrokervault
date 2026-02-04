import { Router } from "express";
import { chat, getChatHistory, clearChatHistory, hasTokensRemaining, recordFeedback } from "../services/ai-assistant";
import { db } from "../db";
import { organizationMembers } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Debug/test endpoint
router.get("/test", async (req, res) => {
  console.log("[AI Assistant Route] GET /test called");
  try {
    // Test database connectivity
    const testQuery = await db.select({ id: organizationMembers.id }).from(organizationMembers).limit(1);
    console.log("[AI Assistant Route] Database test passed");

    res.json({
      status: "ok",
      dbConnected: true,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[AI Assistant Route] Test failed:", error);
    res.json({
      status: "error",
      error: error.message,
      openaiConfigured: !!process.env.OPENAI_API_KEY
    });
  }
});

// Middleware to get user's organization
async function getOrganizationId(userId: number): Promise<number | null> {
  console.log(`[AI Assistant Route] Looking up organization for user ${userId}`);
  const [membership] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));
  console.log(`[AI Assistant Route] Found membership:`, membership);
  return membership?.organizationId || null;
}

// Send a message to the AI assistant
router.post("/chat", async (req, res) => {
  console.log("[AI Assistant Route] POST /chat received");
  try {
    if (!req.isAuthenticated() || !req.user) {
      console.log("[AI Assistant Route] User not authenticated");
      return res.status(401).json({ error: "Authentication required" });
    }

    const { message } = req.body;
    console.log(`[AI Assistant Route] Message from user ${req.user.id}: "${message?.substring(0, 50)}..."`);

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      console.log("[AI Assistant Route] Invalid message");
      return res.status(400).json({ error: "Message is required" });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: "Message too long (max 2000 characters)" });
    }

    const organizationId = await getOrganizationId(req.user.id);
    console.log(`[AI Assistant Route] Organization ID: ${organizationId}`);
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found for user" });
    }

    const result = await chat(organizationId, req.user.id, message.trim());
    console.log(`[AI Assistant Route] Chat result - error: ${result.error}, tokens: ${result.tokensUsed}`);

    res.json({
      response: result.response,
      tokensUsed: result.tokensUsed,
      error: result.error,
    });
  } catch (error: any) {
    console.error("[AI Assistant Route] Error:", error);
    console.error("[AI Assistant Route] Error stack:", error.stack);
    res.status(500).json({ error: "Failed to process message" });
  }
});

// Get chat history
router.get("/history", async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const organizationId = await getOrganizationId(req.user.id);
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found for user" });
    }

    const history = await getChatHistory(organizationId, req.user.id, 50);

    res.json({ messages: history });
  } catch (error: any) {
    console.error("[AI Assistant Route] Error:", error);
    res.status(500).json({ error: "Failed to get chat history" });
  }
});

// Clear chat history
router.delete("/history", async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const organizationId = await getOrganizationId(req.user.id);
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found for user" });
    }

    await clearChatHistory(organizationId, req.user.id);

    res.json({ success: true });
  } catch (error: any) {
    console.error("[AI Assistant Route] Error:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
});

// Get token usage status
router.get("/usage", async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const organizationId = await getOrganizationId(req.user.id);
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found for user" });
    }

    const usage = await hasTokensRemaining(organizationId);

    res.json({
      used: usage.used,
      limit: usage.limit,
      remaining: usage.limit - usage.used,
      percentUsed: Math.round((usage.used / usage.limit) * 100),
    });
  } catch (error: any) {
    console.error("[AI Assistant Route] Error:", error);
    res.status(500).json({ error: "Failed to get usage" });
  }
});

// Record feedback on a message
router.post("/feedback", async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { messageId, feedback } = req.body;
    if (!messageId || !feedback || !["positive", "negative"].includes(feedback)) {
      return res.status(400).json({ error: "Invalid feedback data" });
    }

    await recordFeedback(messageId, feedback);

    res.json({ success: true });
  } catch (error: any) {
    console.error("[AI Assistant Route] Error:", error);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

export default router;
