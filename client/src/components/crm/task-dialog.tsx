import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TeamMember {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
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
  assignee?: TeamMember | null;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  objectType?: string;
  objectId?: number;
  onSuccess?: () => void;
}

const REMINDER_OPTIONS = [
  { value: "none", label: "No reminder" },
  { value: "at_time", label: "At task due time" },
  { value: "15_minutes", label: "15 minutes before" },
  { value: "30_minutes", label: "30 minutes before" },
  { value: "1_hour", label: "1 hour before" },
  { value: "1_day", label: "1 day before" },
  { value: "1_week", label: "1 week before" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "text-gray-500" },
  { value: "normal", label: "Normal", color: "text-blue-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
];

export function TaskDialog({
  open,
  onOpenChange,
  task,
  objectType,
  objectId,
  onSuccess,
}: TaskDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    dueTime: "",
    reminder: "none",
    assignedTo: "unassigned",
    priority: "normal",
  });

  // Reset form when dialog opens or task changes
  useEffect(() => {
    if (open) {
      if (task) {
        setFormData({
          title: task.title || "",
          description: task.description || "",
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
          dueTime: task.dueTime || "",
          reminder: task.reminder || "none",
          assignedTo: task.assignedTo?.toString() || "unassigned",
          priority: task.priority || "normal",
        });
      } else {
        setFormData({
          title: "",
          description: "",
          dueDate: "",
          dueTime: "",
          reminder: "none",
          assignedTo: "unassigned",
          priority: "normal",
        });
      }
    }
  }, [open, task]);

  // Fetch team members for assignment dropdown
  const { data: teamMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/crm/organization/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/organization/members");
      if (!res.ok) return [];
      const data = await res.json();
      // API returns array with userId, map to id for consistency
      return (Array.isArray(data) ? data : []).map((m: any) => ({
        id: m.userId,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
      }));
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/crm/tasks", { body: data }).then((res) =>
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
        title: "Task created",
        description: "Your task has been created successfully.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("PATCH", `/api/crm/tasks/${task?.id}`, { body: data }).then(
        (res) => res.json()
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      if (objectType && objectId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/crm/tasks/${objectType}/${objectId}`],
        });
      }
      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }

    const taskData = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      dueDate: formData.dueDate || null,
      dueTime: formData.dueTime || null,
      reminder: formData.reminder,
      assignedTo: formData.assignedTo && formData.assignedTo !== "unassigned" ? parseInt(formData.assignedTo) : null,
      priority: formData.priority,
      ...(objectType && objectId && { objectType, objectId }),
    };

    if (isEditing) {
      updateTaskMutation.mutate(taskData);
    } else {
      createTaskMutation.mutate(taskData);
    }
  };

  const isPending = createTaskMutation.isPending || updateTaskMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Create Task"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the task details below."
              : "Add a new task to track follow-ups and action items."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Follow up on proposal"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Add more details about this task..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueTime">Due Time</Label>
              <Input
                id="dueTime"
                type="time"
                value={formData.dueTime}
                onChange={(e) =>
                  setFormData({ ...formData, dueTime: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder">Reminder</Label>
            <Select
              value={formData.reminder}
              onValueChange={(value) =>
                setFormData({ ...formData, reminder: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reminder" />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned To</Label>
              <Select
                value={formData.assignedTo}
                onValueChange={(value) =>
                  setFormData({ ...formData, assignedTo: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers?.map((member) => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.firstName && member.lastName
                        ? `${member.firstName} ${member.lastName}`
                        : member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                ? "Update Task"
                : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
