/**
 * Dashboard routes including AI briefing generation
 */

import { Router } from "express";
import { db } from "../db";
import {
  deals,
  pipelineStages,
  crmTasks,
  crmActivities,
  dashboardBriefings,
  esignEnvelopes,
  esignRecipients,
  cimDocuments,
  ndaSignatures,
  messageThreads,
  messages
} from "@shared/schema";
import { eq, and, desc, sql, inArray, isNull, gte, lte } from "drizzle-orm";
import OpenAI from "openai";

const router = Router();

// Initialize OpenAI (may be null if no API key)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Helper to get user's organization
async function getUserOrganization(userId: number) {
  const { organizationMembers, organizations } = await import('@shared/schema');

  const membership = await db
    .select({
      organization: organizations,
      role: organizationMembers.role
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  if (membership.length === 0) return null;
  return membership[0];
}

// Helper to get today's date string
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// Interface for briefing data
interface BriefingData {
  summary: string;
  priorityDeals: Array<{
    id: number;
    name: string;
    value: number | null;
    stage: string;
    daysSinceActivity: number;
    reason: string;
    suggestedAction: string;
  }>;
  riskAlerts: Array<{
    dealId: number;
    dealName: string;
    message: string;
  }>;
  tasksOverview: {
    dueToday: number;
    overdue: number;
    upcoming: number;
    message: string;
  };
  pendingSignatures: {
    count: number;
    items: Array<{ id: number; title: string; recipientName: string }>;
    message: string;
  };
  pendingApprovals: {
    count: number;
    items: Array<{ documentId: number; documentTitle: string; signerEmail: string }>;
    message: string;
  };
  unreadMessages: {
    count: number;
    items: Array<{ threadId: number; subject: string; inquirerName: string; preview: string }>;
    message: string;
  };
  quickStats: {
    pipelineValue: number;
    openDeals: number;
    dealsWonThisMonth: number;
    wonValueThisMonth: number;
  };
  recentActivity: Array<{
    id: number;
    type: string;
    description: string;
    timestamp: string;
    dealName?: string;
  }>;
}

// Gather all data needed for the briefing
async function gatherBriefingData(userId: number, orgId: number): Promise<any> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  // Get all open deals with stages
  const openDeals = await db
    .select({
      id: deals.id,
      name: deals.name,
      amount: deals.amount,
      stageId: deals.stageId,
      stageName: pipelineStages.name,
      closeDate: deals.closeDate,
      updatedAt: deals.updatedAt,
      createdAt: deals.createdAt
    })
    .from(deals)
    .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(
      and(
        eq(deals.organizationId, orgId),
        isNull(deals.closedAt)
      )
    )
    .orderBy(desc(deals.updatedAt));

  // Get last activity for each deal
  const dealIds = openDeals.map(d => d.id);
  let dealActivities: any[] = [];
  if (dealIds.length > 0) {
    dealActivities = await db
      .select({
        dealId: crmActivities.objectId,
        lastActivity: sql<Date>`MAX(${crmActivities.timestamp})`
      })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.organizationId, orgId),
          eq(crmActivities.objectType, 'deal'),
          inArray(crmActivities.objectId, dealIds)
        )
      )
      .groupBy(crmActivities.objectId);
  }

  // Create activity map
  const activityMap = new Map(dealActivities.map(a => [a.dealId, a.lastActivity]));

  // Calculate days since last activity for each deal
  const dealsWithActivity = openDeals.map(deal => {
    const lastActivity = activityMap.get(deal.id) || deal.createdAt;
    const daysSinceActivity = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
    return {
      ...deal,
      daysSinceActivity,
      lastActivity
    };
  });

  // Get my tasks
  const myTasks = await db
    .select()
    .from(crmTasks)
    .where(
      and(
        eq(crmTasks.organizationId, orgId),
        eq(crmTasks.assignedTo, userId),
        inArray(crmTasks.status, ['pending', 'in_progress'])
      )
    )
    .orderBy(crmTasks.dueDate);

  // Categorize tasks
  const overdueTasks = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
  const dueTodayTasks = myTasks.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= todayStart && due < todayEnd;
  });
  const upcomingTasks = myTasks.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= todayEnd && due <= weekFromNow;
  });

  // Get pending e-signature requests (envelopes I sent that are awaiting signatures)
  const pendingSignatures = await db
    .select({
      envelopeId: esignEnvelopes.id,
      title: esignEnvelopes.title,
      recipientId: esignRecipients.id,
      recipientName: esignRecipients.name,
      recipientEmail: esignRecipients.email,
      recipientStatus: esignRecipients.status
    })
    .from(esignEnvelopes)
    .innerJoin(esignRecipients, eq(esignRecipients.envelopeId, esignEnvelopes.id))
    .where(
      and(
        eq(esignEnvelopes.userId, userId),
        eq(esignEnvelopes.status, 'sent'),
        inArray(esignRecipients.status, ['pending', 'sent', 'viewed'])
      )
    )
    .limit(10);

  // Get pending NDA approvals (signatures awaiting my approval)
  const pendingApprovals = await db
    .select({
      signatureId: ndaSignatures.id,
      documentId: ndaSignatures.documentId,
      documentTitle: cimDocuments.title,
      signerEmail: ndaSignatures.signerEmail,
      signedAt: ndaSignatures.signedAt
    })
    .from(ndaSignatures)
    .innerJoin(cimDocuments, eq(cimDocuments.id, ndaSignatures.documentId))
    .where(
      and(
        eq(cimDocuments.userId, userId),
        eq(cimDocuments.ndaApprovalRequired, true),
        eq(ndaSignatures.approved, false),
        eq(ndaSignatures.rejected, false),
        isNull(cimDocuments.deletedAt)
      )
    )
    .limit(10);

  // Get unread messages (messages from inquirers that haven't been read)
  const unreadMessages = await db
    .select({
      messageId: messages.id,
      threadId: messages.threadId,
      content: messages.content,
      senderEmail: messages.senderEmail,
      createdAt: messages.createdAt,
      subject: messageThreads.subject,
      inquirerName: messageThreads.inquirerName
    })
    .from(messages)
    .innerJoin(messageThreads, eq(messageThreads.id, messages.threadId))
    .where(
      and(
        eq(messageThreads.userId, userId),
        eq(messages.senderType, 'inquirer'),
        eq(messages.isRead, false)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(10);

  // Get deals won this month
  const dealsWonThisMonth = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      totalValue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)::float`
    })
    .from(deals)
    .where(
      and(
        eq(deals.organizationId, orgId),
        eq(deals.status, 'won'),
        gte(deals.closedAt, monthStart)
      )
    );

  // Calculate pipeline value
  const pipelineStats = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)::float`,
      count: sql<number>`COUNT(*)::int`
    })
    .from(deals)
    .where(
      and(
        eq(deals.organizationId, orgId),
        isNull(deals.closedAt)
      )
    );

  // Get recent activity (last 5)
  const recentActivity = await db
    .select({
      id: crmActivities.id,
      type: crmActivities.activityType,
      title: crmActivities.title,
      timestamp: crmActivities.timestamp,
      objectId: crmActivities.objectId,
      objectType: crmActivities.objectType
    })
    .from(crmActivities)
    .where(eq(crmActivities.organizationId, orgId))
    .orderBy(desc(crmActivities.timestamp))
    .limit(10);

  return {
    deals: dealsWithActivity,
    tasks: {
      overdue: overdueTasks,
      dueToday: dueTodayTasks,
      upcoming: upcomingTasks,
      all: myTasks
    },
    pendingSignatures,
    pendingApprovals,
    unreadMessages,
    stats: {
      pipelineValue: pipelineStats[0]?.totalValue || 0,
      openDeals: pipelineStats[0]?.count || 0,
      dealsWonThisMonth: dealsWonThisMonth[0]?.count || 0,
      wonValueThisMonth: dealsWonThisMonth[0]?.totalValue || 0
    },
    recentActivity
  };
}

