import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, Plus } from "lucide-react";

export type FilterFieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';

export interface FilterField {
  id: string;
  label: string;
  type: FilterFieldType;
  options?: { value: string; label: string }[];
}

export interface FilterCondition {
  id: string;
  fieldId: string;
  operator: string;
  value: any;
}

export interface FilterBuilderProps {
  fields: FilterField[];
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  activeFilterCount: number;
}

const TEXT_OPERATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'notContains', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Does not equal' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'isEmpty', label: 'Is empty' },
  { value: 'isNotEmpty', label: 'Is not empty' },
];

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Does not equal' },
  { value: 'greaterThan', label: 'Greater than' },
  { value: 'lessThan', label: 'Less than' },
  { value: 'greaterThanOrEqual', label: 'Greater than or equal' },
  { value: 'lessThanOrEqual', label: 'Less than or equal' },
  { value: 'isEmpty', label: 'Is empty' },
  { value: 'isNotEmpty', label: 'Is not empty' },
];

const DATE_OPERATORS = [
  { value: 'equals', label: 'Is' },
  { value: 'before', label: 'Is before' },
  { value: 'after', label: 'Is after' },
  { value: 'between', label: 'Is between' },
  { value: 'isEmpty', label: 'Is empty' },
  { value: 'isNotEmpty', label: 'Is not empty' },
];

const SELECT_OPERATORS = [
  { value: 'equals', label: 'Is' },
  { value: 'notEquals', label: 'Is not' },
  { value: 'isEmpty', label: 'Is empty' },
  { value: 'isNotEmpty', label: 'Is not empty' },
];

const MULTISELECT_OPERATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'notContains', label: 'Does not contain' },
  { value: 'isEmpty', label: 'Is empty' },
  { value: 'isNotEmpty', label: 'Is not empty' },
];

const BOOLEAN_OPERATORS = [
  { value: 'equals', label: 'Is' },
];

function getOperators(fieldType: FilterFieldType) {
  switch (fieldType) {
    case 'text':
      return TEXT_OPERATORS;
    case 'number':
      return NUMBER_OPERATORS;
    case 'date':
      return DATE_OPERATORS;
    case 'select':
      return SELECT_OPERATORS;
    case 'multiselect':
      return MULTISELECT_OPERATORS;
    case 'boolean':
      return BOOLEAN_OPERATORS;
    default:
      return TEXT_OPERATORS;
  }
}

function needsValue(operator: string): boolean {
  return !['isEmpty', 'isNotEmpty'].includes(operator);
}

export function FilterBuilder({
  fields,
  conditions,
  onChange,
  activeFilterCount,
}: FilterBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Local state for editing - only applied when user clicks "Apply"
  const [localConditions, setLocalConditions] = useState<FilterCondition[]>(conditions);

  // Sync local state when popover opens or external conditions change while closed
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLocalConditions(conditions);
    }
    setIsOpen(open);
  };

  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: Date.now().toString(),
      fieldId: fields[0]?.id || '',
      operator: 'contains',
      value: '',
    };
    setLocalConditions([...localConditions, newCondition]);
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setLocalConditions(localConditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCondition = (id: string) => {
    setLocalConditions(localConditions.filter(c => c.id !== id));
  };

  const clearAll = () => {
    setLocalConditions([]);
  };

  const applyFilters = () => {
    onChange(localConditions);
    setIsOpen(false);
  };

  const getField = (fieldId: string) => fields.find(f => f.id === fieldId);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-4" align="end">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900">Filters</h4>
          {localConditions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-7 text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {localConditions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No filters applied. Click "Add filter" to get started.
            </div>
          ) : (
            localConditions.map((condition) => {
              const field = getField(condition.fieldId);
              if (!field) return null;

              const operators = getOperators(field.type);
              const showValue = needsValue(condition.operator);

              return (
                <div key={condition.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 space-y-2">
                    {/* Field selector */}
                    <Select
                      value={condition.fieldId}
                      onValueChange={(value) => {
                        const newField = getField(value);
                        if (newField) {
                          updateCondition(condition.id, {
                            fieldId: value,
                            operator: getOperators(newField.type)[0].value,
                            value: '',
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2">
                      {/* Operator selector */}
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => updateCondition(condition.id, { operator: value })}
                      >
                        <SelectTrigger className="h-8 text-sm bg-white w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Value input */}
                      {showValue && (
                        <div className="flex-1">
                          {field.type === 'select' ? (
                            <Select
                              value={condition.value || ''}
                              onValueChange={(value) => updateCondition(condition.id, { value })}
                            >
                              <SelectTrigger className="h-8 text-sm bg-white">
                                <SelectValue placeholder="Select value..." />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options?.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.type === 'multiselect' ? (
                            <Select
                              value={condition.value || ''}
                              onValueChange={(value) => updateCondition(condition.id, { value })}
                            >
                              <SelectTrigger className="h-8 text-sm bg-white">
                                <SelectValue placeholder="Select value..." />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options?.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.type === 'boolean' ? (
                            <Select
                              value={condition.value?.toString() || ''}
                              onValueChange={(value) => updateCondition(condition.id, { value: value === 'true' })}
                            >
                              <SelectTrigger className="h-8 text-sm bg-white">
                                <SelectValue placeholder="Select value..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Yes</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : field.type === 'date' ? (
                            <Input
                              type="date"
                              value={condition.value || ''}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                              className="h-8 text-sm"
                            />
                          ) : field.type === 'number' ? (
                            <Input
                              type="number"
                              value={condition.value || ''}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                              placeholder="Enter value..."
                              className="h-8 text-sm"
                            />
                          ) : (
                            <Input
                              value={condition.value || ''}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                              placeholder="Enter value..."
                              className="h-8 text-sm"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(condition.id)}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="flex-1"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add filter
          </Button>
          <Button
            size="sm"
            onClick={applyFilters}
            className="flex-1"
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
