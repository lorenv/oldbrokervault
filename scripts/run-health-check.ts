#!/usr/bin/env npx tsx
/**
 * Standalone Health Check Script
 *
 * Run this script to perform a comprehensive health check of the application.
 * Can be scheduled via cron or run manually.
 *
 * Usage:
 *   npx tsx scripts/run-health-check.ts [options]
 *
 * Options:
 *   --quick           Run quick check only (env, db, openai)
 *   --json            Output as JSON
 *   --alert-email     Send email alerts (requires SENDGRID_API_KEY and ALERT_EMAIL)
 *   --alert-slack     Send Slack alerts (requires SLACK_WEBHOOK_URL)
 *   --verbose         Show detailed output
 *
 * Environment Variables:
 *   ALERT_EMAIL       Email address(es) for alerts (comma-separated)
 *   SLACK_WEBHOOK_URL Slack webhook URL for alerts
 *
 * Exit Codes:
 *   0 - All checks healthy
 *   1 - Some checks degraded
 *   2 - Critical checks unhealthy
 */

import {
  runAllHealthChecks,
  runQuickHealthCheck,
  SystemHealthReport,
} from '../server/monitoring/health-checks';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  quick: args.includes('--quick'),
  json: args.includes('--json'),
  alertEmail: args.includes('--alert-email'),
  alertSlack: args.includes('--alert-slack'),
  verbose: args.includes('--verbose'),
};

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return colors.green;
    case 'degraded':
      return colors.yellow;
    case 'unhealthy':
      return colors.red;
    default:
      return colors.reset;
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'healthy':
      return '✅';
    case 'degraded':
      return '⚠️';
    case 'unhealthy':
      return '❌';
    default:
      return '❓';
  }
}

function formatReport(report: SystemHealthReport): void {
  console.log('\n' + colors.bold + '═══════════════════════════════════════════════════' + colors.reset);
  console.log(colors.bold + '           SYSTEM HEALTH CHECK REPORT' + colors.reset);
  console.log(colors.bold + '═══════════════════════════════════════════════════' + colors.reset);
  console.log();

  const statusColor = getStatusColor(report.overall);
  console.log(`${colors.bold}Overall Status:${colors.reset} ${statusColor}${report.overall.toUpperCase()}${colors.reset} ${getStatusEmoji(report.overall)}`);
  console.log(`${colors.bold}Timestamp:${colors.reset} ${report.timestamp.toISOString()}`);
  console.log();

  console.log(colors.bold + '─── Summary ───' + colors.reset);
  console.log(`  Total Checks:  ${report.summary.total}`);
  console.log(`  ${colors.green}Healthy:${colors.reset}       ${report.summary.healthy}`);
  console.log(`  ${colors.yellow}Degraded:${colors.reset}      ${report.summary.degraded}`);
  console.log(`  ${colors.red}Unhealthy:${colors.reset}     ${report.summary.unhealthy}`);
  console.log();

  console.log(colors.bold + '─── Individual Checks ───' + colors.reset);

  for (const check of report.checks) {
    const statusColor = getStatusColor(check.status);
    const emoji = getStatusEmoji(check.status);

    console.log();
    console.log(`${emoji} ${colors.bold}${check.name}${colors.reset}`);
    console.log(`   Status: ${statusColor}${check.status}${colors.reset}`);
    console.log(`   Message: ${check.message}`);

    if (check.latencyMs !== undefined) {
      const latencyColor = check.latencyMs > 5000 ? colors.yellow :
                          check.latencyMs > 1000 ? colors.blue : colors.green;
      console.log(`   Latency: ${latencyColor}${check.latencyMs}ms${colors.reset}`);
    }

    if (options.verbose && check.details) {
      console.log(`   Details: ${JSON.stringify(check.details, null, 2).split('\n').join('\n   ')}`);
    }
  }

  console.log();
  console.log(colors.bold + '═══════════════════════════════════════════════════' + colors.reset);
}

