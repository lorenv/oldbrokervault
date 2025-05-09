import { useEffect, useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";

type LoadingAnimationProps = {
  text?: string;
  size?: "sm" | "md" | "lg";
  progressSteps?: string[];
  showProgress?: boolean;
};

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function LoadingAnimation({ 
  text = "Loading...", 
  size = "md", 
  progressSteps = [], 
  showProgress = false 
}: LoadingAnimationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const hasProgressSteps = progressSteps.length > 0 && showProgress;

  useEffect(() => {
    if (!hasProgressSteps) return;
    
    // Auto-advance through steps for better UX
    const interval = setInterval(() => {
      setCurrentStepIndex(prev => {
        if (prev >= progressSteps.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2000); // Advance every 2 seconds
    
    return () => clearInterval(interval);
  }, [hasProgressSteps, progressSteps.length]);

  if (!hasProgressSteps) {
    return (
      <div className="flex items-center justify-center space-x-2">
        <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
        <span className="text-sm text-foreground">{text}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-center justify-center space-x-2 mb-2">
        <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
        <span className="text-sm font-medium text-foreground">{text}</span>
      </div>
      
      <div className="w-full space-y-1 mt-1">
        {progressSteps.map((step, index) => (
          <div 
            key={index} 
            className={`flex items-center text-xs transition-opacity duration-200 ${
              index > currentStepIndex ? "opacity-40" : "opacity-100"
            }`}
          >
            {index < currentStepIndex ? (
              <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
            ) : index === currentStepIndex ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <div className="h-3 w-3 rounded-full border border-muted-foreground/30 mr-1" />
            )}
            <span className={`${index === currentStepIndex ? "font-medium" : ""} text-foreground`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}