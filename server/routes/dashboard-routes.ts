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
    stageProbability?: number;
    daysSinceActivity: number;
    daysUntilClose?: number | null;
    isHighValue?: boolean;
    isLateStage?: boolean;
    isUrgent?: boolean;
    isOverdue?: boolean;
    priorityScore?: number;
    reason: string;
    suggestedAction: string;
  }>;
  riskAlerts: Array<{
    dealId: number;
    dealName: string;
    value?: number | null;
    stage?: string;
    daysSinceActivity?: number;
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
    items: Array<{
      id: number;
      title: string;
      recipientName: string;
      recipientEmail?: string;
      daysPending?: number;
      hasViewed?: boolean;
      needsReminder?: boolean;
      isStale?: boolean;
    }>;
    staleCount?: number;
    needsReminderCount?: number;
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

  // Get all open deals with stages (including stage position for prioritization)
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
        stageOrder: pipelineStages.displayOrder,
        stageProbability: pipelineStages.probability,
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
      .orderBy(desc(deals.updatedAt))
      .limit(200); // Limit to prevent unbounded queries - dashboard shows priority deals
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

  // Calculate days since last activity and priority score for each deal
  const dealsWithActivity = openDeals.map(deal => {
    const lastActivity = activityMap.get(deal.id) || deal.createdAt;
    const daysSinceActivity = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));

    // Calculate days until close date (negative = overdue)
    const daysUntilClose = deal.closeDate
      ? Math.floor((new Date(deal.closeDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Calculate priority score (higher = needs more attention)
    // Factors: deal value, stage progress, inactivity, close date urgency
    const dealValue = parseFloat(deal.amount) || 0;
    const valueScore = Math.min(dealValue / 100000, 10); // Cap at 10 points for $1M+ deals
    const stageScore = (deal.stageProbability || 0) / 10; // 0-10 based on probability
    const inactivityScore = Math.min(daysSinceActivity, 14) / 2; // 0-7 points
    const urgencyScore = daysUntilClose !== null
      ? (daysUntilClose <= 0 ? 10 : daysUntilClose <= 7 ? 7 : daysUntilClose <= 14 ? 4 : 0)
      : 0;

    const priorityScore = valueScore + stageScore + inactivityScore + urgencyScore;

    return {
      ...deal,
      daysSinceActivity,
      daysUntilClose,
      lastActivity,
      priorityScore,
      isLateStage: (deal.stageProbability || 0) >= 50,
      isHighValue: dealValue >= 100000,
      isOverdue: daysUntilClose !== null && daysUntilClose < 0,
      isUrgent: daysUntilClose !== null && daysUntilClose <= 7 && daysUntilClose >= 0
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

  // Get pending e-signature requests with sent date for urgency tracking
  console.log('[Dashboard] Step 4: Fetching pending signatures...');
  let pendingSignatures: any[] = [];
  try {
    const rawSignatures = await db
      .select({
        envelopeId: esignEnvelopes.id,
        title: esignEnvelopes.title,
        sentAt: esignEnvelopes.sentAt,
        recipientId: esignRecipients.id,
        recipientName: esignRecipients.name,
        recipientEmail: esignRecipients.email,
        recipientStatus: esignRecipients.status,
        recipientSentAt: esignRecipients.sentAt,
        viewedAt: esignRecipients.viewedAt
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
      .orderBy(esignEnvelopes.sentAt)
      .limit(10);

    // Calculate days pending for each signature
    pendingSignatures = rawSignatures.map(sig => {
      const sentDate = sig.recipientSentAt || sig.sentAt;
      const daysPending = sentDate
        ? Math.floor((now.getTime() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        ...sig,
        daysPending,
        hasViewed: sig.recipientStatus === 'viewed',
        needsReminder: daysPending >= 2 && sig.recipientStatus !== 'viewed',
        isStale: daysPending >= 5
      };
    });
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

  // Get high-priority items for specific mentions
  const topPriorityDeal = data.deals
    .filter((d: any) => d.priorityScore > 0)
    .sort((a: any, b: any) => (b.priorityScore || 0) - (a.priorityScore || 0))[0];

  const staleSignatures = data.pendingSignatures.filter((s: any) => s.isStale);
  const overdueDeals = data.deals.filter((d: any) => d.isOverdue);
  const urgentDeals = data.deals.filter((d: any) => d.isUrgent);

  // Build a specific, actionable summary
  let summaryItems = [];

  // First priority: overdue deals
  if (overdueDeals.length > 0) {
    const topOverdue = overdueDeals[0];
    summaryItems.push(`⚠️ "${topOverdue.name}" is past its close date - follow up immediately`);
  }

  // Second priority: stale signatures
  if (staleSignatures.length > 0) {
    summaryItems.push(`${staleSignatures.length} signature${staleSignatures.length > 1 ? 's' : ''} stale 5+ days - send reminder to ${staleSignatures[0].recipientName}`);
  }

  // Third priority: urgent deals closing soon
  if (urgentDeals.length > 0 && overdueDeals.length === 0) {
    const topUrgent = urgentDeals[0];
    summaryItems.push(`"${topUrgent.name}" closing in ${topUrgent.daysUntilClose} days - confirm timeline`);
  }

  // Fourth: overdue tasks
  if (overdueCount > 0) {
    const topTask = data.tasks.overdue[0];
    summaryItems.push(`${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}${topTask ? ` - "${topTask.title}" is most urgent` : ''}`);
  }

  // Fallback to general summary
  if (summaryItems.length === 0) {
    if (topPriorityDeal) {
      summaryItems.push(`Focus on "${topPriorityDeal.name}" ($${(parseFloat(topPriorityDeal.amount) || 0).toLocaleString()}) - ${topPriorityDeal.daysSinceActivity} days since last activity`);
    } else if (dealCount > 0) {
      summaryItems.push(`Managing ${dealCount} open deal${dealCount > 1 ? 's' : ''} worth ${formatCurrency(data.stats.pipelineValue)}. All on track!`);
    } else {
      summaryItems.push('Welcome! Get started by creating your first deal.');
    }
  }

  const summary = summaryItems.slice(0, 2).join(' ');

  // Find deals needing attention using priority score
  const priorityDeals = data.deals
    .filter((d: any) => d.priorityScore > 5 || d.daysSinceActivity >= 3 || d.isUrgent || d.isOverdue)
    .sort((a: any, b: any) => (b.priorityScore || 0) - (a.priorityScore || 0))
    .slice(0, 5)
    .map((d: any) => {
      const reasons = [];
      if (d.isHighValue) reasons.push(`$${(parseFloat(d.amount) || 0).toLocaleString()} high-value deal`);
      if (d.isOverdue) reasons.push(`past close date by ${Math.abs(d.daysUntilClose)} days`);
      else if (d.isUrgent) reasons.push(`closing in ${d.daysUntilClose} days`);
      if (d.isLateStage) reasons.push(`${d.stageProbability}% close probability`);
      if (d.daysSinceActivity >= 5) reasons.push(`${d.daysSinceActivity} days without activity`);

      return {
        id: d.id,
        name: d.name,
        value: d.amount ? parseFloat(d.amount) : null,
        stage: d.stageName || 'Unknown',
        stageProbability: d.stageProbability || 0,
        daysSinceActivity: d.daysSinceActivity,
        daysUntilClose: d.daysUntilClose,
        isHighValue: d.isHighValue || false,
        isLateStage: d.isLateStage || false,
        isUrgent: d.isUrgent || false,
        isOverdue: d.isOverdue || false,
        priorityScore: d.priorityScore || 0,
        reason: reasons.join('; ') || `No activity in ${d.daysSinceActivity} days`,
        suggestedAction: d.isOverdue ? 'Contact immediately to reconfirm timeline'
          : d.isUrgent ? 'Confirm closing details and next steps'
          : 'Follow up with contact'
      };
    });

  // Risk alerts for deals going cold
  const riskAlerts = data.deals
    .filter((d: any) => {
      if (d.isLateStage && d.daysSinceActivity >= 3) return true;
      if (d.isHighValue && d.daysSinceActivity >= 5) return true;
      if (d.daysSinceActivity >= 7) return true;
      if (d.isOverdue) return true;
      return false;
    })
    .sort((a: any, b: any) => (b.priorityScore || 0) - (a.priorityScore || 0))
    .slice(0, 5)
    .map((d: any) => {
      let riskMessage = '';
      if (d.isOverdue) {
        riskMessage = `⚠️ Past close date by ${Math.abs(d.daysUntilClose)} days`;
      } else if (d.isLateStage && d.isHighValue) {
        riskMessage = `🔴 High-value late-stage deal going cold (${d.daysSinceActivity} days)`;
      } else if (d.isLateStage) {
        riskMessage = `🟡 Late-stage deal needs follow-up (${d.daysSinceActivity} days)`;
      } else if (d.isHighValue) {
        riskMessage = `💰 High-value deal losing momentum (${d.daysSinceActivity} days)`;
      } else {
        riskMessage = `${d.daysSinceActivity} days without activity`;
      }
      return {
        dealId: d.id,
        dealName: d.name,
        value: d.amount ? parseFloat(d.amount) : null,
        stage: d.stageName,
        daysSinceActivity: d.daysSinceActivity,
        message: riskMessage
      };
    });

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
      items: data.pendingSignatures
        .sort((a: any, b: any) => (b.daysPending || 0) - (a.daysPending || 0))
        .slice(0, 5)
        .map((s: any) => ({
          id: s.envelopeId,
          title: s.title,
          recipientName: s.recipientName,
          recipientEmail: s.recipientEmail,
          daysPending: s.daysPending || 0,
          hasViewed: s.hasViewed || false,
          needsReminder: s.needsReminder || false,
          isStale: s.isStale || false
        })),
      staleCount: staleSignatures.length,
      needsReminderCount: data.pendingSignatures.filter((s: any) => s.needsReminder && !s.isStale).length,
      message: (() => {
        if (staleSignatures.length > 0) {
          return `⚠️ ${staleSignatures.length} signature${staleSignatures.length > 1 ? 's' : ''} stale (5+ days) - follow up with ${staleSignatures[0].recipientName}`;
        }
        const needsReminder = data.pendingSignatures.filter((s: any) => s.needsReminder && !s.isStale);
        if (needsReminder.length > 0) {
          return `${needsReminder.length} signature${needsReminder.length > 1 ? 's need' : ' needs'} reminder - ${needsReminder[0].recipientName} hasn't viewed`;
        }
        if (data.pendingSignatures.length > 0) {
          return `${data.pendingSignatures.length} awaiting signatures`;
        }
        return 'No pending signatures';
      })()
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

  // Sort deals by priority score for the prompt
  const sortedDeals = [...data.deals].sort((a: any, b: any) => (b.priorityScore || 0) - (a.priorityScore || 0));
  const highValueDeals = data.deals.filter((d: any) => d.isHighValue);
  const lateStageDeals = data.deals.filter((d: any) => d.isLateStage);
  const overdueDeals = data.deals.filter((d: any) => d.isOverdue);
  const urgentDeals = data.deals.filter((d: any) => d.isUrgent);
  const staleSignatures = data.pendingSignatures.filter((s: any) => s.isStale);
  const needsReminderSignatures = data.pendingSignatures.filter((s: any) => s.needsReminder);

  // Prepare a summary of the data for the AI
  const prompt = `You are a helpful CRM assistant generating a SPECIFIC, ACTIONABLE daily briefing for a sales/deal professional.
Your job is to tell them EXACTLY what to focus on first and why.

CRITICAL DATA FOR TODAY:

HIGH-PRIORITY DEALS (sorted by urgency):
${sortedDeals.slice(0, 8).map((d: any) => {
  const flags = [];
  if (d.isHighValue) flags.push('💰 HIGH VALUE');
  if (d.isLateStage) flags.push('🎯 LATE STAGE');
  if (d.isOverdue) flags.push('⚠️ PAST CLOSE DATE');
  if (d.isUrgent) flags.push('⏰ CLOSING SOON');
  if (d.daysSinceActivity >= 7) flags.push('🔴 GOING COLD');
  const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
  const closeInfo = d.daysUntilClose !== null
    ? (d.daysUntilClose < 0 ? `OVERDUE by ${Math.abs(d.daysUntilClose)} days` : d.daysUntilClose <= 7 ? `Closes in ${d.daysUntilClose} days` : '')
    : '';
  return `  • "${d.name}" - $${(parseFloat(d.amount) || 0).toLocaleString()} - ${d.stageName || 'Unknown'} (${d.stageProbability || 0}% probability)${flagStr}
    Last activity: ${d.daysSinceActivity} days ago | ${closeInfo}`;
}).join('\n')}

QUICK STATS:
- ${overdueDeals.length} deals past their close date
- ${urgentDeals.length} deals closing within 7 days
- ${highValueDeals.length} high-value deals ($100k+) in pipeline
- ${lateStageDeals.length} deals at 50%+ probability

TASKS:
- OVERDUE: ${data.tasks.overdue.length}${data.tasks.overdue.length > 0 ? ` (${data.tasks.overdue.slice(0, 3).map((t: any) => t.title).join(', ')})` : ''}
- Due Today: ${data.tasks.dueToday.length}${data.tasks.dueToday.length > 0 ? ` (${data.tasks.dueToday.slice(0, 3).map((t: any) => t.title).join(', ')})` : ''}
- Upcoming: ${data.tasks.upcoming.length}

E-SIGNATURES PENDING (${data.pendingSignatures.length} total):
${data.pendingSignatures.slice(0, 5).map((s: any) => {
  const status = s.isStale ? '🔴 STALE' : s.needsReminder ? '🟡 NEEDS REMINDER' : s.hasViewed ? '👀 Viewed' : '📤 Sent';
  return `  • "${s.title}" - waiting on ${s.recipientName} (${s.daysPending} days) [${status}]`;
}).join('\n') || '  None pending'}

NDA APPROVALS NEEDING YOUR ACTION: ${data.pendingApprovals?.length || 0}
${(data.pendingApprovals || []).slice(0, 3).map((a: any) => `  • "${a.documentTitle}" from ${a.signerEmail}`).join('\n') || ''}

UNREAD MESSAGES: ${data.unreadMessages?.length || 0}
${(data.unreadMessages || []).slice(0, 3).map((m: any) => `  • From ${m.inquirerName}: "${m.subject}"`).join('\n') || ''}

Pipeline: $${data.stats.pipelineValue.toLocaleString()} | Won this month: ${data.stats.dealsWonThisMonth} ($${data.stats.wonValueThisMonth.toLocaleString()})

RESPOND WITH JSON containing:
1. "summary": 2-3 sentences telling them EXACTLY what to do first. Be specific - name the deal/person/task. Example: "Start with [Deal Name] - it's a $500k deal closing Friday that hasn't been touched in 5 days. Then follow up on the stale signature from John Smith."
2. "priorityDeals": Top 3-5 deals with:
   - "id", "name", "value", "stage", "daysSinceActivity"
   - "reason": Be SPECIFIC (e.g., "$200k deal at 70% probability with no activity for 5 days")
   - "suggestedAction": Specific action (e.g., "Call Jane at Acme Corp to confirm closing timeline")
3. "riskAlerts": Deals at risk with specific warnings
4. "tasksMessage": Specific task guidance (name the most important overdue task)
5. "signaturesMessage": Who to follow up with first and why
6. "approvalsMessage": Specific approval actions needed
7. "messagesMessage": Which message to reply to first

Be SPECIFIC with names, amounts, and actions. Prioritize by: 1) Revenue impact, 2) Urgency/deadlines, 3) Risk of loss.`;

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

    // Build priority deals using priority score (combines value, stage, urgency, inactivity)
    const priorityDealsFromData = data.deals
      .filter((d: any) => d.priorityScore > 5 || d.daysSinceActivity >= 3 || d.isUrgent || d.isOverdue)
      .sort((a: any, b: any) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, 5)
      .map((d: any) => {
        // Find AI suggestion for this deal if available
        const aiSuggestion = (aiResponse.priorityDeals || []).find((p: any) =>
          p.name === d.name || p.id === d.id
        );

        // Build a specific reason if AI didn't provide one
        const reasons = [];
        if (d.isHighValue) reasons.push(`$${(parseFloat(d.amount) || 0).toLocaleString()} high-value deal`);
        if (d.isOverdue) reasons.push(`past close date by ${Math.abs(d.daysUntilClose)} days`);
        else if (d.isUrgent) reasons.push(`closing in ${d.daysUntilClose} days`);
        if (d.isLateStage) reasons.push(`${d.stageProbability}% close probability`);
        if (d.daysSinceActivity >= 5) reasons.push(`${d.daysSinceActivity} days without activity`);

        return {
          id: d.id,
          name: d.name,
          value: d.amount ? parseFloat(d.amount) : null,
          stage: d.stageName || 'Unknown',
          stageProbability: d.stageProbability || 0,
          daysSinceActivity: d.daysSinceActivity,
          daysUntilClose: d.daysUntilClose,
          isHighValue: d.isHighValue || false,
          isLateStage: d.isLateStage || false,
          isUrgent: d.isUrgent || false,
          isOverdue: d.isOverdue || false,
          priorityScore: d.priorityScore || 0,
          reason: aiSuggestion?.reason || reasons.join('; ') || `Needs attention`,
          suggestedAction: aiSuggestion?.suggestedAction || 'Follow up with contact to confirm next steps'
        };
      });

    // Build risk alerts for deals going cold (especially late-stage high-value ones)
    const riskAlertsFromData = data.deals
      .filter((d: any) => {
        // Late stage deals (50%+ probability) going cold after 3+ days
        if (d.isLateStage && d.daysSinceActivity >= 3) return true;
        // High value deals going cold after 5+ days
        if (d.isHighValue && d.daysSinceActivity >= 5) return true;
        // Any deal going cold after 7+ days
        if (d.daysSinceActivity >= 7) return true;
        // Deals past their close date
        if (d.isOverdue) return true;
        return false;
      })
      .sort((a: any, b: any) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, 5)
      .map((d: any) => {
        // Find AI message for this deal if available
        const aiAlert = (aiResponse.riskAlerts || []).find((r: any) =>
          r.name === d.name || r.dealName === d.name
        );

        // Build specific risk message
        let riskMessage = '';
        if (d.isOverdue) {
          riskMessage = `⚠️ Past close date by ${Math.abs(d.daysUntilClose)} days - needs immediate attention`;
        } else if (d.isLateStage && d.isHighValue && d.daysSinceActivity >= 3) {
          riskMessage = `🔴 High-value late-stage deal going cold (${d.daysSinceActivity} days)`;
        } else if (d.isLateStage && d.daysSinceActivity >= 3) {
          riskMessage = `🟡 Late-stage deal needs follow-up (${d.daysSinceActivity} days inactive)`;
        } else if (d.isHighValue && d.daysSinceActivity >= 5) {
          riskMessage = `💰 High-value deal losing momentum (${d.daysSinceActivity} days)`;
        } else {
          riskMessage = `${d.daysSinceActivity} days without activity`;
        }

        return {
          dealId: d.id,
          dealName: d.name,
          value: d.amount ? parseFloat(d.amount) : null,
          stage: d.stageName,
          daysSinceActivity: d.daysSinceActivity,
          message: aiAlert?.message || riskMessage
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
        items: data.pendingSignatures
          .sort((a: any, b: any) => (b.daysPending || 0) - (a.daysPending || 0))
          .slice(0, 5)
          .map((s: any) => ({
            id: s.envelopeId,
            title: s.title,
            recipientName: s.recipientName,
            recipientEmail: s.recipientEmail,
            daysPending: s.daysPending || 0,
            hasViewed: s.hasViewed || false,
            needsReminder: s.needsReminder || false,
            isStale: s.isStale || false
          })),
        staleCount: data.pendingSignatures.filter((s: any) => s.isStale).length,
        needsReminderCount: data.pendingSignatures.filter((s: any) => s.needsReminder).length,
        message: aiResponse.signaturesMessage || (() => {
          const stale = data.pendingSignatures.filter((s: any) => s.isStale);
          const needsReminder = data.pendingSignatures.filter((s: any) => s.needsReminder && !s.isStale);
          if (stale.length > 0) {
            return `⚠️ ${stale.length} signature${stale.length > 1 ? 's' : ''} stale (5+ days) - follow up with ${stale[0].recipientName} first.`;
          } else if (needsReminder.length > 0) {
            return `${needsReminder.length} signature${needsReminder.length > 1 ? 's need' : ' needs'} reminder - ${needsReminder[0].recipientName} hasn't viewed yet.`;
          } else if (data.pendingSignatures.length > 0) {
            return `${data.pendingSignatures.length} document${data.pendingSignatures.length > 1 ? 's' : ''} awaiting signatures.`;
          }
          return 'No pending signatures.';
        })()
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
