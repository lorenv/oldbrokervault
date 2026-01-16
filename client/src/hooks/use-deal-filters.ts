import { useState, useCallback, useMemo } from 'react';

// Custom field filter value types
export type CustomFieldFilterValue =
  | string // for select, text, email, url, phone
  | string[] // for multiselect
  | { min?: number; max?: number } // for number, currency
  | { from?: string; to?: string } // for date
  | boolean | null; // for checkbox

export interface DealFilters {
  search: string;
  stages: number[];
  status: 'all' | 'open' | 'won' | 'lost';
  ownerId: number | null;
  owners: number[];
  companies: number[];
  amountMin: number | null;
  amountMax: number | null;
  closeDateFrom: string | null;
  closeDateTo: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  priority: string[];
  closingPeriod: 'all' | 'this_week' | 'this_month' | 'this_quarter' | 'overdue';
  customFields: Record<string, CustomFieldFilterValue>;
}

export interface DealSorting {
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

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Deal Name', visible: true, order: 0 },
  { id: 'company', label: 'Company', visible: true, order: 1 },
  { id: 'stage', label: 'Stage', visible: true, order: 2 },
  { id: 'amount', label: 'Value', visible: true, order: 3 },
  { id: 'closeDate', label: 'Close Date', visible: true, order: 4 },
  { id: 'owner', label: 'Owner', visible: true, order: 5 },
  { id: 'priority', label: 'Priority', visible: false, order: 6 },
  { id: 'source', label: 'Source', visible: false, order: 7 },
  { id: 'createdAt', label: 'Created', visible: false, order: 8 },
];

export const DEFAULT_FILTERS: DealFilters = {
  search: '',
  stages: [],
  status: 'all',
  ownerId: null,
  owners: [],
  companies: [],
  amountMin: null,
  amountMax: null,
  closeDateFrom: null,
  closeDateTo: null,
  createdFrom: null,
  createdTo: null,
  priority: [],
  closingPeriod: 'all',
  customFields: {},
};

export const DEFAULT_SORTING: DealSorting = {
  field: 'createdAt',
  direction: 'desc',
};

