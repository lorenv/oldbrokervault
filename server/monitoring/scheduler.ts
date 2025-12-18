/**
 * Monitoring Scheduler
 *
 * Runs periodic health checks and sends alerts when issues are detected.
 * Can be run as a standalone script or integrated into the main application.
 */

import {
  runAllHealthChecks,
  runQuickHealthCheck,
  SystemHealthReport,
  HealthCheckResult,
} from './health-checks';

// Alert configuration
interface AlertConfig {
  enabled: boolean;
  emailRecipients?: string[];
  webhookUrl?: string;
  slackWebhookUrl?: string;
}

// Scheduler state
let isRunning = false;
let quickCheckInterval: NodeJS.Timeout | null = null;
let fullCheckInterval: NodeJS.Timeout | null = null;
let lastFullReport: SystemHealthReport | null = null;
let lastQuickReport: SystemHealthReport | null = null;
let alertsSentToday: Map<string, number> = new Map();

// Default intervals
const QUICK_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes (quick check for critical services)
const FULL_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours (full comprehensive check)
const DAILY_REPORT_HOUR = 9; // 9 AM UTC
const MAX_ALERTS_PER_CHECK_TYPE = 3; // Max alerts per day per check type

// Default admin email for alerts
const DEFAULT_ADMIN_EMAIL = 'robertkale20@gmail.com';

/**
 * Format a health report for logging/alerting
 */
function formatReportForAlert(report: SystemHealthReport): string {
  const lines: string[] = [];

  lines.push(`=== System Health Report ===`);
  lines.push(`Time: ${report.timestamp.toISOString()}`);
  lines.push(`Overall Status: ${report.overall.toUpperCase()}`);
  lines.push(`Summary: ${report.summary.healthy}/${report.summary.total} healthy, ${report.summary.degraded} degraded, ${report.summary.unhealthy} unhealthy`);
  lines.push('');

  // Group by status
  const unhealthy = report.checks.filter(c => c.status === 'unhealthy');
  const degraded = report.checks.filter(c => c.status === 'degraded');

  if (unhealthy.length > 0) {
    lines.push('🚨 UNHEALTHY SERVICES:');
    unhealthy.forEach(c => {
      lines.push(`  - ${c.name}: ${c.message}`);
      if (c.latencyMs) lines.push(`    Latency: ${c.latencyMs}ms`);
    });
    lines.push('');
  }

  if (degraded.length > 0) {
    lines.push('⚠️ DEGRADED SERVICES:');
    degraded.forEach(c => {
      lines.push(`  - ${c.name}: ${c.message}`);
      if (c.latencyMs) lines.push(`    Latency: ${c.latencyMs}ms`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Send alert via email using SendGrid
 */
async function sendEmailAlert(subject: string, body: string, recipients: string[]): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️ Cannot send email alert: SENDGRID_API_KEY not configured');
      return false;
    }

    const fromEmail = process.env.SUPPORT_EMAIL || 'monitoring@app.com';

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map(email => ({ email })) }],
        from: { email: fromEmail, name: 'System Monitoring' },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });

    if (response.ok || response.status === 202) {
      console.log(`📧 Alert email sent to ${recipients.join(', ')}`);
      return true;
    } else {
      console.error(`❌ Failed to send email alert: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Email alert error:', error);
    return false;
  }
}

/**
 * Send alert via webhook (generic)
 */
async function sendWebhookAlert(webhookUrl: string, report: SystemHealthReport): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'health_alert',
        timestamp: report.timestamp.toISOString(),
        overall: report.overall,
        summary: report.summary,
        checks: report.checks.map(c => ({
          name: c.name,
          status: c.status,
          message: c.message,
          latencyMs: c.latencyMs,
        })),
      }),
    });

    if (response.ok) {
      console.log('🔔 Webhook alert sent successfully');
      return true;
    } else {
      console.error(`❌ Webhook alert failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Webhook alert error:', error);
    return false;
  }
}

/**
 * Send Slack notification
 */
async function sendSlackAlert(webhookUrl: string, report: SystemHealthReport): Promise<boolean> {
  try {
    const emoji = report.overall === 'healthy' ? '✅' :
                  report.overall === 'degraded' ? '⚠️' : '🚨';

    const unhealthyChecks = report.checks.filter(c => c.status === 'unhealthy');
    const degradedChecks = report.checks.filter(c => c.status === 'degraded');

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} System Health: ${report.overall.toUpperCase()}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:* ${report.summary.healthy}/${report.summary.total} healthy\n*Time:* ${report.timestamp.toISOString()}`,
        },
      },
    ];

    if (unhealthyChecks.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🚨 Unhealthy:*\n' + unhealthyChecks.map(c => `• ${c.name}: ${c.message}`).join('\n'),
        },
      });
    }

    if (degradedChecks.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*⚠️ Degraded:*\n' + degradedChecks.map(c => `• ${c.name}: ${c.message}`).join('\n'),
        },
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    if (response.ok) {
      console.log('💬 Slack alert sent successfully');
      return true;
    } else {
      console.error(`❌ Slack alert failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Slack alert error:', error);
    return false;
  }
}

