import { Loader2 } from "lucide-react";

type LoadingAnimationProps = {
  text?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function LoadingAnimation({ text = "Loading...", size = "md" }: LoadingAnimationProps) {
  return (
    <div className="flex items-center justify-center space-x-2">
      <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
      <span className="text-sm">{text}</span>
    </div>
  );
}