export function useDealFilters() {
  const [filters, setFilters] = useState<DealFilters>(DEFAULT_FILTERS);
  const [sorting, setSorting] = useState<DealSorting>(DEFAULT_SORTING);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.stages.length > 0) count++;
    if (filters.status !== 'all') count++;
    if (filters.ownerId) count++;
    if (filters.owners.length > 0) count++;
    if (filters.companies.length > 0) count++;
    if (filters.amountMin !== null) count++;
    if (filters.amountMax !== null) count++;
    if (filters.closeDateFrom) count++;
    if (filters.closeDateTo) count++;
    if (filters.createdFrom) count++;
    if (filters.createdTo) count++;
    if (filters.priority.length > 0) count++;
    if (filters.closingPeriod !== 'all') count++;
    // Count custom field filters
    Object.values(filters.customFields).forEach(value => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value) && value.length > 0) count++;
        else if (typeof value === 'object' && value !== null) {
          const obj = value as Record<string, any>;
          if (obj.min !== undefined || obj.max !== undefined || obj.from || obj.to) count++;
        } else if (typeof value === 'string' && value) count++;
        else if (typeof value === 'boolean') count++;
      }
    });
    return count;
  }, [filters]);

  // Build query string for API
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.stages.length > 0) params.set('stages', filters.stages.join(','));
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.ownerId) params.set('ownerId', filters.ownerId.toString());
    if (filters.owners.length > 0) params.set('owners', filters.owners.join(','));
    if (filters.companies.length > 0) params.set('companies', filters.companies.join(','));
    if (filters.amountMin !== null) params.set('amountMin', filters.amountMin.toString());
    if (filters.amountMax !== null) params.set('amountMax', filters.amountMax.toString());
    if (filters.priority.length > 0) params.set('priority', filters.priority.join(','));

    // Handle closing period date ranges
    if (filters.closingPeriod !== 'all') {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
      const endOfQuarter = new Date(now.getFullYear(), quarter * 3 + 3, 0);

      switch (filters.closingPeriod) {
        case 'this_week':
          params.set('closeDateFrom', startOfWeek.toISOString().split('T')[0]);
          params.set('closeDateTo', endOfWeek.toISOString().split('T')[0]);
          break;
        case 'this_month':
          params.set('closeDateFrom', startOfMonth.toISOString().split('T')[0]);
          params.set('closeDateTo', endOfMonth.toISOString().split('T')[0]);
          break;
        case 'this_quarter':
          params.set('closeDateFrom', startOfQuarter.toISOString().split('T')[0]);
          params.set('closeDateTo', endOfQuarter.toISOString().split('T')[0]);
          break;
        case 'overdue':
          params.set('closeDateTo', now.toISOString().split('T')[0]);
          break;
      }
    } else {
      if (filters.closeDateFrom) params.set('closeDateFrom', filters.closeDateFrom);
      if (filters.closeDateTo) params.set('closeDateTo', filters.closeDateTo);
    }

    if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
    if (filters.createdTo) params.set('createdTo', filters.createdTo);

    // Custom field filters - serialize as JSON
    if (Object.keys(filters.customFields).length > 0) {
      const activeCustomFilters: Record<string, any> = {};
      Object.entries(filters.customFields).forEach(([fieldName, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            activeCustomFilters[fieldName] = value;
          } else if (typeof value === 'object' && value !== null) {
            const obj = value as Record<string, any>;
            if (obj.min !== undefined || obj.max !== undefined || obj.from || obj.to) {
              activeCustomFilters[fieldName] = value;
            }
          } else if (typeof value === 'string' && value) {
            activeCustomFilters[fieldName] = value;
          } else if (typeof value === 'boolean') {
            activeCustomFilters[fieldName] = value;
          }
        }
      });
      if (Object.keys(activeCustomFilters).length > 0) {
        params.set('customFields', JSON.stringify(activeCustomFilters));
      }
    }

    // Sorting
    params.set('sortField', sorting.field);
    params.set('sortOrder', sorting.direction);

    return params.toString();
  }, [filters, sorting]);

  // Update a single filter
  const updateFilter = useCallback(<K extends keyof DealFilters>(
    key: K,
    value: DealFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Update a specific custom field filter
  const updateCustomFieldFilter = useCallback((fieldName: string, value: CustomFieldFilterValue) => {
    setFilters(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldName]: value,
      },
    }));
  }, []);

  // Clear a specific custom field filter
  const clearCustomFieldFilter = useCallback((fieldName: string) => {
    setFilters(prev => {
      const newCustomFields = { ...prev.customFields };
      delete newCustomFields[fieldName];
      return { ...prev, customFields: newCustomFields };
    });
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

  // Apply a saved view configuration
  const applyView = useCallback((view: {
    filters?: Partial<DealFilters>;
    columns?: ColumnConfig[];
    sorting?: DealSorting;
    viewMode?: 'list' | 'kanban';
  }) => {
    if (view.filters) {
      setFilters({ ...DEFAULT_FILTERS, ...view.filters });
    }
    if (view.columns) {
      // Merge saved columns with defaults to ensure labels are always present
      const mergedColumns = view.columns.map(savedCol => {
        const defaultCol = DEFAULT_COLUMNS.find(d => d.id === savedCol.id);
        return {
          ...defaultCol, // Get label from defaults
          ...savedCol,   // Override with saved settings (visible, order, width)
        } as ColumnConfig;
      });
      // Add any default columns not in the saved view
      DEFAULT_COLUMNS.forEach(defaultCol => {
        if (!mergedColumns.find(c => c.id === defaultCol.id)) {
          mergedColumns.push({ ...defaultCol, visible: false });
        }
      });
      setColumns(mergedColumns);
    }
    if (view.sorting) {
      setSorting(view.sorting);
    }
    if (view.viewMode) {
      setViewMode(view.viewMode);
    }
  }, []);

  // Get current view configuration for saving
  const getCurrentViewConfig = useCallback(() => {
    return {
      filters,
      columns,
      sorting,
      viewMode,
    };
  }, [filters, columns, sorting, viewMode]);

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

  const resizeColumn = useCallback((columnId: string, width: number) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId ? { ...col, width } : col
    ));
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
    resizeColumn,
    viewMode,
    setViewMode,
    buildQueryParams,
    applyView,
    getCurrentViewConfig,
    updateCustomFieldFilter,
    clearCustomFieldFilter,
  };
}
