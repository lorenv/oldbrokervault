import { useEffect, useState } from "react";
import { FilterBuilder, FilterField, FilterCondition } from "./filter-builder";
import type { CompanyFilters } from "./companies-advanced-filters";

interface CompaniesFilterBuilderProps {
  filters: CompanyFilters;
  updateFilter: <K extends keyof CompanyFilters>(key: K, value: CompanyFilters[K]) => void;
  clearFilters: () => void;
  activeFilterCount: number;
}

// Define available filter fields for companies
const getFilterFields = (): FilterField[] => [
  { id: 'name', label: 'Company Name', type: 'text' },
  {
    id: 'industry',
    label: 'Industry',
    type: 'select',
    options: [
      { value: 'Technology', label: 'Technology' },
      { value: 'Healthcare', label: 'Healthcare' },
      { value: 'Finance', label: 'Finance' },
      { value: 'Manufacturing', label: 'Manufacturing' },
      { value: 'Retail', label: 'Retail' },
      { value: 'Real Estate', label: 'Real Estate' },
      { value: 'Professional Services', label: 'Professional Services' },
      { value: 'Education', label: 'Education' },
      { value: 'Other', label: 'Other' },
    ]
  },
  { id: 'city', label: 'City', type: 'text' },
  { id: 'state', label: 'State', type: 'text' },
  { id: 'hasDeals', label: 'Has Deals', type: 'boolean' },
  { id: 'hasContacts', label: 'Has Contacts', type: 'boolean' },
  { id: 'createdDate', label: 'Created Date', type: 'date' },
];

// Convert existing filters to filter conditions
function filtersToConditions(filters: CompanyFilters): FilterCondition[] {
  const conditions: FilterCondition[] = [];

  if (filters.industry) {
    conditions.push({
      id: `industry-${Date.now()}`,
      fieldId: 'industry',
      operator: 'equals',
      value: filters.industry,
    });
  }

  if (filters.city) {
    conditions.push({
      id: `city-${Date.now()}`,
      fieldId: 'city',
      operator: 'contains',
      value: filters.city,
    });
  }

  if (filters.state) {
    conditions.push({
      id: `state-${Date.now()}`,
      fieldId: 'state',
      operator: 'contains',
      value: filters.state,
    });
  }

  if (filters.hasDeals !== null) {
    conditions.push({
      id: `hasDeals-${Date.now()}`,
      fieldId: 'hasDeals',
      operator: 'equals',
      value: filters.hasDeals,
    });
  }

  if (filters.hasContacts !== null) {
    conditions.push({
      id: `hasContacts-${Date.now()}`,
      fieldId: 'hasContacts',
      operator: 'equals',
      value: filters.hasContacts,
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

  return conditions;
}

// Apply filter conditions to company filters
function applyConditionsToFilters(
  conditions: FilterCondition[],
  updateFilter: <K extends keyof CompanyFilters>(key: K, value: CompanyFilters[K]) => void
) {
  // Reset relevant filters first
  updateFilter('industry', '');
  updateFilter('city', '');
  updateFilter('state', '');
  updateFilter('hasDeals', null);
  updateFilter('hasContacts', null);
  updateFilter('createdFrom', null);
  updateFilter('createdTo', null);

  // Apply each condition
  conditions.forEach((condition) => {
    const value = condition.value;

    switch (condition.fieldId) {
      case 'industry':
        if (condition.operator === 'equals') {
          updateFilter('industry', value);
        }
        break;

      case 'city':
        if (condition.operator === 'contains' || condition.operator === 'equals') {
          updateFilter('city', value);
        }
        break;

      case 'state':
        if (condition.operator === 'contains' || condition.operator === 'equals') {
          updateFilter('state', value);
        }
        break;

      case 'hasDeals':
        if (condition.operator === 'equals') {
          updateFilter('hasDeals', value === true || value === 'true');
        }
        break;

      case 'hasContacts':
        if (condition.operator === 'equals') {
          updateFilter('hasContacts', value === true || value === 'true');
        }
        break;

      case 'createdDate':
        if (condition.operator === 'after') {
          updateFilter('createdFrom', value);
        } else if (condition.operator === 'before') {
          updateFilter('createdTo', value);
        } else if (condition.operator === 'equals') {
          updateFilter('createdFrom', value);
          updateFilter('createdTo', value);
        }
        break;
    }
  });
}

export function CompaniesFilterBuilderIntegration({
  filters,
  updateFilter,
  clearFilters,
  activeFilterCount,
}: CompaniesFilterBuilderProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const filterFields = getFilterFields();

  // Initialize conditions from existing filters
  useEffect(() => {
    setConditions(filtersToConditions(filters));
  }, []); // Only run once on mount

  const handleConditionsChange = (newConditions: FilterCondition[]) => {
    setConditions(newConditions);

    if (newConditions.length === 0) {
      clearFilters();
    } else {
      applyConditionsToFilters(newConditions, updateFilter);
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
