import { MailService } from '@sendgrid/mail';
import { logger } from './logger';

const ALERT_EMAIL = 'rob@cimshare.com';
const FROM_EMAIL = 'alerts@cimshare.com';

let mailService: MailService | null = null;

if (process.env.SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface ErrorReport {
  error: string;
  stack?: string;
  page: string;
  userEmail?: string;
  userId?: number;
  timestamp: string;
  userAgent?: string;
  componentStack?: string;
  additionalInfo?: Record<string, any>;
}

// Rate limiting to prevent email spam
const recentErrors = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ERRORS_PER_WINDOW = 5;

function getErrorKey(report: ErrorReport): string {
  return `${report.error}:${report.page}`;
}

function isRateLimited(report: ErrorReport): boolean {
  const key = getErrorKey(report);
  const now = Date.now();
  const lastSent = recentErrors.get(key);

  if (lastSent && (now - lastSent) < RATE_LIMIT_WINDOW) {
    return true;
  }

  // Clean up old entries
  const keysToDelete: string[] = [];
  recentErrors.forEach((time, k) => {
    if (now - time > RATE_LIMIT_WINDOW) {
      keysToDelete.push(k);
    }
  });
  keysToDelete.forEach(k => recentErrors.delete(k));

  // Check total errors in window
  let errorCount = 0;
  recentErrors.forEach((time) => {
    if (now - time < RATE_LIMIT_WINDOW) {
      errorCount++;
    }
  });

  if (errorCount >= MAX_ERRORS_PER_WINDOW) {
    return true;
  }

  recentErrors.set(key, now);
  return false;
}

export async function sendErrorReport(report: ErrorReport): Promise<boolean> {
  try {
    logger.error('Client error reported:', {
      error: report.error,
      page: report.page,
      userEmail: report.userEmail,
      userId: report.userId,
    });

    if (!mailService) {
      logger.warn('SendGrid not configured, skipping error email');
      return false;
    }

    if (isRateLimited(report)) {
      logger.info('Error report rate limited, skipping email');
      return false;
    }

    const timestamp = new Date(report.timestamp).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'long',
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
          ⚠️ Client Error Report
        </h2>

        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px; background: #f3f4f6; font-weight: bold; width: 120px;">Time:</td>
            <td style="padding: 10px; background: #f9fafb;">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding: 10px; background: #f3f4f6; font-weight: bold;">Page:</td>
            <td style="padding: 10px; background: #f9fafb;"><code>${report.page}</code></td>
          </tr>
          <tr>
            <td style="padding: 10px; background: #f3f4f6; font-weight: bold;">User:</td>
            <td style="padding: 10px; background: #f9fafb;">${report.userEmail || 'Not logged in'} ${report.userId ? `(ID: ${report.userId})` : ''}</td>
          </tr>
          <tr>
            <td style="padding: 10px; background: #f3f4f6; font-weight: bold;">Browser:</td>
            <td style="padding: 10px; background: #f9fafb; font-size: 12px;">${report.userAgent || 'Unknown'}</td>
          </tr>
        </table>

        <h3 style="color: #374151; margin-top: 30px;">Error Message:</h3>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; color: #991b1b;">
          <code style="white-space: pre-wrap; word-break: break-word;">${report.error}</code>
        </div>

        ${report.stack ? `
          <h3 style="color: #374151; margin-top: 20px;">Stack Trace:</h3>
          <div style="background: #1f2937; border-radius: 6px; padding: 15px; overflow-x: auto;">
            <pre style="color: #f3f4f6; margin: 0; font-size: 11px; white-space: pre-wrap; word-break: break-word;">${report.stack}</pre>
          </div>
        ` : ''}

        ${report.componentStack ? `
          <h3 style="color: #374151; margin-top: 20px;">Component Stack:</h3>
          <div style="background: #1f2937; border-radius: 6px; padding: 15px; overflow-x: auto;">
            <pre style="color: #f3f4f6; margin: 0; font-size: 11px; white-space: pre-wrap; word-break: break-word;">${report.componentStack}</pre>
          </div>
        ` : ''}

        ${report.additionalInfo ? `
          <h3 style="color: #374151; margin-top: 20px;">Additional Info:</h3>
          <div style="background: #f3f4f6; border-radius: 6px; padding: 15px;">
            <pre style="margin: 0; font-size: 12px;">${JSON.stringify(report.additionalInfo, null, 2)}</pre>
          </div>
        ` : ''}

        <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          CIMShare Error Monitoring System
        </p>
      </div>
    `;

    await mailService.send({
      to: ALERT_EMAIL,
      from: FROM_EMAIL,
      subject: `[CIMShare Error] ${report.error.substring(0, 50)}${report.error.length > 50 ? '...' : ''} - ${report.page}`,
      html,
    });

    logger.info('Error report email sent successfully');
    return true;
  } catch (error) {
    logger.error('Failed to send error report email:', error);
    return false;
  }
}