async function sendEmailAlert(report: SystemHealthReport): Promise<void> {
  const recipients = process.env.ALERT_EMAIL?.split(',').map(e => e.trim()).filter(Boolean);

  if (!recipients || recipients.length === 0) {
    console.log(colors.yellow + '⚠️ ALERT_EMAIL not configured, skipping email alert' + colors.reset);
    return;
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.log(colors.yellow + '⚠️ SENDGRID_API_KEY not configured, skipping email alert' + colors.reset);
    return;
  }

  const subject = `[${report.overall.toUpperCase()}] System Health Check Report - ${new Date().toLocaleDateString()}`;

  let body = `SYSTEM HEALTH CHECK REPORT\n`;
  body += `==========================\n\n`;
  body += `Overall Status: ${report.overall.toUpperCase()}\n`;
  body += `Timestamp: ${report.timestamp.toISOString()}\n\n`;
  body += `Summary:\n`;
  body += `  - Healthy: ${report.summary.healthy}/${report.summary.total}\n`;
  body += `  - Degraded: ${report.summary.degraded}\n`;
  body += `  - Unhealthy: ${report.summary.unhealthy}\n\n`;

  const issues = report.checks.filter(c => c.status !== 'healthy');
  if (issues.length > 0) {
    body += `Issues Detected:\n`;
    body += `----------------\n`;
    for (const check of issues) {
      body += `\n[${check.status.toUpperCase()}] ${check.name}\n`;
      body += `  Message: ${check.message}\n`;
      if (check.latencyMs) body += `  Latency: ${check.latencyMs}ms\n`;
    }
  }

  body += `\n\nAll Checks:\n`;
  body += `-----------\n`;
  for (const check of report.checks) {
    body += `[${check.status.toUpperCase()}] ${check.name}: ${check.message}\n`;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map(email => ({ email })) }],
        from: { email: process.env.SUPPORT_EMAIL || 'monitoring@app.com', name: 'System Monitoring' },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });

    if (response.ok || response.status === 202) {
      console.log(colors.green + `📧 Email alert sent to: ${recipients.join(', ')}` + colors.reset);
    } else {
      console.log(colors.red + `❌ Failed to send email: ${response.status}` + colors.reset);
    }
  } catch (error) {
    console.log(colors.red + `❌ Email error: ${error}` + colors.reset);
  }
}

async function sendSlackAlert(report: SystemHealthReport): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(colors.yellow + '⚠️ SLACK_WEBHOOK_URL not configured, skipping Slack alert' + colors.reset);
    return;
  }

  const emoji = report.overall === 'healthy' ? ':white_check_mark:' :
                report.overall === 'degraded' ? ':warning:' : ':rotating_light:';

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} System Health: ${report.overall.toUpperCase()}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Healthy:* ${report.summary.healthy}/${report.summary.total}` },
        { type: 'mrkdwn', text: `*Degraded:* ${report.summary.degraded}` },
        { type: 'mrkdwn', text: `*Unhealthy:* ${report.summary.unhealthy}` },
        { type: 'mrkdwn', text: `*Time:* ${report.timestamp.toISOString()}` },
      ],
    },
  ];

  const issues = report.checks.filter(c => c.status !== 'healthy');
  if (issues.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Issues:*\n' + issues.map(c =>
          `• *${c.name}* (${c.status}): ${c.message}`
        ).join('\n'),
      },
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    if (response.ok) {
      console.log(colors.green + '💬 Slack alert sent' + colors.reset);
    } else {
      console.log(colors.red + `❌ Failed to send Slack alert: ${response.status}` + colors.reset);
    }
  } catch (error) {
    console.log(colors.red + `❌ Slack error: ${error}` + colors.reset);
  }
}

async function main(): Promise<void> {
  console.log(colors.blue + '🏥 Starting health check...' + colors.reset);
  console.log();

  try {
    const report = options.quick
      ? await runQuickHealthCheck()
      : await runAllHealthChecks();

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      formatReport(report);
    }

    // Send alerts if requested and there are issues
    if (report.overall !== 'healthy') {
      if (options.alertEmail) {
        await sendEmailAlert(report);
      }
      if (options.alertSlack) {
        await sendSlackAlert(report);
      }
    }

    // Exit with appropriate code
    if (report.overall === 'healthy') {
      process.exit(0);
    } else if (report.overall === 'degraded') {
      process.exit(1);
    } else {
      process.exit(2);
    }
  } catch (error) {
    console.error(colors.red + '❌ Health check failed with error:' + colors.reset);
    console.error(error);
    process.exit(2);
  }
}

main();
