/**
 * Deal Actions
 *
 * Handles internal actions related to deals:
 * - create_deal: Create a new deal
 * - move_deal_stage: Move a deal to a different stage
 */

import { db } from '../../../../db';
import { deals, dealContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { ExecutionResult } from '../../../types';
import type { DestinationType } from '@shared/schema';
import type { ActionContext, CreateDealConfig, MoveDealStageConfig } from '../types';
import { resolveTemplate, getNestedValue } from '../types';

export async function executeDealActions(
  destinationType: DestinationType,
  config: Record<string, any>,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  switch (destinationType) {
    case 'internal_create_deal':
      return executeCreateDeal(config as CreateDealConfig, mappedPayload, eventPayload, context);
    case 'internal_move_deal_stage':
      return executeMoveDealStage(config as MoveDealStageConfig, mappedPayload, eventPayload, context);
    default:
      return { success: false, error: `Unknown deal action: ${destinationType}` };
  }
}

/**
 * Create a new deal
 */
async function executeCreateDeal(
  config: CreateDealConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  // Resolve template variables in name
  const name = resolveTemplate(config.name, eventPayload);

  if (!name) {
    return { success: false, error: 'Deal name is required' };
  }

  if (!config.pipelineId || !config.stageId) {
    return { success: false, error: 'Pipeline and stage are required' };
  }

  // Determine deal value
  let value: string | undefined;
  if (config.valueField) {
    const numValue = getNestedValue(eventPayload, config.valueField);
    if (numValue !== undefined) {
      value = String(numValue);
    }
  } else if (config.value !== undefined) {
    value = String(config.value);
  }

  // Get contact ID if linking
  let contactId: number | null = null;
  if (config.linkToContact !== false) {
    if (config.contactIdField) {
      contactId = getNestedValue(eventPayload, config.contactIdField);
    } else {
      contactId = getNestedValue(eventPayload, 'data.contact_id') ||
                  getNestedValue(mappedPayload, 'contact_id');
    }
  }

  try {
    const [deal] = await db.insert(deals)
      .values({
        organizationId: context.organizationId,
        name,
        amount: value,
        pipelineId: config.pipelineId,
        stageId: config.stageId,
        ownerId: config.ownerId || context.userId,
        customProperties: config.customFields || {},
        source: 'automation',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: deals.id });

    // Link deal to contact if applicable
    if (contactId) {
      await db.insert(dealContacts)
        .values({
          dealId: deal.id,
          contactId,
          role: 'primary',
        })
        .onConflictDoNothing();
    }

    return {
      success: true,
      externalId: String(deal.id),
      responseBody: JSON.stringify({
        created: true,
        dealId: deal.id,
        name,
        value,
        linkedContactId: contactId,
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Move a deal to a different stage
 */
async function executeMoveDealStage(
  config: MoveDealStageConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  // Get the deal ID from the event payload
  let dealId: number | null = null;

  if (config.dealIdField) {
    dealId = getNestedValue(eventPayload, config.dealIdField);
  } else {
    dealId = getNestedValue(eventPayload, 'data.deal_id') ||
             getNestedValue(mappedPayload, 'deal_id');
  }

  if (!dealId) {
    return { success: false, error: 'Deal ID could not be determined from event payload' };
  }

  if (!config.stageId) {
    return { success: false, error: 'Target stage ID is required' };
  }

  try {
    const updateValues: any = {
      stageId: config.stageId,
      updatedAt: new Date(),
    };

    // Update pipeline if specified
    if (config.pipelineId) {
      updateValues.pipelineId = config.pipelineId;
    }

    const result = await db.update(deals)
      .set(updateValues)
      .where(and(
        eq(deals.id, dealId),
        eq(deals.organizationId, context.organizationId)
      ))
      .returning({ id: deals.id, name: deals.name });

    if (result.length === 0) {
      return { success: false, error: 'Deal not found or access denied' };
    }

    return {
      success: true,
      externalId: String(dealId),
      responseBody: JSON.stringify({
        updated: true,
        dealId,
        dealName: result[0].name,
        newStageId: config.stageId,
        stageName: config.stageName,
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
