import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  FileSignature,
  Mail,
  DollarSign,
  TrendingUp,
  Target,
  Loader2,
  ExternalLink,
} from "lucide-react";

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

export function TeaserEmbedPage() {
  const [matched, params] = useRoute("/teaser/:slug/embed");
  const slug = params?.slug;

  const [password, setPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  // Check if teaser exists and needs password
  const { data: checkData, isLoading: checkLoading } = useQuery({
    queryKey: [`/api/teasers/public/${slug}/check`],
    queryFn: async () => {
      const res = await fetch(`/api/teasers/public/${slug}/check`);
      if (!res.ok) throw new Error("Teaser not found");
      return res.json();
    },
    enabled: !!slug,
  });

  // Fetch teaser data
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
          setShowPasswordForm(true);
          throw new Error("Password required");
        }
      }
      if (!res.ok) throw new Error("Failed to load teaser");
      return res.json();
    },
    enabled: !!slug && !!checkData && !checkData.requiresPassword,
    retry: false,
  });

  // Handle password requirement
  useEffect(() => {
    if (checkData?.requiresPassword && !password) {
      setShowPasswordForm(true);
    }
  }, [checkData, password]);

  // Handle password submit
  const handlePasswordSubmit = async () => {
    setPasswordError(false);
    try {
      const res = await fetch(
        `/api/teasers/public/${slug}?password=${encodeURIComponent(password)}`
      );
      if (res.ok) {
        setShowPasswordForm(false);
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
    if (teaser?.cimShareSlug) {
      // Open in new tab since we're embedded
      window.open(`/share/${teaser.cimShareSlug}`, '_blank');
    }
  };

  // Handle Contact click
  const handleContact = () => {
    if (teaser?.broker.email) {
      window.open(`mailto:${teaser.broker.email}?subject=Inquiry about ${teaser.headline}`, '_blank');
    }
  };

  // Loading state
  if (checkLoading || teaserLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!checkData || teaserError) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-white">
        <div className="text-center p-8">
          <h1 className="text-xl font-bold mb-2">Teaser Not Found</h1>
          <p className="text-gray-600 text-sm">
            This teaser may have been removed.
          </p>
        </div>
      </div>
    );
  }

  // Password form
  if (showPasswordForm) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-white p-6">
        <div className="max-w-sm w-full space-y-4">
          <div className="text-center">
            <Lock className="h-8 w-8 mx-auto text-gray-400 mb-3" />
            <h2 className="font-semibold text-lg">Password Required</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter the password to view this teaser.
            </p>
          </div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            className={passwordError ? "border-red-500" : ""}
          />
          {passwordError && (
            <p className="text-sm text-red-500 text-center">Incorrect password</p>
          )}
          <Button onClick={handlePasswordSubmit} className="w-full bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white">
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (!teaser) return null;

  return (
    <div className="bg-white font-sans">
      {/* Minimal Header with Logo */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          {teaser.broker.businessLogo ? (
            <img
              src={teaser.broker.businessLogo}
              alt={teaser.broker.businessName || ""}
              className="h-8 object-contain"
            />
          ) : (
            <span className="font-semibold text-gray-900">
              {teaser.broker.businessName}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/teaser/${slug}`, '_blank')}
            className="text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Full Page
          </Button>
        </div>
      </div>

      {/* Cover Image (smaller for embed) */}
      {teaser.coverImageUrl && (
        <div className="h-32 w-full overflow-hidden">
          <img
            src={teaser.coverImageUrl}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Headline */}
        <h1 className="text-xl font-bold text-gray-900 mb-3">
          {teaser.headline}
        </h1>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {teaser.industryTags?.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs bg-blue-50 text-blue-700">
              {tag}
            </Badge>
          ))}
          {teaser.dealTypeTags?.slice(0, 1).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Summary (truncated for embed) */}
        <p className="text-sm text-gray-700 leading-relaxed mb-6 line-clamp-4">
          {teaser.summary}
        </p>

        {/* Financial Highlights (compact) */}
        {teaser.showFinancials && teaser.financials && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {teaser.financials.revenue && (
              <div className="bg-gray-50 rounded p-3 text-center">
                <TrendingUp className="h-4 w-4 text-green-600 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Revenue</div>
                <div className="text-sm font-bold">{teaser.financials.revenue}</div>
              </div>
            )}
            {teaser.financials.earnings && (
              <div className="bg-gray-50 rounded p-3 text-center">
                <DollarSign className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Earnings</div>
                <div className="text-sm font-bold">{teaser.financials.earnings}</div>
              </div>
            )}
            {teaser.financials.askingPrice && (
              <div className="bg-gray-50 rounded p-3 text-center">
                <Target className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Asking</div>
                <div className="text-sm font-bold">{teaser.financials.askingPrice}</div>
              </div>
            )}
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-3">
          <Button size="sm" className="flex-1 bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white" onClick={handleSignNda}>
            <FileSignature className="h-4 w-4 mr-1" />
            {teaser.ndaProtected ? "Sign NDA" : "View Details"}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={handleContact}>
            <Mail className="h-4 w-4 mr-1" />
            Contact
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-3 text-center">
        <p className="text-xs text-gray-400">
          Confidential Teaser
        </p>
      </div>
    </div>
  );
}

export default TeaserEmbedPage;
