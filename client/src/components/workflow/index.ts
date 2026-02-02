/**
 * Workflow Builder Components
 *
 * Visual components for building automation workflows with
 * trigger -> action flow visualization and field mapping.
 */

export { WorkflowBuilder } from './workflow-builder';
export { WorkflowTriggerCard } from './workflow-trigger-card';
export { WorkflowActionCard } from './workflow-action-card';
export { WorkflowConnector } from './workflow-connector';
export { VisualFieldMapper } from './visual-field-mapper';
export { PayloadFieldPicker } from './payload-field-picker';
export { TestPayloadCapture } from './test-payload-capture';

// Types
export type { TriggerConfig, ActionConfig, FieldMapping, DestinationField } from './types';