// Generate a basic briefing without AI
function generateBasicBriefing(data: any): BriefingData {
  const overdueCount = data.tasks.overdue.length;
  const dueTodayCount = data.tasks.dueToday.length;
  const dealCount = data.deals.length;

  const unreadCount = data.unreadMessages?.length || 0;

  // Build summary
  let summaryParts = [];
  if (overdueCount > 0) summaryParts.push(`${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}`);
  if (dueTodayCount > 0) summaryParts.push(`${dueTodayCount} task${dueTodayCount > 1 ? 's' : ''} due today`);
  if (unreadCount > 0) summaryParts.push(`${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`);
  if (data.pendingApprovals.length > 0) summaryParts.push(`${data.pendingApprovals.length} NDA approval${data.pendingApprovals.length > 1 ? 's' : ''} pending`);

  const summary = summaryParts.length > 0
    ? `You have ${summaryParts.join(', ')}. ${dealCount > 0 ? `Managing ${dealCount} open deal${dealCount > 1 ? 's' : ''} worth ${formatCurrency(data.stats.pipelineValue)}.` : ''}`
    : dealCount > 0
      ? `You have ${dealCount} open deal${dealCount > 1 ? 's' : ''} worth ${formatCurrency(data.stats.pipelineValue)}. All caught up on tasks!`
      : 'Welcome! Get started by creating your first deal.';

  // Find deals needing attention (no activity in 7+ days)
  const priorityDeals = data.deals
    .filter((d: any) => d.daysSinceActivity >= 3)
    .sort((a: any, b: any) => b.daysSinceActivity - a.daysSinceActivity)
    .slice(0, 5)
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      value: d.amount ? parseFloat(d.amount) : null,
      stage: d.stageName || 'Unknown',
      daysSinceActivity: d.daysSinceActivity,
      reason: `No activity in ${d.daysSinceActivity} days`,
      suggestedAction: 'Follow up with contact'
    }));

  // Risk alerts for deals going cold
  const riskAlerts = data.deals
    .filter((d: any) => d.daysSinceActivity >= 7)
    .slice(0, 3)
    .map((d: any) => ({
      dealId: d.id,
      dealName: d.name,
      message: `${d.daysSinceActivity} days without activity`
    }));

  return {
    summary,
    priorityDeals,
    riskAlerts,
    tasksOverview: {
      dueToday: dueTodayCount,
      overdue: overdueCount,
      upcoming: data.tasks.upcoming.length,
      message: overdueCount > 0
        ? `${overdueCount} overdue, ${dueTodayCount} due today`
        : dueTodayCount > 0
          ? `${dueTodayCount} task${dueTodayCount > 1 ? 's' : ''} due today`
          : 'All caught up!'
    },
    pendingSignatures: {
      count: data.pendingSignatures.length,
      items: data.pendingSignatures.slice(0, 5).map((s: any) => ({
        id: s.envelopeId,
        title: s.title,
        recipientName: s.recipientName
      })),
      message: data.pendingSignatures.length > 0
        ? `${data.pendingSignatures.length} awaiting signatures`
        : 'No pending signatures'
    },
    pendingApprovals: {
      count: data.pendingApprovals.length,
      items: data.pendingApprovals.slice(0, 5).map((a: any) => ({
        documentId: a.documentId,
        documentTitle: a.documentTitle,
        signerEmail: a.signerEmail
      })),
      message: data.pendingApprovals.length > 0
        ? `${data.pendingApprovals.length} NDA approvals pending`
        : 'No pending approvals'
    },
    unreadMessages: {
      count: unreadCount,
      items: (data.unreadMessages || []).slice(0, 5).map((m: any) => ({
        threadId: m.threadId,
        subject: m.subject,
        inquirerName: m.inquirerName,
        preview: m.content?.substring(0, 100) || ''
      })),
      message: unreadCount > 0
        ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`
        : 'No unread messages'
    },
    quickStats: data.stats,
    recentActivity: data.recentActivity.slice(0, 5).map((a: any) => ({
      id: a.id,
      type: a.type,
      description: a.title,
      timestamp: a.timestamp
    }))
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Generate AI briefing using OpenAI
async function generateAIBriefing(data: any): Promise<BriefingData> {
  // If OpenAI is not available, return basic briefing
  if (!openai) {
    console.log('[Dashboard] OpenAI not configured, using basic briefing');
    return generateBasicBriefing(data);
  }

  // Prepare a summary of the data for the AI
  const prompt = `You are a helpful CRM assistant generating a daily briefing for a sales/deal professional.
Analyze the following data and provide actionable insights.

DATA:
- Open Deals (${data.deals.length}):
${data.deals.slice(0, 10).map((d: any) => `  * "${d.name}" - $${d.amount || 0} - Stage: ${d.stageName || 'Unknown'} - ${d.daysSinceActivity} days since last activity`).join('\n')}

- Tasks:
  * Overdue: ${data.tasks.overdue.length}
  * Due Today: ${data.tasks.dueToday.length}
  * Upcoming (next 7 days): ${data.tasks.upcoming.length}

- Pending E-Signatures awaiting others: ${data.pendingSignatures.length}
- Pending NDA Approvals needing my action: ${data.pendingApprovals.length}
- Unread Messages: ${data.unreadMessages?.length || 0}

- Pipeline Stats:
  * Total Pipeline Value: $${data.stats.pipelineValue.toLocaleString()}
  * Open Deals: ${data.stats.openDeals}
  * Deals Won This Month: ${data.stats.dealsWonThisMonth} ($${data.stats.wonValueThisMonth.toLocaleString()})

Please provide a JSON response with:
1. "summary": A 2-3 sentence personalized summary of what needs attention today
2. "priorityDeals": Top 3-5 deals that need attention, with "reason" and "suggestedAction" for each
3. "riskAlerts": Any deals that are going cold (consider stage - early stage deals can go 7+ days, late stage deals going 3+ days without activity is concerning)
4. "tasksMessage": A brief message about the task situation
5. "signaturesMessage": A brief message about pending signatures (if any)
6. "approvalsMessage": A brief message about pending approvals (if any)
7. "messagesMessage": A brief message about unread messages (if any)

Be concise, actionable, and prioritize by business impact. Focus on what matters most today.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful CRM assistant. Respond only with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.7
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || '{}');

    // Build the final briefing data combining AI insights with raw data
    const briefing: BriefingData = {
      summary: aiResponse.summary || "Welcome back! Here's your daily overview.",
      priorityDeals: (aiResponse.priorityDeals || []).map((p: any) => {
        const deal = data.deals.find((d: any) => d.name === p.name || d.id === p.id);
        return {
          id: deal?.id || 0,
          name: p.name || deal?.name || 'Unknown',
          value: deal?.amount ? parseFloat(deal.amount) : null,
          stage: deal?.stageName || 'Unknown',
          daysSinceActivity: deal?.daysSinceActivity || 0,
          reason: p.reason || '',
          suggestedAction: p.suggestedAction || ''
        };
      }),
      riskAlerts: (aiResponse.riskAlerts || []).map((r: any) => {
        const deal = data.deals.find((d: any) => d.name === r.name || d.name === r.dealName);
        return {
          dealId: deal?.id || 0,
          dealName: r.dealName || r.name || 'Unknown',
          message: r.message || r.reason || ''
        };
      }),
      tasksOverview: {
        dueToday: data.tasks.dueToday.length,
        overdue: data.tasks.overdue.length,
        upcoming: data.tasks.upcoming.length,
        message: aiResponse.tasksMessage || `You have ${data.tasks.dueToday.length} tasks due today and ${data.tasks.overdue.length} overdue.`
      },
      pendingSignatures: {
        count: data.pendingSignatures.length,
        items: data.pendingSignatures.slice(0, 5).map((s: any) => ({
          id: s.envelopeId,
          title: s.title,
          recipientName: s.recipientName
        })),
        message: aiResponse.signaturesMessage || (data.pendingSignatures.length > 0
          ? `${data.pendingSignatures.length} documents awaiting signatures.`
          : 'No pending signatures.')
      },
      pendingApprovals: {
        count: data.pendingApprovals.length,
        items: data.pendingApprovals.slice(0, 5).map((a: any) => ({
          documentId: a.documentId,
          documentTitle: a.documentTitle,
          signerEmail: a.signerEmail
        })),
        message: aiResponse.approvalsMessage || (data.pendingApprovals.length > 0
          ? `${data.pendingApprovals.length} NDA approvals need your attention.`
          : 'No pending approvals.')
      },
      unreadMessages: {
        count: data.unreadMessages?.length || 0,
        items: (data.unreadMessages || []).slice(0, 5).map((m: any) => ({
          threadId: m.threadId,
          subject: m.subject,
          inquirerName: m.inquirerName,
          preview: m.content?.substring(0, 100) || ''
        })),
        message: aiResponse.messagesMessage || (data.unreadMessages?.length > 0
          ? `${data.unreadMessages.length} unread message${data.unreadMessages.length > 1 ? 's' : ''}.`
          : 'No unread messages.')
      },
      quickStats: {
        pipelineValue: data.stats.pipelineValue,
        openDeals: data.stats.openDeals,
        dealsWonThisMonth: data.stats.dealsWonThisMonth,
        wonValueThisMonth: data.stats.wonValueThisMonth
      },
      recentActivity: data.recentActivity.slice(0, 5).map((a: any) => ({
        id: a.id,
        type: a.type,
        description: a.title,
        timestamp: a.timestamp,
        dealName: undefined // Could enhance with deal name lookup
      }))
    };

    return briefing;
  } catch (error: any) {
    console.error('[Dashboard] AI briefing generation failed:', error.message);
    // Fallback to basic briefing without AI
    return generateBasicBriefing(data);
  }
}

