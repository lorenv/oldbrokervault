import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Search, Filter, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";

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
}

export default function TasksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"my" | "all">("my");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Fetch tasks
  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/crm/tasks", viewMode, statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (viewMode === "my") {
        params.append("myTasks", "true");
      }
      if (statusFilter !== "all" && statusFilter !== "active") {
        params.append("status", statusFilter);
      }
      if (priorityFilter !== "all") {
        params.append("priority", priorityFilter);
      }
      const res = await apiRequest("GET", `/api/crm/tasks?${params.toString()}`);
      return res.json();
    },
  });

  // Filter tasks based on search and status
  const filteredTasks = (tasks || []).filter((task) => {
    const matchesSearch =
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" &&
        task.status !== "completed" &&
        task.status !== "cancelled") ||
      task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Helper to check if a task is overdue (considering both date AND time)
  const isTaskOverdue = (task: Task): boolean => {
    if (!task.dueDate || task.status === "completed" || task.status === "cancelled") {
      return false;
    }

    const now = new Date();
    const dueDateTime = new Date(task.dueDate);

    // If task has a specific time, use it; otherwise default to end of day (23:59)
    if (task.dueTime) {
      const [hours, minutes] = task.dueTime.split(":").map(Number);
      dueDateTime.setHours(hours, minutes, 0, 0);
    } else {
      // No time specified = due by end of that day
      dueDateTime.setHours(23, 59, 59, 999);
    }

    return now > dueDateTime;
  };

  // Calculate stats
  const stats = {
    total: tasks?.length || 0,
    pending: tasks?.filter((t) => t.status === "pending").length || 0,
    inProgress: tasks?.filter((t) => t.status === "in_progress").length || 0,
    completed: tasks?.filter((t) => t.status === "completed").length || 0,
    overdue: tasks?.filter(isTaskOverdue).length || 0,
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your tasks and follow-ups
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Stats Cards - 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.pending + stats.inProgress}
              </p>
              <p className="text-sm text-gray-500">Active Tasks</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.overdue}
              </p>
              <p className="text-sm text-gray-500">Overdue</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.completed}
              </p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.total}
              </p>
              <p className="text-sm text-gray-500">Total Tasks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "my" | "all")}
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 sm:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="flex-1 sm:w-32">
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
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-lg border">
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : (
            <TaskList
              tasks={filteredTasks}
              onEditTask={(task) => setEditingTask(task)}
            />
          )}
        </div>
      </div>

      {/* Create/Edit Task Dialog */}
      <TaskDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <TaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
      />
    </div>
  );
}
