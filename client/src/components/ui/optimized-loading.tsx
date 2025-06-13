import React from "react";
import { Loader2 } from "lucide-react";

interface OptimizedLoadingProps {
  stage?: string | null;
  message?: string;
  className?: string;
}

const STAGE_MESSAGES = {
  analyzing: "Analyzing website content...",
  enhancing: "Enhancing with AI analysis...",
  generating: "Generating your CIM document...",
  processing: "Processing your request...",
  uploading: "Uploading files...",
  saving: "Saving document..."
};

export const OptimizedLoading = React.memo(({ 
  stage, 
  message, 
  className = "" 
}: OptimizedLoadingProps) => {
  const displayMessage = message || (stage ? STAGE_MESSAGES[stage as keyof typeof STAGE_MESSAGES] : "Loading...");
  
  return (
    <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
      <p className="text-gray-600 text-center max-w-md">
        {displayMessage}
      </p>
      {stage && (
        <div className="w-64 bg-gray-200 rounded-full h-2 mt-4">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ 
              width: stage === 'analyzing' ? '33%' : 
                     stage === 'enhancing' ? '66%' : 
                     stage === 'generating' ? '90%' : '100%' 
            }}
          />
        </div>
      )}
    </div>
  );
});

OptimizedLoading.displayName = "OptimizedLoading";