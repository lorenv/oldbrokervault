import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ChevronLeft, ChevronRight, Sparkles, FileText, Share2, Shield, BarChart3 } from "lucide-react";

interface GuidedTourProps {
  onComplete: () => void;
}

export function GuidedTour({ onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show the tour after a brief delay for smooth animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const tourSteps = [
    {
      title: "Welcome to CIM Share! 🎉",
      content: "You've successfully created your account! Let's take a quick tour of your new document management platform.",
      icon: <Sparkles className="w-8 h-8 text-blue-600" />,
    },
    {
      title: "Create Your First CIM",
      content: "Click the 'Create New CIM' button to start building professional Confidential Information Memorandums using our AI-powered tools.",
      icon: <FileText className="w-8 h-8 text-green-600" />,
    },
    {
      title: "Secure Document Sharing",
      content: "Share your CIM documents with built-in NDA protection, access controls, and detailed view tracking for maximum security.",
      icon: <Share2 className="w-8 h-8 text-purple-600" />,
    },
    {
      title: "NDA Management",
      content: "Manage digital NDAs, collect signatures, and maintain audit trails for all document access and agreements.",
      icon: <Shield className="w-8 h-8 text-orange-600" />,
    },
    {
      title: "Analytics & Insights",
      content: "Track document performance with detailed analytics, view counts, and engagement metrics to optimize your outreach.",
      icon: <BarChart3 className="w-8 h-8 text-indigo-600" />,
    }
  ];

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => {
      sessionStorage.removeItem('isNewUser');
      onComplete();
    }, 300);
  };

  if (!isVisible) return null;

  const currentTourStep = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className={`w-full max-w-lg bg-white shadow-2xl border-0 transition-all duration-300 ${
        isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentTourStep.icon}
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">
                  {currentTourStep.title}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    Step {currentStep + 1} of {tourSteps.length}
                  </Badge>
                  <div className="flex gap-1">
                    {tourSteps.map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentStep ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleComplete}
              className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-gray-600 leading-relaxed">
              {currentTourStep.content}
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleComplete}>
                Skip Quick Start Guide
              </Button>
              <Button 
                onClick={handleNext}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-2"
              >
                {currentStep === tourSteps.length - 1 ? (
                  'Get Started'
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}