import { useState, useCallback, useMemo } from 'react';

export interface CompanyFilters {
  search: string;
  industry: string;
  city: string;
  state: string;
  hasContacts: boolean | null;
  createdFrom: string | null;
  createdTo: string | null;
}

export interface CompanySorting {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width?: string;
  order: number;
}

export const DEFAULT_COMPANY_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Company', visible: true, width: '28%', order: 0 },
  { id: 'industry', label: 'Industry', visible: true, width: '17%', order: 1 },
  { id: 'website', label: 'Website', visible: true, width: '22%', order: 2 },
  { id: 'location', label: 'Location', visible: true, width: '17%', order: 3 },
  { id: 'contacts', label: 'Contacts', visible: true, width: '11%', order: 4 },
  { id: 'createdAt', label: 'Created', visible: false, width: '17%', order: 5 },
];

export const DEFAULT_COMPANY_FILTERS: CompanyFilters = {
  search: '',
  industry: '',
  city: '',
  state: '',
  hasContacts: null,
  createdFrom: null,
  createdTo: null,
};

export const DEFAULT_COMPANY_SORTING: CompanySorting = {
  field: 'name',
  direction: 'asc',
};

export function useCompanyFilters() {
  const [filters, setFilters] = useState<CompanyFilters>(DEFAULT_COMPANY_FILTERS);
  const [sorting, setSorting] = useState<CompanySorting>(DEFAULT_COMPANY_SORTING);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COMPANY_COLUMNS);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.industry) count++;
    if (filters.city) count++;
    if (filters.state) count++;
    if (filters.hasContacts !== null) count++;
    if (filters.createdFrom) count++;
    if (filters.createdTo) count++;
    return count;
  }, [filters]);

  // Build query string for API
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.industry) params.set('industry', filters.industry);
    if (filters.city) params.set('city', filters.city);
    if (filters.state) params.set('state', filters.state);
    if (filters.hasContacts !== null) params.set('hasContacts', filters.hasContacts.toString());
    if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
    if (filters.createdTo) params.set('createdTo', filters.createdTo);

    // Sorting
    params.set('sortField', sorting.field);
    params.set('sortOrder', sorting.direction);

    return params.toString();
  }, [filters, sorting]);

  // Update a single filter
  const updateFilter = useCallback(<K extends keyof CompanyFilters>(
    key: K,
    value: CompanyFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_COMPANY_FILTERS);
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
