/**
 * Email Sync Service
 *
 * Unified interface for fetching and sending emails via Gmail or Microsoft.
 * Used by CRM to display emails on contact/deal pages and in the inbox.
 */

import { db } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import { integrationConnections } from '@shared/schema';
import { gmailProvider } from '../integrations/providers/gmail';
import { microsoftProvider } from '../integrations/providers/microsoft';
import { decrypt } from '../integrations/encryption';

// Gmail API base
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';
// Microsoft Graph API base
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

export interface EmailMessage {
  id: string;
  threadId?: string;
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  cc?: string;
  subject: string;
  snippet: string;
  body?: string;
  bodyHtml?: string;
  date: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  attachments?: EmailAttachment[];
  provider: 'gmail' | 'microsoft';
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  replyToMessageId?: string;
  threadId?: string;
}

/**
 * Map database connection fields to provider expected field names
 * Database uses: accessTokenEncrypted, refreshTokenEncrypted
 * Providers expect: accessToken, refreshToken
 */
function mapConnectionForProvider(connection: any) {
  return {
    ...connection,
    accessToken: connection.accessTokenEncrypted,
    refreshToken: connection.refreshTokenEncrypted,
  };
}

/**
 * Get the user's connected email provider and connection
 */
export async function getEmailConnection(userId: number) {
  // Check for Gmail connection first
  const [gmailConnection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.provider, 'gmail'),
        eq(integrationConnections.status, 'active')
      )
    )
    .limit(1);

  if (gmailConnection) {
    return { provider: 'gmail' as const, connection: gmailConnection };
  }

  // Check for Microsoft connection
  const [microsoftConnection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.provider, 'microsoft'),
        eq(integrationConnections.status, 'active')
      )
    )
    .limit(1);

  if (microsoftConnection) {
    return { provider: 'microsoft' as const, connection: microsoftConnection };
  }

  return null;
}

/**
 * Fetch emails for a specific contact by their email address
 */
