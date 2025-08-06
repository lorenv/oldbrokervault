import { Router } from "express";
import { messageService } from "../message-service";

const router = Router();

// Get all message threads for the authenticated user
router.get("/threads", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  try {
    const userId = req.user!.id;

    const threads = await messageService.getThreadsForUser(userId);
    res.json(threads);
  } catch (error) {
    console.error("Error fetching message threads:", error);
    res.status(500).json({ error: "Failed to fetch message threads" });
  }
});

// Get messages in a specific thread
router.get("/threads/:threadId/messages", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  try {
    const userId = req.user!.id;
    const threadId = parseInt(req.params.threadId);

    if (isNaN(threadId)) {
      return res.status(400).json({ error: "Invalid thread ID" });
    }

    const messages = await messageService.getMessagesInThread(threadId, userId);
    
    // Mark messages as read when viewed
    await messageService.markMessagesAsRead(threadId, userId);
    
    res.json(messages);
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    if (error.message.includes("not found or access denied")) {
      return res.status(404).json({ error: "Thread not found" });
    }
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Reply to a thread
router.post("/threads/:threadId/reply", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  try {
    const userId = req.user!.id;
    const threadId = parseInt(req.params.threadId);
    const { content } = req.body;

    if (isNaN(threadId) || !content?.trim()) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    const message = await messageService.replyToThread(threadId, userId, content.trim());

    res.json(message);
  } catch (error) {
    console.error("Error replying to thread:", error);
    if (error.message.includes("not found or access denied")) {
      return res.status(404).json({ error: "Thread not found" });
    }
    res.status(500).json({ error: "Failed to send reply" });
  }
});

// Get unread message count
router.get("/unread-count", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  try {
    const userId = req.user!.id;
    const count = await messageService.getUnreadCountForUser(userId);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

// Archive a thread
router.patch("/threads/:threadId/archive", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  try {
    const userId = req.user!.id;
    const threadId = parseInt(req.params.threadId);

    if (isNaN(threadId)) {
      return res.status(400).json({ error: "Invalid thread ID" });
    }

    await messageService.archiveThread(threadId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error archiving thread:", error);
    res.status(500).json({ error: "Failed to archive thread" });
  }
});

// Reactivate a thread
router.patch("/threads/:threadId/reactivate", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  try {
    const userId = req.user!.id;
    const threadId = parseInt(req.params.threadId);

    if (isNaN(threadId)) {
      return res.status(400).json({ error: "Invalid thread ID" });
    }

    await messageService.reactivateThread(threadId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error reactivating thread:", error);
    res.status(500).json({ error: "Failed to reactivate thread" });
  }
});

// Public endpoint for contact form submissions (creates new thread)
router.post("/contact", async (req, res) => {
  try {
    const { 
      cimDocumentId, 
      inquirerEmail, 
      inquirerName, 
      subject, 
      content 
    } = req.body;

    // Validate required fields
    if (!cimDocumentId || !inquirerEmail || !inquirerName || !subject || !content) {
      return res.status(400).json({ 
        error: "Missing required fields: cimDocumentId, inquirerEmail, inquirerName, subject, content" 
      });
    }

    // Get the CIM document to find the owner
    const { cimDocuments } = await import("../shared/schema");
    const { db } = await import("../lib/db");
    const { eq } = await import("drizzle-orm");

    const [cimDoc] = await db
      .select({ userId: cimDocuments.userId })
      .from(cimDocuments)
      .where(eq(cimDocuments.id, parseInt(cimDocumentId)));

    if (!cimDoc) {
      return res.status(404).json({ error: "CIM document not found" });
    }

    // Create the message thread and initial message
    const thread = await messageService.createThreadFromContactForm(
      cimDoc.userId,
      parseInt(cimDocumentId),
      inquirerEmail,
      inquirerName,
      subject,
      content
    );

    res.json({ 
      success: true, 
      threadId: thread.id,
      message: "Your message has been sent successfully. You will receive a confirmation email shortly."
    });

  } catch (error) {
    console.error("Error processing contact form:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Webhook endpoint for SendGrid inbound parse (Phase 2)
router.post("/webhook/inbound", async (req, res) => {
  try {
    const { to, from, subject, text, html } = req.body;

    // Extract thread email address from "to" field
    const threadEmailMatch = to.match(/thread-(\d+)@cimshare\.com/);
    if (!threadEmailMatch) {
      console.log("Invalid thread email format:", to);
      return res.status(400).json({ error: "Invalid thread email format" });
    }

    const threadEmailAddress = to;
    const content = html || text || "";

    // Process the inbound email
    await messageService.processInboundEmail(
      threadEmailAddress,
      from,
      subject,
      content
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error processing inbound email:", error);
    res.status(500).json({ error: "Failed to process inbound email" });
  }
});

export { router as messageRoutes };