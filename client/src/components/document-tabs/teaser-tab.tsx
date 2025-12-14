import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Sparkles,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Image as ImageIcon,
  DollarSign,
  Tag,
  Code,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Download,
  Trash2,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface DocumentTeaserTabProps {
  cimDocument: any;
  user: any;
}

// Teaser status type
type TeaserStatus = 'draft' | 'published' | 'outdated';

export function DocumentTeaserTab({ cimDocument, user }: DocumentTeaserTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [newIndustryTag, setNewIndustryTag] = useState("");
  const [newDealTypeTag, setNewDealTypeTag] = useState("");

  // Fetch teaser data
  const { data: teaser, isLoading: teaserLoading, error: teaserError } = useQuery({
    queryKey: [`/api/teasers/cim/${cimDocument.id}`],
    queryFn: async () => {
      const res = await fetch(`/api/teasers/cim/${cimDocument.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch teaser');
      return res.json();
    },
  });

  // Fetch available tags
  const { data: tagsData } = useQuery({
    queryKey: ['/api/teasers/tags'],
    queryFn: async () => {
      const res = await fetch('/api/teasers/tags', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tags');
      return res.json();
    },
  });

  // Local state for editing
  const [editState, setEditState] = useState<{
    headline: string;
    summary: string;
    industryTags: string[];
    dealTypeTags: string[];
    showFinancials: boolean;
    revenue: string;
    earnings: string;
    askingPrice: string;
    shareSlug: string;
    sharePassword: string;
    isPublished: boolean;
    useCimCoverImage: boolean;
    includeWatermark: boolean;
  }>({
    headline: '',
    summary: '',
    industryTags: [],
    dealTypeTags: [],
    showFinancials: false,
    revenue: '',
    earnings: '',
    askingPrice: '',
    shareSlug: '',
    sharePassword: '',
    isPublished: false,
    useCimCoverImage: true,
    includeWatermark: true,
  });

  // Update local state when teaser data loads
  useEffect(() => {
    if (teaser) {
      setEditState({
        headline: teaser.headline || '',
        summary: teaser.summary || '',
        industryTags: teaser.industryTags || [],
        dealTypeTags: teaser.dealTypeTags || [],
        showFinancials: teaser.showFinancials || false,
        revenue: teaser.revenue || '',
        earnings: teaser.earnings || '',
        askingPrice: teaser.askingPrice || '',
        shareSlug: teaser.shareSlug || '',
        sharePassword: teaser.sharePassword || '',
        isPublished: teaser.isPublished || false,
        useCimCoverImage: teaser.useCimCoverImage ?? true,
        includeWatermark: teaser.includeWatermark ?? true,
      });
    }
  }, [teaser]);

  // Create teaser mutation
  const createTeaserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/teasers/cim/${cimDocument.id}`);
      if (!res.ok) throw new Error('Failed to create teaser');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teasers/cim/${cimDocument.id}`] });
      toast({ title: 'Teaser Created', description: 'AI has generated your teaser content.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update teaser mutation
  const updateTeaserMutation = useMutation({
    mutationFn: async (data: Partial<typeof editState>) => {
      const res = await apiRequest('PUT', `/api/teasers/cim/${cimDocument.id}`, { body: data });
      if (!res.ok) throw new Error('Failed to update teaser');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teasers/cim/${cimDocument.id}`] });
      toast({ title: 'Teaser Updated', description: 'Your changes have been saved.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Refresh teaser mutation
  const refreshTeaserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/teasers/cim/${cimDocument.id}/refresh`);
      if (!res.ok) throw new Error('Failed to refresh teaser');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teasers/cim/${cimDocument.id}`] });
      toast({ title: 'Teaser Refreshed', description: 'Content has been regenerated from your CIM.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete teaser mutation
  const deleteTeaserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/teasers/cim/${cimDocument.id}`);
      if (!res.ok) throw new Error('Failed to delete teaser');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teasers/cim/${cimDocument.id}`] });
      toast({ title: 'Teaser Deleted', description: 'The teaser has been removed.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Handle field updates
  const handleFieldChange = (field: string, value: any) => {
    setEditState(prev => ({ ...prev, [field]: value }));
  };

  // Save changes
  const handleSave = () => {
    updateTeaserMutation.mutate(editState);
  };

  // Toggle publish status
  const handleTogglePublish = () => {
    const newPublishedState = !editState.isPublished;
    setEditState(prev => ({ ...prev, isPublished: newPublishedState }));
    updateTeaserMutation.mutate({ isPublished: newPublishedState });
  };

  // Get teaser status
  const getTeaserStatus = (): TeaserStatus => {
    if (!teaser) return 'draft';
    if (teaser.cimUpdatedSinceSync) return 'outdated';
    if (teaser.isPublished) return 'published';
    return 'draft';
  };

  // Generate teaser URL
  const getTeaserUrl = () => {
    if (!editState.shareSlug) return '';
    return `${window.location.origin}/teaser/${editState.shareSlug}`;
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    const url = getTeaserUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  // Generate embed code
  const getEmbedCode = () => {
    const url = getTeaserUrl();
    if (!url) return '';
    return `<iframe src="${url}/embed" width="100%" height="800" frameborder="0" style="border: none; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"></iframe>`;
  };

  // Copy embed code
  const handleCopyEmbed = async () => {
    const code = getEmbedCode();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch (err) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  // Handle tag selection
  const handleTagToggle = (tagType: 'industryTags' | 'dealTypeTags', tag: string) => {
    setEditState(prev => {
      const current = prev[tagType];
      const updated = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      return { ...prev, [tagType]: updated };
    });
  };

  // Add custom tag mutation
  const addCustomTagMutation = useMutation({
    mutationFn: async ({ tagType, tagValue }: { tagType: 'industry' | 'deal_type', tagValue: string }) => {
      const res = await apiRequest('POST', '/api/teasers/tags', {
        body: { tagType, tagValue }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add tag');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/teasers/tags'] });
      toast({ title: 'Tag Added', description: `Custom tag "${variables.tagValue}" has been saved.` });
      if (variables.tagType === 'industry') {
        setNewIndustryTag('');
      } else {
        setNewDealTypeTag('');
      }
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete custom tag mutation
  const deleteCustomTagMutation = useMutation({
    mutationFn: async ({ tagType, tagValue }: { tagType: 'industry' | 'deal_type', tagValue: string }) => {
      const res = await apiRequest('DELETE', `/api/teasers/tags/${tagType}/${encodeURIComponent(tagValue)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete tag');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/teasers/tags'] });
      // Also remove from current selection if selected
      const tagTypeKey = variables.tagType === 'industry' ? 'industryTags' : 'dealTypeTags';
      setEditState(prev => ({
        ...prev,
        [tagTypeKey]: prev[tagTypeKey].filter(t => t !== variables.tagValue)
      }));
      toast({ title: 'Tag Deleted', description: `Custom tag "${variables.tagValue}" has been removed.` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Handle adding a custom tag
  const handleAddCustomTag = (tagType: 'industry' | 'deal_type', tagValue: string) => {
    if (!tagValue.trim()) return;
    addCustomTagMutation.mutate({ tagType, tagValue: tagValue.trim() });
  };

  // Loading state
  if (teaserLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500">Loading teaser...</p>
        </CardContent>
      </Card>
    );
  }

  // No teaser exists - show create prompt
  if (!teaser) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Create a Teaser</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            A teaser is a public-facing one-pager that gives potential buyers a preview of your deal
            before they sign an NDA. AI will generate sanitized content from your CIM.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-8">
          <Button
            size="lg"
            onClick={() => createTeaserMutation.mutate()}
            disabled={createTeaserMutation.isPending}
            className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
          >
            {createTeaserMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Teaser with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = getTeaserStatus();

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {status === 'outdated' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Teaser is Outdated</p>
                <p className="text-sm text-amber-700">Your CIM has been updated since this teaser was generated.</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => refreshTeaserMutation.mutate()}
              disabled={refreshTeaserMutation.isPending}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              {refreshTeaserMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh from CIM
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status & Actions Header */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Badge
              variant={status === 'published' ? 'default' : 'outline'}
              className={
                status === 'published'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : status === 'outdated'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-gray-100 text-gray-800 border-gray-200'
              }
            >
              {status === 'published' ? 'Published' : status === 'outdated' ? 'Outdated' : 'Draft'}
            </Badge>
            {teaser.viewCount > 0 && (
              <span className="text-sm text-gray-500">
                {teaser.viewCount} view{teaser.viewCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(getTeaserUrl(), '_blank')}
              disabled={!editState.shareSlug}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              variant={editState.isPublished ? 'outline' : 'default'}
              size="sm"
              onClick={handleTogglePublish}
              disabled={updateTeaserMutation.isPending}
              className={!editState.isPublished ? "bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white" : ""}
            >
              {editState.isPublished ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Unpublish
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Publish
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Teaser Content
          </CardTitle>
          <CardDescription>
            Edit the headline and summary for your teaser. Content is sanitized to hide specific details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Headline */}
          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={editState.headline}
              onChange={(e) => handleFieldChange('headline', e.target.value)}
              placeholder="Compelling headline for your teaser..."
              className="text-lg font-medium"
            />
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              value={editState.summary}
              onChange={(e) => handleFieldChange('summary', e.target.value)}
              placeholder="A brief, sanitized overview of the business opportunity..."
              rows={6}
            />
            <p className="text-xs text-gray-500">
              {editState.summary.length} characters
            </p>
          </div>

          {/* Tags */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Industry Tags */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Industry Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {(tagsData?.industryTags || []).map((tag: string) => {
                  const isSelected = editState.industryTags.includes(tag);
                  const isCustom = tagsData?.customIndustryTags?.includes(tag);
                  return (
                    <Badge
                      key={tag}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer ${isSelected ? 'bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white border-0' : ''}`}
                      onClick={() => handleTagToggle('industryTags', tag)}
                    >
                      {tag}
                      {isCustom && (
                        <button
                          type="button"
                          className="ml-1 hover:text-red-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomTagMutation.mutate({ tagType: 'industry', tagValue: tag });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
              {/* Add custom industry tag */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom industry tag..."
                  value={newIndustryTag}
                  onChange={(e) => setNewIndustryTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTag('industry', newIndustryTag);
                    }
                  }}
                  className="flex-1 h-8 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddCustomTag('industry', newIndustryTag)}
                  disabled={!newIndustryTag.trim() || addCustomTagMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Deal Type Tags */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Deal Type Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {(tagsData?.dealTypeTags || []).map((tag: string) => {
                  const isSelected = editState.dealTypeTags.includes(tag);
                  const isCustom = tagsData?.customDealTypeTags?.includes(tag);
                  return (
                    <Badge
                      key={tag}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer ${isSelected ? 'bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white border-0' : ''}`}
                      onClick={() => handleTagToggle('dealTypeTags', tag)}
                    >
                      {tag}
                      {isCustom && (
                        <button
                          type="button"
                          className="ml-1 hover:text-red-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomTagMutation.mutate({ tagType: 'deal_type', tagValue: tag });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
              {/* Add custom deal type tag */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom deal type tag..."
                  value={newDealTypeTag}
                  onChange={(e) => setNewDealTypeTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTag('deal_type', newDealTypeTag);
                    }
                  }}
                  className="flex-1 h-8 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddCustomTag('deal_type', newDealTypeTag)}
                  disabled={!newDealTypeTag.trim() || addCustomTagMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financials Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Highlights
              </CardTitle>
              <CardDescription>
                Choose whether to display financial information on the teaser.
              </CardDescription>
            </div>
            <Switch
              checked={editState.showFinancials}
              onCheckedChange={(checked) => handleFieldChange('showFinancials', checked)}
            />
          </div>
        </CardHeader>
        {editState.showFinancials && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="revenue">Revenue</Label>
                <Input
                  id="revenue"
                  value={editState.revenue}
                  onChange={(e) => handleFieldChange('revenue', e.target.value)}
                  placeholder="e.g., $5.2M"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="earnings">Earnings</Label>
                <Input
                  id="earnings"
                  value={editState.earnings}
                  onChange={(e) => handleFieldChange('earnings', e.target.value)}
                  placeholder="e.g., $1.1M"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="askingPrice">Asking Price</Label>
                <Input
                  id="askingPrice"
                  value={editState.askingPrice}
                  onChange={(e) => handleFieldChange('askingPrice', e.target.value)}
                  placeholder="e.g., $4.5M"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Share Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Share Settings
          </CardTitle>
          <CardDescription>
            Configure how your teaser is shared publicly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* URL Slug */}
          <div className="space-y-2">
            <Label htmlFor="shareSlug">URL Slug</Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-gray-50 border rounded-md">
                <span className="px-3 text-sm text-gray-500">/teaser/</span>
                <Input
                  id="shareSlug"
                  value={editState.shareSlug}
                  onChange={(e) => handleFieldChange('shareSlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="border-0 bg-transparent"
                  placeholder="your-teaser-slug"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleCopyLink}
                disabled={!editState.shareSlug}
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Password Protection */}
          <div className="space-y-2">
            <Label htmlFor="sharePassword" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password Protection (Optional)
            </Label>
            <Input
              id="sharePassword"
              type="password"
              value={editState.sharePassword}
              onChange={(e) => handleFieldChange('sharePassword', e.target.value)}
              placeholder="Leave empty for public access"
            />
          </div>

          {/* PDF Watermark */}
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="font-medium">Confidential Watermark on PDF</Label>
              <p className="text-sm text-gray-500">Include "Confidential Teaser" watermark when exporting to PDF</p>
            </div>
            <Switch
              checked={editState.includeWatermark}
              onCheckedChange={(checked) => handleFieldChange('includeWatermark', checked)}
            />
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => window.open(getTeaserUrl(), '_blank')}
              disabled={!editState.shareSlug || !editState.isPublished}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Teaser Page
            </Button>

            <Dialog open={showEmbedDialog} onOpenChange={setShowEmbedDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!editState.shareSlug}>
                  <Code className="h-4 w-4 mr-2" />
                  Get Embed Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Embed Code</DialogTitle>
                  <DialogDescription>
                    Copy this code to embed the teaser on your website.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <code className="text-sm break-all">{getEmbedCode()}</code>
                  </div>
                  <Button onClick={handleCopyEmbed} className="w-full bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white">
                    {copiedEmbed ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Embed Code
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              onClick={() => window.open(`/api/teasers/public/${editState.shareSlug}/export/pdf`, '_blank')}
              disabled={!editState.shareSlug}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Teaser
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Teaser?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your teaser. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTeaserMutation.mutate()}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          onClick={handleSave}
          disabled={updateTeaserMutation.isPending}
          className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
        >
          {updateTeaserMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
