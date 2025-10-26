import { useEffect, useState } from "react";
import { Loader2, CheckCircle, FileText, Zap, Upload, Database, Sparkles, Lightbulb } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type CimGenerationStage = 
  | "initializing"
  | "processing_transcript"
  | "analyzing_website"
  | "analyzing_content"
  | "generating_document"
  | "processing_financials"
  | "finalizing"
  | "complete";

type CimGenerationProgressProps = {
  stage: CimGenerationStage;
  hasFinancials?: boolean;
  hasLargeContent?: boolean;
  showAsModal?: boolean;
};

const HELPFUL_TIPS = [
  "A strong executive summary can make or break a CIM. Keep it concise but compelling.",
  "Include specific financial metrics and growth trends to demonstrate business value.",
  "Use clear, jargon-free language that both industry insiders and outsiders can understand.",
  "Quality photos and professional formatting increase perceived business value by up to 30%.",
  "Always highlight unique selling propositions and competitive advantages early in the document.",
  "Business brokers who respond to inquiries within 1 hour are 7x more likely to convert leads.",
  "The best CIMs tell a story - connect the numbers to the narrative of business growth.",
  "Include customer testimonials or case studies when possible to build credibility.",
  "Address potential buyer concerns proactively rather than waiting for due diligence.",
  "Market comparable sales data strengthens your asking price justification.",
  "Professional NDAs protect both seller and buyer - never skip this step.",
  "Organize financial data chronologically to show clear trends and patterns.",
  "Successful brokers maintain relationships with buyers even after deals close.",
  "Use data visualization for complex financial information - charts speak louder than tables.",
  "The first page sets the tone - make sure it captures attention immediately.",
];

const stageConfig = {
  initializing: {
    label: "Initializing document creation",
    icon: FileText,
    progress: 5
  },
  processing_transcript: {
    label: "Processing your business information",
    icon: Upload,
    progress: 20
  },
  analyzing_website: {
    label: "Analyzing website content and business intelligence",
    icon: Zap,
    progress: 30
  },
  analyzing_content: {
    label: "Analyzing business data and structure",
    icon: Database,
    progress: 50
  },
  generating_document: {
    label: "Generating comprehensive CIM document (this stage may take a minute...)",
    icon: Sparkles,
    progress: 70
  },
  processing_financials: {
    label: "Processing financial data and files",
    icon: Zap,
    progress: 85
  },
  finalizing: {
    label: "Finalizing document and preparing for review",
    icon: CheckCircle,
    progress: 95
  },
  complete: {
    label: "Document generation complete",
    icon: CheckCircle,
    progress: 100
  }
};

