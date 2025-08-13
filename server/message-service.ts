import { db } from "./db";
import { messageThreads, messages, emailSyncLog, cimDocuments, users } from "../shared/schema";
import type { 
  MessageThread, 
  InsertMessageThread, 
  Message, 
  InsertMessage, 
  EmailSyncLog, 
  InsertEmailSyncLog 
} from "../shared/schema";
import { eq, desc, and, sql, or } from "drizzle-orm";
import { sendEmail } from "./email";
import { randomUUID } from "crypto";
import { shareCache, CACHE_TTL, MemoryCache } from "./cache";

export class MessageService {
  // Generate unique email address for thread (using parse subdomain)
  private generateThreadEmail(threadId: number): string {
    return `thread-${threadId}@reply.cimshare.com`;
  }

  // Create a new message thread from contact form
  async createThreadFromContactForm(
    userId: number,
    cimDocumentId: number,
    inquirerEmail: string,
    inquirerName: string,
    subject: string,
    content: string
  ): Promise<MessageThread> {
    // Create the thread first
    const [thread] = await db
      .insert(messageThreads)
      .values({
        userId,
        cimDocumentId,
        inquirerEmail,
        inquirerName,
        subject,
        status: "active"
      })
      .returning();

    // Generate and update thread email address
    const threadEmailAddress = this.generateThreadEmail(thread.id);
    await db
      .update(messageThreads)
      .set({ threadEmailAddress })
      .where(eq(messageThreads.id, thread.id));

    // Create the initial message (exclude richContent for contact forms)
    const [message] = await db
      .insert(messages)
      .values({
        threadId: thread.id,
        senderType: "inquirer",
        senderEmail: inquirerEmail,
        content,
        messageType: "contact_form"
      })
      .returning();

    // Send notification email to owner
    await this.notifyOwnerOfNewMessage(thread.id, content);

    // Return updated thread with email address
    const [updatedThread] = await db
      .select()
      .from(messageThreads)
      .where(eq(messageThreads.id, thread.id));

    return updatedThread;
  }

  // Create a new message in a thread
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(messageData)
      .returning();

    // Update thread's last message timestamp
    await db
      .update(messageThreads)
      .set({ 
        lastMessageAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(messageThreads.id, messageData.threadId));

    // Invalidate relevant caches when new message is created
    this.invalidateMessageCaches(messageData.threadId);

    return message;
  }

