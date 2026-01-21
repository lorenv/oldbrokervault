import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";
import { EmailList } from "@/components/crm/email-list";
import { MentionInput, highlightMentions } from "@/components/ui/mention-input";
import { InlineEdit, InlineEditEmail } from "@/components/ui/inline-edit";
import { DetailPageCustomizer } from "@/components/crm/detail-page-customizer";
import { useDetailPageLayout } from "@/hooks/use-detail-page-layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  Phone,
  Users,
  Briefcase,
  CheckSquare,
  Plus,
  Mail,
  ExternalLink,
  Settings2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  Search,
  Check,
  Clock,
  MessageSquare,
  Trash2,
  FileText,
  ArrowRight,
  FileUp,
  Video,
  UserPlus,
  Download,
} from "lucide-react";
import { PhotoUpload } from "@/components/crm/photo-upload";

// Helper function to get activity icon based on type
function getActivityIcon(activityType: string) {
  switch (activityType) {
    case 'note':
      return { icon: MessageSquare, bg: 'bg-blue-100', color: 'text-blue-600' };
    case 'file_uploaded':
      return { icon: FileUp, bg: 'bg-purple-100', color: 'text-purple-600' };
    case 'task_created':
      return { icon: CheckSquare, bg: 'bg-orange-100', color: 'text-orange-600' };
    case 'task_completed':
      return { icon: Check, bg: 'bg-green-100', color: 'text-green-600' };
    case 'company_created':
      return { icon: Building2, bg: 'bg-blue-100', color: 'text-blue-600' };
    case 'contact_created':
      return { icon: UserPlus, bg: 'bg-indigo-100', color: 'text-indigo-600' };
    case 'email':
      return { icon: Mail, bg: 'bg-cyan-100', color: 'text-cyan-600' };
    case 'call':
      return { icon: Phone, bg: 'bg-yellow-100', color: 'text-yellow-600' };
    case 'meeting':
      return { icon: Video, bg: 'bg-pink-100', color: 'text-pink-600' };
    default:
      return { icon: Clock, bg: 'bg-gray-100', color: 'text-gray-500' };
  }
}

// Helper function to format activity title
function formatActivityTitle(activity: Activity): string {
  switch (activity.activityType) {
    case 'note':
      return 'added a note';
    case 'file_uploaded':
      return `uploaded ${activity.metadata?.fileName || 'a file'}`;
    case 'task_created':
      return `created task: ${activity.metadata?.taskTitle || 'Untitled'}`;
    case 'task_completed':
      return `completed task: ${activity.metadata?.taskTitle || 'Untitled'}`;
    case 'company_created':
      return 'created this company';
    case 'contact_created':
      return 'added a contact';
    case 'email':
      return activity.metadata?.direction === 'sent' ? 'sent an email' : 'received an email';
    case 'call':
      return 'logged a call';
    case 'meeting':
      return 'scheduled a meeting';
    default:
      return activity.title || activity.activityType.replace(/_/g, ' ');
  }
}

interface Note {
  id: number;
  content: string;
  isPinned: boolean;
  createdAt: string;
  author: { id: number; email: string; firstName: string; lastName: string };
}

interface Activity {
  id: number;
  activityType: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
  timestamp: string;
  performedByUser: { id: number; email: string; firstName: string; lastName: string };
  embeddedContent?: any;
}

// Helper to ensure URL has protocol
const ensureProtocol = (url: string): string => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

