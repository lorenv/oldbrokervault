/**
 * VisualFieldMapper
 *
 * The core visual mapping interface showing source data on left
 * and destination fields on right with drag-and-drop or click-to-map.
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayloadFieldPicker } from "./payload-field-picker";
import type { FieldMapping, DestinationField } from "./types";
import {
  ArrowRight,
  Link2,
  Unlink,
  Sparkles,
  Type,
  Hash,
  Mail,
  Calendar,
  FileText,
  Check,
  X,
} from "lucide-react";

interface VisualFieldMapperProps {
  capturedPayload: Record<string, any>;
  destinationFields: DestinationField[];
  mappings: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
  className?: string;
}

// Flatten a nested object into dot-notation paths
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, path));
    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] !== 'object') {
      result[path] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      // For object arrays, show first item's fields
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(result, flattenObject(item, `${path}[${index}]`));
        } else {
          result[`${path}[${index}]`] = item;
        }
      });
    } else {
      result[path] = value;
    }
  }

  return result;
}

// Get value at path from object
function getValueAtPath(obj: Record<string, any>, path: string): any {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

// Auto-suggest mappings based on field name similarity
function autoSuggestMappings(
  payload: Record<string, any>,
  destinationFields: DestinationField[]
): FieldMapping[] {
  const flattened = flattenObject(payload);
  const flatKeys = Object.keys(flattened).map(k => k.toLowerCase());

  return destinationFields.map(field => {
    const fieldLower = field.name.toLowerCase();

    // Try exact match
    const exactIdx = flatKeys.findIndex(k =>
      k === fieldLower || k.endsWith(`.${fieldLower}`)
    );
    if (exactIdx >= 0) {
      return {
        destField: field.name,
        type: 'field' as const,
        sourceField: Object.keys(flattened)[exactIdx],
      };
    }

    // Try common variations
    const variations: Record<string, string[]> = {
      email: ['email', 'e_mail', 'emailaddress', 'email_address', 'mail'],
      firstName: ['firstname', 'first_name', 'fname', 'given_name', 'givenname'],
      lastName: ['lastname', 'last_name', 'lname', 'family_name', 'surname', 'familyname'],
      name: ['name', 'fullname', 'full_name', 'displayname', 'display_name'],
      phone: ['phone', 'telephone', 'tel', 'phone_number', 'phonenumber', 'mobile'],
      company: ['company', 'company_name', 'companyname', 'organization', 'org'],
      title: ['title', 'job_title', 'jobtitle', 'position', 'role'],
      amount: ['amount', 'value', 'price', 'total', 'sum'],
    };

    const fieldVariations = variations[field.name] || [];
    for (const variation of fieldVariations) {
      const matchIdx = flatKeys.findIndex(k =>
        k === variation || k.endsWith(`.${variation}`)
      );
      if (matchIdx >= 0) {
        return {
          destField: field.name,
          type: 'field' as const,
          sourceField: Object.keys(flattened)[matchIdx],
        };
      }
    }

    // No match found
    return {
      destField: field.name,
      type: 'field' as const,
      sourceField: '',
    };
  });
}

// Get icon for field type
function getFieldIcon(type?: string): React.ReactNode {
  switch (type) {
    case 'email':
      return <Mail className="h-4 w-4 text-gray-400" />;
    case 'number':
      return <Hash className="h-4 w-4 text-gray-400" />;
    case 'date':
      return <Calendar className="h-4 w-4 text-gray-400" />;
    case 'textarea':
      return <FileText className="h-4 w-4 text-gray-400" />;
    default:
      return <Type className="h-4 w-4 text-gray-400" />;
  }
}

export function VisualFieldMapper({
  capturedPayload,
  destinationFields,
  mappings,
  onMappingsChange,
  className,
}: VisualFieldMapperProps) {
  const [selectedDestField, setSelectedDestField] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const flattened = flattenObject(capturedPayload);

  // Initialize with auto-suggested mappings if empty
  useEffect(() => {
    if (mappings.length === 0 && destinationFields.length > 0) {
      const suggested = autoSuggestMappings(capturedPayload, destinationFields);
      onMappingsChange(suggested);
    }
  }, []);

  // Get current mapping for a destination field
  const getMapping = (fieldName: string): FieldMapping | undefined => {
    return mappings.find(m => m.destField === fieldName);
  };

  // Update a single mapping
  const updateMapping = (fieldName: string, sourceField: string) => {
    const existing = mappings.filter(m => m.destField !== fieldName);
    const newMapping: FieldMapping = {
      destField: fieldName,
      type: 'field',
      sourceField,
    };
    onMappingsChange([...existing, newMapping]);
    setSelectedDestField(null);
    setShowPicker(false);
  };

  // Clear a mapping
  const clearMapping = (fieldName: string) => {
    const updated = mappings.map(m =>
      m.destField === fieldName ? { ...m, sourceField: '' } : m
    );
    onMappingsChange(updated);
  };

  // Count mapped fields
  const mappedCount = mappings.filter(m => m.sourceField && m.sourceField.trim() !== '').length;
  const requiredFields = destinationFields.filter(f => f.required);
  const requiredMapped = requiredFields.filter(f => {
    const m = getMapping(f.name);
    return m?.sourceField && m.sourceField.trim() !== '';
  }).length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-gray-900">Field Mappings</h4>
          <p className="text-xs text-gray-500">
            {mappedCount} of {destinationFields.length} fields mapped
            {requiredFields.length > 0 && (
              <span className={requiredMapped < requiredFields.length ? "text-orange-500" : "text-green-500"}>
                {" "}({requiredMapped}/{requiredFields.length} required)
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const suggested = autoSuggestMappings(capturedPayload, destinationFields);
            onMappingsChange(suggested);
          }}
          className="gap-1"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Auto-map
        </Button>
      </div>

      {/* Field mapping rows */}
      <div className="space-y-2">
        {destinationFields.map((field) => {
          const mapping = getMapping(field.name);
          const isMapped = mapping?.sourceField && mapping.sourceField.trim() !== '';
          const sourceValue = isMapped ? getValueAtPath(capturedPayload, mapping!.sourceField!) : undefined;
          const isSelected = selectedDestField === field.name;

          return (
            <div
              key={field.name}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-all",
                isMapped ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200",
                isSelected && "ring-2 ring-blue-500"
              )}
            >
              {/* Source field selector */}
              <div className="flex-1 min-w-0">
                <Select
                  value={mapping?.sourceField || '_none_'}
                  onValueChange={(value) => {
                    if (value === '_none_') {
                      clearMapping(field.name);
                    } else if (value === '_picker_') {
                      setSelectedDestField(field.name);
                      setShowPicker(true);
                    } else {
                      updateMapping(field.name, value);
                    }
                  }}
                >
                  <SelectTrigger className={cn(
                    "h-9",
                    !isMapped && "text-gray-400"
                  )}>
                    <SelectValue placeholder="Select source field...">
                      {isMapped ? (
                        <span className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                            {mapping!.sourceField}
                          </code>
                          {sourceValue !== undefined && (
                            <span className="text-xs text-gray-400 truncate max-w-[100px]">
                              = {typeof sourceValue === 'string' ? `"${sourceValue}"` : String(sourceValue)}
                            </span>
                          )}
                        </span>
                      ) : (
                        "Not mapped"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">
                      <span className="text-gray-400">Not mapped</span>
                    </SelectItem>
                    <SelectItem value="_picker_">
                      <span className="text-blue-600">Browse all fields...</span>
                    </SelectItem>
                    <div className="border-t my-1" />
                    {Object.entries(flattened).slice(0, 20).map(([path, value]) => (
                      <SelectItem key={path} value={path}>
                        <span className="flex items-center gap-2">
                          <code className="text-xs">{path}</code>
                          <span className="text-xs text-gray-400 truncate max-w-[100px]">
                            {typeof value === 'string' ? `"${value}"` : String(value)}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0">
                <ArrowRight className={cn(
                  "h-4 w-4",
                  isMapped ? "text-green-500" : "text-gray-300"
                )} />
              </div>

              {/* Destination field */}
              <div className="flex items-center gap-2 min-w-[140px]">
                {getFieldIcon(field.type)}
                <div>
                  <div className="text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </div>
                  {field.description && (
                    <div className="text-xs text-gray-400">{field.description}</div>
                  )}
                </div>
              </div>

              {/* Status icon */}
              <div className="flex-shrink-0 w-6">
                {isMapped ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : field.required ? (
                  <X className="h-5 w-5 text-orange-400" />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Field picker modal */}
      {showPicker && selectedDestField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-medium text-gray-900">
                Select source for "{destinationFields.find(f => f.name === selectedDestField)?.label}"
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Click a field to map it
              </p>
            </div>
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              <PayloadFieldPicker
                payload={capturedPayload}
                selectedPath={getMapping(selectedDestField)?.sourceField}
                onSelect={(path) => {
                  updateMapping(selectedDestField, path);
                }}
              />
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPicker(false);
                  setSelectedDestField(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