// GET /api/dashboard/ai-briefing - Get or generate AI briefing
router.get('/ai-briefing', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userId = req.user!.id;
    const orgData = await getUserOrganization(userId);

    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const orgId = orgData.organization.id;
    const today = getTodayDateString();
    const forceRefresh = req.query.refresh === 'true';

    // Check for cached briefing (unless force refresh)
    if (!forceRefresh) {
      const cached = await db
        .select()
        .from(dashboardBriefings)
        .where(
          and(
            eq(dashboardBriefings.organizationId, orgId),
            eq(dashboardBriefings.userId, userId),
            eq(dashboardBriefings.validForDate, today)
          )
        )
        .limit(1);

      if (cached.length > 0) {
        return res.json({
          briefing: cached[0].briefing,
          generatedAt: cached[0].generatedAt,
          cached: true
        });
      }
    }

    // Gather data and generate new briefing
    const sourceData = await gatherBriefingData(userId, orgId);
    const briefing = await generateAIBriefing(sourceData);

    // Delete old briefings for this user
    await db
      .delete(dashboardBriefings)
      .where(
        and(
          eq(dashboardBriefings.organizationId, orgId),
          eq(dashboardBriefings.userId, userId)
        )
      );

    // Cache the new briefing
    const generatedAt = new Date();
    await db.insert(dashboardBriefings).values({
      organizationId: orgId,
      userId: userId,
      briefing: briefing,
      sourceData: sourceData,
      generatedAt: generatedAt,
      validForDate: today
    });

    res.json({
      briefing,
      generatedAt,
      cached: false
    });
  } catch (error: any) {
    console.error('[Dashboard] Error generating briefing:', error);
    res.status(500).json({ error: 'Failed to generate briefing' });
  }
});

