/**
 * Data Room Actions
 *
 * Handles internal actions related to data rooms and NDAs:
 * - grant_dataroom_access: Grant a user access to a data room
 * - send_nda: Send an NDA for signature
 */

import { db } from '../../../../db';
import { crmContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { ExecutionResult } from '../../../types';
import type { DestinationType } from '@shared/schema';
import type { ActionContext, GrantDataRoomAccessConfig, SendNdaConfig } from '../types';
import { resolveTemplate, getNestedValue } from '../types';

export async function executeDataRoomActions(
  destinationType: DestinationType,
  config: Record<string, any>,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  switch (destinationType) {
    case 'internal_grant_dataroom_access':
      return executeGrantDataRoomAccess(config as GrantDataRoomAccessConfig, mappedPayload, eventPayload, context);
    case 'internal_send_nda':
      return executeSendNda(config as SendNdaConfig, mappedPayload, eventPayload, context);
    default:
      return { success: false, error: `Unknown data room action: ${destinationType}` };
  }
}

/**
 * Grant access to a data room
 */
async function executeGrantDataRoomAccess(
  config: GrantDataRoomAccessConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  // Determine data room ID
  let dataRoomId: number | undefined = config.dataRoomId;
  if (!dataRoomId && config.dataRoomIdField) {
    dataRoomId = getNestedValue(eventPayload, config.dataRoomIdField);
  }

  if (!dataRoomId) {
    return { success: false, error: 'Data room ID is required' };
  }

  // Determine recipient email
  let email: string;
  switch (config.emailType) {
    case 'contact_email':
      const contactId = getNestedValue(eventPayload, 'data.contact_id');
      if (contactId) {
        const contact = await db.query.crmContacts.findFirst({
          where: and(
            eq(crmContacts.id, contactId),
            eq(crmContacts.organizationId, context.organizationId)
          ),
          columns: { email: true },
        });
        email = contact?.email || '';
      } else {
        email = getNestedValue(eventPayload, 'data.contact_email') ||
                getNestedValue(eventPayload, 'data.signer_email') ||
                getNestedValue(eventPayload, 'data.email') || '';
      }
      break;

    case 'template':
      email = resolveTemplate(config.email, eventPayload);
      break;

    case 'static':
    default:
      email = config.email;
  }

  if (!email) {
    return { success: false, error: 'Recipient email could not be determined' };
  }

  try {
    // Calculate expiration date if specified
    let expiresAt: Date | undefined;
    if (config.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + config.expiresInDays);
    }

    // Log the data room access grant
    // In a full implementation, this would:
    // 1. Check if the data room exists
    // 2. Create an invitation or access record
    // 3. Optionally send an email invitation
    console.log('[DataRoomAction] Granting data room access:', {
      dataRoomId,
      email,
      accessLevel: config.accessLevel,
      expiresAt,
      sendInviteEmail: config.sendInviteEmail,
      organizationId: context.organizationId,
    });

    // TODO: Implement actual data room invitation logic
    // This would involve:
    // - Looking up or creating a data room invitation record
    // - Sending an invite email if requested

    return {
      success: true,
      responseBody: JSON.stringify({
        granted: true,
        dataRoomId,
        email,
        accessLevel: config.accessLevel,
        expiresAt: expiresAt?.toISOString(),
        note: 'Data room access grant logged (implementation pending)',
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send an NDA for signature
 */
async function executeSendNda(
  config: SendNdaConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  if (!config.templateId) {
    return { success: false, error: 'NDA template ID is required' };
  }

  // Determine recipient email
  let email: string;
  switch (config.recipientEmailType) {
    case 'contact_email':
      const contactId = getNestedValue(eventPayload, 'data.contact_id');
      if (contactId) {
        const contact = await db.query.crmContacts.findFirst({
          where: and(
            eq(crmContacts.id, contactId),
            eq(crmContacts.organizationId, context.organizationId)
          ),
          columns: { email: true, firstName: true, lastName: true },
        });
        email = contact?.email || '';
        // Use contact name if recipient name not specified
        if (!config.recipientName && contact) {
          config.recipientName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
        }
      } else {
        email = getNestedValue(eventPayload, 'data.contact_email') ||
                getNestedValue(eventPayload, 'data.signer_email') ||
                getNestedValue(eventPayload, 'data.email') || '';
      }
      break;

    case 'template':
      email = resolveTemplate(config.recipientEmail, eventPayload);
      break;

    case 'static':
    default:
      email = config.recipientEmail;
  }

  if (!email) {
    return { success: false, error: 'Recipient email could not be determined' };
  }

  // Get contact ID for linking
  let linkedContactId: number | null = null;
  if (config.linkToContact !== false) {
    if (config.contactIdField) {
      linkedContactId = getNestedValue(eventPayload, config.contactIdField);
    } else {
      linkedContactId = getNestedValue(eventPayload, 'data.contact_id') ||
                        getNestedValue(mappedPayload, 'contact_id');
    }
  }

  try {
    // Log the NDA send request
    // In a full implementation, this would:
    // 1. Fetch the NDA template
    // 2. Create an NDA document instance
    // 3. Send it via eSignature service (DocuSign, etc.)
    console.log('[DataRoomAction] Sending NDA:', {
      templateId: config.templateId,
      recipientEmail: email,
      recipientName: config.recipientName,
      linkedContactId,
      customFields: config.customFields,
      organizationId: context.organizationId,
    });

    // TODO: Implement actual NDA sending logic
    // This would involve:
    // - Creating an NDA document record
    // - Integrating with eSignature service
    // - Tracking the signature status

    return {
      success: true,
      responseBody: JSON.stringify({
        sent: true,
        templateId: config.templateId,
        recipientEmail: email,
        recipientName: config.recipientName,
        linkedContactId,
        note: 'NDA send request logged (implementation pending)',
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