  // Get all threads for a user with unread count (optimized with caching)
  async getThreadsForUser(userId: number, archived: boolean = false, cimDocumentId?: number): Promise<(MessageThread & { 
    unreadCount: number;
    lastMessage?: Message;
    cimTitle?: string | null;
  })[]> {
    const cacheKey = MemoryCache.keys.messageThreads(userId, archived, cimDocumentId);
    const cached = shareCache.get<(MessageThread & { unreadCount: number; lastMessage?: Message; cimTitle?: string | null; })[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Optimized single query with all data including last message
    const threadsWithDetails = await db
      .select({
        // Thread fields
        id: messageThreads.id,
        userId: messageThreads.userId,
        cimDocumentId: messageThreads.cimDocumentId,
        inquirerEmail: messageThreads.inquirerEmail,
        inquirerName: messageThreads.inquirerName,
        subject: messageThreads.subject,
        status: messageThreads.status,
        threadEmailAddress: messageThreads.threadEmailAddress,
        createdAt: messageThreads.createdAt,
        updatedAt: messageThreads.updatedAt,
        lastMessageAt: messageThreads.lastMessageAt,
        // CIM title
        cimTitle: cimDocuments.title,
        // Unread count (calculated)
        unreadCount: sql<number>`
          (SELECT COUNT(*) FROM ${messages} 
           WHERE ${messages.threadId} = ${messageThreads.id} 
           AND ${messages.senderType} = 'inquirer' 
           AND ${messages.isRead} = false)
        `,
        // Last message data (optimized with window function)
        lastMessageId: sql<number>`
          (SELECT id FROM ${messages} 
           WHERE ${messages.threadId} = ${messageThreads.id}
           ORDER BY ${messages.createdAt} DESC 
           LIMIT 1)
        `,
        lastMessageContent: sql<string>`
          (SELECT content FROM ${messages} 
           WHERE ${messages.threadId} = ${messageThreads.id}
           ORDER BY ${messages.createdAt} DESC 
           LIMIT 1)
        `,
        lastMessageSenderType: sql<string>`
          (SELECT sender_type FROM ${messages} 
           WHERE ${messages.threadId} = ${messageThreads.id}
           ORDER BY ${messages.createdAt} DESC 
           LIMIT 1)
        `,
        lastMessageCreatedAt: sql<string>`
          (SELECT created_at FROM ${messages} 
           WHERE ${messages.threadId} = ${messageThreads.id}
           ORDER BY ${messages.createdAt} DESC 
           LIMIT 1)
        `
      })
      .from(messageThreads)
      .leftJoin(cimDocuments, eq(messageThreads.cimDocumentId, cimDocuments.id))
      .where(and(
        eq(messageThreads.userId, userId),
        eq(messageThreads.status, archived ? "archived" : "active"),
        ...(cimDocumentId ? [eq(messageThreads.cimDocumentId, cimDocumentId)] : [])
      ))
      .orderBy(desc(messageThreads.lastMessageAt));

    // Transform the results to include last message object
    const result = threadsWithDetails.map(thread => ({
      id: thread.id,
      userId: thread.userId,
      cimDocumentId: thread.cimDocumentId,
      inquirerEmail: thread.inquirerEmail,
      inquirerName: thread.inquirerName,
      subject: thread.subject,
      status: thread.status as 'active' | 'archived',
      threadEmailAddress: thread.threadEmailAddress,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      lastMessageAt: thread.lastMessageAt,
      cimTitle: thread.cimTitle,
      unreadCount: thread.unreadCount,
      lastMessage: thread.lastMessageId ? {
        id: thread.lastMessageId,
        threadId: thread.id,
        senderType: thread.lastMessageSenderType as 'inquirer' | 'owner',
        senderEmail: '',
        content: thread.lastMessageContent || '',
        richContent: null,
        messageType: 'app_message' as const,
        sendgridMessageId: null,
        isRead: false,
        createdAt: new Date(thread.lastMessageCreatedAt || new Date().toISOString()),
        attachmentPaths: null
      } : undefined
    }));

    // Cache the result
    shareCache.set(cacheKey, result, CACHE_TTL.MESSAGE_THREADS);
    
    return result;
  }

  // Get unique CIM documents that have messages for a user (cached)
  async getCimDocumentsWithMessages(userId: number): Promise<{ id: number; title: string; messageCount: number }[]> {
    const cacheKey = MemoryCache.keys.cimDocuments(userId);
    const cached = shareCache.get<{ id: number; title: string; messageCount: number }[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const cimDocsWithMessages = await db
      .select({
        id: messageThreads.cimDocumentId,
        title: sql<string>`COALESCE(cim_documents.title, 'Untitled CIM')`,
        messageCount: sql<number>`COUNT(DISTINCT ${messageThreads.id})`
      })
      .from(messageThreads)
      .leftJoin(cimDocuments, eq(messageThreads.cimDocumentId, cimDocuments.id))
      .where(eq(messageThreads.userId, userId))
      .groupBy(messageThreads.cimDocumentId, sql`cim_documents.title`)
      .orderBy(sql`cim_documents.title`);

    shareCache.set(cacheKey, cimDocsWithMessages, CACHE_TTL.CIM_DOCUMENTS);
    return cimDocsWithMessages;
  }

  // Get messages in a thread (cached)
  async getMessagesInThread(threadId: number, userId?: number): Promise<Message[]> {
    const cacheKey = MemoryCache.keys.threadMessages(threadId);
    const cached = shareCache.get<Message[]>(cacheKey);
    
    if (cached && !userId) {
      // Only return cached results if no user verification needed
      return cached;
    }

    // Verify user has access to this thread
    if (userId) {
      const thread = await db
        .select()
        .from(messageThreads)
        .where(and(
          eq(messageThreads.id, threadId),
          eq(messageThreads.userId, userId)
        ))
        .limit(1);

      if (thread.length === 0) {
        throw new Error("Thread not found or access denied");
      }
    }

    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt);

    // Cache messages for faster subsequent access
    shareCache.set(cacheKey, result, CACHE_TTL.THREAD_MESSAGES);
    
    return result;
  }

  // Mark messages as read
  async markMessagesAsRead(threadId: number, userId: number): Promise<void> {
    // Verify user owns the thread
    const thread = await db
      .select()
      .from(messageThreads)
      .where(and(
        eq(messageThreads.id, threadId),
        eq(messageThreads.userId, userId)
      ))
      .limit(1);

    if (thread.length === 0) {
      throw new Error("Thread not found or access denied");
    }

    // Mark all inquirer messages as read
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(
        eq(messages.threadId, threadId),
        eq(messages.senderType, "inquirer"),
        eq(messages.isRead, false)
      ));

    // Invalidate unread count cache
    shareCache.delete(MemoryCache.keys.unreadCount(userId));
  }

