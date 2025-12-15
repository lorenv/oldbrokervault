import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Lock,
  FileSignature,
  Mail,
  Phone,
  Building2,
  DollarSign,
  TrendingUp,
  Target,
  Loader2,
  ExternalLink,
  Download,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TeaserData {
  headline: string;
  summary: string;
  industryTags: string[];
  dealTypeTags: string[];
  coverImageUrl: string | null;
  showFinancials: boolean;
  financials: {
    revenue: string;
    earnings: string;
    askingPrice: string;
  } | null;
  broker: {
    businessName: string;
    businessLogo: string | null;
    profilePhoto: string | null;
    email: string;
    name: string;
    phone: string;
  };
  cimShareSlug: string;
  ndaProtected: boolean;
  sessionId: string;
}

export function TeaserPage() {
  const [matched, params] = useRoute("/teaser/:slug");
  const slug = params?.slug;
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Download teaser as PDF
  const handleDownloadPdf = async () => {
    if (!slug) return;
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/teasers/public/${slug}/export/pdf`);
      if (!response.ok) throw new Error('Failed to download PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `teaser-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'PDF Downloaded', description: 'The teaser has been downloaded as a PDF.' });
    } catch (error) {
      toast({ title: 'Download Failed', description: 'Could not download the PDF. Please try again.', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  // Share teaser via email
  const handleShareEmail = () => {
    if (!teaser) return;
    const teaserUrl = window.location.href;
    const subject = encodeURIComponent(`${teaser.headline} - Business Opportunity`);
    const body = encodeURIComponent(`I thought you might be interested in this opportunity:\n\n${teaser.headline}\n\nView the full teaser here: ${teaserUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Check if teaser exists and needs password
  const { data: checkData, isLoading: checkLoading, error: checkError } = useQuery({
    queryKey: [`/api/teasers/public/${slug}/check`],
    queryFn: async () => {
      const res = await fetch(`/api/teasers/public/${slug}/check`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Teaser not found");
      }
      const data = await res.json();
      // Ensure requiresPassword is a proper boolean (SQL can return string sometimes)
      return {
        ...data,
        requiresPassword: data.requiresPassword === true || data.requiresPassword === 'true',
      };
    },
    enabled: !!slug,
    retry: false,
  });

  // Determine if password is required (ensure boolean check)
  const needsPassword = checkData?.requiresPassword === true;

  // Fetch teaser data - enabled when password is not required, OR when password is provided
  const {
    data: teaser,
    isLoading: teaserLoading,
    error: teaserError,
    refetch: refetchTeaser,
  } = useQuery<TeaserData>({
    queryKey: [`/api/teasers/public/${slug}`, password],
    queryFn: async () => {
      const url = password
        ? `/api/teasers/public/${slug}?password=${encodeURIComponent(password)}`
        : `/api/teasers/public/${slug}`;
      const res = await fetch(url);
      if (res.status === 401) {
        const data = await res.json();
        if (data.requiresPassword) {
          setShowPasswordDialog(true);
          throw new Error("Password required");
        }
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load teaser");
      }
      return res.json();
    },
    enabled: !!slug && !!checkData && (!needsPassword || !!password),
    retry: false,
  });

  // Set session ID when teaser loads
  useEffect(() => {
    if (teaser?.sessionId) {
      setSessionId(teaser.sessionId);
    }
  }, [teaser]);

  // Handle password requirement
  useEffect(() => {
    if (needsPassword && !password) {
      setShowPasswordDialog(true);
    }
  }, [needsPassword, password]);

  // Update document title when teaser loads
  useEffect(() => {
    if (teaser?.headline) {
      document.title = teaser.headline;
    }
    return () => {
      document.title = 'CIM Share';
    };
  }, [teaser?.headline]);

  // Heartbeat to track time spent
  useEffect(() => {
    if (sessionId && slug) {
      heartbeatRef.current = setInterval(() => {
        const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
        fetch(`/api/teasers/public/${slug}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, timeSpentSeconds: timeSpent }),
        }).catch(() => {});
      }, 30000); // Every 30 seconds

      return () => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
        // Send final heartbeat
        const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
        navigator.sendBeacon(
          `/api/teasers/public/${slug}/heartbeat`,
          JSON.stringify({ sessionId, timeSpentSeconds: timeSpent })
        );
      };
    }
  }, [sessionId, slug]);

  // Track clicks
  const trackClick = async (action: "sign_nda" | "contact") => {
    if (sessionId && slug) {
      fetch(`/api/teasers/public/${slug}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action }),
      }).catch(() => {});
    }
  };

  // Handle password submit
  const handlePasswordSubmit = async () => {
    setPasswordError(false);
    try {
      const res = await fetch(
        `/api/teasers/public/${slug}?password=${encodeURIComponent(password)}`
      );
      if (res.ok) {
        setShowPasswordDialog(false);
        refetchTeaser();
      } else {
        setPasswordError(true);
      }
    } catch {
      setPasswordError(true);
    }
  };

  // Handle Sign NDA click
  const handleSignNda = () => {
    trackClick("sign_nda");
    if (teaser?.cimShareSlug) {
      window.location.href = `/share/${teaser.cimShareSlug}`;
    }
  };

  // Handle Contact click
  const handleContact = () => {
    trackClick("contact");
    if (teaser?.broker.email) {
      window.location.href = `mailto:${teaser.broker.email}?subject=Inquiry about ${teaser.headline}`;
    }
  };

  // Loading state
  if (checkLoading || teaserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500">Loading teaser...</p>
        </div>
      </div>
    );
  }

  // Not found or check error
  if (checkError || !checkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Teaser Not Found</h1>
            <p className="text-gray-600">
              This teaser may have been removed or the link is incorrect.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error loading teaser data
  if (teaserError && !showPasswordDialog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Something Went Wrong</h1>
            <p className="text-gray-600 mb-4">
              {(teaserError as Error)?.message || "Unable to load this teaser. Please try again."}
            </p>
            <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password dialog
  if (showPasswordDialog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Dialog open={showPasswordDialog} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Password Required
              </DialogTitle>
              <DialogDescription>
                This teaser is password protected. Please enter the password to
                continue.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                className={passwordError ? "border-red-500" : ""}
              />
              {passwordError && (
                <p className="text-sm text-red-500">Incorrect password</p>
              )}
              <Button onClick={handlePasswordSubmit} className="w-full bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white">
                Continue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (!teaser) return null;

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Cover Image */}
        {teaser.coverImageUrl && (
          <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden">
            <img
              src={teaser.coverImageUrl}
              alt="Cover"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50" />
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-4 py-8 -mt-16 relative z-10">
          <Card className="shadow-lg">
            <CardContent className="p-6 sm:p-8">
              {/* Broker Logo */}
              {teaser.broker.businessLogo && (
                <div className="mb-6">
                  <img
                    src={teaser.broker.businessLogo}
                    alt={teaser.broker.businessName || "Broker"}
                    className="h-12 object-contain"
                  />
                </div>
              )}

              {/* Headline and Actions */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {teaser.headline}
                </h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShareEmail}
                    title="Share via Email"
                    className="h-9 w-9"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDownloadPdf}
                    disabled={isDownloading}
                    title="Download PDF"
                    className="h-9 w-9"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {teaser.industryTags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-blue-50 text-blue-700">
                    {tag}
                  </Badge>
                ))}
                {teaser.dealTypeTags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-gray-300">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Summary */}
              <div className="prose prose-gray max-w-none mb-8">
                {teaser.summary.split("\n").map((paragraph, i) => (
                  <p key={i} className="text-gray-700 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Financial Highlights */}
              {teaser.showFinancials && teaser.financials && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {teaser.financials.revenue && (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="text-sm text-gray-500 mb-1">Revenue</div>
                      <div className="text-lg font-bold text-gray-900">
                        {teaser.financials.revenue}
                      </div>
                    </div>
                  )}
                  {teaser.financials.earnings && (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="text-sm text-gray-500 mb-1">Earnings</div>
                      <div className="text-lg font-bold text-gray-900">
                        {teaser.financials.earnings}
                      </div>
                    </div>
                  )}
                  {teaser.financials.askingPrice && (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Target className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="text-sm text-gray-500 mb-1">Asking Price</div>
                      <div className="text-lg font-bold text-gray-900">
                        {teaser.financials.askingPrice}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button
                  size="lg"
                  className="flex-1 bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
                  onClick={handleSignNda}
                >
                  <FileSignature className="h-5 w-5 mr-2" />
                  {teaser.ndaProtected ? "Sign NDA to Learn More" : "View Full Details"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={handleContact}
                >
                  <Mail className="h-5 w-5 mr-2" />
                  Contact Broker
                </Button>
              </div>

              {/* Broker Contact Info */}
              <div className="border-t pt-6">
                {/* Business Logo - displayed prominently if available */}
                {teaser.broker.businessLogo && (
                  <div className="mb-4">
                    <img
                      src={teaser.broker.businessLogo}
                      alt={teaser.broker.businessName || ""}
                      className="h-10 object-contain"
                    />
                  </div>
                )}
                <div className="flex items-start gap-4">
                  {/* Profile Photo or Placeholder */}
                  {teaser.broker.profilePhoto ? (
                    <img
                      src={teaser.broker.profilePhoto}
                      alt={teaser.broker.name || ""}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    {teaser.broker.businessName && (
                      <div className="font-semibold text-gray-900">
                        {teaser.broker.businessName}
                      </div>
                    )}
                    {teaser.broker.name && (
                      <div className="text-gray-600">{teaser.broker.name}</div>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                      {teaser.broker.email && (
                        <a
                          href={`mailto:${teaser.broker.email}`}
                          className="flex items-center gap-1 hover:text-blue-600"
                        >
                          <Mail className="h-4 w-4" />
                          {teaser.broker.email}
                        </a>
                      )}
                      {teaser.broker.phone && (
                        <a
                          href={`tel:${teaser.broker.phone}`}
                          className="flex items-center gap-1 hover:text-blue-600"
                        >
                          <Phone className="h-4 w-4" />
                          {teaser.broker.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Confidential Footer */}
              <div className="mt-8 pt-4 border-t text-center text-xs text-gray-400">
                Confidential Teaser - For Qualified Buyers Only
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}

export default TeaserPage;
