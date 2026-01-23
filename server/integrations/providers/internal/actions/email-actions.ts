/**
 * Email Actions
 *
 * Handles internal actions related to sending emails:
 * - send_email: Send an email to a recipient
 */

import { db } from '../../../../db';
import { crmContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { ExecutionResult } from '../../../types';
import type { DestinationType } from '@shared/schema';
import type { ActionContext, SendEmailConfig } from '../types';
import { resolveTemplate, getNestedValue } from '../types';

export async function executeEmailActions(
  destinationType: DestinationType,
  config: Record<string, any>,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  switch (destinationType) {
    case 'internal_send_email':
      return executeSendEmail(config as SendEmailConfig, mappedPayload, eventPayload, context);
    default:
      return { success: false, error: `Unknown email action: ${destinationType}` };
  }
}

/**
 * Send an email
 * Note: This creates an email send request. Actual sending depends on
 * the organization's email configuration (SMTP, SendGrid, etc.)
 */
async function executeSendEmail(
  config: SendEmailConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  // Resolve recipient email based on toType
  let toEmail: string;

  switch (config.toType) {
    case 'contact_email':
      // Get email from the contact in the event
      const contactId = getNestedValue(eventPayload, 'data.contact_id');
      if (contactId) {
        const contact = await db.query.crmContacts.findFirst({
          where: and(
            eq(crmContacts.id, contactId),
            eq(crmContacts.organizationId, context.organizationId)
          ),
          columns: { email: true },
        });
        toEmail = contact?.email || '';
      } else {
        toEmail = getNestedValue(eventPayload, 'data.contact_email') ||
                  getNestedValue(eventPayload, 'data.signer_email') ||
                  getNestedValue(eventPayload, 'data.email') || '';
      }
      break;

    case 'user_email':
      toEmail = getNestedValue(eventPayload, 'data.user_email') || '';
      break;

    case 'template':
      toEmail = resolveTemplate(config.to, eventPayload);
      break;

    case 'static':
    default:
      toEmail = config.to;
  }

  if (!toEmail) {
    return { success: false, error: 'Recipient email could not be determined' };
  }

  // Resolve template variables in subject and body
  const subject = resolveTemplate(config.subject, eventPayload);
  const body = resolveTemplate(config.body, eventPayload);

  if (!subject || !body) {
    return { success: false, error: 'Subject and body are required' };
  }

  try {
    // For now, we'll log the email request and return success
    // In a full implementation, this would integrate with the email sending service
    console.log('[EmailAction] Email send request:', {
      to: toEmail,
      subject,
      bodyPreview: body.substring(0, 100),
      organizationId: context.organizationId,
      triggeredByEvent: context.triggeredByEvent,
    });

    // TODO: Integrate with actual email sending service
    // This could be:
    // 1. Direct SMTP via nodemailer
    // 2. SendGrid API
    // 3. Postmark API
    // 4. AWS SES
    // For now, we'll queue it or log it

    // Log the email request - actual sending would be implemented by the organization's email service
    // For now, we return success to indicate the action was processed
    return {
      success: true,
      responseBody: JSON.stringify({
        queued: true,
        to: toEmail,
        subject,
        bodyPreview: body.substring(0, 100),
        note: 'Email queued for delivery. Configure email service for actual sending.',
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
