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
  // Get open deals (with error handling)
  console.log('[Dashboard] Step 1: Fetching open deals...');
  let openDeals: any[] = [];
  try {
    openDeals = await db
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
    console.log('[Dashboard] Open deals count:', openDeals.length);
  } catch (error) {
    console.error('[Dashboard] Error fetching open deals:', error);
    openDeals = [];
  }

  // Get last activity for each deal (with error handling)
  console.log('[Dashboard] Step 2: Fetching deal activities...');
  let dealActivities: any[] = [];
  try {
    const dealIds = openDeals.map(d => d.id);
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
    console.log('[Dashboard] Deal activities count:', dealActivities.length);
  } catch (error) {
    console.error('[Dashboard] Error fetching deal activities:', error);
    dealActivities = [];
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

  // Get my tasks (with error handling)
  console.log('[Dashboard] Step 3: Fetching my tasks...');
  let myTasks: any[] = [];
  try {
    myTasks = await db
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
    console.log('[Dashboard] My tasks count:', myTasks.length);
  } catch (error) {
    console.error('[Dashboard] Error fetching my tasks:', error);
    myTasks = [];
  }

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

  // Get pending e-signature requests (with error handling)
  console.log('[Dashboard] Step 4: Fetching pending signatures...');
  let pendingSignatures: any[] = [];
  try {
    pendingSignatures = await db
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
    console.log('[Dashboard] Pending signatures count:', pendingSignatures.length);
  } catch (error) {
    console.error('[Dashboard] Error fetching pending signatures:', error);
    pendingSignatures = [];
  }

  // Get pending NDA approvals (with error handling)
  console.log('[Dashboard] Step 5: Fetching pending approvals...');
  let pendingApprovals: any[] = [];
  try {
    const pendingApprovalsResult = await db.execute(sql`
      SELECT
        ns.id as "signatureId",
        ns.cim_document_id as "documentId",
        cd.title as "documentTitle",
        ns.signer_email as "signerEmail",
        ns.signed_at as "signedAt"
      FROM nda_signatures ns
      INNER JOIN cim_documents cd ON cd.id = ns.cim_document_id
      WHERE cd.user_id = ${userId}
        AND cd.nda_approval_required = true
        AND ns.approved = false
        AND ns.rejected = false
        AND cd.deleted_at IS NULL
      LIMIT 10
    `);
    pendingApprovals = pendingApprovalsResult.rows || [];
    console.log('[Dashboard] Pending approvals count:', pendingApprovals.length);
  } catch (error) {
    console.error('[Dashboard] Error fetching pending approvals:', error);
    pendingApprovals = [];
  }

  // Get unread messages (with error handling)
  console.log('[Dashboard] Step 6: Fetching unread messages...');
  let unreadMessages: any[] = [];
  try {
    unreadMessages = await db
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
    console.log('[Dashboard] Unread messages count:', unreadMessages.length);
  } catch (error) {
    console.error('[Dashboard] Error fetching unread messages:', error);
    unreadMessages = [];
  }

  // Get deals won this month (with error handling)
  console.log('[Dashboard] Calculating won deals this month...');
  let dealsWonThisMonth: any = { rows: [{ count: 0, totalValue: 0 }] };
  try {
    dealsWonThisMonth = await db.execute(sql`
      SELECT
        COUNT(*)::int as count,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0)::float as "totalValue"
      FROM deals d
      INNER JOIN pipeline_stages ps ON d.stage_id = ps.id
      WHERE d.organization_id = ${orgId}
        AND ps.is_won = true
        AND d.closed_at >= ${monthStart}
    `);
  } catch (error) {
    console.error('[Dashboard] Error calculating deals won this month:', error);
  }

  // Calculate pipeline value (with error handling)
  let pipelineStats: any[] = [{ totalValue: 0, count: 0 }];
  try {
    pipelineStats = await db
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
    console.log('[Dashboard] Pipeline stats result:', pipelineStats[0]);
  } catch (error) {
    console.error('[Dashboard] Error calculating pipeline stats:', error);
  }

  // Get recent activity with deal names (with error handling)
  let recentActivity: any[] = [];
  try {
    recentActivity = await db
      .select({
        id: crmActivities.id,
        type: crmActivities.activityType,
        title: crmActivities.title,
        timestamp: crmActivities.timestamp,
        objectId: crmActivities.objectId,
        objectType: crmActivities.objectType,
        dealName: deals.name
      })
      .from(crmActivities)
      .leftJoin(
        deals,
        and(
          eq(crmActivities.objectType, 'deal'),
          eq(crmActivities.objectId, deals.id)
        )
      )
      .where(eq(crmActivities.organizationId, orgId))
      .orderBy(desc(crmActivities.timestamp))
      .limit(10);
  } catch (error) {
    console.error('[Dashboard] Error fetching recent activity:', error);
    recentActivity = [];
  }

  const statsResult = {
    pipelineValue: pipelineStats[0]?.totalValue || 0,
    openDeals: pipelineStats[0]?.count || 0,
    dealsWonThisMonth: (dealsWonThisMonth.rows?.[0] as any)?.count || 0,
    wonValueThisMonth: (dealsWonThisMonth.rows?.[0] as any)?.totalValue || 0
  };

  console.log('[Dashboard] Calculated stats:', statsResult);
  console.log('[Dashboard] Sample open deals with amounts:', openDeals.slice(0, 3).map(d => ({ name: d.name, amount: d.amount })));
  console.log('[Dashboard] Deals with activity data:', dealsWithActivity.map(d => ({
    name: d.name,
    daysSinceActivity: d.daysSinceActivity
  })));

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
    stats: statsResult,
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
  if ((data.pendingApprovals?.length || 0) > 0) summaryParts.push(`${data.pendingApprovals.length} NDA approval${data.pendingApprovals.length > 1 ? 's' : ''} pending`);

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

  console.log('[Dashboard] Basic Priority Deals:', priorityDeals);
  console.log('[Dashboard] Basic Risk Alerts:', riskAlerts);

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
      count: data.pendingApprovals?.length || 0,
      items: (data.pendingApprovals || []).slice(0, 5).map((a: any) => ({
        documentId: a.documentId,
        documentTitle: a.documentTitle,
        signerEmail: a.signerEmail
      })),
      message: (data.pendingApprovals?.length || 0) > 0
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
      timestamp: a.timestamp,
      dealName: a.dealName || undefined
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
- Pending NDA Approvals needing my action: ${data.pendingApprovals?.length || 0}
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

    // Build priority deals and risk alerts directly from data (more reliable than AI matching)
    const priorityDealsFromData = data.deals
      .filter((d: any) => d.daysSinceActivity >= 3)
      .sort((a: any, b: any) => b.daysSinceActivity - a.daysSinceActivity)
      .slice(0, 5)
      .map((d: any) => {
        // Find AI suggestion for this deal if available
        const aiSuggestion = (aiResponse.priorityDeals || []).find((p: any) =>
          p.name === d.name || p.id === d.id
        );
        return {
          id: d.id,
          name: d.name,
          value: d.amount ? parseFloat(d.amount) : null,
          stage: d.stageName || 'Unknown',
          daysSinceActivity: d.daysSinceActivity,
          reason: aiSuggestion?.reason || `No activity in ${d.daysSinceActivity} days`,
          suggestedAction: aiSuggestion?.suggestedAction || 'Follow up with contact'
        };
      });

    const riskAlertsFromData = data.deals
      .filter((d: any) => d.daysSinceActivity >= 7)
      .slice(0, 3)
      .map((d: any) => {
        // Find AI message for this deal if available
        const aiAlert = (aiResponse.riskAlerts || []).find((r: any) =>
          r.name === d.name || r.dealName === d.name
        );
        return {
          dealId: d.id,
          dealName: d.name,
          message: aiAlert?.message || `${d.daysSinceActivity} days without activity`
        };
      });

    console.log('[Dashboard] AI Priority Deals from data:', priorityDealsFromData);
    console.log('[Dashboard] AI Risk Alerts from data:', riskAlertsFromData);

    // Build the final briefing data combining AI insights with raw data
    const briefing: BriefingData = {
      summary: aiResponse.summary || "Welcome back! Here's your daily overview.",
      priorityDeals: priorityDealsFromData,
      riskAlerts: riskAlertsFromData,
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
        count: data.pendingApprovals?.length || 0,
        items: (data.pendingApprovals || []).slice(0, 5).map((a: any) => ({
          documentId: a.documentId,
          documentTitle: a.documentTitle,
          signerEmail: a.signerEmail
        })),
        message: aiResponse.approvalsMessage || ((data.pendingApprovals?.length || 0) > 0
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
        dealName: a.dealName || undefined
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
        console.log('[Dashboard] Returning cached briefing with stats:', cached[0].briefing.quickStats);
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
    console.log('[Dashboard] Caching new briefing with stats:', briefing.quickStats);
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

    // Won this month - use raw SQL
    const wonThisMonth = await db.execute(sql`
      SELECT
        COUNT(*)::int as count,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0)::float as "totalValue"
      FROM deals d
      INNER JOIN pipeline_stages ps ON d.stage_id = ps.id
      WHERE d.organization_id = ${orgId}
        AND ps.is_won = true
        AND d.closed_at >= ${monthStart}
    `);

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
      dealsWonThisMonth: (wonThisMonth.rows?.[0] as any)?.count || 0,
      wonValueThisMonth: (wonThisMonth.rows?.[0] as any)?.totalValue || 0,
      overdueTasks: overdueTasks[0]?.count || 0,
      pendingSignatures: pendingSigs[0]?.count || 0
    });
  } catch (error: any) {
    console.error('[Dashboard] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// DEBUG endpoint - Get raw deals data for troubleshooting
router.get('/debug-deals', async (req, res) => {
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

    // Get first 10 open deals with raw data
    const openDeals = await db
      .select({
        id: deals.id,
        name: deals.name,
        amount: deals.amount,
        currency: deals.currency,
        closedAt: deals.closedAt
      })
      .from(deals)
      .where(
        and(
          eq(deals.organizationId, orgId),
          isNull(deals.closedAt)
        )
      )
      .limit(10);

    // Try the sum query
    const sumQuery = await db
      .select({
        totalValue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)::float`,
        count: sql<number>`COUNT(*)::int`,
        countWithAmount: sql<number>`COUNT(${deals.amount})::int`,
        avgAmount: sql<number>`AVG(CAST(${deals.amount} AS DECIMAL))::float`
      })
      .from(deals)
      .where(
        and(
          eq(deals.organizationId, orgId),
          isNull(deals.closedAt)
        )
      );

    res.json({
      openDeals,
      stats: sumQuery[0],
      message: 'Debug data for open deals'
    });
  } catch (error: any) {
    console.error('[Dashboard] Debug endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch debug data', details: error.message });
  }
});

export default router;
