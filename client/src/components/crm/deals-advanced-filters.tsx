import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Filter, X, Plus } from "lucide-react";
import type { DealFilters, CustomFieldFilterValue } from "@/hooks/use-deal-filters";

interface Owner {
  id: number;
  name: string;
  profilePhoto?: string | null;
}

interface CustomField {
  id: number;
  name: string;
  label: string;
  fieldType: string;
  options?: { value: string; label: string }[];
}

interface AdvancedFiltersProps {
  filters: DealFilters;
  onFilterChange: <K extends keyof DealFilters>(key: K, value: DealFilters[K]) => void;
  onCustomFieldFilterChange: (fieldName: string, value: CustomFieldFilterValue) => void;
  onClearFilters: () => void;
  owners: Owner[];
  customFields?: CustomField[];
  activeFilterCount: number;
}

export function DealsAdvancedFilters({
  filters,
  onFilterChange,
  onCustomFieldFilterChange,
  onClearFilters,
  owners,
  customFields = [],
  activeFilterCount,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Advanced
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
            {isOpen ? (
              <ChevronUp className="h-3.5 w-3.5 ml-1" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            )}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-3 overflow-visible">
        <div className="border rounded-lg p-4 bg-muted/50 space-y-4 relative z-10">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Advanced Filters</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-7 text-xs text-gray-500"
              >
                <X className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
            {/* Value Range */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Value Range</Label>
              <div className="flex items-center gap-2">
                <CurrencyInput
                  placeholder="$0"
                  value={filters.amountMin ?? ''}
                  onValueChange={(num) => onFilterChange('amountMin', num)}
                  className="h-8 text-sm bg-background"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <CurrencyInput
                  placeholder="$0"
                  value={filters.amountMax ?? ''}
                  onValueChange={(num) => onFilterChange('amountMax', num)}
                  className="h-8 text-sm bg-background"
                />
              </div>
            </div>

            {/* Close Date Range */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Close Date Range</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filters.closeDateFrom ?? ''}
                  onChange={(e) => onFilterChange('closeDateFrom', e.target.value || null)}
                  className="h-8 text-sm bg-background"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={filters.closeDateTo ?? ''}
                  onChange={(e) => onFilterChange('closeDateTo', e.target.value || null)}
                  className="h-8 text-sm bg-background"
                />
              </div>
            </div>

            {/* Created Date Range */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Created Date Range</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filters.createdFrom ?? ''}
                  onChange={(e) => onFilterChange('createdFrom', e.target.value || null)}
                  className="h-8 text-sm bg-background"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={filters.createdTo ?? ''}
                  onChange={(e) => onFilterChange('createdTo', e.target.value || null)}
                  className="h-8 text-sm bg-background"
                />
              </div>
            </div>

            {/* Owner Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Owner</Label>
              <Select
                value={filters.owners.length === 1 ? filters.owners[0].toString() : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    onFilterChange('owners', []);
                  } else {
                    onFilterChange('owners', [parseInt(value)]);
                  }
                }}
              >
                <SelectTrigger className="h-8 text-sm bg-background">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-50 max-h-60">
                  <SelectItem value="all">All Owners</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id.toString()}>
                      <span className="flex items-center gap-2">
                        {owner.profilePhoto ? (
                          <img
                            src={owner.profilePhoto}
                            alt={owner.name}
                            className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-blue-600">
                              {owner.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-gray-900">{owner.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
              <div className="flex flex-wrap gap-1.5">
                {priorities.map((priority) => {
                  const isSelected = filters.priority.includes(priority.value);
                  return (
                    <label
                      key={priority.value}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-background border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onFilterChange('priority', [...filters.priority, priority.value]);
                          } else {
                            onFilterChange('priority', filters.priority.filter(p => p !== priority.value));
                          }
                        }}
                        className="h-3 w-3"
                      />
                      {priority.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Custom Fields Section */}
          {customFields.length > 0 && (
            <div className="border-t pt-4">
              <h5 className="text-xs font-medium text-muted-foreground mb-3">Custom Fields</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
                {customFields.map((field) => {
                  const currentValue = filters.customFields[field.name];

                  return (
                    <div key={field.id} className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
                      {field.fieldType === 'select' && field.options ? (
                        <Select
                          value={(currentValue as string) || ''}
                          onValueChange={(value) => {
                            onCustomFieldFilterChange(field.name, value || '');
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm bg-background">
                            <SelectValue placeholder={`Select ${field.label}`} />
                          </SelectTrigger>
                          <SelectContent position="popper" className="z-50 max-h-60">
                            <SelectItem value="">All</SelectItem>
                            {field.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.fieldType === 'multiselect' && field.options ? (
                        <div className="flex flex-wrap gap-1.5">
                          {field.options.map((option) => {
                            const selectedValues = (currentValue as string[]) || [];
                            const isSelected = selectedValues.includes(option.value);
                            return (
                              <label
                                key={option.value}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-background border-border text-muted-foreground hover:bg-accent'
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      onCustomFieldFilterChange(field.name, [...selectedValues, option.value]);
                                    } else {
                                      onCustomFieldFilterChange(field.name, selectedValues.filter(v => v !== option.value));
                                    }
                                  }}
                                  className="h-3 w-3"
                                />
                                {option.label}
                              </label>
                            );
                          })}
                        </div>
                      ) : field.fieldType === 'number' || field.fieldType === 'currency' ? (
                        <div className="flex items-center gap-2">
                          <CurrencyInput
                            placeholder="$0"
                            showPrefix={field.fieldType === 'currency'}
                            value={(currentValue as { min?: number; max?: number })?.min ?? ''}
                            onValueChange={(num) => {
                              const current = (currentValue as { min?: number; max?: number }) || {};
                              onCustomFieldFilterChange(field.name, {
                                ...current,
                                min: num ?? undefined,
                              });
                            }}
                            className="h-8 text-sm bg-background"
                          />
                          <span className="text-muted-foreground text-sm">to</span>
                          <CurrencyInput
                            placeholder="$0"
                            showPrefix={field.fieldType === 'currency'}
                            value={(currentValue as { min?: number; max?: number })?.max ?? ''}
                            onValueChange={(num) => {
                              const current = (currentValue as { min?: number; max?: number }) || {};
                              onCustomFieldFilterChange(field.name, {
                                ...current,
                                max: num ?? undefined,
                              });
                            }}
                            className="h-8 text-sm bg-background"
                          />
                        </div>
                      ) : field.fieldType === 'date' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={(currentValue as { from?: string; to?: string })?.from ?? ''}
                            onChange={(e) => {
                              const current = (currentValue as { from?: string; to?: string }) || {};
                              onCustomFieldFilterChange(field.name, {
                                ...current,
                                from: e.target.value || undefined,
                              });
                            }}
                            className="h-8 text-sm bg-background"
                          />
                          <span className="text-muted-foreground text-sm">to</span>
                          <Input
                            type="date"
                            value={(currentValue as { from?: string; to?: string })?.to ?? ''}
                            onChange={(e) => {
                              const current = (currentValue as { from?: string; to?: string }) || {};
                              onCustomFieldFilterChange(field.name, {
                                ...current,
                                to: e.target.value || undefined,
                              });
                            }}
                            className="h-8 text-sm bg-background"
                          />
                        </div>
                      ) : field.fieldType === 'checkbox' ? (
                        <Select
                          value={currentValue === true ? 'true' : currentValue === false ? 'false' : ''}
                          onValueChange={(value) => {
                            onCustomFieldFilterChange(field.name, value === 'true' ? true : value === 'false' ? false : null);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm bg-background">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="z-50">
                            <SelectItem value="">Any</SelectItem>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="text"
                          placeholder={`Filter by ${field.label}`}
                          value={(currentValue as string) || ''}
                          onChange={(e) => onCustomFieldFilterChange(field.name, e.target.value)}
                          className="h-8 text-sm bg-background"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
