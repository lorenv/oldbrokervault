import { useEffect, useState } from "react";
import { FilterBuilder, FilterField, FilterCondition } from "./filter-builder";
import type { DealFilters } from "@/hooks/use-deal-filters";

interface DealsFilterBuilderProps {
  filters: DealFilters;
  onFilterChange: <K extends keyof DealFilters>(key: K, value: DealFilters[K]) => void;
  onClearFilters: () => void;
  companies: { id: number; name: string }[];
  owners: { id: number; name: string }[];
  customFields?: any[];
  activeFilterCount: number;
}

// Define available filter fields for deals
const getFilterFields = (
  companies: { id: number; name: string }[],
  owners: { id: number; name: string }[]
): FilterField[] => [
  { id: 'dealName', label: 'Deal Name', type: 'text' },
  { id: 'amount', label: 'Value', type: 'number' },
  { id: 'closeDate', label: 'Close Date', type: 'date' },
  { id: 'createdDate', label: 'Created Date', type: 'date' },
  {
    id: 'company',
    label: 'Company',
    type: 'select',
    options: companies.filter(c => c.id != null).map(c => ({ value: c.id.toString(), label: c.name }))
  },
  {
    id: 'owner',
    label: 'Owner',
    type: 'select',
    options: owners.filter(o => o.id != null).map(o => ({ value: o.id.toString(), label: o.name }))
  },
  {
    id: 'priority',
    label: 'Priority',
    type: 'select',
    options: [
      { value: 'hot', label: 'Hot' },
      { value: 'warm', label: 'Warm' },
      { value: 'cold', label: 'Cold' },
    ]
  },
  {
    id: 'source',
    label: 'Source',
    type: 'text'
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'won', label: 'Won' },
      { value: 'lost', label: 'Lost' },
    ]
  },
];

// Convert existing filters to filter conditions
function filtersToConditions(filters: DealFilters): FilterCondition[] {
  const conditions: FilterCondition[] = [];

  if (filters.amountMin !== null) {
    conditions.push({
      id: `amount-min-${Date.now()}`,
      fieldId: 'amount',
      operator: 'greaterThanOrEqual',
      value: filters.amountMin.toString(),
    });
  }

  if (filters.amountMax !== null) {
    conditions.push({
      id: `amount-max-${Date.now()}`,
      fieldId: 'amount',
      operator: 'lessThanOrEqual',
      value: filters.amountMax.toString(),
    });
  }

  if (filters.closeDateFrom) {
    conditions.push({
      id: `closeDate-from-${Date.now()}`,
      fieldId: 'closeDate',
      operator: 'after',
      value: filters.closeDateFrom,
    });
  }

  if (filters.closeDateTo) {
    conditions.push({
      id: `closeDate-to-${Date.now()}`,
      fieldId: 'closeDate',
      operator: 'before',
      value: filters.closeDateTo,
    });
  }

  if (filters.createdFrom) {
    conditions.push({
      id: `createdDate-from-${Date.now()}`,
      fieldId: 'createdDate',
      operator: 'after',
      value: filters.createdFrom,
    });
  }

  if (filters.createdTo) {
    conditions.push({
      id: `createdDate-to-${Date.now()}`,
      fieldId: 'createdDate',
      operator: 'before',
      value: filters.createdTo,
    });
  }

  if (filters.companies.length > 0) {
    filters.companies.forEach((companyId) => {
      conditions.push({
        id: `company-${companyId}-${Date.now()}`,
        fieldId: 'company',
        operator: 'equals',
        value: companyId.toString(),
      });
    });
  }

  if (filters.owners.length > 0) {
    filters.owners.forEach((ownerId) => {
      conditions.push({
        id: `owner-${ownerId}-${Date.now()}`,
        fieldId: 'owner',
        operator: 'equals',
        value: ownerId.toString(),
      });
    });
  }

  if (filters.priority.length > 0) {
    filters.priority.forEach((priority) => {
      conditions.push({
        id: `priority-${priority}-${Date.now()}`,
        fieldId: 'priority',
        operator: 'equals',
        value: priority,
      });
    });
  }

  return conditions;
}

// Apply filter conditions to deal filters
function applyConditionsToFilters(
  conditions: FilterCondition[],
  onFilterChange: <K extends keyof DealFilters>(key: K, value: DealFilters[K]) => void
) {
  // Reset relevant filters first
  onFilterChange('amountMin', null);
  onFilterChange('amountMax', null);
  onFilterChange('closeDateFrom', null);
  onFilterChange('closeDateTo', null);
  onFilterChange('createdFrom', null);
  onFilterChange('createdTo', null);
  onFilterChange('companies', []);
  onFilterChange('owners', []);
  onFilterChange('priority', []);

  // Apply each condition
  conditions.forEach((condition) => {
    const value = condition.value;

    switch (condition.fieldId) {
      case 'amount':
        if (condition.operator === 'greaterThanOrEqual' || condition.operator === 'greaterThan') {
          onFilterChange('amountMin', parseFloat(value) || null);
        } else if (condition.operator === 'lessThanOrEqual' || condition.operator === 'lessThan') {
          onFilterChange('amountMax', parseFloat(value) || null);
        } else if (condition.operator === 'equals') {
          onFilterChange('amountMin', parseFloat(value) || null);
          onFilterChange('amountMax', parseFloat(value) || null);
        }
        break;

      case 'closeDate':
        if (condition.operator === 'after') {
          onFilterChange('closeDateFrom', value);
        } else if (condition.operator === 'before') {
          onFilterChange('closeDateTo', value);
        } else if (condition.operator === 'equals') {
          onFilterChange('closeDateFrom', value);
          onFilterChange('closeDateTo', value);
        }
        break;

      case 'createdDate':
        if (condition.operator === 'after') {
          onFilterChange('createdFrom', value);
        } else if (condition.operator === 'before') {
          onFilterChange('createdTo', value);
        } else if (condition.operator === 'equals') {
          onFilterChange('createdFrom', value);
          onFilterChange('createdTo', value);
        }
        break;

      case 'company':
        if (condition.operator === 'equals') {
          onFilterChange('companies', [parseInt(value)]);
        }
        break;

      case 'owner':
        if (condition.operator === 'equals') {
          onFilterChange('owners', [parseInt(value)]);
        }
        break;

      case 'priority':
        if (condition.operator === 'equals') {
          onFilterChange('priority', [value]);
        }
        break;

      case 'status':
        if (condition.operator === 'equals') {
          onFilterChange('status', value as any);
        }
        break;
    }
  });
}

export function DealsFilterBuilderIntegration({
  filters,
  onFilterChange,
  onClearFilters,
  companies,
  owners,
  activeFilterCount,
}: DealsFilterBuilderProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const filterFields = getFilterFields(companies, owners);

  // Initialize conditions from existing filters
  useEffect(() => {
    setConditions(filtersToConditions(filters));
  }, []); // Only run once on mount

  const handleConditionsChange = (newConditions: FilterCondition[]) => {
    setConditions(newConditions);

    if (newConditions.length === 0) {
      onClearFilters();
    } else {
      applyConditionsToFilters(newConditions, onFilterChange);
    }
  };

  return (
    <FilterBuilder
      fields={filterFields}
      conditions={conditions}
      onChange={handleConditionsChange}
      activeFilterCount={activeFilterCount}
    />
  );
}
