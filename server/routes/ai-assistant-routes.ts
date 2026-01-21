import { Router } from "express";
import { chat, getChatHistory, clearChatHistory, hasTokensRemaining, recordFeedback } from "../services/ai-assistant";
import { db } from "../db";
import { organizationMembers } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Middleware to get user's organization
async function getOrganizationId(userId: number): Promise<number | null> {
  const [membership] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));
  return membership?.organizationId || null;
}

// Send a message to the AI assistant
router.post("/chat", async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: "Message too long (max 2000 characters)" });
    }

    const organizationId = await getOrganizationId(req.user.id);
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found for user" });
    }

    const result = await chat(organizationId, req.user.id, message.trim());

    res.json({
      response: result.response,
      tokensUsed: result.tokensUsed,
      error: result.error,
    });
  } catch (error: any) {
    console.error("[AI Assistant Route] Error:", error);
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
