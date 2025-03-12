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
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative">
        <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
        <div className="absolute -right-2 -top-2 animate-bounce">✨</div>
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
    </div>
  );
}
