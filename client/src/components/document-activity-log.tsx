import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  UserPlus,
  UserMinus,
  Lock,
  Unlock,
  Shield,
  Edit,
  LogOut,
  Check,
  Loader2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface DocumentActivityLogProps {
  documentId: number;
}

interface ActivityLogEntry {
  id: number;
  documentId: number;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  metadata: any;
  createdAt: string;
}

const activityIcons: Record<string, any> = {
  collaborator_invited: UserPlus,
  collaborator_accepted: Check,
  collaborator_removed: UserMinus,
  collaborator_left: LogOut,
  collaborator_permission_changed: Shield,
  lock_acquired: Lock,
  lock_released: Unlock,
  lock_taken_over: Shield,
  document_edited: Edit,
};

const activityColors: Record<string, string> = {
  collaborator_invited: "text-blue-600",
  collaborator_accepted: "text-green-600",
  collaborator_removed: "text-red-600",
  collaborator_left: "text-orange-600",
  collaborator_permission_changed: "text-purple-600",
  lock_acquired: "text-amber-600",
  lock_released: "text-gray-600",
  lock_taken_over: "text-red-600",
  document_edited: "text-blue-600",
};

const getActivityDescription = (entry: ActivityLogEntry): string => {
  const userName = entry.userName || entry.userEmail || "Someone";

  switch (entry.action) {
    case "collaborator_invited":
      return `${userName} invited ${entry.metadata?.collaboratorEmail} as a ${entry.metadata?.permission}`;
    case "collaborator_accepted":
      return `${userName} accepted the collaboration invitation`;
    case "collaborator_removed":
      return `${userName} removed ${entry.metadata?.collaboratorEmail} as a collaborator`;
    case "collaborator_left":
      return `${userName} left the document`;
    case "collaborator_permission_changed":
      return `${userName} changed permission to ${entry.metadata?.newPermission}`;
    case "lock_acquired":
      return `${userName} started editing`;
    case "lock_released":
      return `${userName} stopped editing`;
    case "lock_taken_over":
      return `${userName} took over editing from ${entry.metadata?.previousUser}`;
    case "document_edited":
      return `${userName} edited the document`;
    default:
      return `${userName} performed ${entry.action}`;
  }
};

export function DocumentActivityLog({ documentId }: DocumentActivityLogProps) {
  const [limit] = useState(50);
  const [offset] = useState(0);

  const { data: activities = [], isLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: [`/api/cim/${documentId}/activity`, limit, offset],
    queryFn: async () => {
      const response = await fetch(`/api/cim/${documentId}/activity?limit=${limit}&offset=${offset}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch activity log");
      return response.json();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Recent activity and changes to this document
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No activity yet
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {activities.map((entry, index) => {
                const Icon = activityIcons[entry.action] || History;
                const colorClass = activityColors[entry.action] || "text-gray-600";

                return (
                  <div key={entry.id} className="flex gap-3 pb-4 border-b last:border-0">
                    <div className={`mt-1 ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {getActivityDescription(entry)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
