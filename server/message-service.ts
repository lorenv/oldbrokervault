import { db } from "./db";
import { messageThreads, messages, emailSyncLog, cimDocuments, users, messageAttachments } from "../shared/schema";
import type { 
  MessageThread, 
  InsertMessageThread, 
  Message, 
  InsertMessage, 
  EmailSyncLog, 
  InsertEmailSyncLog,
  MessageAttachment,
  InsertMessageAttachment
} from "../shared/schema";
import { eq, desc, and, sql, or, inArray } from "drizzle-orm";
import { sendEmail } from "./email";
import { randomUUID } from "crypto";
import { shareCache, CACHE_TTL, MemoryCache } from "./cache";

export class MessageService {
  // Generate unique email address for thread with random alphanumeric ID
  private generateThreadEmail(): string {
    // Generate a random 5-character alphanumeric string
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomId = '';
    for (let i = 0; i < 5; i++) {
      randomId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `thread-${randomId}@reply.brokervault.ai`;
  }

  // Check if a thread email already exists
  private async isThreadEmailUnique(email: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(messageThreads)
      .where(eq(messageThreads.threadEmailAddress, email))
      .limit(1);
    return !existing;
  }

  // Generate a unique thread email (with retry logic)
  private async generateUniqueThreadEmail(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const email = this.generateThreadEmail();
      if (await this.isThreadEmailUnique(email)) {
        return email;
      }
      attempts++;
    }

    // Fallback to timestamp-based ID if random generation fails
    const timestamp = Date.now().toString(36);
    return `thread-${timestamp}@reply.brokervault.ai`;
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

    // Generate and update thread email address with unique random ID
    const threadEmailAddress = await this.generateUniqueThreadEmail();
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
    shareSlug?: string | null;
  })[]> {
    const cacheKey = MemoryCache.keys.messageThreads(userId, archived, cimDocumentId);
    const cached = shareCache.get<(MessageThread & { unreadCount: number; lastMessage?: Message; cimTitle?: string | null; shareSlug?: string | null; })[]>(cacheKey);
    
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
        // CIM title and share slug (use customSlug if set, otherwise shareSlug)
        cimTitle: cimDocuments.title,
        shareSlug: sql<string>`COALESCE(${cimDocuments.customSlug}, ${cimDocuments.shareSlug})`,
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
      shareSlug: thread.shareSlug,
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

    // Get messages with their attachments
    const messagesResult = await db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt);

    // Get attachments for all messages in this thread
    const messageIds = messagesResult.map(m => m.id);
    let attachmentsMap: { [messageId: number]: MessageAttachment[] } = {};
    
    if (messageIds.length > 0) {
      const attachments = await db
        .select()
        .from(messageAttachments)
        .where(inArray(messageAttachments.messageId, messageIds));
      
      // Group attachments by message ID
      attachments.forEach(att => {
        if (!attachmentsMap[att.messageId]) {
          attachmentsMap[att.messageId] = [];
        }
        attachmentsMap[att.messageId].push(att);
      });
    }

    // Combine messages with their attachments
    const result = messagesResult.map(message => ({
      ...message,
      attachments: attachmentsMap[message.id] || []
    }));

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
    attachmentPaths?: string[],
    ccEmails?: string
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

    // Create attachment records if any
    let attachmentRecords: MessageAttachment[] = [];
    if (attachmentPaths && attachmentPaths.length > 0) {
      for (const filePath of attachmentPaths) {
        // Extract filename from path - handle object storage URLs
        let fileName = filePath.split('/').pop() || 'attachment';
        if (fileName.includes('-')) {
          // Remove timestamp prefix from uploaded filenames
          const parts = fileName.split('-');
          if (parts.length >= 3) {
            fileName = parts.slice(2).join('-');
          }
        }
        
        const [attachment] = await db
          .insert(messageAttachments)
          .values({
            messageId: message.id,
            fileName,
            filePath,
            fileSize: 0, // We don't have size info here, could be enhanced
            mimeType: 'application/octet-stream' // Default, could be enhanced
          })
          .returning();
        
        attachmentRecords.push(attachment);
      }
    }

    // Send email to inquirer with attachments and CC
    await this.sendReplyEmail(thread, content, user.email, attachmentRecords, ccEmails);

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
              • View in your <a href="${process.env.BASE_URL || ''}/dashboard" style="color: #2563eb;">Message Center</a>
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        to: threadDetails.ownerEmail,
        from: "system@brokervault.ai", // Use verified sender address
        replyTo: threadDetails.threadEmailAddress || "system@brokervault.ai",
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
  private async sendReplyEmail(thread: any, content: string, ownerEmail: string, attachments?: MessageAttachment[], ccEmails?: string): Promise<void> {
    try {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Reply from Broker Vault</h2>

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

      // Convert MessageAttachment[] to SendGrid format - properly fetch file content
      const sendgridAttachments: Array<{
        content: string;
        filename: string;
        type: string;
        disposition: string;
      }> = [];

      if (attachments && attachments.length > 0) {
        const { ObjectStorageService } = await import('./object-storage.js');
        const objectStorage = new ObjectStorageService();

        for (const att of attachments) {
          try {
            // Extract storage key from filePath (remove /api/object-storage/ prefix)
            const storageKey = att.filePath.replace(/^\/api\/object-storage\//, '');

            // Download file content from object storage
            const fileBuffer = await objectStorage.downloadBuffer(storageKey);

            // Convert to base64 for SendGrid
            const base64Content = fileBuffer.toString('base64');

            sendgridAttachments.push({
              content: base64Content,
              filename: att.fileName,
              type: att.mimeType,
              disposition: 'attachment'
            });

            console.log(`✅ Successfully fetched attachment: ${att.fileName} (${fileBuffer.length} bytes)`);
          } catch (error) {
            console.error(`❌ Failed to fetch attachment ${att.fileName}:`, error);
            // Continue with other attachments instead of failing the entire email
          }
        }
      }

      // Parse CC emails (comma-separated)
      const ccList = ccEmails
        ? ccEmails.split(',').map(e => e.trim()).filter(e => e && e.includes('@'))
        : undefined;

      if (ccList && ccList.length > 0) {
        console.log(`📧 Sending email with CC to: ${ccList.join(', ')}`);
      }

      await sendEmail({
        to: thread.inquirerEmail,
        from: "system@brokervault.ai", // Use verified sender address
        replyTo: thread.threadEmailAddress || "system@brokervault.ai",
        subject: `Re: ${thread.subject}`,
        html: emailContent,
        attachments: sendgridAttachments,
        cc: ccList
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
    console.log("📧 Processing inbound email webhook:");
    console.log("Webhook keys:", Object.keys(webhookData));
    
    try {
      // Parse SendGrid inbound email format
      // SendGrid may include envelope data separately
      const envelope = webhookData.envelope ? JSON.parse(webhookData.envelope) : null;
      
      // Extract email addresses, handling various formats
      // SendGrid might send: "Name <email@domain.com>" or just "email@domain.com"
      const extractEmail = (emailStr: string): string => {
        if (!emailStr) return '';
        const match = emailStr.match(/<([^>]+)>/);
        return match ? match[1] : emailStr.trim();
      };
      
      // Try multiple possible field names for recipient
      const toEmail = extractEmail(
        webhookData.to || 
        envelope?.to?.[0] || 
        webhookData.recipient ||
        webhookData.To ||
        ''
      );
      
      // Try multiple possible field names for sender
      const fromEmail = extractEmail(
        webhookData.from || 
        envelope?.from || 
        webhookData.sender ||
        webhookData.From ||
        ''
      );
      
      const subject = webhookData.subject || webhookData.Subject || '';
      const content = webhookData.text || webhookData.html || webhookData.Text || webhookData.Html || '';
      const messageId = webhookData['message-id'] || webhookData['Message-ID'] || undefined;
      
      console.log(`Inbound email: ${fromEmail} -> ${toEmail}`);
      
      // Check if required fields are present
      if (!toEmail) {
        console.error("No 'to' email found in webhook data:", Object.keys(webhookData));
        return;
      }
      
      if (!fromEmail) {
        console.error("No 'from' email found in webhook data:", Object.keys(webhookData));
        return;
      }
      
      // Extract thread email (format: thread-xxxxx@brokervault.ai or thread-xxxxx@reply.brokervault.ai)
      // Now supports alphanumeric thread IDs
      let threadMatch = toEmail.match(/thread-([a-z0-9]+)@(?:reply\.)?brokervault\.ai/i);
      let threadEmail = threadMatch ? threadMatch[0] : null;

      // If not found in main 'to' field, check envelope data
      if (!threadEmail && envelope?.to) {
        for (const recipient of envelope.to) {
          const cleanRecipient = extractEmail(recipient);
          threadMatch = cleanRecipient.match(/thread-([a-z0-9]+)@(?:reply\.)?brokervault\.ai/i);
          if (threadMatch) {
            console.log("Found thread email in envelope.to:", threadMatch[0]);
            threadEmail = threadMatch[0];
            break;
          }
        }
      }

      // Also check the 'to' field if it contains multiple recipients
      if (!threadEmail && webhookData.to && webhookData.to.includes(',')) {
        const recipients = webhookData.to.split(',');
        for (const recipient of recipients) {
          const cleanRecipient = extractEmail(recipient.trim());
          threadMatch = cleanRecipient.match(/thread-([a-z0-9]+)@(?:reply\.)?brokervault\.ai/i);
          if (threadMatch) {
            console.log("Found thread email in comma-separated recipients:", threadMatch[0]);
            threadEmail = threadMatch[0];
            break;
          }
        }
      }
      
      if (!threadEmail) {
        console.log("No thread email found in any recipient field");
        console.log("Checked to:", toEmail);
        console.log("Envelope.to:", envelope?.to);
        return;
      }

      console.log("Found thread email:", threadEmail);

      // Verify thread exists by email address
      const [thread] = await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.threadEmailAddress, threadEmail));
        
      if (!thread) {
        console.error("Thread not found for email:", threadEmail);
        return;
      }
      
      // Clean content (remove quoted text and signatures)
      const cleanContent = this.cleanEmailContent(content);
      
      // Determine sender type
      // Clean both emails for comparison (lowercase and trim)
      const cleanFromEmail = fromEmail.toLowerCase().trim();
      const cleanInquirerEmail = thread.inquirerEmail?.toLowerCase().trim();
      
      console.log("Determining sender type:");
      console.log("  From email:", cleanFromEmail);
      console.log("  Thread inquirer email:", cleanInquirerEmail);
      
      // Check if sender is the owner (fetch owner email from database)
      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.id, thread.userId));
      
      const cleanOwnerEmail = owner?.email?.toLowerCase().trim();
      console.log("  Thread owner email:", cleanOwnerEmail);
      
      let senderType: 'owner' | 'inquirer';
      if (cleanFromEmail === cleanOwnerEmail) {
        senderType = 'owner';
        console.log("  -> Sender is OWNER");
      } else if (cleanFromEmail === cleanInquirerEmail) {
        senderType = 'inquirer';
        console.log("  -> Sender is INQUIRER");
      } else {
        // Default to inquirer if we can't determine
        senderType = 'inquirer';
        console.log("  -> Sender unknown, defaulting to INQUIRER");
      }
      
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
    let cleaned = content;

    // STEP 1: Remove quoted thread content first (everything after "On ... wrote:")
    // This pattern matches "On <date/time>, <email>, wrote:" and everything after
    const onWroteMatch = cleaned.match(/On\s+.{10,80}\s+wrote:\s*/i);
    if (onWroteMatch && onWroteMatch.index !== undefined) {
      cleaned = cleaned.substring(0, onWroteMatch.index);
    }

    // STEP 2: Remove lines starting with > (quoted text)
    cleaned = cleaned
      .split('\n')
      .filter(line => !line.trim().startsWith('>'))
      .join('\n');

    // STEP 3: Find and remove email signatures
    // Signatures can be on their own line OR inline after content
    const signaturePatterns = [
      // Inline em dash signature (like "Take 6 — Robert Kalé | Partner")
      // Capture everything before the em dash
      { pattern: /\s+—\s+[A-Z][a-zA-Z]+\s+[A-Z]/m, keepBefore: true },
      // Em dash at start of line
      { pattern: /^—\s*.*/m, keepBefore: true },
      // Double dash on its own line
      { pattern: /^--\s*$/m, keepBefore: true },
      // Three or more underscores
      { pattern: /^_{3,}\s*$/m, keepBefore: true },
      // Mobile signatures
      { pattern: /Sent from my (iPhone|iPad|Android|Galaxy|Phone)/im, keepBefore: true },
      { pattern: /Get Outlook for (iOS|Android)/im, keepBefore: true },
      // Common signature indicators with phone/email
      { pattern: /📱\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/m, keepBefore: true },
      { pattern: /🔗\s*(www\.|http)/im, keepBefore: true },
    ];

    // Find the earliest signature and truncate there
    let earliestSignatureIndex = cleaned.length;
    for (const { pattern } of signaturePatterns) {
      const match = cleaned.match(pattern);
      if (match && match.index !== undefined && match.index < earliestSignatureIndex) {
        earliestSignatureIndex = match.index;
      }
    }

    // If we found a signature, truncate the content there
    if (earliestSignatureIndex < cleaned.length) {
      cleaned = cleaned.substring(0, earliestSignatureIndex);
    }

    // STEP 4: Clean up whitespace
    cleaned = cleaned
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    // If content is very short after cleaning, return original
    if (cleaned.length < 5 && content.length > cleaned.length) {
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
        from: "system@brokervault.ai", // Use verified sender address
        replyTo: threadDetails.threadEmailAddress || "system@brokervault.ai",
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