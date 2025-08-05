import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Edit, Share2, Download, Eye, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: "top" | "bottom" | "left" | "right";
  icon: React.ComponentType<any>;
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your CIM Editor!",
    description: "Your CIM document has been generated with AI. Let's take a quick tour to help you get started with editing and sharing.",
    target: ".cim-document-container",
    position: "top",
    icon: Sparkles
  },
  {
    id: "click-to-edit",
    title: "Click to Edit Content",
    description: "Click on any section title or content to edit it directly. You can use rich text formatting with bold, italics, and lists.",
    target: ".cim-section-first",
    position: "right",
    icon: Edit
  },
  {
    id: "drag-and-drop",
    title: "Rearrange Sections",
    description: "Drag and drop sections to reorder them. Custom sections can be added and positioned anywhere in your document.",
    target: ".cim-section",
    position: "left",
    icon: Eye
  },
  {
    id: "share-options",
    title: "Share Your CIM",
    description: "Use the share dropdown to create secure share links, email documents, or download as PDF. You can also add password protection.",
    target: "[data-tour='share-button']",
    position: "bottom",
    icon: Share2
  },
  {
    id: "export-options",
    title: "Export Options",
    description: "Download your CIM as PDF, Word document, or export to other formats. All formatting and images will be preserved.",
    target: "[data-tour='export-button']",
    position: "bottom",
    icon: Download
  }
];

interface CimEditTourProps {
  isFirstTime?: boolean;
  onComplete?: () => void;
}

export function CimEditTour({ isFirstTime = false, onComplete }: CimEditTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    // Auto-start tour for first-time users after a short delay
    if (isFirstTime) {
      const timer = setTimeout(() => {
        setIsActive(true);
        setShowOverlay(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isFirstTime]);

  const currentStepData = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const nextStep = () => {
    if (isLastStep) {
      completeTour();
    } else {
      setCurrentStep(current => current + 1);
    }
  };

  const prevStep = () => {
    if (!isFirstStep) {
      setCurrentStep(current => current - 1);
    }
  };

  const completeTour = () => {
    setIsActive(false);
    setShowOverlay(false);
    setCurrentStep(0);
    onComplete?.();
    
    // Store tour completion in localStorage
    localStorage.setItem('cim-edit-tour-completed', 'true');
  };

  const skipTour = () => {
    completeTour();
  };

  if (!isActive) return null;

  return (
    <>
      {/* Overlay */}
      {showOverlay && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-all duration-300" />
      )}
      
      {/* Tour Tooltip */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <Card className="absolute max-w-sm bg-white border-2 border-blue-200 shadow-xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <currentStepData.icon className="w-4 h-4 text-blue-600" />
                </div>
                <Badge variant="secondary" className="text-xs">
                  Step {currentStep + 1} of {tourSteps.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">
                {currentStepData.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {currentStepData.description}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 mb-4">
              <div className="flex space-x-1">
                {tourSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      index <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={prevStep}
                disabled={isFirstStep}
                className="text-xs"
              >
                <ChevronLeft className="w-3 h-3 mr-1" />
                Previous
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="text-xs text-gray-500"
              >
                Skip Tour
              </Button>

              <Button
                size="sm"
                onClick={nextStep}
                className="text-xs bg-blue-600 hover:bg-blue-700"
              >
                {isLastStep ? 'Finish' : 'Next'}
                {!isLastStep && <ChevronRight className="w-3 h-3 ml-1" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Hook to check if user should see the tour
export function useCimEditTour() {
  const [shouldShowTour, setShouldShowTour] = useState(false);

  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('cim-edit-tour-completed');
    const isFirstTimeFromUrl = new URLSearchParams(window.location.search).has('first-time');
    
    if (!hasCompletedTour && isFirstTimeFromUrl) {
      setShouldShowTour(true);
    }
  }, []);

  const completeTour = () => {
    setShouldShowTour(false);
    // Remove the first-time parameter from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('first-time');
    window.history.replaceState({}, '', url.toString());
  };

  return { shouldShowTour, completeTour };
}