  // Get unread message count for user (cached)
  async getUnreadCountForUser(userId: number): Promise<number> {
    const cacheKey = MemoryCache.keys.unreadCount(userId);
    const cached = shareCache.get<number>(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    const result = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(messages)
      .innerJoin(messageThreads, eq(messages.threadId, messageThreads.id))
      .where(and(
        eq(messageThreads.userId, userId),
        eq(messages.senderType, "inquirer"),
        eq(messages.isRead, false)
      ));

    const count = Number(result[0]?.count) || 0;
    shareCache.set(cacheKey, count, CACHE_TTL.UNREAD_COUNT);
    
    return count;
  }

  // Reply to a thread (from app)
  async replyToThread(
    threadId: number, 
    userId: number, 
    content: string,
    richContent?: string,
    attachmentPaths?: string[]
  ): Promise<Message> {
    // Get thread details
    const [thread] = await db
      .select()
      .from(messageThreads)
      .where(and(
        eq(messageThreads.id, threadId),
        eq(messageThreads.userId, userId)
      ));

    if (!thread) {
      throw new Error("Thread not found or access denied");
    }

    // Get user email for sender
    const { users } = await import("../shared/schema");
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new Error("User not found");
    }

    // Create the message with richContent support
    const message = await this.createMessage({
      threadId,
      senderType: "owner",
      senderEmail: user.email,
      content,
      richContent,
      messageType: "app_message"
    });

    // Send email to inquirer
    await this.sendReplyEmail(thread, content, user.email);

    return message;
  }

  // Cache invalidation helper
  private invalidateMessageCaches(threadId: number): void {
    // Get thread to find userId for cache invalidation
    db.select({ userId: messageThreads.userId })
      .from(messageThreads)
      .where(eq(messageThreads.id, threadId))
      .then(([thread]) => {
        if (thread) {
          // Invalidate all user-related message caches
          shareCache.delete(MemoryCache.keys.unreadCount(thread.userId));
          shareCache.delete(MemoryCache.keys.messageThreads(thread.userId, false));
          shareCache.delete(MemoryCache.keys.messageThreads(thread.userId, true));
          shareCache.delete(MemoryCache.keys.threadMessages(threadId));
          shareCache.delete(MemoryCache.keys.cimDocuments(thread.userId));
        }
      })
      .catch(console.error);
  }

  // Send notification email to owner about new message
  private async notifyOwnerOfNewMessage(threadId: number, content: string): Promise<void> {
    try {
      const [threadDetails] = await db
        .select({
          ownerEmail: sql<string>`users.email`,
          ownerName: sql<string>`users.name`,
          inquirerName: messageThreads.inquirerName,
          inquirerEmail: messageThreads.inquirerEmail,
          subject: messageThreads.subject,
          cimTitle: sql<string>`cim_documents.title`,
          threadEmailAddress: messageThreads.threadEmailAddress
        })
        .from(messageThreads)
        .leftJoin(users, eq(users.id, messageThreads.userId))
        .leftJoin(cimDocuments, eq(cimDocuments.id, messageThreads.cimDocumentId))
        .where(eq(messageThreads.id, threadId));

      if (!threadDetails) return;

      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Message from ${threadDetails.inquirerName}</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>From:</strong> ${threadDetails.inquirerName} (${threadDetails.inquirerEmail})</p>
            <p><strong>Regarding:</strong> ${threadDetails.cimTitle}</p>
            <p><strong>Subject:</strong> ${threadDetails.subject}</p>
          </div>
          
          <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <p style="margin: 0;">${content.replace(/\n/g, '<br>')}</p>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background: #eff6ff; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #1e40af;">
              <strong>Reply Options:</strong><br>
              • Reply directly to this email to respond<br>
              • View in your <a href="https://cimshare.com/dashboard" style="color: #2563eb;">Message Center</a>
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        to: threadDetails.ownerEmail,
        from: "notifications@cimshare.com",
        replyTo: threadDetails.threadEmailAddress || undefined,
        subject: `New inquiry: ${threadDetails.subject}`,
        html: emailContent
      });

