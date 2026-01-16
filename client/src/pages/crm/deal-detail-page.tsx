import { useState, useRef, useCallback } from "react";
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
  Building2,
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
import { InlineEdit, InlineEditCurrency, InlineEditDate } from "@/components/ui/inline-edit";
import { EmailList } from "@/components/crm/email-list";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";
import { DetailPageCustomizer } from "@/components/crm/detail-page-customizer";
import { useDetailPageLayout } from "@/hooks/use-detail-page-layout";
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
  companyId: number | null;
  ownerId?: number | null;
  lostReason?: string | null;
  owner?: { id: number; email: string; name?: string; firstName: string; lastName: string; profilePhoto?: string } | null;
  company?: { id: number; name: string } | null;
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

export default function DealDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const [isAddContactDialogOpen, setIsAddContactDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [contactRole, setContactRole] = useState("other");
  const [contactMode, setContactMode] = useState<"existing" | "new">("existing");
  const [contactSearch, setContactSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("activity");
  const [isLostReasonDialogOpen, setIsLostReasonDialogOpen] = useState(false);
  const [pendingLostStageId, setPendingLostStageId] = useState<number | null>(null);
  const [selectedLostReason, setSelectedLostReason] = useState("");
  const [customLostReason, setCustomLostReason] = useState("");

  // Use detail page layout hook
  const {
    isSectionVisible,
    isFieldVisible,
    getSectionOrder,
    getVisibleCustomFields,
  } = useDetailPageLayout("deal");

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

  // Fetch all contacts for the add contact dialog
  const { data: contactsData } = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/crm/contacts"],
    queryFn: () => apiRequest("GET", "/api/crm/contacts").then(res => res.json()),
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
  const { data: membersData } = useQuery<{ id: number; userId: number; email: string; firstName: string | null; lastName: string | null }[]>({
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
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] }); // Also refresh deals list
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"] }); // Also refresh kanban view
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
      setContactRole("other");
      toast({ title: "Contact added", description: "Contact has been linked to this deal." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add contact.", variant: "destructive" });
    },
  });

  // Update contact mutation (for inline editing)
  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: Record<string, any> }) =>
      apiRequest("PATCH", `/api/crm/contacts/${contactId}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
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
  const handleDealUpdate = useCallback(async (field: string, value: string) => {
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
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/deals">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">{deal.name}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
              {deal.company && (
                <Link
                  href={`/companies/${deal.company.id}`}
                  className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1"
                >
                  <Building2 className="h-3 w-3" />
                  {deal.company.name}
                </Link>
              )}
              {deal.owner && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Owner: {deal.owner.firstName || deal.owner.email}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCustomizerOpen(true)}
          className="flex items-center gap-1.5"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Customize</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
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
              <div className="flex items-stretch">
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
                        text-xs font-medium transition-all duration-200
                        ${isActive ? 'z-10' : 'hover:brightness-110'}
                        ${isFuture ? 'opacity-50' : ''}
                      `}
                      style={{
                        backgroundColor: toPastelColor(stage.color),
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
                      <span
                        className="truncate px-3"
                        style={{
                          // Offset text to account for arrow shapes
                          paddingLeft: isFirst ? '12px' : '16px',
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
                            boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.4)`,
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
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="activity">
                <Clock className="h-4 w-4 mr-1" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="emails">
                <Mail className="h-4 w-4 mr-1" />
                Emails
              </TabsTrigger>
              <TabsTrigger value="buyers">
                <Users className="h-4 w-4 mr-1" />
                Buyers
              </TabsTrigger>
              <TabsTrigger value="cims">
                <FileText className="h-4 w-4 mr-1" />
                CIMs
              </TabsTrigger>
              <TabsTrigger value="files">
                <FolderOpen className="h-4 w-4 mr-1" />
                Files
              </TabsTrigger>
              <TabsTrigger value="contacts">
                <User className="h-4 w-4 mr-1" />
                Contacts
              </TabsTrigger>
              <TabsTrigger value="notes">
                <MessageSquare className="h-4 w-4 mr-1" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="tasks">
                <CheckSquare className="h-4 w-4 mr-1" />
                Tasks
              </TabsTrigger>
            </TabsList>

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

                              {/* Stage Change Details */}
                              {activity.activityType === 'stage_change' && activity.metadata && (
                                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <p className="text-sm text-gray-700 flex items-center gap-2">
                                    <span className="text-gray-500">Stage changed:</span>
                                    <Badge variant="outline">{(activity.metadata as any).fromStage || 'None'}</Badge>
                                    <ArrowRight className="h-3 w-3 text-gray-400" />
                                    <Badge variant="outline" className="bg-slate-100 border-slate-300">
                                      {(activity.metadata as any).toStage}
                                    </Badge>
                                  </p>
                                </div>
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
                      <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No activity yet</p>
                      <p className="text-sm text-gray-400 mt-1">
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
                <BuyerPipeline
                  dealId={parseInt(id!)}
                  buyers={buyers || []}
                  stages={buyerStages}
                />
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
                      <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-2" />
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

            <TabsContent value="contacts" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">Contacts</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setIsAddContactDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </CardHeader>
                <CardContent>
                  {deal.contacts && deal.contacts.length > 0 ? (
                    <div className="space-y-3">
                      {deal.contacts.map((contact: any) => (
                        <div
                          key={contact.id}
                          className="p-3 rounded-lg border hover:bg-gray-50/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <Link href={`/contacts/${contact.id}`}>
                              {contact.avatarUrl ? (
                                <img
                                  src={contact.avatarUrl}
                                  alt={`${contact.firstName} ${contact.lastName}`}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                                  {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
                                </div>
                              )}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <Link href={`/contacts/${contact.id}`} className="font-medium text-gray-900 hover:text-blue-600 truncate">
                                  {contact.firstName} {contact.lastName}
                                </Link>
                                <Badge variant="secondary" className="flex-shrink-0">
                                  {contact.role}
                                </Badge>
                              </div>
                              <div className="mt-1.5 space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                  <InlineEdit
                                    value={contact.email}
                                    onSave={(val) => handleContactUpdate(contact.id, 'email', val)}
                                    type="email"
                                    emptyText="Add email"
                                    displayClassName="text-gray-600"
                                  />
                                  {contact.email && (
                                    <a
                                      href={`mailto:${contact.email}`}
                                      className="text-blue-500 hover:text-blue-600 ml-1"
                                      title="Send email"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Mail className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                  <InlineEdit
                                    value={contact.phone}
                                    onSave={(val) => handleContactUpdate(contact.id, 'phone', val)}
                                    type="phone"
                                    emptyText="Add phone"
                                    displayClassName="text-gray-600"
                                  />
                                  {contact.phone && (
                                    <a
                                      href={`tel:${contact.phone}`}
                                      className="text-green-500 hover:text-green-600 ml-1"
                                      title="Call"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No contacts yet</p>
                      <p className="text-sm text-gray-400 mt-1 mb-4">
                        Link contacts to track who's involved in this deal
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setIsAddContactDialogOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add First Contact
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cims" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">CIM Documents</CardTitle>
                  <Button asChild size="sm">
                    <Link href={`/dashboard?mode=cim&dealId=${deal.id}`}>
                      <WandSparkles className="h-4 w-4 mr-2" />
                      Create CIM
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {deal.documents && deal.documents.length > 0 ? (
                    <div className="space-y-3">
                      {deal.documents.map((doc) => (
                        <Link
                          key={doc.id}
                          href={`/documents/${doc.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border"
                        >
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <WandSparkles className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{doc.title}</p>
                            <p className="text-xs text-gray-500">
                              Created {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <WandSparkles className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No CIMs yet</p>
                      <p className="text-sm text-gray-400 mt-1 mb-4">
                        Create a CIM to showcase this deal to potential buyers
                      </p>
                      <Button asChild size="sm">
                        <Link href={`/dashboard?mode=cim&dealId=${deal.id}`}>
                          <WandSparkles className="h-4 w-4 mr-2" />
                          Create Your First CIM
                        </Link>
                      </Button>
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
                      <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No files yet</p>
                      <p className="text-sm text-gray-400 mt-1 mb-4">
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
        <div className="space-y-6">
          {/* Key People Card */}
          {isSectionVisible("key-people") && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-4 w-4" />
                Key People
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddContactDialogOpen(true)}
                title="Link a contact"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Deal Owner */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Deal Owner</label>
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
                    {members.map((member) => (
                      <SelectItem key={member.userId} value={member.userId.toString()}>
                        {member.firstName && member.lastName
                          ? `${member.firstName} ${member.lastName}`
                          : member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Company */}
              {deal.company && (
                <Link
                  href={`/companies/${deal.company.id}`}
                  className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-900">{deal.company.name}</p>
                    <p className="text-xs text-gray-500">Company</p>
                  </div>
                </Link>
              )}

              {/* Primary Contact */}
              {deal.contacts && deal.contacts.length > 0 && (
                <div className="rounded-lg p-2 -mx-2">
                  <div className="flex items-start gap-3">
                    <Link href={`/contacts/${deal.contacts[0].id}`}>
                      {(deal.contacts[0] as any).avatarUrl ? (
                        <img
                          src={(deal.contacts[0] as any).avatarUrl}
                          alt={`${deal.contacts[0].firstName} ${deal.contacts[0].lastName}`}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium">
                          {(deal.contacts[0].firstName?.[0] || '').toUpperCase()}{(deal.contacts[0].lastName?.[0] || '').toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/contacts/${deal.contacts[0].id}`} className="text-sm font-medium truncate text-gray-900 hover:text-blue-600 block">
                        {deal.contacts[0].firstName} {deal.contacts[0].lastName}
                      </Link>
                      <p className="text-xs text-gray-500 mb-1">{deal.contacts[0].role || "Primary Contact"}</p>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <InlineEdit
                            value={deal.contacts[0].email}
                            onSave={(val) => handleContactUpdate(deal.contacts![0].id, 'email', val)}
                            type="email"
                            emptyText="Add email"
                            displayClassName="text-xs text-gray-600"
                            inputClassName="h-6 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <InlineEdit
                            value={(deal.contacts[0] as any).phone}
                            onSave={(val) => handleContactUpdate(deal.contacts![0].id, 'phone', val)}
                            type="phone"
                            emptyText="Add phone"
                            displayClassName="text-xs text-gray-600"
                            inputClassName="h-6 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional contacts count */}
              {deal.contacts && deal.contacts.length > 1 && (
                <p className="text-xs text-gray-500 text-center pt-1">
                  +{deal.contacts.length - 1} more contact{deal.contacts.length > 2 ? 's' : ''} in Contacts tab
                </p>
              )}

              {!deal.company && (!deal.contacts || deal.contacts.length === 0) && (
                <div className="text-center py-3">
                  <p className="text-sm text-gray-500 mb-2">No company or contacts linked yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddContactDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Contact
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

          {/* Quick Actions */}
          {isSectionVisible("quick-actions") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" asChild className="w-full justify-start">
                <Link href={`/dashboard?mode=cim&dealId=${deal.id}`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create CIM
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab("notes");
                }}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Note
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-4 w-4 mr-2" />
                Attach File
              </Button>
            </CardContent>
          </Card>
          )}
        </div>
      </div>

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

      {/* Add Contact Dialog - rendered at root level so it works from any tab */}
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
            <DialogTitle>Add Contact to Deal</DialogTitle>
            <DialogDescription>
              Link an existing contact or create a new one.
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

              {/* Role Selection */}
              <div className="space-y-2">
                <Label>Role in this deal</Label>
                <Select value={contactRole} onValueChange={setContactRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Contact</SelectItem>
                    <SelectItem value="decision_maker">Decision Maker</SelectItem>
                    <SelectItem value="influencer">Influencer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
              <UserPlus className="h-12 w-12 text-gray-300 mx-auto mb-3" />
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