// GET /api/dashboard/stats - Get quick stats without AI
router.get('/stats', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userId = req.user!.id;
    const orgData = await getUserOrganization(userId);

    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const orgId = orgData.organization.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Pipeline stats
    const pipelineStats = await db
      .select({
        totalValue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)::float`,
        count: sql<number>`COUNT(*)::int`
      })
      .from(deals)
      .where(
        and(
          eq(deals.organizationId, orgId),
          isNull(deals.closedAt)
        )
      );

    // Won this month
    const wonThisMonth = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
        totalValue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)::float`
      })
      .from(deals)
      .where(
        and(
          eq(deals.organizationId, orgId),
          eq(deals.status, 'won'),
          gte(deals.closedAt, monthStart)
        )
      );

    // My overdue tasks
    const overdueTasks = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(crmTasks)
      .where(
        and(
          eq(crmTasks.organizationId, orgId),
          eq(crmTasks.assignedTo, userId),
          inArray(crmTasks.status, ['pending', 'in_progress']),
          sql`${crmTasks.dueDate} < NOW()`
        )
      );

    // Pending signatures
    const pendingSigs = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${esignEnvelopes.id})::int` })
      .from(esignEnvelopes)
      .innerJoin(esignRecipients, eq(esignRecipients.envelopeId, esignEnvelopes.id))
      .where(
        and(
          eq(esignEnvelopes.userId, userId),
          eq(esignEnvelopes.status, 'sent'),
          inArray(esignRecipients.status, ['pending', 'sent', 'viewed'])
        )
      );

    res.json({
      pipelineValue: pipelineStats[0]?.totalValue || 0,
      openDeals: pipelineStats[0]?.count || 0,
      dealsWonThisMonth: wonThisMonth[0]?.count || 0,
      wonValueThisMonth: wonThisMonth[0]?.totalValue || 0,
      overdueTasks: overdueTasks[0]?.count || 0,
      pendingSignatures: pendingSigs[0]?.count || 0
    });
  } catch (error: any) {
    console.error('[Dashboard] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
