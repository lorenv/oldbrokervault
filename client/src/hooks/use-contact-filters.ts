import { useState, useCallback, useMemo } from 'react';

export interface ContactFilters {
  search: string;
  contactType: string;
  leadStatus: string[];
  companies: number[];
  tags: string[];
  source: string[];
  hasEmail: boolean | null;
  hasPhone: boolean | null;
  createdFrom: string | null;
  createdTo: string | null;
}

export interface ContactSorting {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width?: number;
  order: number;
}

export const DEFAULT_CONTACT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Name', visible: true, order: 0 },
  { id: 'email', label: 'Email', visible: true, order: 1 },
  { id: 'phone', label: 'Phone', visible: true, order: 2 },
  { id: 'company', label: 'Company', visible: true, order: 3 },
  { id: 'contactType', label: 'Type', visible: true, order: 4 },
  { id: 'lastActivity', label: 'Last Activity', visible: true, order: 5 },
  { id: 'leadStatus', label: 'Status', visible: false, order: 6 },
  { id: 'title', label: 'Title', visible: false, order: 7 },
  { id: 'source', label: 'Source', visible: false, order: 8 },
  { id: 'createdAt', label: 'Created', visible: false, order: 9 },
];

export const DEFAULT_CONTACT_FILTERS: ContactFilters = {
  search: '',
  contactType: '',
  leadStatus: [],
  companies: [],
  tags: [],
  source: [],
  hasEmail: null,
  hasPhone: null,
  createdFrom: null,
  createdTo: null,
};

export const DEFAULT_CONTACT_SORTING: ContactSorting = {
  field: 'createdAt',
  direction: 'desc',
};

export function useContactFilters() {
  const [filters, setFilters] = useState<ContactFilters>(DEFAULT_CONTACT_FILTERS);
  const [sorting, setSorting] = useState<ContactSorting>(DEFAULT_CONTACT_SORTING);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_CONTACT_COLUMNS);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.contactType) count++;
    if (filters.leadStatus.length > 0) count++;
    if (filters.companies.length > 0) count++;
    if (filters.tags.length > 0) count++;
    if (filters.source.length > 0) count++;
    if (filters.hasEmail !== null) count++;
    if (filters.hasPhone !== null) count++;
    if (filters.createdFrom) count++;
    if (filters.createdTo) count++;
    return count;
  }, [filters]);

  // Build query string for API
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.contactType) params.set('contactType', filters.contactType);
    if (filters.leadStatus.length > 0) params.set('leadStatus', filters.leadStatus.join(','));
    if (filters.companies.length > 0) params.set('companies', filters.companies.join(','));
    if (filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    if (filters.source.length > 0) params.set('source', filters.source.join(','));
    if (filters.hasEmail !== null) params.set('hasEmail', filters.hasEmail.toString());
    if (filters.hasPhone !== null) params.set('hasPhone', filters.hasPhone.toString());
    if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
    if (filters.createdTo) params.set('createdTo', filters.createdTo);

    // Sorting
    params.set('sortField', sorting.field);
    params.set('sortOrder', sorting.direction);

    return params.toString();
  }, [filters, sorting]);

  // Update a single filter
  const updateFilter = useCallback(<K extends keyof ContactFilters>(
    key: K,
    value: ContactFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_CONTACT_FILTERS);
  }, []);

  // Toggle sort direction or change sort field
  const toggleSort = useCallback((field: string) => {
    setSorting(prev => {
      if (prev.field === field) {
        return { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  }, []);

  // Column management
  const toggleColumnVisibility = useCallback((columnId: string) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  }, []);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      const newColumns = [...prev];
      const [moved] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, moved);
      return newColumns.map((col, index) => ({ ...col, order: index }));
    });
  }, []);

  // Get visible columns sorted by order
  const visibleColumns = useMemo(() => {
    return columns
      .filter(col => col.visible)
      .sort((a, b) => a.order - b.order);
  }, [columns]);

  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    activeFilterCount,
    sorting,
    setSorting,
    toggleSort,
    columns,
    setColumns,
    visibleColumns,
    toggleColumnVisibility,
    reorderColumns,
    buildQueryParams,
  };
}
