import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EmailList } from "@/components/crm/email-list";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";
import { PhotoUpload } from "@/components/crm/photo-upload";
import { InlineEdit, InlineEditEmail } from "@/components/ui/inline-edit";
import { DetailPageCustomizer } from "@/components/crm/detail-page-customizer";
import { useDetailPageLayout } from "@/hooks/use-detail-page-layout";
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
  User,
  Mail,
  Phone,
  MessageSquare,
  Building2,
  Briefcase,
  Eye,
  Clock,
  MapPin,
  Calendar,
  Tag,
  TrendingUp,
  AlertTriangle,
  Linkedin,
  FileText,
  Activity,
  CheckSquare,
  Plus,
  Settings2,
  X,
  ChevronRight,
  Search,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface ContactCustomProperties {
  totalDocumentViews?: number;
  totalTimeSpentMinutes?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  ipAddress?: string;
  location?: string;
  isPotentialVpn?: boolean;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  migratedFromInvestorDatabase?: boolean;
  originalStatus?: string;
}

export default function ContactDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");

  // Association dialog state
  const [isLinkCompanyOpen, setIsLinkCompanyOpen] = useState(false);
  const [isLinkDealOpen, setIsLinkDealOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [dealSearch, setDealSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [dealRole, setDealRole] = useState("other");

  // Use detail page layout hook
  const { isSectionVisible, getVisibleCustomFields } = useDetailPageLayout("contact");

  const { data: contact, isLoading } = useQuery({
    queryKey: ["/api/crm/contacts", id],
    queryFn: () => apiRequest("GET", `/api/crm/contacts/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch tasks
  const { data: tasks } = useQuery<any[]>({
    queryKey: [`/api/crm/tasks/contact/${id}`],
    queryFn: () => apiRequest("GET", `/api/crm/tasks/contact/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch all companies for linking
  const { data: companiesData } = useQuery<{ companies: any[] }>({
    queryKey: ["/api/crm/companies"],
    queryFn: () => apiRequest("GET", "/api/crm/companies").then(res => res.json()),
  });
  const allCompanies = companiesData?.companies || [];

  // Fetch all deals for linking
  const { data: dealsData } = useQuery<{ deals: any[] }>({
    queryKey: ["/api/crm/deals"],
    queryFn: () => apiRequest("GET", "/api/crm/deals").then(res => res.json()),
  });
  const allDeals = dealsData?.deals || [];

  // Filter available companies (exclude current company)
  const availableCompanies = allCompanies.filter(
    (company) => company.id !== (contact as any)?.company?.id
  );

  // Filter available deals (exclude already associated deals)
  const availableDeals = allDeals.filter(
    (deal) => !(contact as any)?.deals?.some((d: any) => d.id === deal.id)
  );

  // Filtered lists based on search
  const filteredCompanies = availableCompanies.filter((company) =>
    company.name?.toLowerCase().includes(companySearch.toLowerCase())
  );

  const filteredDeals = availableDeals.filter((deal) =>
    deal.name?.toLowerCase().includes(dealSearch.toLowerCase())
  );

  // Mutation to link company to contact
  const linkCompanyMutation = useMutation({
    mutationFn: (companyId: number) =>
      apiRequest("PATCH", `/api/crm/contacts/${id}`, { body: { companyId } }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      setIsLinkCompanyOpen(false);
      setSelectedCompanyId("");
      setCompanySearch("");
      toast({ title: "Company linked", description: "Company has been associated with this contact." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to link company.", variant: "destructive" });
    },
  });

  // Mutation to link deal to contact
  const linkDealMutation = useMutation({
    mutationFn: ({ dealId, role }: { dealId: number; role: string }) =>
      apiRequest("POST", `/api/crm/deals/${dealId}/contacts`, {
        body: { contactId: parseInt(id!), role },
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      setIsLinkDealOpen(false);
      setSelectedDealId("");
      setDealSearch("");
      setDealRole("other");
      toast({ title: "Deal linked", description: "Deal has been associated with this contact." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to link deal.", variant: "destructive" });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest("PATCH", `/api/crm/contacts/${id}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
    },
  });

  // Helper for inline contact updates
  const handleContactUpdate = useCallback(async (field: string, value: string) => {
    await updateContactMutation.mutateAsync({ [field]: value || null });
  }, [updateContactMutation]);

  // Tag management functions
  const handleAddTag = useCallback(async (tagName: string) => {
    const trimmedTag = tagName.trim();
    if (!trimmedTag) return;

    const currentTags = (contact as any)?.tags || [];
    if (currentTags.includes(trimmedTag)) {
      toast({ title: "Tag already exists", variant: "destructive" });
      return;
    }

    await updateContactMutation.mutateAsync({ tags: [...currentTags, trimmedTag] });
    setNewTagValue("");
    setShowTagInput(false);
  }, [contact, updateContactMutation, toast]);

  const handleRemoveTag = useCallback(async (tagToRemove: string) => {
    const currentTags = (contact as any)?.tags || [];
    const updatedTags = currentTags.filter((tag: string) => tag !== tagToRemove);
    await updateContactMutation.mutateAsync({ tags: updatedTags });
  }, [contact, updateContactMutation]);

  if (isLoading) {
    return <div className="p-6"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  if (!contact) {
    return (
      <div className="p-6 text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Contact not found</h2>
        <p className="text-gray-600 mt-2">This contact may have been deleted or you don't have access to it.</p>
        <Button asChild className="mt-4"><Link href="/contacts">Back to Contacts</Link></Button>
      </div>
    );
  }

  const customProps = (contact as any).customProperties as ContactCustomProperties || {};
  const contactType = (contact as any).contactType || 'other';
  const leadStatus = (contact as any).leadStatus || 'new';
  const tags = (contact as any).tags || [];
  const source = (contact as any).source;

  // Format time spent
  const formatTimeSpent = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  // Get contact type color
  const getContactTypeColor = (type: string) => {
    switch (type) {
      case 'buyer': return 'bg-green-100 text-green-700 border-green-200';
      case 'seller': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'advisor': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Get lead status color
  const getLeadStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-700';
      case 'contacted': return 'bg-yellow-100 text-yellow-700';
      case 'qualified': return 'bg-green-100 text-green-700';
      case 'unqualified': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/contacts"><ArrowLeft className="h-4 w-4 mr-2" />Contacts</Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <PhotoUpload
            currentPhotoUrl={(contact as any).avatarUrl}
            onPhotoChange={async (photoUrl) => {
              await handleContactUpdate('avatarUrl', photoUrl || '');
            }}
            placeholder={
              <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-base sm:text-lg font-semibold">
                {((contact as any).firstName?.[0] || '').toUpperCase()}{((contact as any).lastName?.[0] || '').toUpperCase()}
              </div>
            }
            shape="circle"
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">{(contact as any).firstName} {(contact as any).lastName}</h1>
              <Badge className={`${getContactTypeColor(contactType)} border text-xs`}>
                {contactType.charAt(0).toUpperCase() + contactType.slice(1)}
              </Badge>
              <Badge className={`${getLeadStatusColor(leadStatus)} text-xs`}>
                {leadStatus.charAt(0).toUpperCase() + leadStatus.slice(1)}
              </Badge>
            </div>
            <p className="text-gray-500 text-sm truncate">{(contact as any).title || (contact as any).email}</p>
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

      {/* Mobile Quick Actions */}
      {isMobile && (contact as any).email && (
        <div className="flex gap-2 mb-4">
          {(contact as any).email && (
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => window.location.href = `mailto:${(contact as any).email}`}
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
          )}
          {(contact as any).phone && (
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => window.location.href = `tel:${(contact as any).phone}`}
            >
              <Phone className="h-4 w-4" />
              Call
            </Button>
          )}
          {(contact as any).phone && (
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => window.location.href = `sms:${(contact as any).phone}`}
            >
              <MessageSquare className="h-4 w-4" />
              Text
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          {isSectionVisible("contact-info") && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Name and Title - Inline Editable */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">First Name</Label>
                  <div>
                    <InlineEdit
                      value={(contact as any).firstName}
                      onSave={(val) => handleContactUpdate('firstName', val)}
                      emptyText="Add first name"
                      displayClassName="font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Last Name</Label>
                  <div>
                    <InlineEdit
                      value={(contact as any).lastName}
                      onSave={(val) => handleContactUpdate('lastName', val)}
                      emptyText="Add last name"
                      displayClassName="font-medium"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs text-gray-500">Title</Label>
                  <div>
                    <InlineEdit
                      value={(contact as any).title}
                      onSave={(val) => handleContactUpdate('title', val)}
                      emptyText="Add title"
                      placeholder="e.g., CEO, VP of Sales"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Details - Inline Editable */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <InlineEditEmail
                    value={(contact as any).email}
                    onSave={(val) => handleContactUpdate('email', val)}
                    emptyText="Add email"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <InlineEdit
                    value={(contact as any).phone}
                    onSave={(val) => handleContactUpdate('phone', val)}
                    type="phone"
                    emptyText="Add phone"
                  />
                  {(contact as any).phone && (
                    <a href={`tel:${(contact as any).phone}`} className="text-gray-400 hover:text-green-600">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                {(contact as any).linkedinUrl && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-gray-400" />
                    <a href={(contact as any).linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      LinkedIn Profile
                    </a>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Tags</span>
                  </div>
                  {!showTagInput && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTagInput(true)}
                      className="h-7 px-2 text-gray-500 hover:text-gray-700"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>

                {/* Tag input */}
                {showTagInput && (
                  <div className="flex gap-2 mb-3">
                    <Input
                      placeholder="Enter tag name..."
                      value={newTagValue}
                      onChange={(e) => setNewTagValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(newTagValue);
                        } else if (e.key === 'Escape') {
                          setShowTagInput(false);
                          setNewTagValue("");
                        }
                      }}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddTag(newTagValue)}
                      disabled={!newTagValue.trim()}
                      className="h-8"
                    >
                      Add
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowTagInput(false);
                        setNewTagValue("");
                      }}
                      className="h-8 px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Tags list */}
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: string, index: number) => (
                      <Badge key={index} variant="outline" className="bg-gray-50 pr-1 flex items-center gap-1 text-gray-700">
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:bg-gray-200 rounded p-0.5 transition-colors"
                          title={`Remove ${tag}`}
                        >
                          <X className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No tags added</p>
                )}
              </div>

              {/* Source */}
              {source && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Source:</span>
                    <span className="text-sm font-medium">{source.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              {(contact as any).notes && (
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    Notes
                  </h4>
                  <p className="text-gray-600 whitespace-pre-wrap">{(contact as any).notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Engagement Data - Only show if there's engagement data */}
          {isSectionVisible("engagement-history") && (customProps.totalDocumentViews || customProps.totalTimeSpentMinutes || customProps.location) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Engagement History
                  {customProps.migratedFromInvestorDatabase && (
                    <Badge variant="outline" className="ml-2 text-xs">Migrated from Investor DB</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {customProps.totalDocumentViews !== undefined && (
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <Eye className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-700">{customProps.totalDocumentViews}</div>
                      <div className="text-xs text-blue-600">Document Views</div>
                    </div>
                  )}
                  {customProps.totalTimeSpentMinutes !== undefined && (
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <Clock className="h-6 w-6 text-green-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-700">{formatTimeSpent(customProps.totalTimeSpentMinutes)}</div>
                      <div className="text-xs text-green-600">Time Spent</div>
                    </div>
                  )}
                  {customProps.location && (
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <MapPin className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                      <div className="text-lg font-bold text-purple-700 truncate" title={customProps.location}>{customProps.location}</div>
                      <div className="text-xs text-purple-600">Location</div>
                    </div>
                  )}
                  {customProps.firstSeenAt && (
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <Calendar className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                      <div className="text-lg font-bold text-orange-700">{new Date(customProps.firstSeenAt).toLocaleDateString()}</div>
                      <div className="text-xs text-orange-600">First Seen</div>
                    </div>
                  )}
                </div>

                {/* Additional engagement details */}
                <div className="mt-4 pt-4 border-t space-y-2">
                  {customProps.lastSeenAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Last Activity</span>
                      <span className="font-medium">{new Date(customProps.lastSeenAt).toLocaleString()}</span>
                    </div>
                  )}
                  {customProps.lastContactDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Last Contact Date</span>
                      <span className="font-medium">{new Date(customProps.lastContactDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {customProps.nextFollowUpDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Next Follow-up</span>
                      <span className="font-medium text-blue-600">{new Date(customProps.nextFollowUpDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {customProps.isPotentialVpn && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Potential VPN detected</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Email Activity */}
          {isSectionVisible("email-activity") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmailList
                contactId={parseInt(id!)}
                contactEmail={(contact as any).email}
              />
            </CardContent>
          </Card>
          )}

          {/* Tasks */}
          {isSectionVisible("tasks") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Tasks
              </CardTitle>
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
                objectType="contact"
                objectId={parseInt(id!)}
                onEditTask={(task) => setEditingTask(task)}
              />
            </CardContent>
          </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Associations */}
          {isSectionVisible("associated-deals") && (
          <Card>
            <CardHeader><CardTitle className="text-base">Associations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Company */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company</h4>
                  {!(contact as any).company && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLinkCompanyOpen(true)}
                      className="h-6 px-2 text-gray-500 hover:text-gray-700"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
                {(contact as any).company ? (
                  <Link
                    href={`/companies/${(contact as any).company.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{(contact as any).company.name}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  </Link>
                ) : (
                  <p className="text-sm text-gray-500 py-2">No company linked</p>
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
                {(contact as any).deals?.length > 0 ? (
                  <div className="space-y-2">
                    {(contact as any).deals.map((deal: any) => (
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
                  <p className="text-sm text-gray-500 py-2">No deals associated</p>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Quick Stats */}
          {isSectionVisible("quick-info") && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Quick Info</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{new Date((contact as any).createdAt).toLocaleDateString()}</span>
              </div>
              {(contact as any).lastActivityDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Activity</span>
                  <span>{new Date((contact as any).lastActivityDate).toLocaleDateString()}</span>
                </div>
              )}
              {(contact as any).lifecycleStage && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Lifecycle Stage</span>
                  <span className="capitalize">{(contact as any).lifecycleStage}</span>
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      {/* Task Dialogs */}
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        objectType="contact"
        objectId={parseInt(id!)}
      />

      <TaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        objectType="contact"
        objectId={parseInt(id!)}
      />

      {/* Detail Page Customizer */}
      <DetailPageCustomizer
        objectType="contact"
        open={isCustomizerOpen}
        onOpenChange={setIsCustomizerOpen}
      />

      {/* Link Company Dialog */}
      <Dialog open={isLinkCompanyOpen} onOpenChange={setIsLinkCompanyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Company</DialogTitle>
            <DialogDescription>
              Associate a company with this contact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search companies..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Company List */}
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {filteredCompanies.length > 0 ? (
                filteredCompanies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => setSelectedCompanyId(company.id.toString())}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 text-left transition-colors ${
                      selectedCompanyId === company.id.toString() ? "bg-blue-50 border-blue-200" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{company.name}</p>
                      {company.industry && (
                        <p className="text-xs text-gray-500 truncate">{company.industry}</p>
                      )}
                    </div>
                    {selectedCompanyId === company.id.toString() && (
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {companySearch ? "No companies match your search" : "No available companies"}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkCompanyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => linkCompanyMutation.mutate(parseInt(selectedCompanyId))}
              disabled={!selectedCompanyId || linkCompanyMutation.isPending}
            >
              {linkCompanyMutation.isPending ? "Linking..." : "Link Company"}
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
              Associate a deal with this contact.
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

            {/* Role Selection */}
            {selectedDealId && (
              <div>
                <Label className="text-sm text-gray-700">Contact Role</Label>
                <Select value={dealRole} onValueChange={setDealRole}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decision_maker">Decision Maker</SelectItem>
                    <SelectItem value="influencer">Influencer</SelectItem>
                    <SelectItem value="champion">Champion</SelectItem>
                    <SelectItem value="end_user">End User</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDealOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => linkDealMutation.mutate({ dealId: parseInt(selectedDealId), role: dealRole })}
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
