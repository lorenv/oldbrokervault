import { useEffect, useState } from "react";
import { FilterBuilder, FilterField, FilterCondition } from "./filter-builder";
import type { ContactFilters } from "@/hooks/use-contact-filters";

interface ContactsFilterBuilderProps {
  filters: ContactFilters;
  updateFilter: <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) => void;
  clearFilters: () => void;
  activeFilterCount: number;
}

// Define available filter fields for contacts
const getFilterFields = (): FilterField[] => [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'phone', label: 'Phone', type: 'text' },
  { id: 'tags', label: 'Tags', type: 'text' },
  {
    id: 'contactType',
    label: 'Contact Type',
    type: 'select',
    options: [
      { value: 'buyer', label: 'Buyer' },
      { value: 'seller', label: 'Seller' },
      { value: 'advisor', label: 'Advisor' },
      { value: 'other', label: 'Other' },
    ]
  },
  {
    id: 'leadStatus',
    label: 'Lead Status',
    type: 'select',
    options: [
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'qualified', label: 'Qualified' },
      { value: 'unqualified', label: 'Unqualified' },
    ]
  },
  {
    id: 'source',
    label: 'Source',
    type: 'select',
    options: [
      { value: 'website', label: 'Website' },
      { value: 'referral', label: 'Referral' },
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'cold_outreach', label: 'Cold Outreach' },
      { value: 'event', label: 'Event' },
      { value: 'other', label: 'Other' },
    ]
  },
  { id: 'hasEmail', label: 'Has Email', type: 'boolean' },
  { id: 'hasPhone', label: 'Has Phone', type: 'boolean' },
  { id: 'createdDate', label: 'Created Date', type: 'date' },
];

// Convert existing filters to filter conditions
function filtersToConditions(filters: ContactFilters): FilterCondition[] {
  const conditions: FilterCondition[] = [];

  if (filters.contactType) {
    conditions.push({
      id: `contactType-${Date.now()}`,
      fieldId: 'contactType',
      operator: 'equals',
      value: filters.contactType,
    });
  }

  if (filters.leadStatus.length > 0) {
    filters.leadStatus.forEach((status) => {
      conditions.push({
        id: `leadStatus-${status}-${Date.now()}`,
        fieldId: 'leadStatus',
        operator: 'equals',
        value: status,
      });
    });
  }

  if (filters.source.length > 0) {
    filters.source.forEach((source) => {
      conditions.push({
        id: `source-${source}-${Date.now()}`,
        fieldId: 'source',
        operator: 'equals',
        value: source,
      });
    });
  }

  if (filters.hasEmail !== null) {
    conditions.push({
      id: `hasEmail-${Date.now()}`,
      fieldId: 'hasEmail',
      operator: 'equals',
      value: filters.hasEmail,
    });
  }

  if (filters.hasPhone !== null) {
    conditions.push({
      id: `hasPhone-${Date.now()}`,
      fieldId: 'hasPhone',
      operator: 'equals',
      value: filters.hasPhone,
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

  if (filters.tags.length > 0) {
    filters.tags.forEach((tag) => {
      conditions.push({
        id: `tags-${tag}-${Date.now()}`,
        fieldId: 'tags',
        operator: 'contains',
        value: tag,
      });
    });
  }

  return conditions;
}

// Apply filter conditions to contact filters
function applyConditionsToFilters(
  conditions: FilterCondition[],
  updateFilter: <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) => void
) {
  // Reset relevant filters first
  updateFilter('search', '');
  updateFilter('contactType', '');
  updateFilter('leadStatus', []);
  updateFilter('source', []);
  updateFilter('tags', []);
  updateFilter('hasEmail', null);
  updateFilter('hasPhone', null);
  updateFilter('createdFrom', null);
  updateFilter('createdTo', null);

  // Apply each condition
  conditions.forEach((condition) => {
    const value = condition.value;

    switch (condition.fieldId) {
      case 'name':
      case 'email':
      case 'phone':
        // These all map to the search filter
        if (condition.operator === 'contains' || condition.operator === 'equals') {
          updateFilter('search', value);
        }
        break;

      case 'contactType':
        if (condition.operator === 'equals') {
          updateFilter('contactType', value);
        }
        break;

      case 'leadStatus':
        if (condition.operator === 'equals') {
          updateFilter('leadStatus', [value]);
        }
        break;

      case 'source':
        if (condition.operator === 'equals') {
          updateFilter('source', [value]);
        }
        break;

      case 'hasEmail':
        if (condition.operator === 'equals') {
          updateFilter('hasEmail', value === true || value === 'true');
        }
        break;

      case 'hasPhone':
        if (condition.operator === 'equals') {
          updateFilter('hasPhone', value === true || value === 'true');
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

      case 'tags':
        if (condition.operator === 'contains' && value) {
          updateFilter('tags', [value]);
        }
        break;
    }
  });
}

export function ContactsFilterBuilderIntegration({
  filters,
  updateFilter,
  clearFilters,
  activeFilterCount,
}: ContactsFilterBuilderProps) {
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