      // Log the email sync
      await this.logEmailSync(threadId, null, "outbound", "sent");

    } catch (error) {
      console.error("Failed to send owner notification:", error);
      await this.logEmailSync(threadId, null, "outbound", "failed", (error as Error).message);
    }
  }

  // Send reply email to inquirer
  private async sendReplyEmail(thread: any, content: string, ownerEmail: string): Promise<void> {
    try {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Reply from CIM Share</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Re:</strong> ${thread.subject}</p>
          </div>
          
          <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <p style="margin: 0;">${content.replace(/\n/g, '<br>')}</p>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background: #eff6ff; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #1e40af;">
              Reply directly to this email to continue the conversation.
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        to: thread.inquirerEmail,
        from: "notifications@cimshare.com",
        replyTo: thread.threadEmailAddress!,
        subject: `Re: ${thread.subject}`,
        html: emailContent
      });

      await this.logEmailSync(thread.id, null, "outbound", "sent");

    } catch (error) {
      console.error("Failed to send reply email:", error);
      await this.logEmailSync(thread.id, null, "outbound", "failed", (error as Error).message);
    }
  }

  // Log email sync activity
  async logEmailSync(
    threadId: number,
    messageId: number | null,
    direction: "inbound" | "outbound",
    status: "pending" | "sent" | "delivered" | "bounced" | "failed" | string,
    errorMessage?: string,
    sendgridMessageId?: string
  ): Promise<void> {
    await db
      .insert(emailSyncLog)
      .values({
        threadId,
        messageId,
        direction,
        status: status as any,
        errorMessage,
        sendgridMessageId
      });
  }

  // Process inbound email (Phase 2)
  async processInboundEmail(
    threadEmailAddress: string,
    fromEmail: string,
    subject: string,
    content: string,
    sendgridMessageId?: string
  ): Promise<void> {
    try {
      // Find the thread by email address
      const [thread] = await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.threadEmailAddress, threadEmailAddress));

      if (!thread) {
        console.error("Thread not found for email address:", threadEmailAddress);
        return;
      }

      // Create the message
      const message = await this.createMessage({
        threadId: thread.id,
        senderType: "inquirer",
        senderEmail: fromEmail,
        content,
        messageType: "email_reply"
      });

      // Log successful sync
      await this.logEmailSync(thread.id, message.id, "inbound", "delivered");

      // Notify owner of new reply
      await this.notifyOwnerOfNewMessage(thread.id, content);

    } catch (error) {
      console.error("Failed to process inbound email:", error);
      // Log failed sync attempt
      await this.logEmailSync(-1, null, "inbound", "failed", (error as Error).message);
    }
  }

  // Phase 2: Process SendGrid inbound email webhook
  async processInboundEmailWebhook(webhookData: any): Promise<void> {
    console.log("📧 Processing inbound email webhook:", JSON.stringify(webhookData, null, 2));
    
    try {
      // Parse SendGrid inbound email format
      // Expected format: { to, from, subject, text, html, dkim, SPF }
      const toEmail = webhookData.to;
      const fromEmail = webhookData.from;
      const subject = webhookData.subject || '';
      const content = webhookData.text || webhookData.html || '';
      const messageId = webhookData['message-id'] || undefined;
      
      console.log(`Inbound email: ${fromEmail} -> ${toEmail}`);
      
      // Extract thread ID from email address (format: thread-123@reply.cimshare.com)
      const threadMatch = toEmail.match(/thread-(\d+)@reply\.cimshare\.com/);
      if (!threadMatch) {
        console.log("No thread ID found in recipient email:", toEmail);
        return;
      }
      
      const threadId = parseInt(threadMatch[1]);
      console.log("Found thread ID:", threadId);
      
      // Verify thread exists
      const [thread] = await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.id, threadId));
        
      if (!thread) {
        console.error("Thread not found:", threadId);
        return;
      }
      
      // Clean content (remove quoted text and signatures)
      const cleanContent = this.cleanEmailContent(content);
      
      // Determine sender type
      const senderType = fromEmail === thread.inquirerEmail ? 'inquirer' : 
                        fromEmail.includes('@cimshare.com') ? 'owner' : 'inquirer';
      
      // Create the message
      const message = await this.createMessage({
        threadId: thread.id,
        senderType,
        senderEmail: fromEmail,
        content: cleanContent,
        messageType: "email_reply",
        sendgridMessageId: messageId
      });
      
      // Log successful sync
      await this.logEmailSync(thread.id, message.id, "inbound", "delivered");
      
      // Send notification to the appropriate party
      if (senderType === 'inquirer') {
        // Notify owner of new inquiry response
        await this.notifyOwnerOfNewMessage(thread.id, cleanContent);
      } else {
        // Notify inquirer of owner response
        await this.notifyInquirerOfResponse(thread.id, cleanContent);
      }
      
      console.log("✅ Successfully processed inbound email");
      
    } catch (error) {
      console.error("❌ Failed to process inbound email:", error);
      throw error;
    }
  }
  
  // Phase 2: Process SendGrid email events (delivery, open, click tracking)
  async processEmailEvent(event: any): Promise<void> {
    try {
      console.log("📊 Processing email event:", event.event, event.sg_message_id);
      
      // Find message by SendGrid message ID
      if (event.sg_message_id) {
        const [message] = await db
          .select()
          .from(messages)
          .where(eq(messages.sendgridMessageId, event.sg_message_id));
          
        if (message) {
          // Log delivery event
          await this.logEmailSync(
            message.threadId, 
            message.id, 
            "outbound", 
            event.event,
            undefined,
            event.sg_message_id
          );
        }
      }
      
    } catch (error) {
      console.error("Failed to process email event:", error);
    }
  }
  
  // Clean email content by removing quoted text and signatures
  private cleanEmailContent(content: string): string {
    // Remove common email signatures and quoted text
    let cleaned = content
      // Remove quoted text (lines starting with >)
      .split('\n')
      .filter(line => !line.trim().startsWith('>'))
      .join('\n')
      // Remove "On ... wrote:" patterns
      .replace(/On .+ wrote:/g, '')
      // Remove common signature separators
      .replace(/^\s*--\s*$/gm, '')
      // Remove excessive whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
      
    // If content is very short after cleaning, return original
    if (cleaned.length < 10 && content.length > cleaned.length) {
      return content;
    }
    
    return cleaned;
  }
  
  // Send notification to inquirer about owner response
  private async notifyInquirerOfResponse(threadId: number, content: string): Promise<void> {
    try {
      const [threadDetails] = await db
        .select({
          inquirerEmail: messageThreads.inquirerEmail,
          inquirerName: messageThreads.inquirerName,
          subject: messageThreads.subject,
          cimTitle: sql<string>`cim_documents.title`,
          threadEmailAddress: messageThreads.threadEmailAddress
        })
        .from(messageThreads)
        .leftJoin(cimDocuments, eq(cimDocuments.id, messageThreads.cimDocumentId))
        .where(eq(messageThreads.id, threadId));

      if (!threadDetails) return;

      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Response to Your Inquiry</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Regarding:</strong> ${threadDetails.cimTitle}</p>
            <p><strong>Subject:</strong> ${threadDetails.subject}</p>
          </div>
          
          <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <p style="margin: 0;">${content.replace(/\n/g, '<br>')}</p>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background: #eff6ff; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #1e40af;">
              You can reply directly to this email to continue the conversation.
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        to: threadDetails.inquirerEmail,
        from: "notifications@cimshare.com",
        replyTo: threadDetails.threadEmailAddress || undefined,
        subject: `Re: ${threadDetails.subject}`,
        html: emailContent
      });

    } catch (error) {
      console.error("Failed to notify inquirer:", error);
    }
  }

  // Archive a thread
  async archiveThread(threadId: number, userId: number): Promise<void> {
    await db
      .update(messageThreads)
      .set({ 
        status: "archived",
        updatedAt: new Date()
      })
      .where(and(
        eq(messageThreads.id, threadId),
        eq(messageThreads.userId, userId)
      ));
  }

  // Reactivate a thread
  async reactivateThread(threadId: number, userId: number): Promise<void> {
    await db
      .update(messageThreads)
      .set({ 
        status: "active",
        updatedAt: new Date()
      })
      .where(and(
        eq(messageThreads.id, threadId),
        eq(messageThreads.userId, userId)
      ));
  }

  // Get email sync status for a thread (Phase 2)
  async getEmailSyncStatus(threadId: number, userId: number): Promise<any[]> {
    // Verify user owns the thread
    const thread = await db
      .select()
      .from(messageThreads)
      .where(and(
        eq(messageThreads.id, threadId),
        eq(messageThreads.userId, userId)
      ))
      .limit(1);

    if (thread.length === 0) {
      throw new Error("Thread not found or access denied");
    }

    // Get sync status for this thread
    return await db
      .select()
      .from(emailSyncLog)
      .where(eq(emailSyncLog.threadId, threadId))
      .orderBy(desc(emailSyncLog.syncAt));
  }
}

export const messageService = new MessageService();