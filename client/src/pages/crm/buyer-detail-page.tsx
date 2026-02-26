import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/crm/photo-upload";
import { InlineEdit, InlineEditEmail } from "@/components/ui/inline-edit";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";
import { MentionInput } from "@/components/ui/mention-input";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Tag,
  FileText,
  Activity,
  CheckSquare,
  Plus,
  X,
  Search,
  Check,
  Trash2,
  UserPlus,
  Video,
  FileUp,
  Copy,
  Shield,
  ShieldCheck,
  DollarSign,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";

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
    case 'call': return 'logged a call';
    case 'meeting': return 'scheduled a meeting';
    default: return activity.title || activity.activityType.replace(/_/g, ' ');
  }
}

export default function BuyerDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("activity");
  const [newNote, setNewNote] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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

  const { data: companiesData } = useQuery<{ companies: any[] }>({
    queryKey: ["/api/crm/companies"],
    queryFn: () => apiRequest("GET", "/api/crm/companies").then(res => res.json()),
  });

  const updateContactMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest("PATCH", `/api/crm/contacts/${id}`, { body: data }).then(res => res.json()),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/crm/contacts", id] });
      const previousContact = queryClient.getQueryData(["/api/crm/contacts", id]);
      queryClient.setQueryData(["/api/crm/contacts", id], (old: any) => ({ ...old, ...newData }));
      return { previousContact };
    },
    onError: (err, newData, context) => {
      if (context?.previousContact) queryClient.setQueryData(["/api/crm/contacts", id], context.previousContact);
      toast({ title: "Error", description: "Failed to update buyer.", variant: "destructive" });
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
      toast({ title: "Buyer deleted" });
      navigate("/buyers");
    },
  });

  const toggleWhitelistMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest("POST", "/api/nda-whitelist/toggle-contact", { body: { email } }).then(res => res.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      toast({ title: data.whitelisted ? "Contact whitelisted" : "Whitelist removed", description: data.whitelisted ? "This contact will bypass NDA requirements." : "NDA requirements restored for this contact." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle whitelist.", variant: "destructive" });
    },
  });

  const linkDealMutation = useMutation({
    mutationFn: ({ dealId }: { dealId: number }) =>
      apiRequest("POST", `/api/crm/deals/${dealId}/buyers`, {
        body: { contactId: parseInt(id!) },
      }).then(res => res.json()),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", String(variables.dealId)] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", String(variables.dealId), "buyers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
      setIsLinkDealOpen(false);
      setSelectedDealId("");
      setDealSearch("");
      toast({ title: "Deal linked" });
    },
  });

  const unlinkDealMutation = useMutation({
    mutationFn: ({ dealId, dealBuyerId }: { dealId: number; dealBuyerId?: number }) => {
      if (dealBuyerId) {
        return apiRequest("DELETE", `/api/crm/deals/${dealId}/buyers/${dealBuyerId}`).then(res => res.json());
      }
      return apiRequest("DELETE", `/api/crm/deals/${dealId}/contacts/${id}`).then(res => res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", String(variables.dealId)] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", String(variables.dealId), "buyers"] });
      toast({ title: "Deal unlinked" });
    },
  });

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
        <h2 className="text-xl font-semibold text-gray-900">Buyer not found</h2>
        <p className="text-gray-600 mt-2">This buyer may have been deleted or you don't have access.</p>
        <Button asChild className="mt-4"><Link href="/buyers">Back to Buyers</Link></Button>
      </div>
    );
  }

  // Redirect if not a buyer
  if ((contact as any).contactType === 'seller') {
    navigate(`/sellers/${id}`, { replace: true });
    return null;
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white -ml-4 -mr-4 -mt-4 pl-4 pr-4 pt-4 md:-ml-6 md:-mr-6 md:-mt-6 md:pl-6 md:pr-6 md:pt-6 pb-3 mb-3 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/buyers"><ArrowLeft className="h-4 w-4 mr-2" />Buyers</Link>
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <PhotoUpload
              currentPhotoUrl={(contact as any).avatarUrl}
              onPhotoChange={async (photoUrl) => handleContactUpdate('avatarUrl', photoUrl || '')}
              placeholder={
                <div className="w-full h-full rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-base sm:text-lg font-semibold">
                  {((contact as any).firstName?.[0] || '').toUpperCase()}{((contact as any).lastName?.[0] || '').toUpperCase()}
                </div>
              }
              shape="circle"
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <InlineEdit
                  value={(contact as any).firstName}
                  onSave={(val) => handleContactUpdate('firstName', val)}
                  emptyText="First"
                  displayClassName="text-xl md:text-2xl font-semibold text-gray-900"
                />
                <InlineEdit
                  value={(contact as any).lastName}
                  onSave={(val) => handleContactUpdate('lastName', val)}
                  emptyText="Last"
                  displayClassName="text-xl md:text-2xl font-semibold text-gray-900"
                />
                <Badge className="bg-green-100 text-green-700 text-xs">Buyer</Badge>
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
                    title="Copy email"
                  >
                    {copiedEmail ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(contact as any).email && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleWhitelistMutation.mutate((contact as any).email)}
                disabled={toggleWhitelistMutation.isPending}
                className={(contact as any).isWhitelisted ? "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200" : ""}
              >
                {(contact as any).isWhitelisted ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                <span className="hidden sm:inline ml-1.5">{(contact as any).isWhitelisted ? "Whitelisted" : "Whitelist"}</span>
              </Button>
            )}
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
                <Label className="text-xs text-gray-500 block">Company</Label>
                <p className="text-sm text-gray-900">
                  {(contact as any).company ? (
                    <Link href={`/companies/${(contact as any).company.id}`} className="text-blue-600 hover:underline">{(contact as any).company.name}</Link>
                  ) : (
                    <span className="text-gray-500">No company</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Buyer Profile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4" />
                Buyer Profile
                {(contact as any).isActiveBuyer && (
                  <Badge className="bg-green-100 text-green-700 text-xs">Active Buyer</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">Buyer Type</Label>
                  <Select value={(contact as any).buyerType || ''} onValueChange={(value) => handleContactUpdate('buyerType', value)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strategic">Strategic</SelectItem>
                      <SelectItem value="financial">Financial</SelectItem>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="search_fund">Search Fund</SelectItem>
                      <SelectItem value="family_office">Family Office</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Financial Capability</Label>
                  <Select value={(contact as any).financialCapability || 'unverified'} onValueChange={(value) => handleContactUpdate('financialCapability', value)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unverified">Unverified</SelectItem>
                      <SelectItem value="self_reported">Self-Reported</SelectItem>
                      <SelectItem value="proof_of_funds">Proof of Funds</SelectItem>
                      <SelectItem value="pre_approved">Pre-Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Est. Budget</Label>
                  <InlineEdit value={(contact as any).estimatedBudget || ''} onSave={(val) => handleContactUpdate('estimatedBudget', val)} placeholder="e.g. $5M-$10M" className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Prior Acquisitions</Label>
                  <p className="text-sm text-gray-900 mt-1">{(contact as any).priorAcquisitions ?? '-'}</p>
                </div>
                {(contact as any).qualificationScore != null && (
                  <div>
                    <Label className="text-xs text-gray-500">Qualification Score</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (contact as any).qualificationScore >= 70 ? 'bg-green-500' :
                            (contact as any).qualificationScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(contact as any).qualificationScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{(contact as any).qualificationScore}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* NDA History */}
              {(contact as any).ndaHistory && (contact as any).ndaHistory.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-gray-500">NDA Signatures ({(contact as any).ndaHistory.length})</Label>
                    <Link href="/ndas" className="text-xs text-blue-600 hover:text-blue-700">View all in NDA Hub</Link>
                  </div>
                  <div className="space-y-2">
                    {(contact as any).ndaHistory.map((nda: any) => {
                      const status = nda.approved ? 'Approved' : nda.rejected ? 'Rejected' : 'Pending';
                      const statusColor = nda.approved ? 'bg-green-100 text-green-700' : nda.rejected ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
                      return (
                        <Link key={nda.id} href={`/ndas/${nda.id}`}>
                          <div className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2 hover:bg-gray-100 transition-colors cursor-pointer">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <span className="text-gray-800 truncate block">{nda.documentTitle}</span>
                                {nda.dealName && (
                                  <span className="text-xs text-gray-500 truncate block">{nda.dealName}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              <span className="text-xs text-gray-500">{nda.signedAt ? new Date(nda.signedAt).toLocaleDateString() : ''}</span>
                              <Badge className={`text-xs ${statusColor}`}>{status}</Badge>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity & Notes Tabs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity & Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Add Note */}
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
                    <Button
                      size="sm"
                      onClick={() => createNoteMutation.mutate({ content: newNote, mentionedUserIds })}
                      disabled={createNoteMutation.isPending}
                    >
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
                              {activity.description && (
                                <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
                              )}
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
                  <TaskList
                    tasks={tasks || []}
                    onEditTask={(task: any) => { setEditingTask(task); setIsTaskDialogOpen(true); }}
                  />
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
                        onClick={() => unlinkDealMutation.mutate({ dealId: deal.id, dealBuyerId: deal.dealBuyerId })}
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
                {(contact as any).source && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Source</span>
                    <span className="text-gray-900">{(contact as any).source.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {(contact as any).linkedinUrl && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">LinkedIn</span>
                    <a href={(contact as any).linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate ml-2">
                      Profile
                    </a>
                  </div>
                )}
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
            <DialogTitle>Delete Buyer</DialogTitle>
            <DialogDescription>Are you sure you want to delete this buyer? This action cannot be undone.</DialogDescription>
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
