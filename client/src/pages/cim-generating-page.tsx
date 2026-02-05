import { useMemo, useState, useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useCimGeneration } from '@/contexts/cim-generation-context';
import { Button } from '@/components/ui/button';
import { Sparkles, Lightbulb, X, ArrowLeft, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

export function CimGeneratingPage() {
  const [, params] = useRoute('/documents/:id/generating');
  const [, setLocation] = useLocation();
  const docId = params?.id ? parseInt(params.id) : null;

  const cimGeneration = useCimGeneration();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(() =>
    Math.floor(Math.random() * HELPFUL_TIPS.length)
  );

  // Poll document status directly for this page
  const { data: docStatus } = useQuery<{
    generationStatus: string;
    generationError?: string;
    title?: string;
  }>({
    queryKey: [`/api/cim/${docId}/status`],
    enabled: !!docId,
    refetchInterval: 3000,
  });

  // Redirect to document page if generation is complete
  useEffect(() => {
    if (docStatus?.generationStatus === 'ready' && docId) {
      setLocation(`/documents/${docId}?tab=edit`);
    }
  }, [docStatus?.generationStatus, docId, setLocation]);

  // Update elapsed time every second
  useEffect(() => {
    const startedAt = cimGeneration.activeGeneration?.startedAt || Date.now();
    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [cimGeneration.activeGeneration?.startedAt]);

  // Rotate tips every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => {
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * HELPFUL_TIPS.length);
        } while (newIndex === prev && HELPFUL_TIPS.length > 1);
        return newIndex;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Generate stable particle data
  const floatingParticles = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 8 + 2,
      delay: 0,
      duration: 5,
    }));
  }, []);

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedDisplay = elapsedMinutes > 0
    ? `${elapsedMinutes}m ${elapsedSeconds % 60}s`
    : `${elapsedSeconds}s`;

  const title = cimGeneration.activeGeneration?.title || docStatus?.title || 'Your CIM';

  const handleCancelConfirm = async () => {
    setIsCancelling(true);
    try {
      await cimGeneration.cancelGeneration();
      setLocation('/documents');
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  // Show error state if generation failed
  if (docStatus?.generationStatus === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <main className="px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
          </div>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-red-200 rounded-lg shadow-xl p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Generation Failed</h2>
              <p className="text-gray-600 mb-4">
                {docStatus?.generationError || "An error occurred during CIM generation. Please try again."}
              </p>
              <div className="flex justify-center gap-3">
                <Link href="/documents">
                  <Button variant="outline">Back to Documents</Button>
                </Link>
                <Link href="/dashboard?mode=cim">
                  <Button>Try Again</Button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50/95 via-purple-50/95 to-pink-50/95 relative overflow-hidden">
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {floatingParticles.map((particle) => (
            <div
              key={particle.id}
              className="absolute rounded-full bg-gradient-to-br from-blue-400/30 to-purple-400/30 animate-float-up blur-[0.5px]"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
              }}
            />
          ))}
        </div>

        <main className="relative z-10 px-4 md:px-6 py-4 md:py-6">
          {/* Back link */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/documents">
              <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
          </div>

          <div className="max-w-2xl mx-auto">
            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
                <Sparkles className="h-8 w-8 text-purple-500 animate-pulse" />
                Generating Your CIM
                <Sparkles className="h-8 w-8 text-purple-500 animate-pulse" />
              </h2>
              <p className="text-sm text-gray-600">
                Our AI is crafting your professional Confidential Information Memorandum
              </p>
            </div>

            {/* Main progress card */}
            <div className="bg-white border rounded-lg shadow-xl p-6 space-y-4">
              {/* Document info */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 truncate max-w-md">
                    {title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Time elapsed: {elapsedDisplay}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Generating...</span>
                </div>
              </div>

              {/* Progress animation */}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full animate-progress-indeterminate"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Stage description */}
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span>AI is analyzing your business data and generating a comprehensive document...</span>
                </div>
              </div>

              {/* Navigate away message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  <strong>Feel free to navigate elsewhere</strong> — you'll receive a notification when your document is ready.
                </p>
              </div>

              {/* Cancel button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full text-gray-700 border-gray-300 hover:bg-gray-100"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Generation
                </Button>
              </div>
            </div>

            {/* Tips section */}
            <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 shadow-lg">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Pro Tip</p>
                  <p
                    key={currentTipIndex}
                    className="text-sm text-gray-600 mt-1 animate-in fade-in duration-700"
                  >
                    {HELPFUL_TIPS[currentTipIndex]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel CIM Generation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the generation of "{title}"?
              This will delete the in-progress document and you'll need to start over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep Generating
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default CimGeneratingPage;
