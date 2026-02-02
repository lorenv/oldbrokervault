/**
 * WorkflowBuilder
 *
 * Main container component that renders the visual workflow flow:
 * Trigger Card → Connector → Action Card
 * with optional field mapping UI below.
 */

import { cn } from "@/lib/utils";
import { WorkflowTriggerCard } from "./workflow-trigger-card";
import { WorkflowActionCard } from "./workflow-action-card";
import { WorkflowConnector } from "./workflow-connector";
import { VisualFieldMapper } from "./visual-field-mapper";
import type { TriggerConfig, ActionConfig, FieldMapping, DestinationField } from "./types";

interface WorkflowBuilderProps {
  trigger: TriggerConfig;
  action: ActionConfig;
  fieldMappings: FieldMapping[];
  onMappingsChange?: (mappings: FieldMapping[]) => void;
  destinationFields?: DestinationField[];
  capturedPayload?: Record<string, any>;
  readonly?: boolean;
  showFieldMapper?: boolean;
  className?: string;
  status?: 'idle' | 'waiting' | 'received' | 'active';
}

export function WorkflowBuilder({
  trigger,
  action,
  fieldMappings,
  onMappingsChange,
  destinationFields = [],
  capturedPayload,
  readonly = false,
  showFieldMapper = true,
  className,
  status = 'idle',
}: WorkflowBuilderProps) {
  // Calculate mapped field count
  const mappedCount = fieldMappings.filter(
    m => m.sourceField && m.sourceField.trim() !== ''
  ).length;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Visual flow: Trigger → Action */}
      <div className="flex items-center justify-center py-4">
        <WorkflowTriggerCard
          type={trigger.type}
          name={trigger.name}
          description={trigger.description}
          icon={trigger.icon}
          status={status === 'waiting' ? 'waiting' : status === 'received' ? 'received' : status === 'active' ? 'active' : 'idle'}
        />

        <WorkflowConnector animated={status === 'waiting'} />

        <WorkflowActionCard
          type={action.type}
          label={action.label}
          description={action.description}
          mappedFieldCount={mappedCount}
          totalFieldCount={destinationFields.length}
        />
      </div>

      {/* Field mapping section */}
      {showFieldMapper && capturedPayload && destinationFields.length > 0 && !readonly && onMappingsChange && (
        <div className="border-t pt-6">
          <VisualFieldMapper
            capturedPayload={capturedPayload}
            destinationFields={destinationFields}
            mappings={fieldMappings}
            onMappingsChange={onMappingsChange}
          />
        </div>
      )}

      {/* Read-only summary */}
      {readonly && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Mapping Summary</h4>
          <div className="space-y-2">
            {fieldMappings
              .filter(m => m.sourceField && m.sourceField.trim() !== '')
              .map((mapping) => {
                const destField = destinationFields.find(f => f.name === mapping.destField);
                return (
                  <div
                    key={mapping.destField}
                    className="flex items-center gap-2 text-sm"
                  >
                    <code className="bg-white px-2 py-0.5 rounded border text-xs font-mono">
                      {mapping.sourceField}
                    </code>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-700">
                      {destField?.label || mapping.destField}
                    </span>
                  </div>
                );
              })}
            {mappedCount === 0 && (
              <p className="text-sm text-gray-400 italic">No fields mapped</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
