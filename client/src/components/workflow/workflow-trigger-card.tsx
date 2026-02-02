/**
 * WorkflowTriggerCard
 *
 * Displays the trigger source (webhook, event, schedule) with icon and status.
 */

import { cn } from "@/lib/utils";
import { Webhook, Zap, Clock, CheckCircle2, Loader2 } from "lucide-react";

interface WorkflowTriggerCardProps {
  type: 'webhook' | 'event' | 'schedule';
  name: string;
  description?: string;
  status?: 'idle' | 'waiting' | 'received' | 'active';
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const typeIcons = {
  webhook: Webhook,
  event: Zap,
  schedule: Clock,
};

const typeLabels = {
  webhook: 'Incoming Webhook',
  event: 'CRM Event',
  schedule: 'Scheduled',
};

export function WorkflowTriggerCard({
  type,
  name,
  description,
  status = 'idle',
  icon,
  onClick,
  className,
}: WorkflowTriggerCardProps) {
  const IconComponent = typeIcons[type];

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-lg border bg-white p-4 shadow-sm transition-all min-w-[200px]",
        onClick && "cursor-pointer hover:border-blue-300 hover:shadow-md",
        status === 'waiting' && "border-blue-300",
        status === 'received' && "border-green-300",
        className
      )}
    >
      {/* Status indicator */}
      {status !== 'idle' && (
        <div className="absolute -top-2 -right-2">
          {status === 'waiting' && (
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            </div>
          )}
          {status === 'received' && (
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          )}
          {status === 'active' && (
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "flex items-center justify-center h-10 w-10 rounded-lg",
          type === 'webhook' && "bg-purple-100",
          type === 'event' && "bg-yellow-100",
          type === 'schedule' && "bg-blue-100"
        )}>
          {icon || (
            <IconComponent className={cn(
              "h-5 w-5",
              type === 'webhook' && "text-purple-600",
              type === 'event' && "text-yellow-600",
              type === 'schedule' && "text-blue-600"
            )} />
          )}
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Trigger
          </div>
          <div className="text-xs text-gray-400">
            {typeLabels[type]}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-3">
        <div className="font-medium text-gray-900 truncate">{name}</div>
        {description && (
          <div className="text-sm text-gray-500 mt-1 line-clamp-2">{description}</div>
        )}
      </div>

      {/* Status message */}
      {status === 'waiting' && (
        <div className="mt-3 text-xs text-blue-600 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Waiting for data...
        </div>
      )}
      {status === 'received' && (
        <div className="mt-3 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Data received
        </div>
      )}
    </div>
  );
}
