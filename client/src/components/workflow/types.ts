/**
 * Workflow Builder Types
 */

export interface TriggerConfig {
  type: 'webhook' | 'event' | 'schedule';
  name: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface ActionConfig {
  type: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface FieldMapping {
  destField: string;
  type: 'field' | 'constant' | 'template';
  sourceField?: string;
  value?: string;
  template?: string;
}

export interface DestinationField {
  name: string;
  label: string;
  required: boolean;
  type?: 'string' | 'email' | 'number' | 'date' | 'textarea';
  description?: string;
}

export interface FlattenedField {
  path: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';
}

export type CaptureStatus = 'idle' | 'waiting' | 'received' | 'timeout';
