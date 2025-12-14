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
} from "lucide-react";

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

export function ListingsSettings() {
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

    // Validate file type
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
      // Compress image to base64 (1920px wide for banner)
      let imageUrl = await compressImage(file, 1920, 0.8);

      // Check compressed size (should be under 2MB base64)
      if (imageUrl.length > 2 * 1024 * 1024) {
        // Try with higher compression
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const listingsUrl = `${window.location.origin}/listings/${slug}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Public Listings Page
          </CardTitle>
          <CardDescription>
            Create a public page that showcases all your published teasers in one place.
          </CardDescription>
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(listingsUrl, "_blank")}
                    disabled={!slug || !!slugError || !enabled}
                  >
                    <ExternalLink className="h-4 w-4" />
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
                <p className="text-xs text-gray-500">
                  {100 - title.length} characters remaining
                </p>
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
                <p className="text-xs text-gray-500">
                  {500 - tagline.length} characters remaining
                </p>
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
              className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
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

      {/* Preview Card */}
      {enabled && slug && !slugError && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-gray-100 p-2 flex items-center gap-2 border-b">
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white rounded px-3 py-1 text-sm text-gray-600">
                  {listingsUrl}
                </div>
              </div>
              <div className="p-4 bg-gray-50">
                <div className="text-center py-8">
                  <p className="text-gray-500">Your listings page will appear here</p>
                  <Button
                    variant="link"
                    onClick={() => window.open(listingsUrl, "_blank")}
                  >
                    View Live Page
                    <ExternalLink className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ListingsSettings;
