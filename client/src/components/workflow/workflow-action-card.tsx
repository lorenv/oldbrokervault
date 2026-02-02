/**
 * WorkflowActionCard
 *
 * Displays the action with configurable fields and mapping progress.
 */

import { cn } from "@/lib/utils";
import {
  Zap,
  User,
  Tag,
  FileText,
  Bell,
  Mail,
  Briefcase,
  Activity,
  FolderOpen,
  FileSignature,
  UserPlus,
  Users,
  CheckSquare,
  MessageSquare,
} from "lucide-react";

interface WorkflowActionCardProps {
  type: string;
  label: string;
  description?: string;
  mappedFieldCount?: number;
  totalFieldCount?: number;
  onClick?: () => void;
  className?: string;
}

// Icons for different action types
const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  internal_update_stage: Activity,
  internal_create_task: CheckSquare,
  internal_assign_owner: User,
  internal_add_tag: Tag,
  internal_remove_tag: Tag,
  internal_update_field: FileText,
  internal_send_notification: Bell,
  internal_add_note: MessageSquare,
  internal_send_email: Mail,
  internal_create_contact: UserPlus,
  internal_create_deal: Briefcase,
  internal_move_deal_stage: Activity,
  internal_log_activity: Activity,
  internal_grant_dataroom_access: FolderOpen,
  internal_send_nda: FileSignature,
  create_contact: UserPlus,
  create_deal: Briefcase,
  create_task: CheckSquare,
  add_note: MessageSquare,
  create_company: Users,
};

export function WorkflowActionCard({
  type,
  label,
  description,
  mappedFieldCount = 0,
  totalFieldCount = 0,
  onClick,
  className,
}: WorkflowActionCardProps) {
  const IconComponent = actionIcons[type] || Zap;
  const hasProgress = totalFieldCount > 0;
  const progressPercent = hasProgress ? Math.round((mappedFieldCount / totalFieldCount) * 100) : 0;
  const isComplete = mappedFieldCount >= totalFieldCount && totalFieldCount > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-lg border bg-white p-4 shadow-sm transition-all min-w-[200px]",
        onClick && "cursor-pointer hover:border-purple-300 hover:shadow-md",
        isComplete && "border-green-200",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-100">
          <IconComponent className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Action
          </div>
          <div className="text-xs text-gray-400">
            {type.startsWith('internal_') ? 'Internal' : 'Create'}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-3">
        <div className="font-medium text-gray-900 truncate">{label}</div>
        {description && (
          <div className="text-sm text-gray-500 mt-1 line-clamp-2">{description}</div>
        )}
      </div>

      {/* Progress indicator */}
      {hasProgress && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">
              {mappedFieldCount}/{totalFieldCount} fields mapped
            </span>
            <span className={cn(
              "font-medium",
              isComplete ? "text-green-600" : "text-gray-600"
            )}>
              {progressPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isComplete ? "bg-green-500" : "bg-purple-500"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