/**
 * Process health report and send alerts if needed
 */
async function processReport(report: SystemHealthReport, alertConfig: AlertConfig): Promise<void> {
  // Log to console
  console.log(formatReportForAlert(report));

  // Only alert on degraded or unhealthy status
  if (report.overall === 'healthy') {
    // Reset alert counters at midnight
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() < 10) {
      alertsSentToday.clear();
    }
    return;
  }

  if (!alertConfig.enabled) {
    return;
  }

  // Check alert rate limiting
  const unhealthyChecks = report.checks.filter(c => c.status === 'unhealthy');
  const shouldAlert = unhealthyChecks.some(check => {
    const alertCount = alertsSentToday.get(check.name) || 0;
    return alertCount < MAX_ALERTS_PER_CHECK_TYPE;
  });

  if (!shouldAlert) {
    console.log('⏸️ Alert rate limit reached for all failing checks');
    return;
  }

  // Update alert counters
  unhealthyChecks.forEach(check => {
    const count = alertsSentToday.get(check.name) || 0;
    alertsSentToday.set(check.name, count + 1);
  });

  // Send alerts
  const subject = `🚨 System Health Alert: ${report.overall.toUpperCase()}`;
  const body = formatReportForAlert(report);

  if (alertConfig.emailRecipients && alertConfig.emailRecipients.length > 0) {
    await sendEmailAlert(subject, body, alertConfig.emailRecipients);
  }

  if (alertConfig.webhookUrl) {
    await sendWebhookAlert(alertConfig.webhookUrl, report);
  }

  if (alertConfig.slackWebhookUrl) {
    await sendSlackAlert(alertConfig.slackWebhookUrl, report);
  }
}

/**
 * Start the monitoring scheduler
 */
export function startMonitoring(alertConfig: AlertConfig = { enabled: false }): void {
  if (isRunning) {
    console.log('⚠️ Monitoring is already running');
    return;
  }

  console.log('🚀 Starting monitoring scheduler...');
  isRunning = true;

  // Run initial full check
  runAllHealthChecks().then(report => {
    lastFullReport = report;
    processReport(report, alertConfig);
  });

  // Schedule quick checks (every 5 minutes)
  quickCheckInterval = setInterval(async () => {
    try {
      const report = await runQuickHealthCheck();
      lastQuickReport = report;

      // Only process/alert if there are issues
      if (report.overall !== 'healthy') {
        await processReport(report, alertConfig);
      } else {
        console.log(`✅ Quick check passed at ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('❌ Quick health check failed:', error);
    }
  }, QUICK_CHECK_INTERVAL_MS);

  // Schedule full checks (every hour)
  fullCheckInterval = setInterval(async () => {
    try {
      const report = await runAllHealthChecks();
      lastFullReport = report;
      await processReport(report, alertConfig);
    } catch (error) {
      console.error('❌ Full health check failed:', error);
    }
  }, FULL_CHECK_INTERVAL_MS);

  console.log(`📊 Quick checks every ${QUICK_CHECK_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`📊 Full checks every ${FULL_CHECK_INTERVAL_MS / 1000 / 60} minutes`);
}

/**
 * Stop the monitoring scheduler
 */
export function stopMonitoring(): void {
  if (!isRunning) {
    console.log('⚠️ Monitoring is not running');
    return;
  }

  if (quickCheckInterval) {
    clearInterval(quickCheckInterval);
    quickCheckInterval = null;
  }

  if (fullCheckInterval) {
    clearInterval(fullCheckInterval);
    fullCheckInterval = null;
  }

  isRunning = false;
  console.log('🛑 Monitoring scheduler stopped');
}

/**
 * Get the latest health reports
 */
export function getLatestReports(): {
  quick: SystemHealthReport | null;
  full: SystemHealthReport | null;
  isRunning: boolean;
} {
  return {
    quick: lastQuickReport,
    full: lastFullReport,
    isRunning,
  };
}

/**
 * Manually trigger a health check
 */
export async function triggerHealthCheck(full: boolean = false): Promise<SystemHealthReport> {
  if (full) {
    const report = await runAllHealthChecks();
    lastFullReport = report;
    return report;
  } else {
    const report = await runQuickHealthCheck();
    lastQuickReport = report;
    return report;
  }
}

/**
 * Auto-start monitoring with default configuration
 * Called from server startup
 */
export function autoStartMonitoring(): void {
  // Only start if not already running
  if (isRunning) {
    return;
  }

  console.log('🔄 Auto-starting health monitoring with email alerts...');

  startMonitoring({
    enabled: true,
    emailRecipients: [DEFAULT_ADMIN_EMAIL],
  });
}
