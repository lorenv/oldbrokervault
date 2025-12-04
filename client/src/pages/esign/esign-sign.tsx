import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  FileSignature,
  Pen,
  Type,
  CheckCircle2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  X,
  XCircle,
} from "lucide-react";
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
  const [declineReason, setDeclineReason] = useState("");
  const [signatureTab, setSignatureTab] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showSuccessState, setShowSuccessState] = useState(false);

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

  // Canvas drawing handlers
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

    let signatureValue = '';

    if (signatureTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      signatureValue = canvas.toDataURL('image/png');
    } else {
      if (!typedSignature.trim()) return;
      signatureValue = typedSignature;
    }

    setFields(fields.map(f =>
      f.id === selectedFieldId ? { ...f, value: signatureValue } : f
    ));

    setShowSignatureModal(false);
    setSelectedFieldId(null);
    clearCanvas();
    setTypedSignature("");
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

  // Validation
  const requiredFields = fields.filter(f => f.required);
  const completedRequiredFields = requiredFields.filter(f => f.value);
  const canSubmit = completedRequiredFields.length === requiredFields.length && agreedToTerms;
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
              <p className="text-gray-500 mb-6">
                Thank you for signing "{data.envelope.title}". You will receive a copy of the completed document once all parties have signed.
              </p>
              <div className="p-4 bg-gray-50 rounded-lg w-full">
                <p className="text-sm text-gray-600">Signed as</p>
                <p className="font-medium">{data.recipient.name}</p>
                <p className="text-sm text-gray-500">{data.recipient.email}</p>
              </div>
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {data.branding?.logoUrl ? (
                <img
                  src={data.branding.logoUrl}
                  alt="Company logo"
                  className="h-8 max-w-[150px] object-contain"
                />
              ) : data.branding?.companyName ? (
                <span className="text-xl font-bold text-white">
                  {data.branding.companyName}
                </span>
              ) : (
                <FileSignature className="h-8 w-8 text-white" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={() => setShowDeclineModal(true)}
              >
                <X className="h-4 w-4 mr-2" />
                Decline
              </Button>
              <Button
                className="bg-white hover:bg-gray-100"
                style={{ color: brandingColor }}
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit || submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 mr-2" style={{ borderColor: brandingColor }} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Finish
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Document Viewer */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{data.envelope.title}</CardTitle>
                    {data.envelope.message && (
                      <CardDescription className="mt-1">
                        {data.envelope.message}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-500 ml-4">
                      {pageImages.length} page{pageImages.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 overflow-auto max-h-[calc(100vh-250px)]">
                {/* Scrollable container for all pages */}
                <div className="space-y-6">
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
                                  className={`absolute border-2 rounded cursor-pointer transition-all ${
                                    hasValue
                                      ? 'border-green-500 bg-green-50/50'
                                      : 'border-dashed animate-pulse'
                                  }`}
                                  style={{
                                    left: `${field.x}%`,
                                    top: `${field.y}%`,
                                    width: `${field.width}%`,
                                    height: `${field.height}%`,
                                    borderColor: hasValue ? undefined : data.recipient.color,
                                    backgroundColor: hasValue ? undefined : `${data.recipient.color}10`,
                                  }}
                                  onClick={() => {
                                    if (isSignatureOrInitials) {
                                      setSelectedFieldId(field.id);
                                      setShowSignatureModal(true);
                                    }
                                  }}
                                >
                                  {hasValue ? (
                                    <div className="w-full h-full flex items-center justify-center p-1 overflow-hidden">
                                      {isSignatureOrInitials && field.value?.startsWith('data:') ? (
                                        <img
                                          src={field.value}
                                          alt="Signature"
                                          className="max-w-full max-h-full object-contain"
                                        />
                                      ) : isSignatureOrInitials ? (
                                        <span className="font-signature text-lg" style={{ fontFamily: 'cursive' }}>
                                          {field.value}
                                        </span>
                                      ) : (
                                        <span className="text-xs truncate">{field.value}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs font-medium" style={{ color: data.recipient.color }}>
                                      {isSignatureOrInitials ? (
                                        <>
                                          <Pen className="h-3 w-3 mr-1" />
                                          {field.type === 'signature' ? 'Sign Here' : 'Initial Here'}
                                        </>
                                      ) : field.type === 'name' ? (
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
                                        <Input
                                          type="date"
                                          value={field.value || new Date().toISOString().split('T')[0]}
                                          onChange={(e) => updateFieldValue(field.id, e.target.value)}
                                          className="h-full text-xs border-0 bg-transparent"
                                          onClick={(e) => e.stopPropagation()}
                                        />
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

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Agreement - Must be at top and prominent */}
            <Card className={`border-2 ${agreedToTerms ? 'border-green-500 bg-green-50' : 'border-amber-500 bg-amber-50'}`}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms-top"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms-top" className="text-sm cursor-pointer">
                    <span className={`font-medium ${agreedToTerms ? 'text-green-700' : 'text-amber-700'}`}>
                      {agreedToTerms ? '✓ Agreement accepted' : '⚠️ Required: Accept agreement'}
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      I agree that my signature and initials on this document are legally binding,
                      equivalent to signing on paper.
                    </p>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card>
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

            {/* Fields to Complete */}
            <Card>
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

            {/* Signer Info */}
            <Card>
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
          <DialogHeader>
            <DialogTitle>
              {fields.find(f => f.id === selectedFieldId)?.type === 'initials' ? 'Add Your Initials' : 'Add Your Signature'}
            </DialogTitle>
            <DialogDescription>
              Draw or type your signature below
            </DialogDescription>
          </DialogHeader>

          <Tabs value={signatureTab} onValueChange={(v) => setSignatureTab(v as 'draw' | 'type')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="draw">
                <Pen className="h-4 w-4 mr-2" />
                Draw
              </TabsTrigger>
              <TabsTrigger value="type">
                <Type className="h-4 w-4 mr-2" />
                Type
              </TabsTrigger>
            </TabsList>

            <TabsContent value="draw" className="mt-4">
              <div className="border rounded-lg bg-white">
                <canvas
                  ref={canvasRef}
                  width={350}
                  height={150}
                  className="w-full cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={clearCanvas}>
                Clear
              </Button>
            </TabsContent>

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
              Apply
            </Button>
          </DialogFooter>
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
    </div>
  );
}
