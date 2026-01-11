import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";
import { InlineEdit } from "@/components/ui/inline-edit";
import { DetailPageCustomizer } from "@/components/crm/detail-page-customizer";
import { useDetailPageLayout } from "@/hooks/use-detail-page-layout";
import { ArrowLeft, Building2, Globe, MapPin, Phone, Users, Briefcase, CheckSquare, Plus, Mail, ExternalLink, Settings2 } from "lucide-react";

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
        <h2 className="text-xl font-semibold">Company not found</h2>
        <Button asChild className="mt-4"><Link href="/companies">Back to Companies</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/companies"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold truncate">{(company as any).name}</h1>
            {(company as any).industry && <p className="text-gray-500 text-sm">{(company as any).industry}</p>}
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
                <div className="flex-1">
                  <Label className="text-xs text-gray-500">Location</Label>
                  <p className="text-sm text-gray-600">
                    {[(company as any).city, (company as any).state, (company as any).country].filter(Boolean).join(", ") || "Not set"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
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

          {isSectionVisible("associated-contacts") && (
          <Card>
            <CardHeader><CardTitle>Associated Contacts</CardTitle></CardHeader>
            <CardContent>
              {(company as any).contacts?.length > 0 ? (
                <div className="space-y-3">
                  {(company as any).contacts.map((contact: any) => (
                    <div key={contact.id} className="p-3 rounded-lg border hover:bg-gray-50/50 transition-colors">
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
                          <Link href={`/contacts/${contact.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                            {contact.firstName} {contact.lastName}
                          </Link>
                          {contact.title && (
                            <p className="text-sm text-gray-500">{contact.title}</p>
                          )}
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
                                <a href={`mailto:${contact.email}`} className="text-blue-500 hover:text-blue-600 ml-1">
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
                                <a href={`tel:${contact.phone}`} className="text-green-500 hover:text-green-600 ml-1">
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
                <p className="text-gray-500 text-center py-4">No contacts associated</p>
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
        </div>

        <div>
          {isSectionVisible("deals") && (
          <Card>
            <CardHeader><CardTitle>Deals</CardTitle></CardHeader>
            <CardContent>
              {(company as any).deals?.length > 0 ? (
                <div className="space-y-2">
                  {(company as any).deals.map((deal: any) => (
                    <Link key={deal.id} href={`/deals/${deal.id}`} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                      <Briefcase className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">{deal.name}</p>
                        {deal.amount && <p className="text-sm text-green-600">${parseFloat(deal.amount).toLocaleString()}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No deals yet</p>
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
    </div>
  );
}
