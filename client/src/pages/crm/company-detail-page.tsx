import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";
import { EmailList } from "@/components/crm/email-list";
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
import { ArrowLeft, Building2, Globe, MapPin, Phone, Users, Briefcase, CheckSquare, Plus, Mail, ExternalLink, Settings2, ChevronRight, User, Search, Check } from "lucide-react";
import { PhotoUpload } from "@/components/crm/photo-upload";

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

  // Association dialog state
  const [isLinkContactOpen, setIsLinkContactOpen] = useState(false);
  const [isLinkDealOpen, setIsLinkDealOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [dealSearch, setDealSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedDealId, setSelectedDealId] = useState<string>("");

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
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
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
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
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
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900 truncate">{(company as any).name}</h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {isSectionVisible("company-info") && (
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <InlineEdit
                  value={(company as any).website}
                  onSave={(val) => handleCompanyUpdate('website', val)}
                  type="text"
                  emptyText="Add website"
                  placeholder="https://example.com"
                  displayClassName="text-blue-600"
                />
                {(company as any).website && (
                  <a
                    href={ensureProtocol((company as any).website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-600"
                    title="Open website in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <InlineEdit
                  value={(company as any).phone}
                  onSave={(val) => handleCompanyUpdate('phone', val)}
                  type="phone"
                  emptyText="Add phone"
                />
                {(company as any).phone && (
                  <a href={`tel:${(company as any).phone}`} className="text-gray-400 hover:text-green-600">
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                <div className="flex-1 space-y-0.5">
                  <Label className="text-xs text-gray-500">Location</Label>
                  <p className="text-sm text-gray-600">
                    {[(company as any).city, (company as any).state, (company as any).country].filter(Boolean).join(", ") || "Not set"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Briefcase className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                <div className="flex-1 space-y-0.5">
                  <Label className="text-xs text-gray-500">Industry</Label>
                  <InlineEdit
                    value={(company as any).industry}
                    onSave={(val) => handleCompanyUpdate('industry', val)}
                    emptyText="Add industry"
                    placeholder="e.g., Technology"
                  />
                </div>
              </div>
              {(company as any).description && (
                <div className="pt-4 border-t">
                  <p className="text-gray-600">{(company as any).description}</p>
                </div>
              )}
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
                objectType="company"
                objectId={parseInt(id!)}
                onEditTask={(task) => setEditingTask(task)}
              />
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
              <EmailList companyId={parseInt(id!)} />
            </CardContent>
          </Card>
          )}
        </div>

        <div className="space-y-6">
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
