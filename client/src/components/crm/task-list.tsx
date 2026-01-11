import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Calendar,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  User,
  Flag,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface TaskListProps {
  tasks: Task[];
  objectType?: string;
  objectId?: number;
  onEditTask?: (task: Task) => void;
  showLinkedEntity?: boolean;
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
  if (!dueDate) return "";

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
    dateStr += ` at ${timeDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return dateStr;
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  return due < now;
}

export function TaskList({
  tasks,
  objectType,
  objectId,
  onEditTask,
  showLinkedEntity = false,
}: TaskListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: (taskId: number) =>
      apiRequest("PATCH", `/api/crm/tasks/${taskId}/complete`).then((res) =>
        res.json()
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      if (objectType && objectId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/crm/tasks/${objectType}/${objectId}`],
        });
        queryClient.invalidateQueries({
          queryKey: [`/api/crm/activities/${objectType}`, objectId?.toString()],
        });
      }
      toast({
        title: "Task completed",
        description: "The task has been marked as complete.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete task",
        variant: "destructive",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) =>
      apiRequest("DELETE", `/api/crm/tasks/${taskId}`).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      if (objectType && objectId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/crm/tasks/${objectType}/${objectId}`],
        });
      }
      toast({
        title: "Task deleted",
        description: "The task has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    },
  });

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">No tasks yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Create a task to track follow-ups and action items
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const isComplete = task.status === "completed" || task.status === "cancelled";
        const priorityConfig = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
        const overdue = !isComplete && isOverdue(task.dueDate);

        return (
          <div
            key={task.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors",
              isComplete && "opacity-60"
            )}
          >
            <Checkbox
              checked={isComplete}
              disabled={isComplete || completeTaskMutation.isPending}
              onCheckedChange={() => {
                if (!isComplete) {
                  completeTaskMutation.mutate(task.id);
                }
              }}
              className="mt-1"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4
                    className={cn(
                      "font-medium text-sm text-gray-900 truncate",
                      isComplete && "line-through text-gray-500"
                    )}
                  >
                    {task.title}
                  </h4>

                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center flex-wrap gap-2 mt-2">
                    {task.dueDate && (
                      <div
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          overdue ? "text-red-600" : "text-gray-500"
                        )}
                      >
                        <Calendar className="h-3 w-3" />
                        <span>{formatDueDate(task.dueDate, task.dueTime)}</span>
                      </div>
                    )}

                    {task.assignee && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <User className="h-3 w-3" />
                        <span>
                          {task.assignee.firstName && task.assignee.lastName
                            ? `${task.assignee.firstName} ${task.assignee.lastName}`
                            : task.assignee.email}
                        </span>
                      </div>
                    )}

                    <Badge
                      variant="secondary"
                      className={cn("text-xs h-5", priorityConfig.color)}
                    >
                      <Flag className="h-2.5 w-2.5 mr-1" />
                      {priorityConfig.label}
                    </Badge>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEditTask && (
                      <DropdownMenuItem onClick={() => onEditTask(task)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {!isComplete && (
                      <DropdownMenuItem
                        onClick={() => completeTaskMutation.mutate(task.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark Complete
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => deleteTaskMutation.mutate(task.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
