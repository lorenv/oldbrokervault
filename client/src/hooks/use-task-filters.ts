import { useState, useCallback, useMemo } from 'react';

export interface TaskFilters {
  search: string;
  status: string;
  priority: string;
  assignedTo: string;
  objectType: string;
  dueDateFrom: string | null;
  dueDateTo: string | null;
  showOverdue: boolean;
}

export interface TaskSorting {
  field: string;
  direction: 'asc' | 'desc';
}

export interface TaskColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export const DEFAULT_TASK_COLUMNS: TaskColumnConfig[] = [
  { id: 'title', label: 'Title', visible: true, order: 0 },
  { id: 'dueDate', label: 'Due Date', visible: true, order: 1 },
  { id: 'assignedTo', label: 'Assigned To', visible: true, order: 2 },
  { id: 'status', label: 'Status', visible: true, order: 3 },
  { id: 'priority', label: 'Priority', visible: true, order: 4 },
  { id: 'linkedTo', label: 'Linked To', visible: true, order: 5 },
  { id: 'createdAt', label: 'Created', visible: false, order: 6 },
  { id: 'completedAt', label: 'Completed', visible: false, order: 7 },
  { id: 'reminder', label: 'Reminder', visible: false, order: 8 },
];

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  search: '',
  status: 'active',
  priority: 'all',
  assignedTo: 'my',
  objectType: 'all',
  dueDateFrom: null,
  dueDateTo: null,
  showOverdue: false,
};

export const DEFAULT_TASK_SORTING: TaskSorting = {
  field: 'dueDate',
  direction: 'asc',
};

const STORAGE_KEY = 'taskColumnsConfig';

function loadColumnsFromStorage(): TaskColumnConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // Ignore storage errors
  }
  return DEFAULT_TASK_COLUMNS;
}

function saveColumnsToStorage(columns: TaskColumnConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch (e) {
    // Ignore storage errors
  }
}

export function useTaskFilters() {
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_TASK_FILTERS);
  const [sorting, setSorting] = useState<TaskSorting>(DEFAULT_TASK_SORTING);
  const [columns, setColumns] = useState<TaskColumnConfig[]>(loadColumnsFromStorage);

  // Count active filters (excluding defaults)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status && filters.status !== 'active') count++;
    if (filters.priority && filters.priority !== 'all') count++;
    if (filters.assignedTo && filters.assignedTo !== 'my') count++;
    if (filters.objectType && filters.objectType !== 'all') count++;
    if (filters.dueDateFrom) count++;
    if (filters.dueDateTo) count++;
    if (filters.showOverdue) count++;
    return count;
  }, [filters]);

  // Build query string for API
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.status && filters.status !== 'all' && filters.status !== 'active' && filters.status !== 'overdue') {
      params.set('status', filters.status);
    }
    if (filters.priority && filters.priority !== 'all') {
      params.set('priority', filters.priority);
    }
    if (filters.assignedTo === 'my') {
      params.set('myTasks', 'true');
    }
    if (filters.objectType && filters.objectType !== 'all') {
      params.set('objectType', filters.objectType);
    }
    if (filters.dueDateFrom) params.set('dueDateFrom', filters.dueDateFrom);
    if (filters.dueDateTo) params.set('dueDateTo', filters.dueDateTo);

    // Sorting
    params.set('sortField', sorting.field);
    params.set('sortOrder', sorting.direction);

    return params.toString();
  }, [filters, sorting]);

  // Update a single filter
  const updateFilter = useCallback(<K extends keyof TaskFilters>(
    key: K,
    value: TaskFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_TASK_FILTERS);
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
    setColumns(prev => {
      const updated = prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      );
      saveColumnsToStorage(updated);
      return updated;
    });
  }, []);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      const newColumns = [...prev];
      const [moved] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, moved);
      const updated = newColumns.map((col, index) => ({ ...col, order: index }));
      saveColumnsToStorage(updated);
      return updated;
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
