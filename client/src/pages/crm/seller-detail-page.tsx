import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/crm/photo-upload";
import { InlineEdit, InlineEditEmail } from "@/components/ui/inline-edit";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";
import { MentionInput } from "@/components/ui/mention-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageSquare,
  Building2,
  Briefcase,
  Clock,
  FileText,
  Activity,
  CheckSquare,
  Plus,
  Check,
  Trash2,
  UserPlus,
  Video,
  FileUp,
  Copy,
  DollarSign,
  TrendingUp,
  Calendar,
  Upload,
  Download,
  X,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const REVENUE_RANGES: Record<string, string> = {
  under_500k: 'Under $500K', '500k_1m': '$500K-$1M', '1m_5m': '$1M-$5M',
  '5m_10m': '$5M-$10M', '10m_25m': '$10M-$25M', '25m_plus': '$25M+',
};

const PROFIT_RANGES: Record<string, string> = {
  under_100k: 'Under $100K', '100k_250k': '$100K-$250K', '250k_500k': '$250K-$500K',
  '500k_1m': '$500K-$1M', '1m_5m': '$1M-$5M',
};

const TIMELINE_LABELS: Record<string, string> = {
  immediate: 'Immediate', '3_months': '3 Months', '6_months': '6 Months',
  '12_months': '12 Months', flexible: 'Flexible',
};

const MOTIVATION_LABELS: Record<string, string> = {
  retirement: 'Retirement', burnout: 'Burnout', partner_dispute: 'Partner Dispute',
  health: 'Health', relocation: 'Relocation', new_venture: 'New Venture', other: 'Other',
};

function getActivityIcon(activityType: string) {
  switch (activityType) {
    case 'note': return { icon: MessageSquare, bg: 'bg-blue-100', color: 'text-blue-600' };
    case 'file_uploaded': return { icon: FileUp, bg: 'bg-purple-100', color: 'text-purple-600' };
    case 'task_created': return { icon: CheckSquare, bg: 'bg-orange-100', color: 'text-orange-600' };
    case 'task_completed': return { icon: Check, bg: 'bg-green-100', color: 'text-green-600' };
    case 'contact_created': return { icon: UserPlus, bg: 'bg-indigo-100', color: 'text-indigo-600' };
    case 'email': return { icon: Mail, bg: 'bg-cyan-100', color: 'text-cyan-600' };
    case 'call': return { icon: Phone, bg: 'bg-yellow-100', color: 'text-yellow-600' };
    case 'meeting': return { icon: Video, bg: 'bg-pink-100', color: 'text-pink-600' };
    default: return { icon: Clock, bg: 'bg-gray-100', color: 'text-gray-500' };
  }
}

function formatActivityTitle(activity: any): string {
  switch (activity.activityType) {
    case 'note': return 'added a note';
    case 'file_uploaded': return `uploaded ${activity.metadata?.fileName || 'a file'}`;
    case 'task_created': return `created task: ${activity.metadata?.taskTitle || 'Untitled'}`;
    case 'task_completed': return `completed task: ${activity.metadata?.taskTitle || 'Untitled'}`;
    case 'contact_created': return 'created this contact';
    case 'email': return activity.metadata?.direction === 'sent' ? 'sent an email' : 'received an email';
    default: return activity.title || activity.activityType.replace(/_/g, ' ');
  }
}

