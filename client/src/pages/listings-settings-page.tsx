import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Copy,
  ExternalLink,
  Check,
  AlertCircle,
  LayoutGrid,
  List,
  Image,
  Link as LinkIcon,
  Eye,
  FileText,
  LayoutList,
} from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/layout/page-header";

// Helper to compress image to base64
async function compressImage(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ListingsSettings {
  listingsEnabled: boolean;
  listingsSlug: string | null;
  listingsTitle: string | null;
  listingsTagline: string | null;
  listingsBannerUrl: string | null;
  listingsLayout: string;
  businessName: string | null;
  businessLogo: string | null;
}

interface ActiveListing {
  id: number;
  shareSlug: string;
  headline: string;
  summary: string;
  coverImageUrl: string | null;
  listingStatus: 'active' | 'under_loi' | 'closed';
  updatedAt: string;
}

export default function ListingsSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [layout, setLayout] = useState("grid");
  const [slugError, setSlugError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<ListingsSettings>({
    queryKey: ["/api/listings/settings"],
    queryFn: async () => {
      const res = await fetch("/api/listings/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  // Fetch active listings (teasers on the public listings page)
  const { data: activeListings } = useQuery<ActiveListing[]>({
    queryKey: ["/api/listings/active"],
    queryFn: async () => {
      const res = await fetch("/api/listings/active");
      if (!res.ok) throw new Error("Failed to fetch active listings");
      return res.json();
    },
    enabled: !!settings?.listingsEnabled,
  });

  // Suggest slug
  const { data: suggestedSlug } = useQuery<{ slug: string | null }>({
    queryKey: ["/api/listings/suggest-slug"],
    queryFn: async () => {
      const res = await fetch("/api/listings/suggest-slug");
      if (!res.ok) throw new Error("Failed to suggest slug");
      return res.json();
    },
    enabled: !settings?.listingsSlug,
  });

  // Check slug availability
  const checkSlugMutation = useMutation({
    mutationFn: async (slugToCheck: string) => {
      const res = await fetch(`/api/listings/check-slug/${slugToCheck}`);
      if (!res.ok) throw new Error("Failed to check slug");
      return res.json();
    },
    onSuccess: (data) => {
      if (!data.available) {
        setSlugError("This URL is already taken");
      } else {
        setSlugError("");
      }
    },
  });

  // Update settings
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<ListingsSettings>) => {
      const res = await fetch("/api/listings/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings/settings"] });
      toast({
        title: "Settings saved",
        description: "Your listings page settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize form from settings
  useEffect(() => {
    if (settings) {
      setEnabled(settings.listingsEnabled);
      setSlug(settings.listingsSlug || "");
      setTitle(settings.listingsTitle || "");
      setTagline(settings.listingsTagline || "");
      setBannerUrl(settings.listingsBannerUrl || "");
      setLayout(settings.listingsLayout || "grid");
    }
  }, [settings]);

  // Use suggested slug if no current slug
  useEffect(() => {
    if (suggestedSlug?.slug && !settings?.listingsSlug && !slug) {
      setSlug(suggestedSlug.slug);
    }
  }, [suggestedSlug, settings?.listingsSlug, slug]);

  // Validate slug on change
  useEffect(() => {
    if (slug && slug !== settings?.listingsSlug) {
      const timer = setTimeout(() => {
        if (/^[a-z0-9-]+$/.test(slug) && slug.length >= 3) {
          checkSlugMutation.mutate(slug);
        } else if (slug.length > 0 && slug.length < 3) {
          setSlugError("URL must be at least 3 characters");
        } else if (slug.length > 0) {
          setSlugError("URL can only contain lowercase letters, numbers, and hyphens");
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSlugError("");
    }
  }, [slug, settings?.listingsSlug]);

  const handleSlugChange = (value: string) => {
    // Auto-format: lowercase, replace spaces with hyphens
    const formatted = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    setSlug(formatted);
  };

  const handleSave = () => {
    if (slugError) {
      toast({
        title: "Invalid URL",
        description: slugError,
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      listingsEnabled: enabled,
      listingsSlug: slug || null,
      listingsTitle: title || null,
      listingsTagline: tagline || null,
      listingsBannerUrl: bannerUrl || null,
      listingsLayout: layout,
    });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/listings/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copied",
      description: "Listings page URL copied to clipboard.",
    });
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please choose an image file (PNG, JPG, or GIF).",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingBanner(true);
    try {
      let imageUrl = await compressImage(file, 1920, 0.8);

      if (imageUrl.length > 2 * 1024 * 1024) {
        imageUrl = await compressImage(file, 1200, 0.6);
        if (imageUrl.length > 2 * 1024 * 1024) {
          toast({
            title: "Image Too Large",
            description: "Please choose a smaller image or reduce the image quality.",
            variant: "destructive",
          });
          return;
        }
      }

      setBannerUrl(imageUrl);
      toast({
        title: "Banner uploaded",
        description: "Your banner image has been uploaded. Remember to save settings.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process banner image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingBanner(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const listingsUrl = `${window.location.origin}/listings/${slug}`;

  return (
    <div className="p-6">
      <PageHeader
        title="Public Listings Page"
        description="Create a public page that showcases all your published teasers in one place."
        icon={<LayoutList className="h-5 w-5" />}
      />

      {/* Preview Button - Prominent */}
      {enabled && slug && !slugError && (
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Your listings page is live!</p>
                  <p className="text-sm text-gray-600">{listingsUrl}</p>
                </div>
              </div>
              <Button
                onClick={() => window.open(listingsUrl, "_blank")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview Listings Page
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Listings Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enabled" className="text-base font-medium">
                    Enable Listings Page
                  </Label>
                  <p className="text-sm text-gray-500">
                    Make your listings page publicly accessible
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>

              {enabled && (
                <>
                  {/* URL Slug */}
                  <div className="space-y-2">
                    <Label htmlFor="slug">Page URL</Label>
                    <div className="flex gap-2">
                      <div className={`flex-1 flex items-center border rounded-md bg-white ${slugError ? "border-red-500" : "border-input"}`}>
                        <span className="pl-3 pr-1 text-sm text-gray-500 whitespace-nowrap select-none bg-gray-50 py-2 rounded-l-md border-r">
                          {window.location.host}/listings/
                        </span>
                        <Input
                          id="slug"
                          value={slug}
                          onChange={(e) => handleSlugChange(e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="your-company"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyLink}
                        disabled={!slug || !!slugError}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {slugError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {slugError}
                      </p>
                    )}
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Page Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={settings?.businessName ? `${settings.businessName} Listings` : "Business Listings"}
                      maxLength={100}
                    />
                  </div>

                  {/* Tagline */}
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Textarea
                      id="tagline"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Browse our current business opportunities..."
                      maxLength={500}
                      rows={2}
                    />
                  </div>

                  {/* Banner Image */}
                  <div className="space-y-2">
                    <Label>Banner Image</Label>
                    <div className="flex gap-4 items-start">
                      {bannerUrl ? (
                        <div className="relative w-48 h-24 rounded-lg overflow-hidden border">
                          <img
                            src={bannerUrl}
                            alt="Banner preview"
                            className="w-full h-full object-cover"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1"
                            onClick={() => setBannerUrl("")}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="w-48 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <Image className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <input
                          type="file"
                          id="banner-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handleBannerUpload}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById("banner-upload")?.click()}
                          disabled={isUploadingBanner}
                        >
                          {isUploadingBanner ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>Upload Banner</>
                          )}
                        </Button>
                        <p className="text-xs text-gray-500 mt-1">
                          Recommended: 1920x400px
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Layout */}
                  <div className="space-y-2">
                    <Label>Default Layout</Label>
                    <Select value={layout} onValueChange={setLayout}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">
                          <div className="flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            Grid View
                          </div>
                        </SelectItem>
                        <SelectItem value="list">
                          <div className="flex items-center gap-2">
                            <List className="h-4 w-4" />
                            List View
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Save Button */}
              <div className="pt-4 border-t">
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending || !!slugError}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Listings Column */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Active Listings
              </CardTitle>
              <CardDescription>
                CIMs with teasers on your public page
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!enabled ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Enable your listings page to see active listings here.
                </p>
              ) : activeListings && activeListings.length > 0 ? (
                <div className="space-y-3">
                  {activeListings.map((listing) => (
                    <Link key={listing.id} href={`/documents/${listing.id}`}>
                      <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group">
                        {listing.coverImageUrl ? (
                          <img
                            src={listing.coverImageUrl}
                            alt=""
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                            {listing.headline}
                          </p>
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {listing.summary}
                          </p>
                          {listing.listingStatus === 'under_loi' && (
                            <span className="inline-flex items-center text-xs text-amber-600 mt-1">
                              Under LOI
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No active listings yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Publish teasers to see them here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
