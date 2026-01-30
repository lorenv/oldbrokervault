import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  FileSignature,
  Loader2,
  AlertCircle,
  Users,
  ArrowRight,
  Building2,
  User,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlaceholderRecipient {
  id: string;
  label: string;
  role: string;
  color: string;
  order: number;
}

interface PowerFormData {
  template: {
    id: number;
    name: string;
    description: string | null;
    pageImages: string[];
    totalPages: number;
  };
  placeholderRecipients: PlaceholderRecipient[];
  settings: {
    multiSignerMode: 'upfront' | 'sequential' | 'choice';
    customMessage: string | null;
    allowLinkSharing: boolean;
  };
  owner: {
    name: string;
  } | null;
  branding: {
    logoUrl: string | null;
    companyName: string | null;
    primaryColor: string | null;
  } | null;
}

interface SignerInfo {
  placeholderId: string;
  name: string;
  email: string;
}

export default function EsignPowerForm() {
  const [, params] = useRoute("/esign/form/:slug");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const slug = params?.slug;

  // State for multi-signer mode choice
  const [selectedMode, setSelectedMode] = useState<'upfront' | 'sequential'>('upfront');

  // State for signer information
  const [signers, setSigners] = useState<SignerInfo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch PowerForm data
  const { data: powerForm, isLoading, error } = useQuery<PowerFormData>({
    queryKey: ['/api/esign/form', slug],
    queryFn: async () => {
      const res = await fetch(`/api/esign/form/${slug}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to load form');
      }
      return res.json();
    },
    enabled: !!slug,
    retry: false,
  });

  // Initialize signers state when PowerForm data loads
  useEffect(() => {
    if (powerForm?.placeholderRecipients) {
      const initialSigners = powerForm.placeholderRecipients.map(p => ({
        placeholderId: p.id,
        name: '',
        email: '',
      }));
      setSigners(initialSigners);
    }
  }, [powerForm]);

  // Start signing session mutation
  const startSession = useMutation({
    mutationFn: async (data: { signers: SignerInfo[], multiSignerMode?: 'upfront' | 'sequential' }) => {
      const res = await fetch(`/api/esign/form/${slug}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to start signing session');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Redirect to signing page
      setLocation(`/esign/sign/${data.signingToken}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Determine which signers to include
    const signersToSubmit = selectedMode === 'sequential'
      ? [signers[0]] // Only first signer for sequential
      : signers;

    // Validate required fields
    for (const signer of signersToSubmit) {
      if (!signer.name.trim()) {
        toast({
          title: "Name Required",
          description: "Please enter your name to continue.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      if (!signer.email.trim() || !signer.email.includes('@')) {
        toast({
          title: "Valid Email Required",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    startSession.mutate({
      signers: signersToSubmit,
      multiSignerMode: selectedMode,
    });
  };

  const updateSigner = (index: number, field: 'name' | 'email', value: string) => {
    setSigners(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading form...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !powerForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Form Not Available</h2>
            <p className="text-slate-600">
              {error?.message || "This form is not available or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = powerForm.branding?.primaryColor || '#4f46e5';
  const hasMultipleSigners = powerForm.placeholderRecipients.length > 1;
  const showModeChoice = hasMultipleSigners && powerForm.settings.multiSignerMode === 'choice';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header with branding */}
        <div className="text-center mb-8">
          {powerForm.branding?.logoUrl ? (
            <img
              src={powerForm.branding.logoUrl}
              alt={powerForm.branding.companyName || 'Company Logo'}
              className="h-12 mx-auto mb-4 object-contain"
            />
          ) : powerForm.branding?.companyName ? (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Building2 className="h-6 w-6" style={{ color: primaryColor }} />
              <span className="text-xl font-semibold text-slate-900">
                {powerForm.branding.companyName}
              </span>
            </div>
          ) : null}
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center border-b bg-slate-50">
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileSignature className="h-6 w-6" style={{ color: primaryColor }} />
            </div>
            <CardTitle className="text-2xl">{powerForm.template.name}</CardTitle>
            {powerForm.settings.customMessage && (
              <CardDescription className="mt-2">
                {powerForm.settings.customMessage}
              </CardDescription>
            )}
            {powerForm.owner && (
              <p className="text-sm text-slate-500 mt-2">
                Sent by {powerForm.owner.name}
              </p>
            )}
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Multi-signer info */}
              {hasMultipleSigners && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        This document requires {powerForm.placeholderRecipients.length} signatures
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        {powerForm.placeholderRecipients.map(p => p.label).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode choice for multi-signer forms */}
              {showModeChoice && (
                <div className="space-y-4">
                  <Label className="text-base font-medium">
                    How would you like to handle other signers?
                  </Label>
                  <RadioGroup
                    value={selectedMode}
                    onValueChange={(v) => setSelectedMode(v as 'upfront' | 'sequential')}
                    className="space-y-3"
                  >
                    <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer">
                      <RadioGroupItem value="upfront" id="upfront" className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor="upfront" className="font-medium cursor-pointer">
                          I'll provide their info now
                        </Label>
                        <p className="text-sm text-slate-500">
                          Enter details for all signers. They'll receive email invitations after you sign.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer">
                      <RadioGroupItem value="sequential" id="sequential" className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor="sequential" className="font-medium cursor-pointer">
                          I'll send them the link myself
                        </Label>
                        <p className="text-sm text-slate-500">
                          After you sign, you'll get a link to share with the next signer.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Signer information inputs */}
              <div className="space-y-6">
                {(selectedMode === 'upfront' || !hasMultipleSigners ? signers : [signers[0]]).map((signer, index) => {
                  const placeholder = powerForm.placeholderRecipients.find(p => p.id === signer.placeholderId);
                  if (!placeholder) return null;

                  return (
                    <div key={signer.placeholderId} className="space-y-4">
                      {hasMultipleSigners && selectedMode === 'upfront' && (
                        <>
                          {index > 0 && <Separator />}
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: placeholder.color }}
                            />
                            <span className="font-medium text-slate-900">
                              {placeholder.label}
                              {index === 0 && " (You)"}
                            </span>
                          </div>
                        </>
                      )}

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`name-${index}`} className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            {index === 0 ? "Your Name" : "Name"}
                          </Label>
                          <Input
                            id={`name-${index}`}
                            type="text"
                            value={signer.name}
                            onChange={(e) => updateSigner(index, 'name', e.target.value)}
                            placeholder="Enter full name"
                            required
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`email-${index}`} className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            {index === 0 ? "Your Email" : "Email"}
                          </Label>
                          <Input
                            id={`email-${index}`}
                            type="email"
                            value={signer.email}
                            onChange={(e) => updateSigner(index, 'email', e.target.value)}
                            placeholder="Enter email address"
                            required
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                style={{ backgroundColor: primaryColor }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Continue to Document
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>

              {/* Document preview thumbnail */}
              {powerForm.template.pageImages?.[0] && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-slate-500 mb-2 text-center">Document Preview</p>
                  <div className="flex justify-center">
                    <img
                      src={powerForm.template.pageImages[0]}
                      alt="Document preview"
                      className="max-h-32 rounded border shadow-sm"
                    />
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-400">
            Powered by <span className="font-medium">BrokerVault.ai</span>
          </p>
        </div>
      </div>
    </div>
  );
}