export default function SellerDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("activity");
  const [newNote, setNewNote] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [uploadFileType, setUploadFileType] = useState("other");
  const [isLinkDealOpen, setIsLinkDealOpen] = useState(false);
  const [dealSearch, setDealSearch] = useState("");
  const [selectedDealId, setSelectedDealId] = useState<string>("");

  const { data: contact, isLoading } = useQuery({
    queryKey: ["/api/crm/contacts", id],
    queryFn: () => apiRequest("GET", `/api/crm/contacts/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  const { data: tasks } = useQuery<any[]>({
    queryKey: [`/api/crm/tasks/contact/${id}`],
    queryFn: () => apiRequest("GET", `/api/crm/tasks/contact/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  const { data: activities } = useQuery<any[]>({
    queryKey: ["/api/crm/activity-feed/contact", id],
    queryFn: () => apiRequest("GET", `/api/crm/activity-feed/contact/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  const { data: dealsData } = useQuery<{ deals: any[] }>({
    queryKey: ["/api/crm/deals"],
    queryFn: () => apiRequest("GET", "/api/crm/deals").then(res => res.json()),
  });
  const allDeals = dealsData?.deals || [];
  const availableDeals = allDeals.filter(
    (deal) => !(contact as any)?.deals?.some((d: any) => d.id === deal.id)
  );
  const filteredDeals = availableDeals.filter((deal) =>
    deal.name?.toLowerCase().includes(dealSearch.toLowerCase())
  );

  const updateContactMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest("PATCH", `/api/crm/contacts/${id}`, { body: data }).then(res => res.json()),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/crm/contacts", id] });
      const prev = queryClient.getQueryData(["/api/crm/contacts", id]);
      queryClient.setQueryData(["/api/crm/contacts", id], (old: any) => ({ ...old, ...newData }));
      return { prev };
    },
    onError: (err, newData, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/crm/contacts", id], ctx.prev);
      toast({ title: "Error", description: "Failed to update seller.", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
    },
  });

  const handleContactUpdate = useCallback((field: string, value: any) => {
    updateContactMutation.mutate({ [field]: value });
  }, [updateContactMutation]);

  const createNoteMutation = useMutation({
    mutationFn: (data: { content: string; mentionedUserIds: number[] }) =>
      apiRequest("POST", "/api/crm/notes", {
        body: { objectType: "contact", objectId: parseInt(id!), content: data.content, mentionedUserIds: data.mentionedUserIds },
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes/contact", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activity-feed/contact", id] });
      setNewNote("");
      setMentionedUserIds([]);
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/crm/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      toast({ title: "Seller deleted" });
      navigate("/sellers");
    },
  });

  const linkDealMutation = useMutation({
    mutationFn: ({ dealId }: { dealId: number }) =>
      apiRequest("POST", `/api/crm/deals/${dealId}/contacts`, {
        body: { contactId: parseInt(id!), role: "seller" },
      }).then(res => res.json()),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", String(variables.dealId)] });
      setIsLinkDealOpen(false);
      setSelectedDealId("");
      setDealSearch("");
      toast({ title: "Deal linked" });
    },
  });

  const unlinkDealMutation = useMutation({
    mutationFn: ({ dealId }: { dealId: number }) =>
      apiRequest("DELETE", `/api/crm/deals/${dealId}/contacts/${id}`).then(res => res.json()),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", String(variables.dealId)] });
      toast({ title: "Deal unlinked" });
    },
  });

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', uploadFileType);

    try {
      const res = await fetch(`/api/crm/sellers/${id}/files`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Upload failed');
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      toast({ title: "File uploaded" });
    } catch {
      toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileDelete = async (filename: string) => {
    try {
      await apiRequest("DELETE", `/api/crm/sellers/${id}/files/${filename}`);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      toast({ title: "File deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete file", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-6 text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Seller not found</h2>
        <p className="text-gray-600 mt-2">This seller may have been deleted or you don't have access.</p>
        <Button asChild className="mt-4"><Link href="/sellers">Back to Sellers</Link></Button>
      </div>
    );
  }

  // Redirect if not a seller
  if ((contact as any).contactType === 'buyer') {
    navigate(`/buyers/${id}`, { replace: true });
    return null;
  }

  const sellerStage = (contact as any).sellerStage || 'lead';
  const sellerFiles = ((contact as any).sellerFiles || []) as any[];

  const getStageBadgeColor = (stage: string) => {
    const colors: Record<string, string> = {
      lead: 'bg-gray-100 text-gray-700', meeting: 'bg-blue-100 text-blue-700',
      proposal: 'bg-yellow-100 text-yellow-700', engaged: 'bg-green-100 text-green-700',
    };
    return colors[stage] || colors.lead;
  };

  const getFileTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      financials: 'bg-blue-100 text-blue-700', tax_returns: 'bg-purple-100 text-purple-700',
      pnl: 'bg-green-100 text-green-700', other: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      financials: 'Financials', tax_returns: 'Tax Returns', pnl: 'P&L', other: 'Other',
    };
    return <Badge className={`${colors[type] || colors.other} text-xs`}>{labels[type] || type}</Badge>;
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white -ml-4 -mr-4 -mt-4 pl-4 pr-4 pt-4 md:-ml-6 md:-mr-6 md:-mt-6 md:pl-6 md:pr-6 md:pt-6 pb-3 mb-3 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/sellers"><ArrowLeft className="h-4 w-4 mr-2" />Sellers</Link>
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <PhotoUpload
              currentPhotoUrl={(contact as any).avatarUrl}
              onPhotoChange={async (photoUrl) => handleContactUpdate('avatarUrl', photoUrl || '')}
              placeholder={
                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-base sm:text-lg font-semibold">
                  {((contact as any).firstName?.[0] || '').toUpperCase()}{((contact as any).lastName?.[0] || '').toUpperCase()}
                </div>
              }
              shape="circle"
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <InlineEdit value={(contact as any).firstName} onSave={(val) => handleContactUpdate('firstName', val)} emptyText="First" displayClassName="text-xl md:text-2xl font-semibold text-gray-900" />
                <InlineEdit value={(contact as any).lastName} onSave={(val) => handleContactUpdate('lastName', val)} emptyText="Last" displayClassName="text-xl md:text-2xl font-semibold text-gray-900" />
                <Badge className={`${getStageBadgeColor(sellerStage)} text-xs`}>{sellerStage.charAt(0).toUpperCase() + sellerStage.slice(1)}</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-gray-500 text-sm truncate">{(contact as any).title || (contact as any).email}</p>
                {(contact as any).email && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText((contact as any).email);
                      setCopiedEmail(true);
                      setTimeout(() => setCopiedEmail(false), 2000);
                    }}
                    className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
                  >
                    {copiedEmail ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteDialogOpen(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /><span className="hidden sm:inline ml-1.5">Delete</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Main Column */}
        <div className="space-y-6 min-w-0">
          {/* Contact Info */}
          <div className="bg-white px-3 pb-5 mb-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
              <div className="space-y-0.5 min-w-0">
                <Label className="text-xs text-gray-500 block">Email</Label>
                <InlineEditEmail value={(contact as any).email} onSave={(val) => handleContactUpdate('email', val)} emptyText="Add email" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <Label className="text-xs text-gray-500 block">Phone</Label>
                <InlineEdit value={(contact as any).phone} onSave={(val) => handleContactUpdate('phone', val || null)} type="phone" emptyText="Add phone" displayClassName="text-sm text-gray-700" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <Label className="text-xs text-gray-500 block">Title</Label>
                <InlineEdit value={(contact as any).title} onSave={(val) => handleContactUpdate('title', val || null)} emptyText="Add title" displayClassName="text-sm text-gray-700" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <Label className="text-xs text-gray-500 block">LinkedIn</Label>
                <InlineEdit value={(contact as any).linkedinUrl} onSave={(val) => handleContactUpdate('linkedinUrl', val || null)} emptyText="Add LinkedIn" displayClassName="text-sm text-blue-600" />
              </div>
            </div>
          </div>

          {/* Seller Profile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                Seller Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">Stage</Label>
                  <Select value={sellerStage} onValueChange={(val) => handleContactUpdate('sellerStage', val)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="engaged">Engaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Motivation</Label>
                  <Select value={(contact as any).sellerMotivation || ''} onValueChange={(val) => handleContactUpdate('sellerMotivation', val)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select motivation" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retirement">Retirement</SelectItem>
                      <SelectItem value="burnout">Burnout</SelectItem>
                      <SelectItem value="partner_dispute">Partner Dispute</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="relocation">Relocation</SelectItem>
                      <SelectItem value="new_venture">New Venture</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Timeline</Label>
                  <Select value={(contact as any).sellerTimeline || ''} onValueChange={(val) => handleContactUpdate('sellerTimeline', val)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select timeline" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="3_months">3 Months</SelectItem>
                      <SelectItem value="6_months">6 Months</SelectItem>
                      <SelectItem value="12_months">12 Months</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Engagement Status</Label>
                  <Select value={(contact as any).sellerEngagementStatus || ''} onValueChange={(val) => handleContactUpdate('sellerEngagementStatus', val)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="meeting_scheduled">Meeting Scheduled</SelectItem>
                      <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                      <SelectItem value="engaged">Engaged</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Asking Price</Label>
                  <InlineEdit value={(contact as any).sellerAskingPrice || ''} onSave={(val) => handleContactUpdate('sellerAskingPrice', val)} placeholder="e.g. $2.5M" className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Listing Status</Label>
                  <Select value={(contact as any).sellerListingStatus || ''} onValueChange={(val) => handleContactUpdate('sellerListingStatus', val)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_listed">Not Listed</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="under_loi">Under LOI</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Source</Label>
                  <Select value={(contact as any).sellerSource || ''} onValueChange={(val) => handleContactUpdate('sellerSource', val)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="direct_marketing">Direct Marketing</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Referred By</Label>
                  <InlineEdit value={(contact as any).sellerReferredBy || ''} onSave={(val) => handleContactUpdate('sellerReferredBy', val)} placeholder="Who referred them?" className="text-sm mt-1" />
                </div>
              </div>
              {/* Seller Notes */}
              <div className="mt-4 pt-3 border-t">
                <Label className="text-xs text-gray-500 mb-1 block">Seller Notes</Label>
                <Textarea
                  value={(contact as any).sellerNotes || ''}
                  onChange={(e) => handleContactUpdate('sellerNotes', e.target.value)}
                  placeholder="Notes about this seller..."
                  className="text-sm min-h-[60px]"
                />
              </div>

              {/* Engaged CTA */}
              {sellerStage === 'engaged' && (
                <div className="mt-4 pt-3 border-t">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">Seller is Engaged</p>
                      <p className="text-xs text-green-600 mt-0.5">Create a deal to track this engagement</p>
                    </div>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => navigate('/deals')}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Create Deal
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Snapshot */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" />
                Business Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">Revenue Range</Label>
                  <Select value={(contact as any).sellerRevenueRange || ''} onValueChange={(val) => handleContactUpdate('sellerRevenueRange', val)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select range" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under_500k">Under $500K</SelectItem>
                      <SelectItem value="500k_1m">$500K-$1M</SelectItem>
                      <SelectItem value="1m_5m">$1M-$5M</SelectItem>
                      <SelectItem value="5m_10m">$5M-$10M</SelectItem>
                      <SelectItem value="10m_25m">$10M-$25M</SelectItem>
                      <SelectItem value="25m_plus">$25M+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Profit/SDE Range</Label>
                  <Select value={(contact as any).sellerProfitRange || ''} onValueChange={(val) => handleContactUpdate('sellerProfitRange', val)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select range" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under_100k">Under $100K</SelectItem>
                      <SelectItem value="100k_250k">$100K-$250K</SelectItem>
                      <SelectItem value="250k_500k">$250K-$500K</SelectItem>
                      <SelectItem value="500k_1m">$500K-$1M</SelectItem>
                      <SelectItem value="1m_5m">$1M-$5M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Industry</Label>
                  <InlineEdit value={(contact as any).sellerIndustry || ''} onSave={(val) => handleContactUpdate('sellerIndustry', val)} placeholder="e.g. Manufacturing" className="text-sm mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-gray-500">Business Description</Label>
                  <Textarea
                    value={(contact as any).sellerBusinessDescription || ''}
                    onChange={(e) => handleContactUpdate('sellerBusinessDescription', e.target.value)}
                    placeholder="Brief description of the business..."
                    className="text-sm min-h-[60px] mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Documents */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Financial Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Select value={uploadFileType} onValueChange={setUploadFileType}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="financials">Financials</SelectItem>
                    <SelectItem value="tax_returns">Tax Returns</SelectItem>
                    <SelectItem value="pnl">P&L</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1" />Upload File
                </Button>
              </div>

              {sellerFiles.length > 0 ? (
                <div className="space-y-2">
                  {sellerFiles.map((file: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-900 truncate">{file.name}</span>
                        {getFileTypeBadge(file.type)}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-500">{file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : ''}</span>
                        <a href={`/api/crm/sellers/${id}/files/${file.path}`} className="text-gray-400 hover:text-blue-600 p-1">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button onClick={() => handleFileDelete(file.path)} className="text-gray-400 hover:text-red-600 p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No files uploaded yet</p>
                  <p className="text-xs text-gray-400 mt-1">Upload financials, tax returns, P&L statements</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity & Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity & Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <MentionInput
                  value={newNote}
                  onChange={(value, mentions) => {
                    setNewNote(value);
                    setMentionedUserIds(mentions.map(m => m.userId));
                  }}
                  placeholder="Add a note..."
                  className="min-h-[60px]"
                />
                {newNote.trim() && (
                  <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={() => createNoteMutation.mutate({ content: newNote, mentionedUserIds })} disabled={createNoteMutation.isPending}>
                      {createNoteMutation.isPending ? "Saving..." : "Add Note"}
                    </Button>
                  </div>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-3">
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                </TabsList>

                <TabsContent value="activity">
                  {activities && activities.length > 0 ? (
                    <div className="space-y-4">
                      {activities.map((activity: any, index: number) => {
                        const { icon: ActivityIcon, bg, color } = getActivityIcon(activity.activityType);
                        return (
                          <div key={activity.id || index} className="flex gap-3">
                            <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                              <ActivityIcon className={`h-4 w-4 ${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900">
                                <span className="font-medium">{activity.performedByUser?.firstName || 'System'}</span>{' '}
                                {formatActivityTitle(activity)}
                              </p>
                              {activity.description && <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>}
                              <p className="text-xs text-gray-500 mt-0.5">{new Date(activity.timestamp).toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-4 text-center">No activity yet</p>
                  )}
                </TabsContent>

                <TabsContent value="tasks">
                  <div className="mb-3">
                    <Button variant="outline" size="sm" onClick={() => { setEditingTask(null); setIsTaskDialogOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Add Task
                    </Button>
                  </div>
                  <TaskList tasks={tasks || []} onEditTask={(task: any) => { setEditingTask(task); setIsTaskDialogOpen(true); }} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block space-y-4">
          {/* Associated Deals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Associated Deals</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsLinkDealOpen(true)} className="h-7 w-7 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {(contact as any).deals && (contact as any).deals.length > 0 ? (
                <div className="space-y-2">
                  {(contact as any).deals.map((deal: any) => (
                    <div key={deal.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 text-sm group">
                      <Link href={`/deals/${deal.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        <span className="text-gray-900 truncate">{deal.name}</span>
                        {deal.amount && <span className="text-gray-500 text-xs ml-auto flex-shrink-0">${Number(deal.amount).toLocaleString()}</span>}
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 flex-shrink-0"
                        onClick={() => unlinkDealMutation.mutate({ dealId: deal.id })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No deals yet</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Quick Info</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {sellerStage && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Stage</span>
                    <Badge className={`${getStageBadgeColor(sellerStage)} text-xs`}>{sellerStage.charAt(0).toUpperCase() + sellerStage.slice(1)}</Badge>
                  </div>
                )}
                {(contact as any).sellerMotivation && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Motivation</span>
                    <span className="text-gray-900">{MOTIVATION_LABELS[(contact as any).sellerMotivation] || (contact as any).sellerMotivation}</span>
                  </div>
                )}
                {(contact as any).sellerTimeline && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Timeline</span>
                    <span className="text-gray-900">{TIMELINE_LABELS[(contact as any).sellerTimeline] || (contact as any).sellerTimeline}</span>
                  </div>
                )}
                {(contact as any).sellerAskingPrice && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Asking Price</span>
                    <span className="text-gray-900 font-medium">{(contact as any).sellerAskingPrice}</span>
                  </div>
                )}
                {(contact as any).sellerRevenueRange && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Revenue</span>
                    <span className="text-gray-900">{REVENUE_RANGES[(contact as any).sellerRevenueRange] || (contact as any).sellerRevenueRange}</span>
                  </div>
                )}
                {(contact as any).lastActivityDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Activity</span>
                    <span className="text-gray-900">{new Date((contact as any).lastActivityDate).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">{new Date((contact as any).createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {((contact as any).tags || []).map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
                {(!(contact as any).tags || (contact as any).tags.length === 0) && (
                  <p className="text-sm text-gray-500">No tags</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Task Dialog */}
      {isTaskDialogOpen && (
        <TaskDialog
          open={isTaskDialogOpen}
          onOpenChange={setIsTaskDialogOpen}
          task={editingTask}
          objectType="contact"
          objectId={parseInt(id!)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/crm/tasks/contact/${id}`] });
            queryClient.invalidateQueries({ queryKey: ["/api/crm/activity-feed/contact", id] });
            setIsTaskDialogOpen(false);
            setEditingTask(null);
          }}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Seller</DialogTitle>
            <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteContactMutation.mutate()} disabled={deleteContactMutation.isPending}>
              {deleteContactMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Deal Dialog */}
      <Dialog open={isLinkDealOpen} onOpenChange={setIsLinkDealOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Deal</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search deals..." value={dealSearch} onChange={(e) => setDealSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {filteredDeals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => setSelectedDealId(deal.id.toString())}
                  className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-50 ${selectedDealId === deal.id.toString() ? 'bg-blue-50 border border-blue-200' : ''}`}
                >
                  {deal.name}
                </button>
              ))}
              {filteredDeals.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No deals found</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDealOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedDealId && linkDealMutation.mutate({ dealId: parseInt(selectedDealId) })} disabled={!selectedDealId || linkDealMutation.isPending}>
              Link Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
