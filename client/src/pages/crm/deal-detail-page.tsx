import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MentionInput, highlightMentions } from "@/components/ui/mention-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  FileText,
  MessageSquare,
  Paperclip,
  Clock,
  Plus,
  Trash2,
  X,
  Users,
  WandSparkles,
  Mail,
  Upload,
  FolderOpen,
  UserPlus,
  Link as LinkIcon,
  Download,
  AlertCircle,
  Search,
  Check,
  CheckSquare,
  ArrowRight,
  FileUp,
  Phone,
  Video,
  MessageSquarePlus,
  Settings2,
  BriefcaseBusiness,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Shield,
  Copy,
  Loader2,
  ExternalLink,
} from "lucide-react";

// Helper function to get activity icon based on type
function getActivityIcon(activityType: string) {
  switch (activityType) {
    case 'note':
      return { icon: MessageSquare, bg: 'bg-blue-100', color: 'text-blue-600' };
    case 'file_uploaded':
      return { icon: FileUp, bg: 'bg-purple-100', color: 'text-purple-600' };
    case 'stage_change':
      return { icon: ArrowRight, bg: 'bg-slate-100', color: 'text-slate-600' };
    case 'task_created':
      return { icon: CheckSquare, bg: 'bg-orange-100', color: 'text-orange-600' };
    case 'task_completed':
      return { icon: Check, bg: 'bg-green-100', color: 'text-green-600' };
    case 'deal_created':
      return { icon: Plus, bg: 'bg-blue-100', color: 'text-blue-600' };
    case 'deal_won':
      return { icon: Check, bg: 'bg-green-100', color: 'text-green-600' };
    case 'deal_lost':
      return { icon: X, bg: 'bg-red-100', color: 'text-red-600' };
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
    case 'stage_change':
      return `moved deal from ${activity.metadata?.fromStage || 'Unknown'} to ${activity.metadata?.toStage || 'Unknown'}`;
    case 'task_created':
      return `created task: ${activity.metadata?.taskTitle || 'Untitled'}`;
    case 'task_completed':
      return `completed task: ${activity.metadata?.taskTitle || 'Untitled'}`;
    case 'deal_created':
      return 'created this deal';
    case 'deal_won':
      return 'marked deal as won';
    case 'deal_lost':
      return 'marked deal as lost';
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
import { BuyerPipeline } from "@/components/crm/buyer-pipeline";
import { DealCollaborators } from "@/components/crm/deal-collaborators";
import { InlineEdit, InlineEditEmail, InlineEditCurrency, InlineEditDate } from "@/components/ui/inline-edit";
import { EmailList } from "@/components/crm/email-list";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";
import { DetailPageCustomizer } from "@/components/crm/detail-page-customizer";
import { useDetailPageLayout } from "@/hooks/use-detail-page-layout";
import { useBrandColor } from "@/hooks/use-brand-color";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface Deal {
  id: number;
  name: string;
  amount: string | null;
  currency: string;
  stageId: number;
  pipelineId: number;
  closeDate: string | null;
  description: string | null;
  ownerId?: number | null;
  lostReason?: string | null;
  // Business details
  askingPrice?: string | null;
  revenueRange?: string | null;
  profitRange?: string | null;
  industry?: string | null;
  businessDescription?: string | null;
  listingStatus?: string | null;
  // Seller engagement context
  sellerMotivation?: string | null;
  sellerTimeline?: string | null;
  engagementStatus?: string | null;
  engagementSignedAt?: string | null;
  dealSource?: string | null;
  referredBy?: string | null;
  // Files
  dealFiles?: Array<{ name: string; path: string; uploadedAt: string; type?: string; size?: number }> | null;
  // Relations
  owner?: { id: number; email: string; name?: string; firstName: string; lastName: string; profilePhoto?: string } | null;
  stage?: { id: number; name: string; color: string; probability: number };
  pipeline?: { id: number; name: string };
  contacts?: Array<{ id: number; email: string; firstName: string; lastName: string; role: string }>;
  documents?: Array<{ id: number; title: string; createdAt: string }>;
  files?: Array<{ id: number; fileName: string; fileSize: number; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
}

// Common lost reasons
const LOST_REASONS = [
  "Price too high",
  "Went with competitor",
  "No budget",
  "Timing not right",
  "No decision made",
  "Project cancelled",
  "Unresponsive",
  "Not a good fit",
  "Other",
];

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
}

interface DealBuyer {
  id: number;
  dealId: number;
  stageId: number;
  contactId: number | null;
  companyId: number | null;
  notes: string | null;
  lastContactDate: string | null;
  nextFollowUp: string | null;
  contact?: { id: number; email: string; firstName: string; lastName: string } | null;
  company?: { id: number; name: string } | null;
  stage?: { id: number; name: string; color: string };
}

interface BuyerStage {
  id: number;
  name: string;
  displayOrder: number;
  color: string;
}

interface Contact {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  role?: string;
  avatarUrl?: string;
}

interface Attachment {
  id: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: number;
}

// Deal NDAs sidebar card component
function DealNdasCard({ dealId }: { dealId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ndas, isLoading } = useQuery<any[]>({
    queryKey: [`/api/deals/${dealId}/ndas`],
    queryFn: () => apiRequest("GET", `/api/deals/${dealId}/ndas`).then((r) => r.json()),
    enabled: !!dealId,
  });

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/nda/${slug}`);
    toast({ title: "Share URL copied" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-600" />
            NDAs
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        ) : !ndas || ndas.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No NDAs created for this deal yet. Create one from the NDAs page.</p>
        ) : (
          <div className="space-y-3">
            {ndas.map((nda: any) => (
              <div key={nda.id} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{nda.name || "Untitled NDA"}</p>
                    <p className="text-xs text-gray-500 truncate">CIM: {nda.cimTitle}</p>
                    {nda.templateName && (
                      <p className="text-xs text-gray-500 truncate">Template: {nda.templateName}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={() => copyUrl(nda.shareSlug)}
                    title="Copy share URL"
                  >
                    <Copy className="h-3 w-3 text-gray-500" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-gray-600">{nda.signatureStats?.total || 0} signed</span>
                  {nda.signatureStats?.pending > 0 && (
                    <span className="text-yellow-600">{nda.signatureStats.pending} pending</span>
                  )}
                  <span className="text-green-600">{nda.signatureStats?.approved || 0} approved</span>
                </div>
                <div className="mt-1.5">
                  <Badge className={`text-xs ${nda.approvalRequired ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {nda.approvalRequired ? "Manual approval" : "Auto-approve"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DealDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const [isAddContactDialogOpen, setIsAddContactDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [contactRole, setContactRole] = useState("seller");
  const [contactMode, setContactMode] = useState<"existing" | "new">("existing");
  const [contactSearch, setContactSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("activity");
  const [expandedEmails, setExpandedEmails] = useState<Set<number>>(new Set());
  const [isLostReasonDialogOpen, setIsLostReasonDialogOpen] = useState(false);
  const [pendingLostStageId, setPendingLostStageId] = useState<number | null>(null);
  const [selectedLostReason, setSelectedLostReason] = useState("");
  const [customLostReason, setCustomLostReason] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Link CIM dialog state
  const [isLinkCimOpen, setIsLinkCimOpen] = useState(false);
  const [cimSearch, setCimSearch] = useState("");

  // Sidebar collapse state - persisted to localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('deal-detail-sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Buyers fullscreen state
  const [isBuyersFullscreen, setIsBuyersFullscreen] = useState(false);

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('deal-detail-sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Use detail page layout hook
  const {
    isSectionVisible,
    isFieldVisible,
    getSectionOrder,
    getVisibleCustomFields,
  } = useDetailPageLayout("deal");

  // Get brand color for theming
  const { brandColor, needsDarkText } = useBrandColor();

  // Fetch deal details
  const { data: deal, isLoading } = useQuery<Deal>({
    queryKey: ["/api/crm/deals", id],
    queryFn: () => apiRequest("GET", `/api/crm/deals/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch pipeline stages for the dropdown
  const { data: pipelines } = useQuery({
    queryKey: ["/api/crm/pipelines"],
  });

  // Fetch seller contacts for the add seller dialog
  const { data: contactsData } = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/crm/contacts", { contactType: "seller" }],
    queryFn: () => apiRequest("GET", "/api/crm/contacts?contactType=seller").then(res => res.json()),
  });
  const allContacts = contactsData?.contacts;

  // Fetch notes
  const { data: notes } = useQuery<Note[]>({
    queryKey: ["/api/crm/notes/deal", id],
    queryFn: () => apiRequest("GET", `/api/crm/notes/deal/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch unified activity feed with embedded content
  const { data: activities } = useQuery<Activity[]>({
    queryKey: ["/api/crm/activity-feed/deal", id],
    queryFn: () => apiRequest("GET", `/api/crm/activity-feed/deal/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch tasks
  const { data: tasks } = useQuery<any[]>({
    queryKey: [`/api/crm/tasks/deal/${id}`],
    queryFn: () => apiRequest("GET", `/api/crm/tasks/deal/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch user's CIM documents for linking — uses server-side search
  const { data: allCimDocsData } = useQuery<{ documents: any[]; total: number }>({
    queryKey: [`/api/cim?limit=50${cimSearch ? `&search=${encodeURIComponent(cimSearch)}` : ''}`],
    enabled: isLinkCimOpen,
  });
  const allCimDocs = allCimDocsData?.documents;

  // Fetch deal buyers
  const { data: buyers } = useQuery<DealBuyer[]>({
    queryKey: ["/api/crm/deals", id, "buyers"],
    queryFn: () => apiRequest("GET", `/api/crm/deals/${id}/buyers`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch buyer stages
  const { data: buyerStages } = useQuery<BuyerStage[]>({
    queryKey: ["/api/crm/buyer-stages"],
  });

  // Fetch attachments for this deal
  const { data: attachments, isLoading: attachmentsLoading, error: attachmentsError } = useQuery<Attachment[]>({
    queryKey: ["/api/crm/attachments/deal", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/attachments/deal/${id}`);
      if (!res.ok) {
        throw new Error('Failed to load attachments');
      }
      return res.json();
    },
    enabled: !!id,
    retry: 1,
  });

  // Fetch organization members for owner assignment
  const { data: membersData } = useQuery<{ id: number; userId: number; email: string; firstName: string | null; lastName: string | null; profilePhoto?: string | null }[]>({
    queryKey: ["/api/crm/organization/members"],
    queryFn: () => apiRequest("GET", "/api/crm/organization/members").then(res => res.json()),
  });
  const members = membersData || [];

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('objectType', 'deal');
      formData.append('objectId', id!);

      const response = await fetch('/api/crm/attachments', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/attachments/deal", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities/deal", id] });
      toast({ title: "File uploaded", description: "Your file has been uploaded successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: (attachmentId: number) =>
      apiRequest("DELETE", `/api/crm/attachments/${attachmentId}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/attachments/deal", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities/deal", id] });
      toast({ title: "File deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete file.", variant: "destructive" });
    },
  });

  // Update deal mutation
  const updateDealMutation = useMutation({
    mutationFn: (data: Partial<Deal>) =>
      apiRequest("PATCH", `/api/crm/deals/${id}`, {
        body: data,
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' }); // Refresh all deals queries including filtered
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' }); // Refresh kanban view
      toast({ title: "Deal updated", description: "Changes saved successfully." });
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: { content: string; mentionedUserIds: number[] }) =>
      apiRequest("POST", "/api/crm/notes", {
        body: {
          objectType: "deal",
          objectId: parseInt(id!),
          content: data.content,
          mentionedUserIds: data.mentionedUserIds,
        },
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes/deal", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities/deal", id] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes/deal", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activity-feed/deal", id] });
      toast({ title: "Note deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete note", variant: "destructive" });
    },
  });

  // Move to stage mutation
  const moveToStageMutation = useMutation({
    mutationFn: ({ stageId, lostReason }: { stageId: number; lostReason?: string }) =>
      apiRequest("POST", `/api/crm/deals/${id}/move`, {
        body: { stageId, lostReason },
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities/deal", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activity-feed/deal", id] });
      toast({ title: "Deal moved", description: "Stage updated successfully." });
      // Reset lost reason state
      setIsLostReasonDialogOpen(false);
      setPendingLostStageId(null);
      setSelectedLostReason("");
      setCustomLostReason("");
    },
  });

  // Helper to check if a stage is a "lost" stage
  const isLostStage = (stage: any) => {
    const name = stage.name?.toLowerCase() || '';
    return name.includes('lost') || name.includes('closed lost') || stage.probability === 0;
  };

  // Handle stage click - show lost reason dialog if moving to lost stage
  const handleStageClick = (stage: any) => {
    if (stage.id === deal?.stageId) return; // Already on this stage

    if (isLostStage(stage)) {
      setPendingLostStageId(stage.id);
      setIsLostReasonDialogOpen(true);
    } else {
      moveToStageMutation.mutate({ stageId: stage.id });
    }
  };

  // Confirm lost reason and move
  const confirmLostReason = () => {
    if (!pendingLostStageId) return;
    const reason = selectedLostReason === "Other" ? customLostReason : selectedLostReason;
    moveToStageMutation.mutate({ stageId: pendingLostStageId, lostReason: reason || undefined });
  };

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/crm/deals/${id}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
      toast({ title: "Deal deleted", description: "The deal has been permanently deleted." });
      navigate("/deals");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete deal.", variant: "destructive" });
    },
  });

  // Add contact to deal mutation
  const addContactMutation = useMutation({
    mutationFn: ({ contactId, role }: { contactId: number; role: string }) =>
      apiRequest("POST", `/api/crm/deals/${id}/contacts`, {
        body: { contactId, role },
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", id] });
      setIsAddContactDialogOpen(false);
      setSelectedContactId("");
      setContactRole("seller");
      toast({ title: "Seller added", description: "Seller has been linked to this deal." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add seller.", variant: "destructive" });
    },
  });

  // Remove contact from deal mutation
  const removeContactMutation = useMutation({
    mutationFn: (contactId: number) =>
      apiRequest("DELETE", `/api/crm/deals/${id}/contacts/${contactId}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", id] });
      toast({ title: "Seller removed" });
    },
  });

  // Link CIM to deal mutation
  const linkCimMutation = useMutation({
    mutationFn: (cimDocumentId: number) =>
      apiRequest("POST", `/api/crm/deals/${id}/documents`, {
        body: { cimDocumentId },
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", id] });
      setIsLinkCimOpen(false);
      setCimSearch("");
      toast({ title: "CIM linked", description: "Document has been linked to this deal." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to link document", variant: "destructive" });
    },
  });

  const unlinkCimMutation = useMutation({
    mutationFn: (documentId: number) =>
      apiRequest("DELETE", `/api/crm/deals/${id}/documents/${documentId}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", id] });
      toast({ title: "CIM unlinked" });
    },
  });

  // Update contact mutation (for inline editing)
  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: Record<string, any> }) =>
      apiRequest("PATCH", `/api/crm/contacts/${contactId}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
    },
  });

  // Helper for inline contact updates
  const handleContactUpdate = useCallback(async (contactId: number, field: string, value: string) => {
    await updateContactMutation.mutateAsync({ contactId, data: { [field]: value || null } });
  }, [updateContactMutation]);

  // Helper for inline deal updates
  const handleDealUpdate = useCallback(async (field: string, value: string | null) => {
    await updateDealMutation.mutateAsync({ [field]: value || null });
  }, [updateDealMutation]);

  const currentPipeline = (pipelines as any)?.find((p: any) => p.id === deal?.pipelineId);
  const stages = currentPipeline?.stages || [];
  const currentStageIndex = stages.findIndex((s: any) => s.id === deal?.stageId);

  // Filter out contacts already associated with the deal
  const availableContacts = (allContacts || []).filter(
    (contact) => !deal?.contacts?.some((dc) => dc.id === contact.id)
  );

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

  if (!deal) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Deal not found</h2>
          <p className="text-gray-500 mt-2">This deal may have been deleted.</p>
          <Button asChild className="mt-4">
            <Link href="/deals">Back to Deals</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pr-2 md:pr-4">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="sm" asChild className="w-fit flex-shrink-0">
            <Link href="/deals">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Deals
            </Link>
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 ${!brandColor ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : ''}`}
              style={brandColor ? { backgroundColor: brandColor } : undefined}
            >
              <BriefcaseBusiness className={`h-5 w-5 sm:h-6 sm:w-6 ${brandColor && needsDarkText ? 'text-gray-900' : 'text-white'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <InlineEdit
                value={deal.name}
                onSave={(val) => handleDealUpdate('name', val)}
                emptyText="Deal Name"
                displayClassName="text-xl md:text-2xl font-semibold text-gray-900"
              />
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                {deal.owner && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Owner: {deal.owner.firstName || deal.owner.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCustomizerOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Customize</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-6">
        {/* Main Content */}
        <div className="space-y-6 min-w-0">
          {/* Pipeline Stages - Pipedrive Arrow Style */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {deal.pipeline?.name || "Pipeline"} Stage
                </CardTitle>
                <span className="text-sm text-gray-500">
                  {deal.stage?.probability}% probability
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-stretch" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}>
                {stages.map((stage: any, index: number) => {
                  const isActive = stage.id === deal.stageId;
                  const isPast = index < currentStageIndex;
                  const isFuture = index > currentStageIndex;
                  const isFirst = index === 0;
                  const isLast = index === stages.length - 1;
                  const arrowWidth = 12; // pixels for arrow point

                  return (
                    <button
                      key={stage.id}
                      onClick={() => handleStageClick(stage)}
                      className={`
                        relative h-11 flex-1 min-w-0 flex items-center justify-center
                        text-xs transition-all duration-200
                        ${isPast ? 'font-semibold' : 'font-medium'}
                        ${isActive ? 'z-10 font-semibold' : 'hover:brightness-105'}
                        ${isFuture ? 'opacity-60' : ''}
                      `}
                      style={{
                        backgroundColor: isPast || isActive ? toPastelColorSaturated(stage.color) : toPastelColor(stage.color),
                        color: getPastelTextColor(stage.color),
                        // Left indent for non-first items (arrow from previous)
                        marginLeft: isFirst ? 0 : -arrowWidth,
                        // Right side clips to arrow shape
                        clipPath: isLast
                          ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${arrowWidth}px 50%)`
                          : `polygon(0 0, calc(100% - ${arrowWidth}px) 0, 100% 50%, calc(100% - ${arrowWidth}px) 100%, 0 100%, ${isFirst ? '0' : `${arrowWidth}px`} 50%)`,
                      }}
                      title={`Move to ${stage.name}`}
                    >
                      {/* Checkmark for completed stages */}
                      {isPast && (
                        <Check
                          className="h-3.5 w-3.5 flex-shrink-0"
                          style={{
                            marginLeft: isFirst ? '8px' : '12px',
                            marginRight: '2px'
                          }}
                        />
                      )}
                      <span
                        className="truncate"
                        style={{
                          // Offset text to account for arrow shapes
                          paddingLeft: isPast ? '2px' : (isFirst ? '12px' : '16px'),
                          paddingRight: isLast ? '12px' : '16px',
                        }}
                      >
                        {stage.name}
                      </span>
                      {/* Active indicator */}
                      {isActive && (
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.5)`,
                            clipPath: isLast
                              ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${arrowWidth}px 50%)`
                              : `polygon(0 0, calc(100% - ${arrowWidth}px) 0, 100% 50%, calc(100% - ${arrowWidth}px) 100%, 0 100%, ${isFirst ? '0' : `${arrowWidth}px`} 50%)`,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto scrollbar-hide -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <TabsList variant="underline" className="w-max min-w-full justify-start border-b flex-nowrap">
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
                <TabsTrigger variant="underline" value="buyers">
                  <Users className="h-4 w-4 mr-1" />
                  Buyers
                </TabsTrigger>
                <TabsTrigger variant="underline" value="cims">
                  <FileText className="h-4 w-4 mr-1" />
                  CIMs
                </TabsTrigger>
                <TabsTrigger variant="underline" value="files">
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Files
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {activities && activities.length > 0 ? (
                    <div className="space-y-4">
                      {activities.map((activity: any) => {
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
                                <p className="text-sm">
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

                              {/* Stage Change Details */}
                              {activity.activityType === 'stage_change' && activity.metadata && (
                                <p className="text-sm text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline">{(activity.metadata as any).fromStage || 'None'}</Badge>
                                  <ArrowRight className="h-3 w-3 text-gray-400" />
                                  <Badge variant="outline">
                                    {(activity.metadata as any).toStage}
                                  </Badge>
                                </p>
                              )}

                              {/* Fallback description for other activity types */}
                              {!embedded && activity.description && activity.activityType !== 'stage_change' && (
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
                        Activity will appear here as you work on this deal
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Emails
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EmailList dealId={parseInt(id!)} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="buyers" className="mt-4">
              {buyerStages && buyerStages.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsBuyersFullscreen(true)}
                      className="flex items-center gap-2"
                    >
                      <Maximize2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Expand View</span>
                    </Button>
                  </div>
                  <BuyerPipeline
                    dealId={parseInt(id!)}
                    buyers={buyers || []}
                    stages={buyerStages}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-gray-500 text-center">Loading buyer stages...</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

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
                    objectType="deal"
                    objectId={parseInt(id!)}
                    onEditTask={(task) => setEditingTask(task)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cims" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">CIM Documents</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsLinkCimOpen(true)}>
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Link Existing
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/dashboard?mode=cim&dealId=${deal.id}`}>
                        <WandSparkles className="h-4 w-4 mr-2" />
                        Create CIM
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {deal.documents && deal.documents.length > 0 ? (
                    <div className="space-y-3">
                      {deal.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border group">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="flex items-center gap-3 flex-1 min-w-0"
                          >
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <WandSparkles className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-gray-900">{doc.title}</p>
                              <p className="text-xs text-gray-500">
                                Created {new Date(doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                            onClick={() => unlinkCimMutation.mutate(doc.id)}
                            title="Unlink from deal"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <WandSparkles className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-700 font-medium">No CIMs yet</p>
                      <p className="text-sm text-gray-500 mt-1 mb-4">
                        Link an existing CIM or create a new one for this deal
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsLinkCimOpen(true)}>
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Link Existing
                        </Button>
                        <Button asChild size="sm">
                          <Link href={`/dashboard?mode=cim&dealId=${deal.id}`}>
                            <WandSparkles className="h-4 w-4 mr-2" />
                            Create CIM
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">Files & Attachments</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadFileMutation.isPending}
                  >
                    {uploadFileMutation.isPending ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload File
                      </>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Validate file size (25MB limit)
                        if (file.size > 25 * 1024 * 1024) {
                          toast({
                            title: "File too large",
                            description: "Please select a file smaller than 25MB.",
                            variant: "destructive"
                          });
                          return;
                        }
                        uploadFileMutation.mutate(file);
                      }
                      // Reset input so same file can be selected again
                      e.target.value = '';
                    }}
                  />
                </CardHeader>
                <CardContent>
                  {attachmentsLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : attachmentsError ? (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-3" />
                      <p className="text-red-600 font-medium">Unable to load files</p>
                      <p className="text-sm text-gray-500 mt-1">Please try refreshing the page</p>
                    </div>
                  ) : attachments && attachments.length > 0 ? (
                    <div className="space-y-3">
                      {attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-gray-900">{file.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {file.fileSize >= 1024 * 1024
                                ? `${(file.fileSize / 1024 / 1024).toFixed(1)} MB`
                                : `${(file.fileSize / 1024).toFixed(1)} KB`
                              } • {new Date(file.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Download file"
                              onClick={() => {
                                window.open(`/api/crm/attachments/${file.id}/download`, '_blank');
                              }}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete file"
                              onClick={() => deleteFileMutation.mutate(file.id)}
                              disabled={deleteFileMutation.isPending}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-700 font-medium">No files yet</p>
                      <p className="text-sm text-gray-500 mt-1 mb-4">
                        Upload contracts, NDAs, and other supporting documents
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadFileMutation.isPending}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload First File
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className={`hidden lg:block flex-shrink-0 group ${isSidebarCollapsed ? 'w-6' : 'w-80'} transition-all duration-200`}>
          <div className="flex">
            {/* Edge toggle button - visible on hover */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`flex-shrink-0 w-6 flex items-start justify-center pt-2 transition-opacity duration-200 ${isSidebarCollapsed ? 'text-gray-400 hover:text-gray-600' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500'}`}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelRightOpen className="h-5 w-5" />
              ) : (
                <PanelRightClose className="h-5 w-5" />
              )}
            </button>

            {!isSidebarCollapsed && (
            <div className="w-72 space-y-6">
          {/* Associations Card */}
          {isSectionVisible("key-people") && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Associations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seller */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Seller</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddContactDialogOpen(true)}
                    className="h-6 px-2 text-gray-500 hover:text-gray-700"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                {deal.contacts && deal.contacts.length > 0 ? (
                  <div className="space-y-2">
                    {deal.contacts.map((contact: any) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors group"
                      >
                        <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 flex-1 min-w-0">
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
                            {contact.email && (
                              <p className="text-sm text-gray-500 truncate">{contact.email}</p>
                            )}
                          </div>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 flex-shrink-0"
                          onClick={() => removeContactMutation.mutate(contact.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-2">No seller linked</p>
                )}
              </div>

              {(!deal.contacts || deal.contacts.length === 0) && (
                <div className="text-center py-3">
                  <p className="text-sm text-gray-500 mb-2">No seller linked yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddContactDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Seller
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Deal Details Card */}
          {isSectionVisible("deal-details") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Deal Owner */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Deal Owner</Label>
                <Select
                  value={deal.ownerId?.toString() || ""}
                  onValueChange={(value) => {
                    updateDealMutation.mutate({
                      ownerId: value ? parseInt(value) : null,
                    });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select owner">
                      {deal.owner ? (
                        <span className="flex items-center gap-2">
                          {deal.owner.profilePhoto ? (
                            <img
                              src={deal.owner.profilePhoto}
                              alt={deal.owner.name || deal.owner.email}
                              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-blue-600">
                                {(deal.owner.name || deal.owner.email || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="truncate text-gray-900">
                            {deal.owner.name ||
                             (deal.owner.firstName && deal.owner.lastName
                              ? `${deal.owner.firstName} ${deal.owner.lastName}`
                              : deal.owner.email)}
                          </span>
                        </span>
                      ) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {members.filter(m => m.userId != null).map((member) => {
                      const displayName = member.firstName && member.lastName
                        ? `${member.firstName} ${member.lastName}`
                        : member.email;
                      return (
                        <SelectItem key={member.userId} value={member.userId.toString()}>
                          <span className="flex items-center gap-2">
                            {member.profilePhoto ? (
                              <img
                                src={member.profilePhoto}
                                alt={displayName}
                                className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium text-blue-600">
                                  {displayName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="text-gray-900">{displayName}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Deal Collaborators */}
              <div className="pt-2 border-t">
                <DealCollaborators
                  dealId={parseInt(id!)}
                  dealOwnerId={deal.ownerId || undefined}
                  canManage={true}
                />
              </div>

              <div>
                <Label className="text-xs text-gray-500">Value</Label>
                <div className="mt-0.5">
                  <InlineEditCurrency
                    value={deal.amount}
                    onSave={(val) => handleDealUpdate('amount', val)}
                    currency={deal.currency || "USD"}
                    displayClassName="text-lg font-semibold text-green-600"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Close Date</Label>
                <div className="mt-0.5">
                  <InlineEditDate
                    value={deal.closeDate ? deal.closeDate.split('T')[0] : ''}
                    onSave={(val) => handleDealUpdate('closeDate', val)}
                    displayClassName="font-medium"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Pipeline</Label>
                <p className="font-medium">{deal.pipeline?.name || "Default"}</p>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Created</Label>
                <p className="text-sm text-gray-600">
                  {new Date(deal.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Last Updated</Label>
                <p className="text-sm text-gray-600">
                  {new Date(deal.updatedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Lost Reason - only show if deal is lost */}
              {deal.lostReason && (
                <div className="pt-2 border-t">
                  <Label className="text-xs text-red-500 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    Lost Reason
                  </Label>
                  <p className="text-sm text-red-600 font-medium mt-0.5">{deal.lostReason}</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Business Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Business Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Industry</Label>
                <div className="mt-0.5">
                  <InlineEdit
                    value={deal.industry || ''}
                    onSave={(val) => handleDealUpdate('industry', val)}
                    placeholder="e.g. Manufacturing"
                    className="text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Asking Price</Label>
                <div className="mt-0.5">
                  <InlineEdit
                    value={deal.askingPrice || ''}
                    onSave={(val) => handleDealUpdate('askingPrice', val)}
                    placeholder="e.g. $2.5M"
                    className="text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Revenue Range</Label>
                <div className="mt-0.5">
                  <Select value={deal.revenueRange ?? 'none'} onValueChange={(val) => handleDealUpdate('revenueRange', val === 'none' ? null : val)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="under_500k">Under $500K</SelectItem>
                      <SelectItem value="500k_1m">$500K - $1M</SelectItem>
                      <SelectItem value="1m_5m">$1M - $5M</SelectItem>
                      <SelectItem value="5m_10m">$5M - $10M</SelectItem>
                      <SelectItem value="10m_25m">$10M - $25M</SelectItem>
                      <SelectItem value="25m_plus">$25M+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Profit / EBITDA Range</Label>
                <div className="mt-0.5">
                  <Select value={deal.profitRange ?? 'none'} onValueChange={(val) => handleDealUpdate('profitRange', val === 'none' ? null : val)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="under_100k">Under $100K</SelectItem>
                      <SelectItem value="100k_250k">$100K - $250K</SelectItem>
                      <SelectItem value="250k_500k">$250K - $500K</SelectItem>
                      <SelectItem value="500k_1m">$500K - $1M</SelectItem>
                      <SelectItem value="1m_5m">$1M - $5M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Listing Status</Label>
                <div className="mt-0.5">
                  <Select value={deal.listingStatus ?? 'none'} onValueChange={(val) => handleDealUpdate('listingStatus', val === 'none' ? null : val)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="not_listed">Not Listed</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="under_loi">Under LOI</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {deal.businessDescription !== undefined && (
                <div>
                  <Label className="text-xs text-gray-500">Business Description</Label>
                  <div className="mt-0.5">
                    <InlineEdit
                      value={deal.businessDescription || ''}
                      onSave={(val) => handleDealUpdate('businessDescription', val)}
                      placeholder="Brief description..."
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seller Context Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Seller Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Motivation</Label>
                <div className="mt-0.5">
                  <Select value={deal.sellerMotivation ?? 'none'} onValueChange={(val) => handleDealUpdate('sellerMotivation', val === 'none' ? null : val)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select motivation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
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
              </div>

              <div>
                <Label className="text-xs text-gray-500">Timeline</Label>
                <div className="mt-0.5">
                  <Select value={deal.sellerTimeline ?? 'none'} onValueChange={(val) => handleDealUpdate('sellerTimeline', val === 'none' ? null : val)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select timeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="3_months">3 Months</SelectItem>
                      <SelectItem value="6_months">6 Months</SelectItem>
                      <SelectItem value="12_months">12 Months</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Engagement Status</Label>
                <div className="mt-0.5">
                  <Select value={deal.engagementStatus ?? 'none'} onValueChange={(val) => handleDealUpdate('engagementStatus', val === 'none' ? null : val)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
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
              </div>

              <div>
                <Label className="text-xs text-gray-500">Deal Source</Label>
                <div className="mt-0.5">
                  <Select value={deal.dealSource ?? 'none'} onValueChange={(val) => handleDealUpdate('dealSource', val === 'none' ? null : val)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="direct_marketing">Direct Marketing</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                      <SelectItem value="intake_form">Intake Form</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Referred By</Label>
                <div className="mt-0.5">
                  <InlineEdit
                    value={deal.referredBy || ''}
                    onSave={(val) => handleDealUpdate('referredBy', val)}
                    placeholder="Who referred this deal?"
                    className="text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deal NDAs Card */}
          <DealNdasCard dealId={parseInt(id!)} />

            </div>
            )}
          </div>
        </div>
      </div>

      {/* Buyers Fullscreen Dialog */}
      {isBuyersFullscreen && buyerStages && buyerStages.length > 0 && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${!brandColor ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : ''}`}
                  style={brandColor ? { backgroundColor: brandColor } : undefined}
                >
                  <BriefcaseBusiness className={`h-4 w-4 ${brandColor && needsDarkText ? 'text-gray-900' : 'text-white'}`} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Buyer Pipeline - {deal?.name}</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsBuyersFullscreen(false)}
                className="flex items-center gap-2"
              >
                <Minimize2 className="h-4 w-4" />
                Exit Fullscreen
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <BuyerPipeline
                dealId={parseInt(id!)}
                buyers={buyers || []}
                stages={buyerStages}
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Dialogs */}
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        objectType="deal"
        objectId={parseInt(id!)}
      />

      <TaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        objectType="deal"
        objectId={parseInt(id!)}
      />

      {/* Add Seller Dialog - rendered at root level so it works from any tab */}
      <Dialog open={isAddContactDialogOpen} onOpenChange={(open) => {
        setIsAddContactDialogOpen(open);
        if (!open) {
          setContactSearch("");
          setSelectedContactId("");
          setContactMode("existing");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Seller to Deal</DialogTitle>
            <DialogDescription>
              Link an existing contact as the seller or create a new one.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Selection */}
          <div className="flex gap-2 py-2">
            <Button
              variant={contactMode === "existing" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setContactMode("existing")}
            >
              <Users className="h-4 w-4 mr-2" />
              Existing Contact
            </Button>
            <Button
              variant={contactMode === "new" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setContactMode("new")}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Contact
            </Button>
          </div>

          {contactMode === "existing" ? (
            <div className="space-y-4 py-2">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contacts by name or email..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Contact List */}
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {availableContacts.filter(c =>
                  `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(contactSearch.toLowerCase())
                ).length > 0 ? (
                  availableContacts
                    .filter(c =>
                      `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(contactSearch.toLowerCase())
                    )
                    .slice(0, 20)
                    .map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => setSelectedContactId(contact.id.toString())}
                        className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 text-left transition-colors ${
                          selectedContactId === contact.id.toString() ? "bg-blue-50 border-blue-200" : ""
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{contact.email}</p>
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

              {/* Role is always 'seller' for this sidebar section */}
            </div>
          ) : (
            <div className="py-4 text-center">
              <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">Create a new contact in your CRM</p>
              <Button asChild>
                <Link href={`/contacts/new?dealId=${id}`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Contact
                </Link>
              </Button>
            </div>
          )}

          {contactMode === "existing" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddContactDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedContactId) {
                    addContactMutation.mutate({
                      contactId: parseInt(selectedContactId),
                      role: contactRole,
                    });
                  }
                }}
                disabled={!selectedContactId || addContactMutation.isPending}
              >
                {addContactMutation.isPending ? "Adding..." : "Add to Deal"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Lost Reason Dialog */}
      <Dialog open={isLostReasonDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsLostReasonDialogOpen(false);
          setPendingLostStageId(null);
          setSelectedLostReason("");
          setCustomLostReason("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Why was this deal lost?</DialogTitle>
            <DialogDescription>
              Select a reason to help track and analyze lost deals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Lost Reason</Label>
              <Select value={selectedLostReason} onValueChange={setSelectedLostReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedLostReason === "Other" && (
              <div className="space-y-2">
                <Label>Custom reason</Label>
                <Input
                  value={customLostReason}
                  onChange={(e) => setCustomLostReason(e.target.value)}
                  placeholder="Enter a custom reason..."
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                // Move without reason
                if (pendingLostStageId) {
                  moveToStageMutation.mutate({ stageId: pendingLostStageId });
                }
              }}
            >
              Skip
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsLostReasonDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmLostReason}
                disabled={!selectedLostReason || (selectedLostReason === "Other" && !customLostReason.trim())}
              >
                Mark as Lost
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Page Customizer */}
      <DetailPageCustomizer
        objectType="deal"
        open={isCustomizerOpen}
        onOpenChange={setIsCustomizerOpen}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Deal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deal.name}"? This action cannot be undone and will permanently remove the deal and all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDealMutation.mutate()}
              disabled={deleteDealMutation.isPending}
            >
              {deleteDealMutation.isPending ? "Deleting..." : "Delete Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link CIM Dialog */}
      <Dialog open={isLinkCimOpen} onOpenChange={setIsLinkCimOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link CIM Document</DialogTitle>
            <DialogDescription>
              Associate an existing CIM document with this deal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search CIM documents..."
                value={cimSearch}
                onChange={(e) => setCimSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {(() => {
                const existingDocIds = new Set((deal.documents || []).map((d: any) => d.id));
                const availableCims = (allCimDocs || []).filter(
                  (doc: any) => !existingDocIds.has(doc.id)
                );
                return availableCims.length > 0 ? (
                  availableCims.map((doc: any) => (
                    <button
                      key={doc.id}
                      onClick={() => linkCimMutation.mutate(doc.id)}
                      disabled={linkCimMutation.isPending}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-500">
                          Created {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {cimSearch ? "No CIM documents match your search" : "No available CIM documents to link"}
                  </div>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkCimOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to convert a color to a softer pastel version
function toPastelColor(hexColor: string | undefined | null): string {
  if (!hexColor) return '#e5e7eb'; // gray-200 as fallback

  try {
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return '#e5e7eb';

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#e5e7eb';

    // Mix with white to create pastel (70% original, 30% white gives nice pastel)
    // Then boost saturation slightly for vibrancy
    const pastelR = Math.round(r * 0.6 + 255 * 0.4);
    const pastelG = Math.round(g * 0.6 + 255 * 0.4);
    const pastelB = Math.round(b * 0.6 + 255 * 0.4);

    return `#${pastelR.toString(16).padStart(2, '0')}${pastelG.toString(16).padStart(2, '0')}${pastelB.toString(16).padStart(2, '0')}`;
  } catch {
    return '#e5e7eb';
  }
}

// Helper function to convert a color to a more saturated pastel (for completed stages)
function toPastelColorSaturated(hexColor: string | undefined | null): string {
  if (!hexColor) return '#d1d5db'; // gray-300 as fallback

  try {
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return '#d1d5db';

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#d1d5db';

    // Less white mixing for more saturated look (75% original, 25% white)
    const pastelR = Math.round(r * 0.75 + 255 * 0.25);
    const pastelG = Math.round(g * 0.75 + 255 * 0.25);
    const pastelB = Math.round(b * 0.75 + 255 * 0.25);

    return `#${pastelR.toString(16).padStart(2, '0')}${pastelG.toString(16).padStart(2, '0')}${pastelB.toString(16).padStart(2, '0')}`;
  } catch {
    return '#d1d5db';
  }
}

// Helper function to get appropriate text color for pastel backgrounds
function getPastelTextColor(hexColor: string | undefined | null): string {
  if (!hexColor) return '#374151'; // gray-700 as fallback

  try {
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return '#374151';

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#374151';

    // Create a darker version of the original color for text (40% brightness)
    const darkR = Math.round(r * 0.4);
    const darkG = Math.round(g * 0.4);
    const darkB = Math.round(b * 0.4);

    return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
  } catch {
    return '#374151';
  }
}

// Helper function to determine if text should be dark or light based on background color
function getContrastColor(hexColor: string | undefined | null): string {
  // Default to white text if no color provided
  if (!hexColor) return '#ffffff';

  try {
    // Remove # if present
    let hex = hexColor.replace('#', '');

    // Handle shorthand hex colors like #FFF
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    // Ensure we have valid hex
    if (hex.length !== 6) return '#ffffff';

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Validate parsed values
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';

    // Calculate relative luminance using sRGB formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Use a lower threshold (0.45) to favor white text more often
    return luminance > 0.45 ? '#1f2937' : '#ffffff';
  } catch {
    return '#ffffff';
  }
}