export async function getEmailsForContact(
  userId: number,
  contactEmail: string,
  options: { maxResults?: number } = {}
): Promise<EmailMessage[]> {
  const emailConn = await getEmailConnection(userId);
  if (!emailConn) {
    throw new Error('No email account connected');
  }

  const { provider, connection } = emailConn;
  const { maxResults = 20 } = options;
  const mappedConnection = mapConnectionForProvider(connection);

  try {
    if (provider === 'gmail') {
      return await getGmailEmailsForContact(mappedConnection, contactEmail, maxResults);
    } else {
      return await getMicrosoftEmailsForContact(mappedConnection, contactEmail, maxResults);
    }
  } catch (error: any) {
    // Re-throw with more context
    if (error.message?.includes('token') || error.message?.includes('unauthorized') || error.message?.includes('401')) {
      throw new Error('Email connection expired. Please reconnect in Settings.');
    }
    throw new Error(`Failed to fetch emails: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Fetch emails from Gmail for a specific contact
 */
async function getGmailEmailsForContact(
  connection: any,
  contactEmail: string,
  maxResults: number
): Promise<EmailMessage[]> {
  const accessToken = await gmailProvider.getValidAccessToken(connection);
  if (!accessToken) {
    throw new Error('Failed to get valid access token');
  }

  // Search for emails to/from this contact (Gmail search is case-insensitive)
  const query = `from:${contactEmail} OR to:${contactEmail}`;

  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    q: query,
  });

  const listResponse = await fetch(
    `${GMAIL_API_BASE}/users/me/messages?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listResponse.ok) {
    throw new Error('Failed to fetch emails from Gmail');
  }

  const listData = await listResponse.json();
  const messages = listData.messages || [];

  // Fetch metadata for each message
  const emailDetails = await Promise.all(
    messages.slice(0, maxResults).map(async (msg: { id: string }) => {
      const msgResponse = await fetch(
        `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!msgResponse.ok) return null;
      return msgResponse.json();
    })
  );

  return emailDetails.filter(Boolean).map((email: any) => {
    const headers = email.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

    const fromHeader = getHeader('From') || '';
    const fromMatch = fromHeader.match(/^(?:(.+?)\s*<)?([^<>]+)>?$/);

    return {
      id: email.id,
      threadId: email.threadId,
      from: fromMatch?.[2]?.trim() || fromHeader,
      fromName: fromMatch?.[1]?.trim()?.replace(/"/g, ''),
      to: getHeader('To') || '',
      cc: getHeader('Cc'),
      subject: getHeader('Subject') || '(No Subject)',
      snippet: email.snippet || '',
      date: getHeader('Date') || new Date().toISOString(),
      isRead: !email.labelIds?.includes('UNREAD'),
      hasAttachments: email.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0),
      provider: 'gmail' as const,
    };
  });
}

/**
 * Fetch emails from Microsoft for a specific contact
 * Searches both Inbox and Sent Items folders
 */
async function getMicrosoftEmailsForContact(
  connection: any,
  contactEmail: string,
  maxResults: number
): Promise<EmailMessage[]> {
  const accessToken = await microsoftProvider.getValidAccessToken(connection);
  if (!accessToken) {
    throw new Error('Failed to get valid access token');
  }

  const normalizedEmail = contactEmail.toLowerCase();

  // Fetch from both Inbox and Sent Items in parallel for better results
  const selectFields = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments';

  const [inboxResponse, sentResponse] = await Promise.all([
    // Search Inbox folder
    fetch(
      `${GRAPH_API_BASE}/me/mailFolders/Inbox/messages?$top=${maxResults}&$select=${selectFields}&$orderby=receivedDateTime desc`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    ),
    // Search Sent Items folder
    fetch(
      `${GRAPH_API_BASE}/me/mailFolders/SentItems/messages?$top=${maxResults}&$select=${selectFields}&$orderby=receivedDateTime desc`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    ),
  ]);

  let allMessages: any[] = [];

  if (inboxResponse.ok) {
    const inboxData = await inboxResponse.json();
    allMessages = [...allMessages, ...(inboxData.value || [])];
  }

  if (sentResponse.ok) {
    const sentData = await sentResponse.json();
    allMessages = [...allMessages, ...(sentData.value || [])];
  }

  if (allMessages.length === 0 && !inboxResponse.ok && !sentResponse.ok) {
    throw new Error('Failed to fetch emails from Microsoft');
  }

  // Filter to only emails involving this contact
  const filteredMessages = allMessages.filter((email: any) => {
    const fromEmail = email.from?.emailAddress?.address?.toLowerCase() || '';
    const toEmails = email.toRecipients?.map((r: any) => r.emailAddress?.address?.toLowerCase()) || [];
    const ccEmails = email.ccRecipients?.map((r: any) => r.emailAddress?.address?.toLowerCase()) || [];

    return fromEmail === normalizedEmail ||
           toEmails.includes(normalizedEmail) ||
           ccEmails.includes(normalizedEmail);
  });

  // Sort by date descending and deduplicate by ID
  const seen = new Set<string>();
  const uniqueMessages = filteredMessages
    .sort((a: any, b: any) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime())
    .filter((email: any) => {
      if (seen.has(email.id)) return false;
      seen.add(email.id);
      return true;
    })
    .slice(0, maxResults);

  return mapMicrosoftEmails(uniqueMessages);
}

function mapMicrosoftEmails(messages: any[]): EmailMessage[] {
  return messages.map((email: any) => ({
    id: email.id,
    from: email.from?.emailAddress?.address || '',
    fromName: email.from?.emailAddress?.name,
    to: email.toRecipients?.map((r: any) => r.emailAddress?.address).join(', ') || '',
    cc: email.ccRecipients?.map((r: any) => r.emailAddress?.address).join(', '),
    subject: email.subject || '(No Subject)',
    snippet: email.bodyPreview || '',
    date: email.receivedDateTime || new Date().toISOString(),
    isRead: email.isRead,
    hasAttachments: email.hasAttachments,
    provider: 'microsoft' as const,
  }));
}

/**
 * Fetch full email content by ID
 */
export async function getEmailById(
  userId: number,
  emailId: string,
  provider: 'gmail' | 'microsoft'
): Promise<EmailMessage | null> {
  const emailConn = await getEmailConnection(userId);
  if (!emailConn || emailConn.provider !== provider) {
    return null;
  }

  const { connection } = emailConn;
  const mappedConnection = mapConnectionForProvider(connection);

  try {
    if (provider === 'gmail') {
      return await getGmailEmailById(mappedConnection, emailId);
    } else {
      return await getMicrosoftEmailById(mappedConnection, emailId);
    }
  } catch (error) {
    return null;
  }
}

/**
 * Fetch full Gmail message by ID
 */
async function getGmailEmailById(connection: any, emailId: string): Promise<EmailMessage | null> {
  const accessToken = await gmailProvider.getValidAccessToken(connection);
  if (!accessToken) {
    return null;
  }

  const response = await fetch(
    `${GMAIL_API_BASE}/users/me/messages/${emailId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    return null;
  }

  const email = await response.json();
  const headers = email.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

  // Extract body from payload
  let body = '';
  let bodyHtml = '';

  const extractBody = (part: any) => {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };

  if (email.payload) {
    extractBody(email.payload);
  }

  // Extract attachments
  const attachments: EmailAttachment[] = [];
  const extractAttachments = (part: any) => {
    if (part.filename && part.filename.length > 0) {
      attachments.push({
        id: part.body?.attachmentId || '',
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: parseInt(part.body?.size) || 0,
      });
    }
    if (part.parts) {
      part.parts.forEach(extractAttachments);
    }
  };

  if (email.payload) {
    extractAttachments(email.payload);
  }

  const fromHeader = getHeader('From') || '';
  const fromMatch = fromHeader.match(/^(?:(.+?)\s*<)?([^<>]+)>?$/);

  return {
    id: email.id,
    threadId: email.threadId,
    from: fromMatch?.[2]?.trim() || fromHeader,
    fromName: fromMatch?.[1]?.trim()?.replace(/"/g, ''),
    to: getHeader('To') || '',
    cc: getHeader('Cc'),
    subject: getHeader('Subject') || '(No Subject)',
    snippet: email.snippet || '',
    body,
    bodyHtml,
    date: getHeader('Date') || new Date().toISOString(),
    isRead: !email.labelIds?.includes('UNREAD'),
    hasAttachments: attachments.length > 0,
    attachments,
    provider: 'gmail',
  };
}

/**
 * Fetch full Microsoft message by ID
 */
async function getMicrosoftEmailById(connection: any, emailId: string): Promise<EmailMessage | null> {
  const accessToken = await microsoftProvider.getValidAccessToken(connection);
  if (!accessToken) {
    return null;
  }

  const response = await fetch(
    `${GRAPH_API_BASE}/me/messages/${emailId}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,isRead,hasAttachments,attachments`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    return null;
  }

  const email = await response.json();

  // Fetch attachments if present
  let attachments: EmailAttachment[] = [];
  if (email.hasAttachments) {
    const attachResponse = await fetch(
      `${GRAPH_API_BASE}/me/messages/${emailId}/attachments`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (attachResponse.ok) {
      const attachData = await attachResponse.json();
      attachments = (attachData.value || []).map((a: any) => ({
        id: a.id,
        filename: a.name,
        mimeType: a.contentType,
        size: a.size,
      }));
    }
  }

  return {
    id: email.id,
    from: email.from?.emailAddress?.address || '',
    fromName: email.from?.emailAddress?.name,
    to: email.toRecipients?.map((r: any) => r.emailAddress?.address).join(', ') || '',
    cc: email.ccRecipients?.map((r: any) => r.emailAddress?.address).join(', '),
    subject: email.subject || '(No Subject)',
    snippet: '',
    body: email.body?.contentType === 'text' ? email.body?.content : '',
    bodyHtml: email.body?.contentType === 'html' ? email.body?.content : '',
    date: email.receivedDateTime || new Date().toISOString(),
    isRead: email.isRead,
    hasAttachments: attachments.length > 0,
    attachments,
    provider: 'microsoft',
  };
}

/**
 * Send an email via the user's connected provider
 */
export async function sendEmail(
  userId: number,
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const emailConn = await getEmailConnection(userId);
  if (!emailConn) {
    return { success: false, error: 'No email account connected' };
  }

  const { provider, connection } = emailConn;
  const mappedConnection = mapConnectionForProvider(connection);

  try {
    if (provider === 'gmail') {
      return await gmailProvider.sendEmail(mappedConnection as any, options);
    } else {
      return await microsoftProvider.sendEmail(mappedConnection as any, options);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Send a reply to an existing email
 */
export async function sendReply(
  userId: number,
  originalEmail: EmailMessage,
  replyBody: string,
  isHtml: boolean = false
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const emailConn = await getEmailConnection(userId);
  if (!emailConn) {
    return { success: false, error: 'No email account connected' };
  }

  // Build the reply subject
  const subject = originalEmail.subject.startsWith('Re:')
    ? originalEmail.subject
    : `Re: ${originalEmail.subject}`;

  // Build quoted original message
  const quotedOriginal = `

---
On ${new Date(originalEmail.date).toLocaleString()}, ${originalEmail.fromName || originalEmail.from} wrote:

${originalEmail.body || originalEmail.snippet}
`;

  const fullBody = replyBody + quotedOriginal;

  return sendEmail(userId, {
    to: originalEmail.from,
    subject,
    body: fullBody,
    isHtml,
    replyToMessageId: originalEmail.id,
    threadId: originalEmail.threadId,
  });
}

/**
 * Get the user's connected email address
 */
export async function getConnectedEmailAddress(userId: number): Promise<string | null> {
  const emailConn = await getEmailConnection(userId);
  if (!emailConn) {
    return null;
  }

  return emailConn.connection.providerAccountId || null;
}
