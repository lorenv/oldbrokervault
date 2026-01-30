import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileSignature,
  Pen,
  Type,
  CheckCircle2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Ban,
  XCircle,
  Shield,
  FileCheck,
  Sparkles,
  Clock,
  ListChecks,
  Tag,
  AlertTriangle,
  CalendarIcon,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface SigningField {
  id: string;
  type: 'signature' | 'initials' | 'name' | 'email' | 'date' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  value?: string;
}

interface SigningData {
  envelope: {
    id: number;
    title: string;
    message: string | null;
    pageImages: string[];
    totalPages: number;
  };
  recipient: {
    id: number;
    name: string;
    email: string;
    role: string;
    color: string;
  };
  branding: {
    logoUrl: string | null;
    primaryColor: string;
    companyName: string | null;
  } | null;
  fields: SigningField[];
}

export default function EsignSign() {
  const [, params] = useRoute("/esign/sign/:token");
  const accessToken = params?.token;

  const { toast } = useToast();

  // State
  const [zoom, setZoom] = useState(1);
  const [fields, setFields] = useState<SigningField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [signatureTab, setSignatureTab] = useState<'draw' | 'type'>('type');
  const [typedSignature, setTypedSignature] = useState("");
  const [hasConsented, setHasConsented] = useState(false);
  const [consentedAt, setConsentedAt] = useState<string | null>(null);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showFieldsModal, setShowFieldsModal] = useState(false);

  // PowerForm next signer state
  const [nextSignerInfo, setNextSignerInfo] = useState<{
    placeholderId: string;
    label: string;
    color: string;
    allowLinkSharing: boolean;
    envelopeId: string;
    currentSignerToken: string;
  } | null>(null);
  const [nextSignerName, setNextSignerName] = useState("");
  const [nextSignerEmail, setNextSignerEmail] = useState("");
  const [sendingNextSigner, setSendingNextSigner] = useState(false);
  const [nextSignerUrl, setNextSignerUrl] = useState<string | null>(null);
  const [copiedNextSignerUrl, setCopiedNextSignerUrl] = useState(false);

  // Cached signatures for quick reuse (DocuSign-style)
  const [cachedSignature, setCachedSignature] = useState<string | null>(null);
  const [cachedInitials, setCachedInitials] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<{
    summary: string;
    keyPoints: string[];
    importantTerms: string[];
    estimatedReadTime: string;
    disclaimer: string;
    totalPages?: number;
    pagesAnalyzed?: number;
    pageLimitReached?: boolean;
  } | null>(null);

  // Canvas for drawing signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Fetch signing data
  const { data, isLoading, error } = useQuery<SigningData>({
    queryKey: ["/api/esign/sign", accessToken],
    queryFn: async () => {
      if (!accessToken) throw new Error('No access token');
      const res = await fetch(`/api/esign/sign/${accessToken}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to load signing data');
      }
      return res.json();
    },
    enabled: !!accessToken,
  });

  // Initialize fields from data
  useEffect(() => {
    if (data) {
      setFields(data.fields.map(f => ({ ...f, value: f.value || '' })));
    }
  }, [data]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [showSignatureModal]);

  // Canvas drawing handlers - Mouse events
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Canvas drawing handlers - Touch events for mobile
  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling while drawing
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    setIsDrawing(true);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling while drawing
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawingTouch = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Apply signature to field
  const applySignature = () => {
    if (!selectedFieldId) return;

    const selectedField = fields.find(f => f.id === selectedFieldId);
    const isInitials = selectedField?.type === 'initials';

    let signatureValue = '';

    if (signatureTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      signatureValue = canvas.toDataURL('image/png');
    } else {
      if (!typedSignature.trim()) return;
      signatureValue = typedSignature;
    }

    // Cache the signature/initials for quick reuse
    if (isInitials) {
      setCachedInitials(signatureValue);
    } else {
      setCachedSignature(signatureValue);
    }

    setFields(fields.map(f =>
      f.id === selectedFieldId ? { ...f, value: signatureValue } : f
    ));

    setShowSignatureModal(false);
    setSelectedFieldId(null);
    clearCanvas();
    setTypedSignature("");
  };

  // Quick apply cached signature/initials with one click
  const applyCachedSignature = (fieldId: string, isInitials: boolean) => {
    const cachedValue = isInitials ? cachedInitials : cachedSignature;
    if (!cachedValue) return;

    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, value: cachedValue } : f
    ));
  };

  // Update text field value
  const updateFieldValue = (fieldId: string, value: string) => {
    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, value } : f
    ));
  };

  // Submit signing mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      // Submit each field value
      for (const field of fields) {
        if (field.value) {
          const fieldRes = await fetch(`/api/esign/sign/${accessToken}/field/${field.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: field.value }),
          });

          if (!fieldRes.ok) {
            const errData = await fieldRes.json();
            throw new Error(errData.error || `Failed to save field ${field.type}`);
          }
        }
      }

      // Complete the signing
      const res = await fetch(`/api/esign/sign/${accessToken}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to complete signing');
      }

      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Document signed!",
        description: result.envelopeCompleted
          ? "All parties have signed. You will receive the completed document shortly."
          : "Thank you for signing. Other parties will be notified.",
      });
      // Capture next signer info for PowerForm sequential mode
      if (result.nextSignerInfo) {
        setNextSignerInfo(result.nextSignerInfo);
      }
      // Show a success state instead of reloading
      setShowSuccessState(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/esign/sign/${accessToken}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to decline');
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Document declined",
        description: "The sender has been notified of your decision.",
      });
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // E-SIGN Act consent mutation
  const consentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/esign/sign/${accessToken}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to record consent');
      }

      return res.json();
    },
    onSuccess: (result) => {
      setHasConsented(true);
      setConsentedAt(result.consentedAt);
      setShowConsentDialog(false);
      toast({
        title: "Consent recorded",
        description: "You may now proceed with signing the document.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // AI Document Summarize mutation
  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/esign/sign/${accessToken}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to summarize document');
      }

      return res.json();
    },
    onSuccess: (result) => {
      setSummaryData(result);
      setShowSummaryModal(true);
    },
    onError: (error: any) => {
      toast({
        title: "Unable to summarize",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Validation
  const requiredFields = fields.filter(f => f.required);
  const completedRequiredFields = requiredFields.filter(f => f.value);
  const canSubmit = completedRequiredFields.length === requiredFields.length && hasConsented;
  const progress = requiredFields.length > 0
    ? Math.round((completedRequiredFields.length / requiredFields.length) * 100)
    : 100;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-lg font-medium mb-2">Unable to Load Document</h2>
              <p className="text-gray-500">
                {(error as any)?.message || "This signing link may be invalid or expired."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Function to add next signer for PowerForm
  const handleAddNextSigner = async (sendEmail: boolean) => {
    if (!nextSignerInfo || !nextSignerName.trim() || !nextSignerEmail.trim()) return;

    setSendingNextSigner(true);
    try {
      const res = await fetch(`/api/esign/form/envelope/${nextSignerInfo.envelopeId}/add-signer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentSignerToken: nextSignerInfo.currentSignerToken,
          nextSigner: {
            placeholderId: nextSignerInfo.placeholderId,
            name: nextSignerName,
            email: nextSignerEmail,
          },
          sendEmail,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to add signer');
      }

      const result = await res.json();

      if (sendEmail) {
        toast({
          title: "Invitation sent!",
          description: `${nextSignerName} has been notified to sign the document.`,
        });
        setNextSignerInfo(null); // Clear the form
      } else {
        setNextSignerUrl(result.recipient.signingUrl);
        toast({
          title: "Link generated!",
          description: "Copy the link below to share with the next signer.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingNextSigner(false);
    }
  };

  const copyNextSignerUrl = () => {
    if (nextSignerUrl) {
      navigator.clipboard.writeText(nextSignerUrl);
      setCopiedNextSignerUrl(true);
      setTimeout(() => setCopiedNextSignerUrl(false), 2000);
      toast({
        title: "Link copied!",
        description: "Share this link with the next signer.",
      });
    }
  };

  // Success state after signing
  if (showSuccessState) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Successfully Signed!</h2>
              <p className="text-gray-500 mb-4">
                Thank you for signing "{data.envelope.title}".
                {!nextSignerInfo && " You will receive a copy of the completed document once all parties have signed."}
              </p>
              <div className="p-4 bg-gray-50 rounded-lg w-full mb-4">
                <p className="text-sm text-gray-600">Signed as</p>
                <p className="font-medium">{data.recipient.name}</p>
                <p className="text-sm text-gray-500">{data.recipient.email}</p>
              </div>

              {/* Next signer section for PowerForm sequential mode */}
              {nextSignerInfo && !nextSignerUrl && (
                <div className="w-full border-t pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: nextSignerInfo.color }}
                    />
                    <h3 className="font-medium text-gray-900">
                      Next: {nextSignerInfo.label}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Share this document with the next signer to complete:
                  </p>
                  <div className="space-y-3 text-left">
                    <div>
                      <Label htmlFor="nextName" className="text-sm">Name</Label>
                      <Input
                        id="nextName"
                        value={nextSignerName}
                        onChange={(e) => setNextSignerName(e.target.value)}
                        placeholder="Enter their name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nextEmail" className="text-sm">Email</Label>
                      <Input
                        id="nextEmail"
                        type="email"
                        value={nextSignerEmail}
                        onChange={(e) => setNextSignerEmail(e.target.value)}
                        placeholder="Enter their email"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Button
                      onClick={() => handleAddNextSigner(true)}
                      disabled={!nextSignerName.trim() || !nextSignerEmail.trim() || sendingNextSigner}
                      className="flex-1"
                    >
                      {sendingNextSigner ? (
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Send Email Invitation
                    </Button>
                    {nextSignerInfo.allowLinkSharing && (
                      <Button
                        variant="outline"
                        onClick={() => handleAddNextSigner(false)}
                        disabled={!nextSignerName.trim() || !nextSignerEmail.trim() || sendingNextSigner}
                        className="flex-1"
                      >
                        Get Link to Share
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Show generated link */}
              {nextSignerUrl && (
                <div className="w-full border-t pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium text-gray-900">Link Ready!</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    Share this link with {nextSignerName} to sign:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={nextSignerUrl}
                      readOnly
                      className="flex-1 text-sm"
                    />
                    <Button onClick={copyNextSignerUrl} variant="outline" size="icon">
                      {copiedNextSignerUrl ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <FileCheck className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const brandingColor = data.branding?.primaryColor || '#0072CE';
  const pageImages = data.envelope.pageImages;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b shadow-sm"
        style={{ backgroundColor: brandingColor }}
      >
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              {data.branding?.logoUrl ? (
                <img
                  src={data.branding.logoUrl}
                  alt="Company logo"
                  className="h-6 md:h-8 max-w-[100px] md:max-w-[150px] object-contain"
                />
              ) : data.branding?.companyName ? (
                <span className="text-base md:text-xl font-bold text-white truncate">
                  {data.branding.companyName}
                </span>
              ) : (
                <FileSignature className="h-6 w-6 md:h-8 md:w-8 text-white flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => setShowDeclineModal(true)}
              >
                <Ban className="h-4 w-4 mr-1 md:mr-2" />
                <span className="text-xs md:text-sm">Decline</span>
              </Button>
              <Button
                size="sm"
                className="bg-white hover:bg-gray-100 font-semibold px-4 md:px-6"
                style={{ color: brandingColor }}
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit || submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 mr-2" style={{ borderColor: brandingColor }} />
                    <span>Finishing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    <span>Finish</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-3 md:px-4 py-4 md:py-6">
        <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 md:gap-6">
          {/* Document Viewer */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <Card className="overflow-hidden">
              <CardHeader className="border-b p-3 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base md:text-lg truncate">{data.envelope.title}</CardTitle>
                    {data.envelope.message && (
                      <CardDescription className="mt-1 text-sm line-clamp-2">
                        {data.envelope.message}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                    {/* Desktop zoom controls - hidden on mobile (use pinch to zoom) */}
                    <div className="hidden md:flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-xs md:text-sm text-gray-500 md:ml-4 whitespace-nowrap">
                      {pageImages.length} page{pageImages.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-6 overflow-auto max-h-[50vh] lg:max-h-[calc(100vh-250px)] touch-pan-x touch-pan-y touch-pinch-zoom">
                {/* Scrollable container for all pages - pinch to zoom on mobile */}
                <div className="space-y-6 origin-top-left" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
                  {pageImages.map((pageImage, pageIndex) => {
                    const pageNumber = pageIndex + 1;
                    const pageFields = fields.filter(f => f.page === pageNumber);

                    return (
                      <div key={pageNumber} data-page={pageNumber} className="flex flex-col items-center">
                        {/* Page number badge */}
                        <div className="mb-2 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                          Page {pageNumber} of {pageImages.length}
                        </div>

                        {/* Page container */}
                        <div
                          className="relative mx-auto border shadow-lg bg-white"
                          style={{ width: 612 * zoom, maxWidth: '100%' }}
                        >
                          <img
                            src={pageImage}
                            alt={`Page ${pageNumber}`}
                            className="w-full h-auto block"
                            draggable={false}
                          />

                          {/* Fields overlay for this page */}
                          <div className="absolute inset-0">
                            {pageFields.map((field) => {
                              const isSignatureOrInitials = field.type === 'signature' || field.type === 'initials';
                              const hasValue = !!field.value;

                              return (
                                <div
                                  key={field.id}
                                  className={`absolute cursor-pointer transition-all ${
                                    hasValue
                                      ? isSignatureOrInitials
                                        ? '' // No border for signed signature fields - L-frame is outside
                                        : 'border-2 rounded border-green-500 bg-green-50/50'
                                      : 'border-2 border-dashed rounded animate-pulse'
                                  }`}
                                  style={{
                                    left: `${field.x}%`,
                                    top: `${field.y}%`,
                                    width: `${field.width}%`,
                                    height: `${field.height}%`,
                                    borderColor: hasValue ? undefined : data.recipient.color,
                                    backgroundColor: hasValue ? undefined : `${data.recipient.color}10`,
                                    // Add overflow visible for signature fields to show L-frame outside
                                    overflow: isSignatureOrInitials && hasValue ? 'visible' : undefined,
                                  }}
                                  onClick={() => {
                                    if (isSignatureOrInitials) {
                                      setSelectedFieldId(field.id);
                                      setShowSignatureModal(true);
                                    }
                                  }}
                                >
                                  {isSignatureOrInitials ? (
                                    // Signature/Initials - show value with DocuSign-style L-frame if filled, otherwise show prompt
                                    hasValue ? (
                                      <div className="w-full h-full relative">
                                        {/* Signature content area - no border on the signature itself */}
                                        <div className="w-full h-full flex items-center justify-center px-0.5 overflow-hidden">
                                          {field.value?.startsWith('data:') ? (
                                            <img
                                              src={field.value}
                                              alt="Signature"
                                              className="max-w-full max-h-full object-contain"
                                            />
                                          ) : (
                                            // Text signature - scale font size based on field height
                                            // and scale down horizontally if name is too long (DocuSign-style)
                                            (() => {
                                              const basePageWidth = 612 * zoom;
                                              const basePageHeight = 792 * zoom;
                                              const fieldPixelWidth = (field.width / 100) * basePageWidth;
                                              const fieldPixelHeight = (field.height / 100) * basePageHeight;
                                              const fontSize = Math.max(12, Math.min(fieldPixelHeight * 0.55, field.type === 'initials' ? 28 : 42));
                                              // Estimate text width: cursive fonts average ~0.55 of fontSize per character
                                              const estimatedTextWidth = (field.value?.length || 0) * fontSize * 0.55;
                                              const availableWidth = fieldPixelWidth - 8; // Account for padding
                                              // Scale down if text is too wide, minimum 0.4 to keep readable
                                              const scaleX = estimatedTextWidth > availableWidth
                                                ? Math.max(0.4, availableWidth / estimatedTextWidth)
                                                : 1;
                                              return (
                                                <span
                                                  style={{
                                                    fontFamily: 'cursive',
                                                    color: '#0d0d4d',
                                                    fontSize: `${fontSize}px`,
                                                    lineHeight: 1,
                                                    whiteSpace: 'nowrap',
                                                    transform: scaleX < 1 ? `scaleX(${scaleX})` : undefined,
                                                    transformOrigin: 'center center',
                                                    display: 'inline-block',
                                                  }}
                                                >
                                                  {field.value}
                                                </span>
                                              );
                                            })()
                                          )}
                                        </div>
                                        {/* "eSigned by" label above the signature */}
                                        <div
                                          className="absolute font-sans"
                                          style={{
                                            left: '-4px',
                                            top: '-12px',
                                            fontSize: '7px',
                                            color: '#9CA3AF',
                                            letterSpacing: '0.3px',
                                          }}
                                        >
                                          eSigned by
                                        </div>
                                        {/* L-shaped frame OUTSIDE the signature area with rounded corner */}
                                        {/* Left border - stops at corner */}
                                        <div
                                          className="absolute"
                                          style={{
                                            left: '-4px',
                                            top: '-2px',
                                            bottom: 'calc(-4px + 5px)', // Stop at corner radius
                                            width: '1px',
                                            backgroundColor: '#9CA3AF',
                                          }}
                                        />
                                        {/* Bottom border - stops halfway, DocuSign style */}
                                        <div
                                          className="absolute"
                                          style={{
                                            left: 'calc(-4px + 5px)', // Start after corner radius
                                            bottom: '-4px',
                                            width: '45%',
                                            height: '1px',
                                            backgroundColor: '#9CA3AF',
                                          }}
                                        />
                                        {/* Rounded corner connecting left and bottom */}
                                        <div
                                          className="absolute"
                                          style={{
                                            left: '-4px',
                                            bottom: '-4px',
                                            width: '10px',
                                            height: '10px',
                                            border: '1px solid #9CA3AF',
                                            borderTop: 'none',
                                            borderRight: 'none',
                                            borderBottomLeftRadius: '5px',
                                          }}
                                        />
                                        {/* Unique ID inline with bottom border */}
                                        <div
                                          className="absolute font-mono"
                                          style={{
                                            left: 'calc(-4px + 5px + 45% + 6px)', // Position right after the bottom border
                                            bottom: '-7px',
                                            fontSize: '7px',
                                            color: '#9CA3AF',
                                            letterSpacing: '0.5px',
                                          }}
                                        >
                                          {/* Generate a hash-like ID from field.id for display */}
                                          {String(field.id).split('').reduce((acc, char, i) =>
                                            acc + ((char.charCodeAt(0) * (i + 1) * 7) % 36).toString(36), ''
                                          ).slice(0, 8).toUpperCase()}
                                        </div>
                                      </div>
                                    ) : (
                                      // Empty signature/initials field - show one-click option if cached, otherwise show prompt
                                      (() => {
                                        const isInitials = field.type === 'initials';
                                        const hasCached = isInitials ? !!cachedInitials : !!cachedSignature;

                                        return hasCached ? (
                                          // One-click apply cached signature
                                          <div
                                            className="w-full h-full flex flex-col items-center justify-center gap-0.5 group"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              applyCachedSignature(field.id, isInitials);
                                            }}
                                          >
                                            <div className="flex items-center gap-1 text-xs font-medium transition-colors group-hover:scale-105" style={{ color: data.recipient.color }}>
                                              <CheckCircle2 className="h-3 w-3" />
                                              <span>Click to apply</span>
                                            </div>
                                            {/* Show preview of cached signature/initials */}
                                            <div className="max-w-[80%] max-h-[60%] overflow-hidden opacity-60">
                                              {(isInitials ? cachedInitials : cachedSignature)?.startsWith('data:') ? (
                                                <img
                                                  src={isInitials ? cachedInitials! : cachedSignature!}
                                                  alt="Saved signature"
                                                  className="max-w-full max-h-full object-contain"
                                                  style={{ maxHeight: '20px' }}
                                                />
                                              ) : (
                                                <span
                                                  className="text-xs truncate"
                                                  style={{ fontFamily: 'cursive', color: '#0d0d4d' }}
                                                >
                                                  {isInitials ? cachedInitials : cachedSignature}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          // No cached signature - show prompt to draw/type
                                          <div className="w-full h-full flex items-center justify-center text-xs font-medium" style={{ color: data.recipient.color }}>
                                            <Pen className="h-3 w-3 mr-1" />
                                            {field.type === 'signature' ? 'Sign Here' : 'Initial Here'}
                                          </div>
                                        );
                                      })()
                                    )
                                  ) : (
                                    // Text fields (name, email, date, text) - always show input for editing
                                    <div className="w-full h-full flex items-center justify-center text-xs font-medium">
                                      {field.type === 'name' ? (
                                        <Input
                                          value={field.value || ''}
                                          onChange={(e) => updateFieldValue(field.id, e.target.value)}
                                          placeholder="Your name"
                                          className="h-full text-xs border-0 bg-transparent"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : field.type === 'email' ? (
                                        <Input
                                          type="email"
                                          value={field.value || data.recipient.email}
                                          onChange={(e) => updateFieldValue(field.id, e.target.value)}
                                          placeholder="Your email"
                                          className="h-full text-xs border-0 bg-transparent"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : field.type === 'date' ? (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button
                                              className="w-full h-full flex items-center justify-between px-2 text-xs text-left hover:bg-gray-50 transition-colors"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <span className={field.value ? "text-gray-900" : "text-gray-400"}>
                                                {field.value
                                                  ? format(parse(field.value, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')
                                                  : "Select date..."}
                                              </span>
                                              <CalendarIcon className="h-3 w-3 text-gray-400" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                              mode="single"
                                              selected={field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : undefined}
                                              onSelect={(date) => {
                                                if (date) {
                                                  updateFieldValue(field.id, format(date, 'yyyy-MM-dd'));
                                                }
                                              }}
                                              defaultMonth={new Date()}
                                              initialFocus
                                            />
                                            <div className="border-t p-2 flex justify-between items-center">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs"
                                                onClick={() => updateFieldValue(field.id, format(new Date(), 'yyyy-MM-dd'))}
                                              >
                                                Today
                                              </Button>
                                              {field.value && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="text-xs text-gray-500"
                                                  onClick={() => updateFieldValue(field.id, '')}
                                                >
                                                  Clear
                                                </Button>
                                              )}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      ) : (
                                        <Input
                                          value={field.value || ''}
                                          onChange={(e) => updateFieldValue(field.id, e.target.value)}
                                          placeholder="Enter text"
                                          className="h-full text-xs border-0 bg-transparent"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Shows first on mobile */}
          <div className="space-y-3 md:space-y-4 order-1 lg:order-2">
            {/* E-SIGN Act Consent - Clickwrap style - Always visible */}
            <Card className={`border-2 ${hasConsented ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
              <CardContent className="pt-4">
                {hasConsented ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="text-sm">
                      <span className="font-medium text-green-700">
                        Electronic signature consent accepted
                      </span>
                      <p className="text-xs text-gray-600 mt-1">
                        You agreed to use electronic signatures on {consentedAt ? new Date(consentedAt).toLocaleString() : 'this session'}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="esign-consent"
                        checked={hasConsented}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            consentMutation.mutate();
                          }
                        }}
                        disabled={consentMutation.isPending}
                        className="mt-0.5"
                      />
                      <label htmlFor="esign-consent" className="text-sm leading-tight cursor-pointer">
                        I agree to use electronic signatures and have reviewed the{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowConsentDialog(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 underline font-medium"
                        >
                          Electronic Signature Disclosure
                        </button>
                      </label>
                    </div>
                    {consentMutation.isPending && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500" />
                        Recording consent...
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mobile: Menu for AI Summarize and Required Fields */}
            <div className="lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <MoreHorizontal className="h-4 w-4" />
                      More Options
                    </span>
                    <span className="text-xs text-gray-500">
                      {completedRequiredFields.length}/{requiredFields.length} fields
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[calc(100vw-2rem)] max-w-sm">
                  <DropdownMenuItem
                    onClick={() => {
                      if (summaryData) {
                        setShowSummaryModal(true);
                      } else {
                        summarizeMutation.mutate();
                      }
                    }}
                    disabled={summarizeMutation.isPending}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {summarizeMutation.isPending ? 'Analyzing...' : summaryData ? 'View AI Summary' : 'AI Summarize Document'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowFieldsModal(true)}>
                    <ListChecks className="h-4 w-4 mr-2" />
                    Required Fields ({completedRequiredFields.length}/{requiredFields.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop: AI Summarize - Help signers understand the document */}
            <Card className="hidden lg:block">
              <CardContent className="pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (summaryData) {
                      setShowSummaryModal(true);
                    } else {
                      summarizeMutation.mutate();
                    }
                  }}
                  disabled={summarizeMutation.isPending}
                >
                  {summarizeMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                      Analyzing document...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {summaryData ? 'View AI Summary' : 'AI Summarize Document'}
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Get AI-powered key points and summary
                </p>
              </CardContent>
            </Card>

            {/* Desktop: Progress - Hidden on mobile */}
            <Card className="hidden lg:block">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Signing Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{completedRequiredFields.length} of {requiredFields.length} required fields</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%`, backgroundColor: brandingColor }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Desktop: Fields to Complete - Hidden on mobile (shown in modal) */}
            <Card className="hidden lg:block">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Required Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {requiredFields.map((field) => {
                  const isComplete = !!field.value;
                  return (
                    <button
                      key={field.id}
                      className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                        isComplete ? 'bg-green-50 text-green-700' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        // Scroll to the page containing this field
                        const pageElement = document.querySelector(`[data-page="${field.page}"]`);
                        if (pageElement) {
                          pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        if (field.type === 'signature' || field.type === 'initials') {
                          setSelectedFieldId(field.id);
                          setShowSignatureModal(true);
                        }
                      }}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <div
                          className="w-4 h-4 rounded-full border-2"
                          style={{ borderColor: data.recipient.color }}
                        />
                      )}
                      <span className="capitalize">{field.type}</span>
                      <span className="text-xs text-gray-400 ml-auto">Page {field.page}</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Desktop: Signer Info - Hidden on mobile */}
            <Card className="hidden lg:block">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Signing as</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: data.recipient.color }}
                  >
                    {data.recipient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{data.recipient.name}</p>
                    <p className="text-sm text-gray-500">{data.recipient.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>

      {/* Signature Modal */}
      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const isInitials = fields.find(f => f.id === selectedFieldId)?.type === 'initials';
            const hasCachedValue = isInitials ? !!cachedInitials : !!cachedSignature;
            const cachedValue = isInitials ? cachedInitials : cachedSignature;

            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {isInitials ? 'Add Your Initials' : 'Add Your Signature'}
                  </DialogTitle>
                  <DialogDescription>
                    {hasCachedValue
                      ? `Use your saved ${isInitials ? 'initials' : 'signature'} or create a new one`
                      : `Draw or type your ${isInitials ? 'initials' : 'signature'} below`
                    }
                  </DialogDescription>
                </DialogHeader>

                {/* Show saved signature option if available */}
                {hasCachedValue && (
                  <div className="mb-4 p-4 border-2 border-dashed border-green-300 rounded-lg bg-green-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-800 mb-2">
                          Use your saved {isInitials ? 'initials' : 'signature'}:
                        </p>
                        <div className="p-3 bg-white rounded border flex items-center justify-center min-h-[60px]">
                          {cachedValue?.startsWith('data:') ? (
                            <img
                              src={cachedValue}
                              alt={isInitials ? "Saved initials" : "Saved signature"}
                              className="max-w-full max-h-[50px] object-contain"
                            />
                          ) : (
                            <span
                              className="text-2xl"
                              style={{ fontFamily: 'cursive', color: '#0d0d4d' }}
                            >
                              {cachedValue}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        className="ml-4"
                        style={{ backgroundColor: brandingColor }}
                        onClick={() => {
                          if (selectedFieldId && cachedValue) {
                            applyCachedSignature(selectedFieldId, !!isInitials);
                            setShowSignatureModal(false);
                            setSelectedFieldId(null);
                          }
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Apply
                      </Button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs text-green-700 text-center">
                        Or create a new {isInitials ? 'initials' : 'signature'} below
                      </p>
                    </div>
                  </div>
                )}

                <Tabs value={signatureTab} onValueChange={(v) => setSignatureTab(v as 'draw' | 'type')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="type">
                      <Type className="h-4 w-4 mr-2" />
                      Type
                    </TabsTrigger>
                    <TabsTrigger value="draw">
                      <Pen className="h-4 w-4 mr-2" />
                      Draw
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="type" className="mt-4">
                    <Input
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                      placeholder="Type your name"
                      className="text-2xl h-14"
                      style={{ fontFamily: 'cursive' }}
                    />
                    <div
                      className="mt-4 p-4 border rounded-lg bg-white text-center"
                      style={{ fontFamily: 'cursive' }}
                    >
                      <span className="text-3xl">{typedSignature || 'Preview'}</span>
                    </div>
                  </TabsContent>

                  <TabsContent value="draw" className="mt-4">
                    <div className="border rounded-lg bg-white">
                      <canvas
                        ref={canvasRef}
                        width={350}
                        height={150}
                        className="w-full cursor-crosshair"
                        style={{ touchAction: 'none' }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawingTouch}
                        onTouchMove={drawTouch}
                        onTouchEnd={stopDrawingTouch}
                      />
                    </div>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={clearCanvas}>
                      Clear
                    </Button>
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSignatureModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={applySignature}
                    disabled={(signatureTab === 'draw' && !hasDrawn) || (signatureTab === 'type' && !typedSignature.trim())}
                    style={{ backgroundColor: brandingColor }}
                  >
                    {hasCachedValue ? 'Apply New' : 'Apply'}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Decline Confirmation */}
      <AlertDialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Decline to Sign?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline this document? The sender will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Reason (optional)</Label>
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Please provide a reason for declining..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => declineMutation.mutate()}
              disabled={declineMutation.isPending}
            >
              {declineMutation.isPending ? 'Declining...' : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* E-SIGN Act Disclosure Dialog - View only, consent via checkbox */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Electronic Signature Disclosure
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Consumer Consent to Use Electronic Signatures</h4>
                <p className="text-gray-600">
                  By checking the consent box, you are consenting to use electronic signatures to sign this document.
                  This consent is provided pursuant to the Electronic Signatures in Global and National Commerce Act
                  (E-SIGN Act) and the Uniform Electronic Transactions Act (UETA).
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What This Means</h4>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>Your electronic signature will have the same legal validity as a handwritten signature.</li>
                  <li>You agree to conduct this transaction electronically.</li>
                  <li>You will receive a copy of the signed document via email.</li>
                  <li>Records of your signature, including timestamp and IP address, will be maintained.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Your Rights</h4>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>You have the right to receive this document on paper. To request a paper copy, contact the sender.</li>
                  <li>You may withdraw this consent at any time before signing by closing this page or clicking "Decline."</li>
                  <li>Withdrawing consent will not affect the validity of any signatures already provided.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Hardware and Software Requirements</h4>
                <p className="text-gray-600">
                  To access and retain electronic records, you need:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>A computer or mobile device with internet access</li>
                  <li>A current web browser (Chrome, Firefox, Safari, or Edge)</li>
                  <li>A valid email address to receive signed documents</li>
                  <li>Sufficient storage to save or print electronic records</li>
                </ul>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-blue-800 text-xs">
                  <strong>Document:</strong> {data?.envelope.title}<br />
                  <strong>Signer:</strong> {data?.recipient.name} ({data?.recipient.email})
                </p>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowConsentDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Summary Modal */}
      <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Document Summary
            </DialogTitle>
            <DialogDescription>
              AI-generated overview of key points in this document
            </DialogDescription>
          </DialogHeader>

          {summaryData && (
            <ScrollArea className="max-h-[500px] pr-4">
              <div className="space-y-6">
                {/* Page limit notice */}
                {summaryData.pageLimitReached && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-800">
                        This summary is based on the first {summaryData.pagesAnalyzed} pages of your {summaryData.totalPages}-page document.
                        Please review the full document before signing.
                      </p>
                    </div>
                  </div>
                )}

                {/* Estimated Read Time */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>Full document read time: <strong>{summaryData.estimatedReadTime}</strong></span>
                </div>

                {/* Summary */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-blue-600" />
                    Summary
                  </h4>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {summaryData.summary}
                  </p>
                </div>

                {/* Key Points */}
                {summaryData.keyPoints.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-green-600" />
                      Key Points
                    </h4>
                    <ul className="space-y-2">
                      {summaryData.keyPoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Important Terms */}
                {summaryData.importantTerms.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-orange-600" />
                      Important Terms & Conditions
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {summaryData.importantTerms.map((term, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-orange-50 text-orange-800 rounded-full text-sm"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">Important Notice</p>
                      <p>{summaryData.disclaimer}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="mt-4">
            <Button onClick={() => setShowSummaryModal(false)}>
              Close & Continue Signing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Required Fields Modal */}
      <Dialog open={showFieldsModal} onOpenChange={setShowFieldsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Required Fields
            </DialogTitle>
            <DialogDescription>
              {completedRequiredFields.length} of {requiredFields.length} fields completed
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {requiredFields.map((field) => {
              const isComplete = !!field.value;
              return (
                <button
                  key={field.id}
                  className={`w-full p-3 rounded-lg text-left text-sm flex items-center gap-3 transition-colors ${
                    isComplete ? 'bg-green-50 text-green-700' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setShowFieldsModal(false);
                    // Scroll to the page containing this field
                    setTimeout(() => {
                      const pageElement = document.querySelector(`[data-page="${field.page}"]`);
                      if (pageElement) {
                        pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                      if (field.type === 'signature' || field.type === 'initials') {
                        setSelectedFieldId(field.id);
                        setShowSignatureModal(true);
                      }
                    }, 100);
                  }}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                      style={{ borderColor: data.recipient.color }}
                    />
                  )}
                  <span className="capitalize flex-1">{field.type}</span>
                  <span className="text-xs text-gray-400">Page {field.page}</span>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFieldsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