export default function CompanyDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("activity");
  const [newNote, setNewNote] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const [expandedEmails, setExpandedEmails] = useState<Set<number>>(new Set());

  // Association dialog state
  const [isLinkContactOpen, setIsLinkContactOpen] = useState(false);
  const [isLinkDealOpen, setIsLinkDealOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [dealSearch, setDealSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedDealId, setSelectedDealId] = useState<string>("");

  // Sidebar collapse state - persisted to localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('company-detail-sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('company-detail-sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const { isSectionVisible, getSectionOrder, getVisibleCustomFields } = useDetailPageLayout("company");

  const { data: company, isLoading } = useQuery({
    queryKey: ["/api/crm/companies", id],
    queryFn: () => apiRequest("GET", `/api/crm/companies/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch tasks
  const { data: tasks } = useQuery<any[]>({
    queryKey: [`/api/crm/tasks/company/${id}`],
    queryFn: () => apiRequest("GET", `/api/crm/tasks/company/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch notes
  const { data: notes } = useQuery<Note[]>({
    queryKey: ["/api/crm/notes/company", id],
    queryFn: () => apiRequest("GET", `/api/crm/notes/company/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch unified activity feed
  const { data: activities } = useQuery<Activity[]>({
    queryKey: ["/api/crm/activity-feed/company", id],
    queryFn: () => apiRequest("GET", `/api/crm/activity-feed/company/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch all contacts for linking
  const { data: contactsData } = useQuery<{ contacts: any[] }>({
    queryKey: ["/api/crm/contacts"],
    queryFn: () => apiRequest("GET", "/api/crm/contacts").then(res => res.json()),
  });
  const allContacts = contactsData?.contacts || [];

  // Fetch all deals for linking
  const { data: dealsData } = useQuery<{ deals: any[] }>({
    queryKey: ["/api/crm/deals"],
    queryFn: () => apiRequest("GET", "/api/crm/deals").then(res => res.json()),
  });
  const allDeals = dealsData?.deals || [];

  // Filter available contacts (exclude already associated contacts)
  const availableContacts = allContacts.filter(
    (contact) => !(company as any)?.contacts?.some((c: any) => c.id === contact.id)
  );

  // Filter available deals (exclude already associated deals)
  const availableDeals = allDeals.filter(
    (deal) => !(company as any)?.deals?.some((d: any) => d.id === deal.id)
  );

  // Filtered lists based on search
  const filteredContacts = availableContacts.filter((contact) =>
    `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(contactSearch.toLowerCase()) ||
    contact.email?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filteredDeals = availableDeals.filter((deal) =>
    deal.name?.toLowerCase().includes(dealSearch.toLowerCase())
  );

  // Mutation to link contact to company
  const linkContactMutation = useMutation({
    mutationFn: (contactId: number) =>
      apiRequest("PATCH", `/api/crm/contacts/${contactId}`, { body: { companyId: parseInt(id!) } }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      setIsLinkContactOpen(false);
      setSelectedContactId("");
      setContactSearch("");
      toast({ title: "Contact linked", description: "Contact has been associated with this company." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to link contact.", variant: "destructive" });
    },
  });

  // Mutation to link deal to company
  const linkDealMutation = useMutation({
    mutationFn: (dealId: number) =>
      apiRequest("PATCH", `/api/crm/deals/${dealId}`, { body: { companyId: parseInt(id!) } }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      setIsLinkDealOpen(false);
      setSelectedDealId("");
      setDealSearch("");
      toast({ title: "Deal linked", description: "Deal has been associated with this company." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to link deal.", variant: "destructive" });
    },
  });

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest("PATCH", `/api/crm/companies/${id}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"], refetchType: 'all' });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update company.", variant: "destructive" });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: Record<string, any> }) =>
      apiRequest("PATCH", `/api/crm/contacts/${contactId}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: { content: string; mentionedUserIds: number[] }) =>
      apiRequest("POST", "/api/crm/notes", {
        body: {
          objectType: "company",
          objectId: parseInt(id!),
          content: data.content,
          mentionedUserIds: data.mentionedUserIds,
        },
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes/company", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activity-feed/company", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setNewNote("");
      setMentionedUserIds([]);
      toast({ title: "Note added" });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) =>
      apiRequest("DELETE", `/api/crm/notes/${noteId}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes/company", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activity-feed/company", id] });
      toast({ title: "Note deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete note", variant: "destructive" });
    },
  });

  // Helper for inline company updates
  const handleCompanyUpdate = useCallback(async (field: string, value: string) => {
    await updateCompanyMutation.mutateAsync({ [field]: value || null });
  }, [updateCompanyMutation]);

  // Helper for inline contact updates
  const handleContactUpdate = useCallback(async (contactId: number, field: string, value: string) => {
    await updateContactMutation.mutateAsync({ contactId, data: { [field]: value || null } });
  }, [updateContactMutation]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6 text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Company not found</h2>
        <p className="text-gray-600 mt-2">This company may have been deleted or you don't have access to it.</p>
        <Button asChild className="mt-4"><Link href="/companies">Back to Companies</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/companies"><ArrowLeft className="h-4 w-4 mr-2" />Companies</Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <PhotoUpload
            currentPhotoUrl={(company as any).logoUrl}
            onPhotoChange={async (photoUrl) => {
              await handleCompanyUpdate('logoUrl', photoUrl || '');
            }}
            placeholder={
              <div className="w-full h-full rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            }
            shape="rounded"
            size="md"
          />
          <div className="min-w-0">
            <InlineEdit
              value={(company as any).name}
              onSave={(val) => handleCompanyUpdate('name', val)}
              emptyText="Company Name"
              displayClassName="text-xl md:text-2xl font-semibold text-gray-900"
            />
            {(company as any).industry && <p className="text-gray-600 text-sm">{(company as any).industry}</p>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCustomizerOpen(true)}
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" />
          Customize
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-6">
        <div className="space-y-6">
          {/* Company Information - Compact */}
          {isSectionVisible("company-info") && (
          <div className="bg-white px-3 pb-5 mb-2 relative">
            {/* Partial separator line at bottom */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gray-200" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
              {/* Website */}
              <div className="space-y-0.5">
                <Label className="text-xs text-gray-500 block">Website</Label>
                <div className="flex items-center gap-1">
                  <InlineEdit
                    value={(company as any).website}
                    onSave={(val) => handleCompanyUpdate('website', val)}
                    type="text"
                    emptyText="Add website"
                    placeholder="example.com"
                    displayClassName="text-blue-600"
                  />
                  {(company as any).website && (
                    <a
                      href={ensureProtocol((company as any).website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600"
                      title="Open website"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              {/* Phone */}
              <div className="space-y-0.5">
                <Label className="text-xs text-gray-500 block">Phone</Label>
                <InlineEdit
                  value={(company as any).phone}
                  onSave={(val) => handleCompanyUpdate('phone', val)}
                  type="phone"
                  emptyText="Add phone"
                />
              </div>
              {/* Industry */}
              <div className="space-y-0.5">
                <Label className="text-xs text-gray-500 block">Industry</Label>
                <InlineEdit
                  value={(company as any).industry}
                  onSave={(val) => handleCompanyUpdate('industry', val)}
                  emptyText="Add industry"
                  placeholder="e.g., Technology"
                />
              </div>
              {/* Location */}
              <div className="space-y-0.5">
                <Label className="text-xs text-gray-500 block">Location</Label>
                <p className="text-sm text-gray-900">
                  {[(company as any).city, (company as any).state, (company as any).country].filter(Boolean).join(", ") || <span className="text-gray-400">—</span>}
                </p>
              </div>
            </div>
            {/* Description if present */}
            {(company as any).description && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">{(company as any).description}</p>
              </div>
            )}
          </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-2">
            <TabsList variant="underline" className="w-full justify-start border-b">
              <TabsTrigger variant="underline" value="activity">
                <Clock className="h-4 w-4 mr-1" />
                Activity
              </TabsTrigger>
              <TabsTrigger variant="underline" value="notes">
                <MessageSquare className="h-4 w-4 mr-1" />
                Notes
              </TabsTrigger>
              <TabsTrigger variant="underline" value="tasks">
                <CheckSquare className="h-4 w-4 mr-1" />
                Tasks
              </TabsTrigger>
              <TabsTrigger variant="underline" value="emails">
                <Mail className="h-4 w-4 mr-1" />
                Emails
              </TabsTrigger>
            </TabsList>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {activities && activities.length > 0 ? (
                    <div className="space-y-4">
                      {activities.map((activity: Activity) => {
                        const { icon: ActivityIcon, bg, color } = getActivityIcon(activity.activityType);
                        const embedded = activity.embeddedContent;

                        return (
                          <div
                            key={activity.id}
                            className="flex gap-3 pb-4 border-b last:border-0"
                          >
                            <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center flex-shrink-0 mt-1`}>
                              <ActivityIcon className={`h-4 w-4 ${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-900">
                                  <span className="font-medium">
                                    {activity.performedByUser?.firstName || activity.performedByUser?.email || 'System'}
                                  </span>{" "}
                                  {formatActivityTitle(activity)}
                                </p>
                                <span className="text-xs text-gray-400">
                                  {new Date(activity.timestamp).toLocaleString()}
                                </span>
                              </div>

                              {/* Embedded Note Content */}
                              {embedded?.type === 'note' && (
                                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {embedded.content}
                                  </p>
                                </div>
                              )}

                              {/* Embedded File Content */}
                              {embedded?.type === 'file' && (
                                <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-100 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center">
                                      <FileText className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-700">
                                        {embedded.fileName}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {(embedded.fileSize / 1024).toFixed(1)} KB
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      window.open(embedded.downloadUrl, '_blank');
                                    }}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              )}

                              {/* Embedded Task Content */}
                              {(embedded?.type === 'task' || embedded?.type === 'task_completed') && (
                                <div className={`mt-2 p-3 rounded-lg border ${
                                  embedded.type === 'task_completed'
                                    ? 'bg-green-50 border-green-100'
                                    : 'bg-orange-50 border-orange-100'
                                }`}>
                                  <p className="text-sm text-gray-700 flex items-center gap-2">
                                    <CheckSquare className={`h-4 w-4 ${
                                      embedded.type === 'task_completed' ? 'text-green-600' : 'text-orange-600'
                                    }`} />
                                    {embedded.title}
                                    {embedded.type === 'task_completed' && (
                                      <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                                        Completed
                                      </Badge>
                                    )}
                                  </p>
                                </div>
                              )}

                              {/* Embedded Email Content */}
                              {embedded?.type === 'email' && (
                                <div className="mt-1.5 border border-gray-200 rounded-md">
                                  <button
                                    onClick={() => {
                                      setExpandedEmails(prev => {
                                        const next = new Set(prev);
                                        if (next.has(activity.id)) {
                                          next.delete(activity.id);
                                        } else {
                                          next.add(activity.id);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-full text-left px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 truncate">
                                          <span className="font-medium">{embedded.subject || '(No subject)'}</span>
                                          <span className="text-gray-400 mx-1.5">·</span>
                                          <span className="text-gray-500 text-xs">{embedded.fromName || embedded.from} → {embedded.to}</span>
                                        </p>
                                        {!expandedEmails.has(activity.id) && embedded.snippet && (
                                          <p className="text-xs text-gray-500 truncate mt-0.5">
                                            {embedded.snippet}
                                          </p>
                                        )}
                                      </div>
                                      {expandedEmails.has(activity.id) ? (
                                        <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                      )}
                                    </div>
                                  </button>
                                  {expandedEmails.has(activity.id) && (
                                    <div className="px-3 pb-2 border-t border-gray-100">
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap pt-2">
                                        {embedded.body || embedded.snippet || '(No content)'}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Fallback description */}
                              {!embedded && activity.description && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {activity.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-700 font-medium">No activity yet</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Activity will appear here as you work with this company
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {/* Add Note Form */}
                  <div className="mb-6">
                    <MentionInput
                      value={newNote}
                      onChange={(value, mentions) => {
                        setNewNote(value);
                        setMentionedUserIds(mentions.map(m => m.userId));
                      }}
                      placeholder="Add a note... Use @ to mention teammates"
                      rows={3}
                    />
                    <Button
                      className="mt-2"
                      size="sm"
                      onClick={() => createNoteMutation.mutate({ content: newNote, mentionedUserIds })}
                      disabled={!newNote.trim() || createNoteMutation.isPending}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </div>

                  {/* Notes List */}
                  {notes && notes.length > 0 ? (
                    <div className="space-y-4">
                      {notes.map((note) => (
                        <div
                          key={note.id}
                          className="p-4 bg-gray-50 rounded-lg group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm whitespace-pre-wrap flex-1 text-gray-700">
                              {highlightMentions(note.content)}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                              disabled={deleteNoteMutation.isPending}
                              title="Delete note"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {note.author?.firstName || note.author?.email}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(note.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <MessageSquare className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No notes yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">Tasks</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsTaskDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </CardHeader>
                <CardContent>
                  <TaskList
                    tasks={tasks || []}
                    objectType="company"
                    objectId={parseInt(id!)}
                    onEditTask={(task) => setEditingTask(task)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Emails Tab */}
            <TabsContent value="emails" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Emails
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EmailList companyId={parseInt(id!)} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className={`hidden lg:flex ${isSidebarCollapsed ? 'w-6' : 'w-80'} transition-all duration-200`}>
          {/* Edge toggle button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="flex-shrink-0 w-6 flex items-start justify-center pt-2 group"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <div className="w-1 h-8 rounded-full bg-gray-200 group-hover:bg-gray-400 transition-colors" />
          </button>

          {!isSidebarCollapsed && (
          <div className="flex-1 space-y-6">
            {/* Associations */}
          <Card>
            <CardHeader><CardTitle className="text-base">Associations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contacts</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsLinkContactOpen(true)}
                    className="h-6 px-2 text-gray-500 hover:text-gray-700"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                {(company as any).contacts?.length > 0 ? (
                  <div className="space-y-2">
                    {(company as any).contacts.map((contact: any) => (
                      <Link
                        key={contact.id}
                        href={`/contacts/${contact.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                      >
                        {contact.avatarUrl ? (
                          <img
                            src={contact.avatarUrl}
                            alt={`${contact.firstName} ${contact.lastName}`}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                            {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {contact.firstName} {contact.lastName}
                          </p>
                          {contact.title && (
                            <p className="text-sm text-gray-500 truncate">{contact.title}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-2">No contacts associated</p>
                )}
              </div>

              {/* Deals */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deals</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsLinkDealOpen(true)}
                    className="h-6 px-2 text-gray-500 hover:text-gray-700"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                {(company as any).deals?.length > 0 ? (
                  <div className="space-y-2">
                    {(company as any).deals.map((deal: any) => (
                      <Link
                        key={deal.id}
                        href={`/deals/${deal.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{deal.name}</p>
                          {deal.amount && <p className="text-sm text-green-600">${parseFloat(deal.amount).toLocaleString()}</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-2">No deals yet</p>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
          )}
        </div>
      </div>

      {/* Task Dialogs */}
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        objectType="company"
        objectId={parseInt(id!)}
      />

      <TaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        objectType="company"
        objectId={parseInt(id!)}
      />

      <DetailPageCustomizer
        objectType="company"
        open={isCustomizerOpen}
        onOpenChange={setIsCustomizerOpen}
      />

      {/* Link Contact Dialog */}
      <Dialog open={isLinkContactOpen} onOpenChange={setIsLinkContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Contact</DialogTitle>
            <DialogDescription>
              Associate a contact with this company.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Contact List */}
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContactId(contact.id.toString())}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 text-left transition-colors ${
                      selectedContactId === contact.id.toString() ? "bg-blue-50 border-blue-200" : ""
                    }`}
                  >
                    {contact.avatarUrl ? (
                      <img
                        src={contact.avatarUrl}
                        alt={`${contact.firstName} ${contact.lastName}`}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                        {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {contact.firstName} {contact.lastName}
                      </p>
                      {contact.email && (
                        <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                      )}
                    </div>
                    {selectedContactId === contact.id.toString() && (
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {contactSearch ? "No contacts match your search" : "No available contacts"}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkContactOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => linkContactMutation.mutate(parseInt(selectedContactId))}
              disabled={!selectedContactId || linkContactMutation.isPending}
            >
              {linkContactMutation.isPending ? "Linking..." : "Link Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Deal Dialog */}
      <Dialog open={isLinkDealOpen} onOpenChange={setIsLinkDealOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Deal</DialogTitle>
            <DialogDescription>
              Associate a deal with this company.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search deals..."
                value={dealSearch}
                onChange={(e) => setDealSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Deal List */}
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {filteredDeals.length > 0 ? (
                filteredDeals.map((deal) => (
                  <button
                    key={deal.id}
                    onClick={() => setSelectedDealId(deal.id.toString())}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 text-left transition-colors ${
                      selectedDealId === deal.id.toString() ? "bg-blue-50 border-blue-200" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{deal.name}</p>
                      {deal.amount && (
                        <p className="text-xs text-green-600">${parseFloat(deal.amount).toLocaleString()}</p>
                      )}
                    </div>
                    {selectedDealId === deal.id.toString() && (
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {dealSearch ? "No deals match your search" : "No available deals"}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDealOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => linkDealMutation.mutate(parseInt(selectedDealId))}
              disabled={!selectedDealId || linkDealMutation.isPending}
            >
              {linkDealMutation.isPending ? "Linking..." : "Link Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
