import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTaskFilters } from "@/hooks/use-task-filters";
import { TasksColumnConfig } from "@/components/crm/tasks-column-config";
import { TaskDialog } from "@/components/crm/task-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Trash2,
  Calendar,
  User,
  Flag,
  Building2,
  UserCircle,
  Briefcase,
  RotateCcw,
  Download,
} from "lucide-react";

// Animated checkmark component for task completion
function AnimatedCheckmark({ visible }: { visible: boolean }) {
  return (
    <svg
      className={cn(
        "h-3 w-3 transition-all duration-200",
        visible ? "scale-100 opacity-100" : "scale-0 opacity-0"
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M5 12l5 5L20 7"
        style={{
          strokeDasharray: 24,
          strokeDashoffset: visible ? 0 : 24,
          transition: "stroke-dashoffset 0.3s ease-in-out 0.1s"
        }}
      />
    </svg>
  );
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  reminder: string;
  assignedTo: number | null;
  status: string;
  priority: string;
  objectType: string | null;
  objectId: number | null;
  completedAt: string | null;
  createdAt: string;
  assignee?: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  creator?: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  deal?: { id: number; name: string } | null;
  contact?: { id: number; firstName: string | null; lastName: string | null } | null;
  company?: { id: number; name: string } | null;
}

interface TeamMember {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-gray-100 text-gray-700" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-700" },
  high: { label: "High", color: "bg-orange-100 text-orange-700" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700" },
};

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500" },
};

function formatDueDate(dueDate: string | null, dueTime: string | null): string {
  if (!dueDate) return "-";

  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  let dateStr = "";
  if (dateOnly.getTime() === today.getTime()) {
    dateStr = "Today";
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    dateStr = "Tomorrow";
  } else {
    dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  }

  if (dueTime) {
    const [hours, minutes] = dueTime.split(":");
    const timeDate = new Date();
    timeDate.setHours(parseInt(hours), parseInt(minutes));
    dateStr += ` ${timeDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return dateStr;
}

export default function TasksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const {
    filters,
    updateFilter,
    clearFilters,
    activeFilterCount,
    sorting,
    toggleSort,
    columns,
    visibleColumns,
    toggleColumnVisibility,
    reorderColumns,
    buildQueryParams,
  } = useTaskFilters();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());

  // Fetch ALL tasks (for stats calculation - only filtered by assignedTo)
  const statsQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.assignedTo === "my") {
      params.append("myTasks", "true");
    }
    return params.toString();
  }, [filters.assignedTo]);

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/crm/tasks", "stats", statsQueryParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/tasks?${statsQueryParams}`);
      return res.json();
    },
  });

  // Fetch filtered tasks (for display)
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/crm/tasks", buildQueryParams()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.assignedTo === "my") {
        params.append("myTasks", "true");
      }
      if (filters.status !== "all" && filters.status !== "active" && filters.status !== "overdue") {
        params.append("status", filters.status);
      }
      if (filters.priority !== "all") {
        params.append("priority", filters.priority);
      }
      const res = await apiRequest("GET", `/api/crm/tasks?${params.toString()}`);
      return res.json();
    },
  });

  // Fetch team members for assignee dropdown
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/team-members");
      return res.json();
    },
  });

  // Helper to check if a task is overdue
  const isTaskOverdue = useCallback((task: Task): boolean => {
    if (!task.dueDate || task.status === "completed" || task.status === "cancelled") {
      return false;
    }
    const now = new Date();
    const dueDateTime = new Date(task.dueDate);
    if (task.dueTime) {
      const [hours, minutes] = task.dueTime.split(":").map(Number);
      dueDateTime.setHours(hours, minutes, 0, 0);
    } else {
      dueDateTime.setHours(23, 59, 59, 999);
    }
    return now > dueDateTime;
  }, []);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = tasks.filter((task) => {
      const matchesSearch =
        !filters.search ||
        task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        task.description?.toLowerCase().includes(filters.search.toLowerCase());

      let matchesStatus = false;
      if (filters.status === "all") {
        matchesStatus = true;
      } else if (filters.status === "active") {
        matchesStatus = task.status !== "completed" && task.status !== "cancelled";
      } else if (filters.status === "overdue") {
        matchesStatus = isTaskOverdue(task);
      } else {
        matchesStatus = task.status === filters.status;
      }

      return matchesSearch && matchesStatus;
    });

    // Sort tasks
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sorting.field) {
        case 'dueDate':
          aVal = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          bVal = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          break;
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
          aVal = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
          bVal = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'assignedTo':
          aVal = a.assignee?.firstName || a.assignee?.email || 'zzz';
          bVal = b.assignee?.firstName || b.assignee?.email || 'zzz';
          break;
        default:
          aVal = a.createdAt;
          bVal = b.createdAt;
      }
      if (aVal < bVal) return sorting.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sorting.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [tasks, filters, sorting, isTaskOverdue]);

  // Calculate stats from ALL tasks (not filtered by status)
  const stats = useMemo(() => ({
    total: allTasks.length,
    pending: allTasks.filter((t) => t.status === "pending").length,
    inProgress: allTasks.filter((t) => t.status === "in_progress").length,
    completed: allTasks.filter((t) => t.status === "completed").length,
    overdue: allTasks.filter(isTaskOverdue).length,
  }), [allTasks, isTaskOverdue]);

  // Mutations
  const completeTaskMutation = useMutation({
    mutationFn: (taskId: number) =>
      apiRequest("PATCH", `/api/crm/tasks/${taskId}/complete`).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"], refetchType: 'all' });
      toast({ title: "Task completed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to complete task", variant: "destructive" });
    },
  });

  const uncompleteTaskMutation = useMutation({
    mutationFn: (taskId: number) =>
      apiRequest("PATCH", `/api/crm/tasks/${taskId}/uncomplete`).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"], refetchType: 'all' });
      toast({ title: "Task reopened" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reopen task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: Record<string, any> }) =>
      apiRequest("PATCH", `/api/crm/tasks/${taskId}`, { body: data }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"], refetchType: 'all' });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) =>
      apiRequest("DELETE", `/api/crm/tasks/${taskId}`).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"], refetchType: 'all' });
      toast({ title: "Task deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete task", variant: "destructive" });
    },
  });

  // Bulk actions
  const handleBulkComplete = useCallback(async () => {
    const promises = Array.from(selectedTasks).map(id => completeTaskMutation.mutateAsync(id));
    await Promise.all(promises);
    setSelectedTasks(new Set());
    toast({ title: `${selectedTasks.size} tasks completed` });
  }, [selectedTasks, completeTaskMutation, toast]);

  const handleBulkDelete = useCallback(async () => {
    const promises = Array.from(selectedTasks).map(id => deleteTaskMutation.mutateAsync(id));
    await Promise.all(promises);
    setSelectedTasks(new Set());
    toast({ title: `${selectedTasks.size} tasks deleted` });
  }, [selectedTasks, deleteTaskMutation, toast]);

  // Selection helpers
  const toggleTaskSelection = useCallback((taskId: number) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);

  const toggleAllSelection = useCallback(() => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    }
  }, [filteredTasks, selectedTasks.size]);

  const isAllSelected = filteredTasks.length > 0 && selectedTasks.size === filteredTasks.length;
  const isSomeSelected = selectedTasks.size > 0 && selectedTasks.size < filteredTasks.length;

  // Helper for inline task updates
  const handleTaskUpdate = useCallback(async (taskId: number, field: string, value: any) => {
    await updateTaskMutation.mutateAsync({ taskId, data: { [field]: value } });
  }, [updateTaskMutation]);

  // Get sort icon for column
  const getSortIcon = (field: string) => {
    if (sorting.field !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    return sorting.direction === 'asc'
      ? <ArrowUp className="h-3 w-3 text-blue-600" />
      : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  // Get linked entity info
  const getLinkedEntityInfo = (task: Task) => {
    if (task.deal) {
      return { type: 'Deal', name: task.deal.name, href: `/deals/${task.deal.id}`, icon: Briefcase };
    }
    if (task.contact) {
      const name = [task.contact.firstName, task.contact.lastName].filter(Boolean).join(' ') || 'Contact';
      return { type: 'Contact', name, href: `/contacts/${task.contact.id}`, icon: UserCircle };
    }
    if (task.company) {
      return { type: 'Company', name: task.company.name, href: `/companies/${task.company.id}`, icon: Building2 };
    }
    return null;
  };

  // Export tasks to CSV
  const handleExport = () => {
    if (filteredTasks.length === 0) {
      toast({ title: "No tasks to export", variant: "destructive" });
      return;
    }

    const headers = ["Title", "Due Date", "Assigned To", "Status", "Priority", "Linked To", "Created", "Completed"];
    const rows = filteredTasks.map((t) => [
      t.title,
      t.dueDate ? formatDueDate(t.dueDate, t.dueTime) : "",
      t.assignee ? `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim() || t.assignee.email : "",
      STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG]?.label || t.status,
      PRIORITY_CONFIG[t.priority as keyof typeof PRIORITY_CONFIG]?.label || t.priority,
      getLinkedEntityInfo(t)?.name || "",
      new Date(t.createdAt).toLocaleDateString(),
      t.completedAt ? new Date(t.completedAt).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: `Exported ${filteredTasks.length} tasks` });
  };

  // Render cell content based on column
  const renderCell = (task: Task, columnId: string) => {
    const isComplete = task.status === "completed" || task.status === "cancelled";
    const overdue = isTaskOverdue(task);

    switch (columnId) {
      case 'title':
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={completeTaskMutation.isPending || uncompleteTaskMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                if (isComplete) {
                  uncompleteTaskMutation.mutate(task.id);
                } else {
                  completeTaskMutation.mutate(task.id);
                }
              }}
              className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                isComplete
                  ? "bg-green-500 border-green-500 text-white hover:bg-green-600"
                  : "border-gray-300 hover:border-green-500 hover:bg-green-50"
              )}
              title={isComplete ? "Mark as incomplete" : "Mark as complete"}
            >
              <AnimatedCheckmark visible={isComplete} />
            </button>
            <span
              className={cn(
                "font-medium cursor-pointer hover:text-blue-600 transition-all duration-200",
                isComplete ? "line-through text-gray-400" : "text-gray-900"
              )}
              onClick={() => setEditingTask(task)}
            >
              {task.title}
            </span>
          </div>
        );

      case 'dueDate':
        return (
          <span className={cn("text-sm", overdue ? "text-red-600 font-medium" : "text-gray-600")}>
            {task.dueDate ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDueDate(task.dueDate, task.dueTime)}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </span>
        );

      case 'assignedTo':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={task.assignedTo?.toString() || "unassigned"}
              onValueChange={async (val) => {
                const assignedTo = val === "unassigned" ? null : parseInt(val);
                await handleTaskUpdate(task.id, 'assignedTo', assignedTo);
              }}
            >
              <SelectTrigger className="h-7 text-sm border-0 bg-transparent hover:bg-gray-100 px-2 -mx-2 min-w-[120px]">
                <SelectValue>
                  {task.assignee ? (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 text-gray-400" />
                      {task.assignee.firstName || task.assignee.email}
                    </span>
                  ) : (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-gray-400">Unassigned</span>
                </SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id.toString()}>
                    {member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'status':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={task.status}
              onValueChange={async (val) => {
                await handleTaskUpdate(task.id, 'status', val);
              }}
            >
              <SelectTrigger className="h-7 text-sm border-0 bg-transparent hover:bg-gray-100 px-0 min-w-[100px]">
                <SelectValue>
                  <Badge className={cn("text-xs", STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.color)}>
                    {STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.label || task.status}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <Badge className={cn("text-xs", config.color)}>{config.label}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'priority':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={task.priority}
              onValueChange={async (val) => {
                await handleTaskUpdate(task.id, 'priority', val);
              }}
            >
              <SelectTrigger className="h-7 text-sm border-0 bg-transparent hover:bg-gray-100 px-0 min-w-[80px]">
                <SelectValue>
                  <Badge className={cn("text-xs", PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.color)}>
                    <Flag className="h-2.5 w-2.5 mr-1" />
                    {PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.label || task.priority}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <Badge className={cn("text-xs", config.color)}>
                      <Flag className="h-2.5 w-2.5 mr-1" />
                      {config.label}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'linkedTo':
        const linked = getLinkedEntityInfo(task);
        if (!linked) return <span className="text-gray-400 text-sm">-</span>;
        const IconComponent = linked.icon;
        return (
          <Link
            href={linked.href}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors"
          >
            <IconComponent className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{linked.name}</span>
          </Link>
        );

      case 'createdAt':
        return (
          <span className="text-sm text-gray-600">
            {new Date(task.createdAt).toLocaleDateString()}
          </span>
        );

      case 'completedAt':
        return task.completedAt ? (
          <span className="text-sm text-gray-600">
            {new Date(task.completedAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        );

      case 'reminder':
        return (
          <span className="text-sm text-gray-600 capitalize">
            {task.reminder.replace(/_/g, ' ')}
          </span>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your tasks and follow-ups
          </p>
        </div>
        <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <button
          onClick={() => updateFilter("status", "active")}
          className={cn(
            "bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md hover:border-blue-300",
            filters.status === "active" && "ring-2 ring-blue-500 border-blue-500"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.pending + stats.inProgress}
              </p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => updateFilter("status", "overdue")}
          className={cn(
            "bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md hover:border-red-300",
            filters.status === "overdue" && "ring-2 ring-red-500 border-red-500"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.overdue}</p>
              <p className="text-sm text-gray-500">Overdue</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => updateFilter("status", "completed")}
          className={cn(
            "bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md hover:border-green-300",
            filters.status === "completed" && "ring-2 ring-green-500 border-green-500"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.completed}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => updateFilter("status", "all")}
          className={cn(
            "bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md hover:border-gray-400",
            filters.status === "all" && "ring-2 ring-gray-500 border-gray-500"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <Tabs
          value={filters.assignedTo}
          onValueChange={(v) => updateFilter("assignedTo", v)}
        >
          <TabsList>
            <TabsTrigger value="my">My Tasks</TabsTrigger>
            <TabsTrigger value="all">All Tasks</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={filters.priority} onValueChange={(v) => updateFilter("priority", v)}>
              <SelectTrigger className="w-[110px] h-8">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <TasksColumnConfig
              columns={columns}
              onToggleVisibility={toggleColumnVisibility}
              onReorder={reorderColumns}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredTasks.length === 0}
              title="Export to CSV"
              className="h-8"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTasks.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">
            {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkComplete}
              disabled={completeTaskMutation.isPending}
              className="h-7"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Complete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleteTaskMutation.isPending}
              className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTasks(new Set())}
              className="h-7"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="bg-white rounded-lg border">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-12 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No tasks found</p>
            <p className="text-xs text-gray-400 mt-1">
              {filters.search || filters.status !== "active"
                ? "Try adjusting your filters"
                : "Create a task to get started"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden p-4 space-y-3">
              {filteredTasks.map((task) => {
                const isComplete = task.status === "completed" || task.status === "cancelled";
                const overdue = isTaskOverdue(task);
                const linked = getLinkedEntityInfo(task);

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "p-3 rounded-lg border bg-white",
                      isComplete && "opacity-60"
                    )}
                    onClick={() => setEditingTask(task)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isComplete) {
                            uncompleteTaskMutation.mutate(task.id);
                          } else {
                            completeTaskMutation.mutate(task.id);
                          }
                        }}
                        className={cn(
                          "mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                          isComplete
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-300 hover:border-green-500 hover:bg-green-50"
                        )}
                      >
                        <AnimatedCheckmark visible={isComplete} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4
                          className={cn(
                            "font-medium transition-all duration-200",
                            isComplete ? "line-through text-gray-400" : "text-gray-900"
                          )}
                        >
                          {task.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          {task.dueDate && (
                            <span className={cn("flex items-center gap-1", overdue ? "text-red-600" : "text-gray-500")}>
                              <Calendar className="h-3 w-3" />
                              {formatDueDate(task.dueDate, task.dueTime)}
                            </span>
                          )}
                          <Badge className={cn("text-xs", PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.color)}>
                            {PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.label}
                          </Badge>
                          {linked && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <linked.icon className="h-3 w-3" />
                              {linked.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="w-10 py-3 px-4">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleAllSelection}
                        className={`border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400 ${isSomeSelected ? "data-[state=checked]:bg-gray-300" : ""}`}
                      />
                    </th>
                    {visibleColumns.map((column) => (
                      <th
                        key={column.id}
                        className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                        style={{
                          width: column.id === 'title' ? '30%' :
                                 column.id === 'dueDate' ? '15%' :
                                 column.id === 'assignedTo' ? '15%' :
                                 column.id === 'status' ? '12%' :
                                 column.id === 'priority' ? '10%' :
                                 column.id === 'linkedTo' ? '15%' :
                                 '10%'
                        }}
                        onClick={() => toggleSort(column.id)}
                      >
                        <div className="flex items-center gap-1">
                          {column.label}
                          {getSortIcon(column.id)}
                        </div>
                      </th>
                    ))}
                    <th className="w-10 py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const isComplete = task.status === "completed" || task.status === "cancelled";
                    return (
                      <tr
                        key={task.id}
                        className={cn(
                          "border-b hover:bg-gray-50 transition-colors",
                          isComplete && "opacity-60",
                          selectedTasks.has(task.id) && "bg-blue-50"
                        )}
                      >
                        <td className="py-3 px-4">
                          <Checkbox
                            checked={selectedTasks.has(task.id)}
                            onCheckedChange={() => toggleTaskSelection(task.id)}
                            className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                          />
                        </td>
                        {visibleColumns.map((column) => (
                          <td key={column.id} className="py-3 px-4">
                            {renderCell(task, column.id)}
                          </td>
                        ))}
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingTask(task)}>
                                Edit
                              </DropdownMenuItem>
                              {!isComplete ? (
                                <DropdownMenuItem onClick={() => completeTaskMutation.mutate(task.id)}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Complete
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => uncompleteTaskMutation.mutate(task.id)}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Reopen
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => deleteTaskMutation.mutate(task.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <TaskDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <TaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
      />

      {/* Mobile FAB (Floating Action Button) */}
      {isMobile && (
        <Button
          size="lg"
          onClick={() => setIsCreateDialogOpen(true)}
          className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg hover:shadow-xl p-0"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