export function CimGenerationProgress({
  stage,
  hasFinancials = false,
  hasLargeContent = false,
  showAsModal = false
}: CimGenerationProgressProps) {
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const targetProgress = stageConfig[stage].progress;

  // Rotate tips every 20 seconds
  useEffect(() => {
    if (!showAsModal) return;

    const tipInterval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % HELPFUL_TIPS.length);
    }, 20000);

    return () => clearInterval(tipInterval);
  }, [showAsModal]);
  
  // Smooth progress animation with faster completion for final stages
  useEffect(() => {
    // Helper to detect if we're in a completion stage
    const isCompletionStage = targetProgress >= 85;
    
    const interval = setInterval(() => {
      setCurrentProgress(prev => {
        if (prev >= targetProgress) return prev;
        
        // Speed up animation for final completion stages (85%+) for better UX
        const animationSpeed = isCompletionStage ? 5 : 10; // Faster for completion stages
        const increment = Math.max(1, (targetProgress - prev) / animationSpeed);
        
        return Math.min(prev + increment, targetProgress);
      });
    }, isCompletionStage ? 50 : 100); // Faster interval for completion stages
    
    return () => clearInterval(interval);
  }, [targetProgress]);

  // Get relevant stages based on content type
  const getRelevantStages = (): CimGenerationStage[] => {
    const baseStages: CimGenerationStage[] = [
      "initializing",
      "processing_transcript",
      "analyzing_content",
      "generating_document"
    ];
    
    if (hasFinancials) {
      baseStages.push("processing_financials");
    }
    
    baseStages.push("finalizing", "complete");
    return baseStages;
  };

  const relevantStages = getRelevantStages();
  const currentStageIndex = relevantStages.indexOf(stage);
  const CurrentIcon = stageConfig[stage].icon;

  const getEstimatedTime = (): string => {
    switch (stage) {
      case "initializing":
        return "5-10 seconds";
      case "processing_transcript":
        return hasLargeContent ? "15-30 seconds" : "10-20 seconds";
      case "analyzing_content":
        return "20-40 seconds";
      case "generating_document":
        return "30-60 seconds";
      case "processing_financials":
        return "10-20 seconds";
      case "finalizing":
        return "5-15 seconds";
      case "complete":
        return "Complete";
      default:
        return "Processing";
    }
  };

  const progressContent = (
    <div className="flex flex-col w-full space-y-4 p-6 bg-white dark:bg-card border rounded-lg shadow-xl">
      {/* Main progress indicator */}
      <div className="flex items-center space-x-3">
        <CurrentIcon className="h-6 w-6 text-primary animate-pulse" />
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-foreground">
              {stageConfig[stage].label}
            </h3>
            <span className="text-xs text-muted-foreground">
              {Math.round(currentProgress)}%
            </span>
          </div>
          <Progress value={currentProgress} className="h-2" />
        </div>
      </div>

      {/* Estimated time */}
      <div className="text-xs text-muted-foreground text-center">
        Estimated time: {getEstimatedTime()}
      </div>

      {/* Stage breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Generation Steps
        </h4>
        <div className="grid gap-1">
          {relevantStages.map((stageKey, index) => {
            const stageInfo = stageConfig[stageKey];
            const StageIcon = stageInfo.icon;
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const isPending = index > currentStageIndex;
            
            return (
              <div
                key={stageKey}
                className={`flex items-center text-xs space-x-2 transition-all duration-200 ${
                  isCompleted 
                    ? "text-green-600 dark:text-green-400" 
                    : isCurrent 
                      ? "text-primary font-medium" 
                      : "text-muted-foreground opacity-60"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="h-3 w-3" />
                ) : isCurrent ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-current opacity-40" />
                )}
                <span className="flex-1">
                  {stageInfo.label}
                </span>
                {isCompleted && (
                  <span className="text-green-500">✓</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional info for current stage */}
      {stage === "generating_document" && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <div className="flex items-center space-x-1">
            <Sparkles className="h-3 w-3" />
            <span>AI is creating your professional CIM document with detailed analysis</span>
          </div>
        </div>
      )}

      {stage === "processing_financials" && hasFinancials && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <div className="flex items-center space-x-1">
            <Zap className="h-3 w-3" />
            <span>Processing financial data and uploaded documents</span>
          </div>
        </div>
      )}

      {hasLargeContent && stage === "processing_transcript" && (
        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-1">
            <Upload className="h-3 w-3 text-blue-600" />
            <span>Processing large content - this may take a bit longer</span>
          </div>
        </div>
      )}
    </div>
  );

  // Render as modal with darkened background
  if (showAsModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="max-w-2xl w-full mx-4">
          {progressContent}

          {/* Tips section */}
          <div className="mt-4 p-4 bg-white dark:bg-card rounded-lg border border-blue-200 dark:border-blue-800 shadow-lg">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Pro Tip</p>
                <p
                  key={currentTipIndex}
                  className="text-sm text-gray-600 dark:text-gray-400 mt-1 animate-in fade-in duration-700"
                >
                  {HELPFUL_TIPS[currentTipIndex]}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render inline
  return progressContent;
}