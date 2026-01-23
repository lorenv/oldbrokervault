/**
 * WorkflowConnector
 *
 * Visual arrow connecting trigger to action in the workflow builder.
 */

import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface WorkflowConnectorProps {
  animated?: boolean;
  className?: string;
}

export function WorkflowConnector({ animated = false, className }: WorkflowConnectorProps) {
  return (
    <div className={cn("flex items-center justify-center px-4", className)}>
      <div className="flex items-center">
        <div
          className={cn(
            "h-0.5 w-8 bg-gray-300",
            animated && "animate-pulse bg-blue-400"
          )}
        />
        <ArrowRight
          className={cn(
            "h-5 w-5 text-gray-400",
            animated && "text-blue-500 animate-pulse"
          )}
        />
      </div>
    </div>
  );
}
