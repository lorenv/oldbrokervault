import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InlineEdit, InlineEditEmail } from "@/components/ui/inline-edit";
import { TablePagination } from "@/components/ui/pagination";
import { useContactFilters } from "@/hooks/use-contact-filters";
import { ContactsColumnConfig } from "@/components/crm/contacts-column-config";
import { ContactsFilterBuilderIntegration } from "@/components/crm/contacts-filter-builder-integration";
import {
  Plus,
  Search,
  User,
  Mail,
  Building2,
  Phone,
  RefreshCw,
  Download,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Trash2,
  Pencil,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ContactsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchString = useSearch();

  // Use the contact filters hook
  const {
    filters,
    updateFilter,
    clearFilters,
    activeFilterCount,
    sorting,
    toggleSort,
    columns,
    visibleColumns,
    toggleColumnVisibility,
    reorderColumns,
    buildQueryParams,
  } = useContactFilters();

  // Parse contact type from URL params
  const initialContactType = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('contactType') || '';
  }, [searchString]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({ email: "", firstName: "", lastName: "", phone: "", companyId: "" });
  const [hasMigrated, setHasMigrated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditProperty, setBulkEditProperty] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState<string>("");
  const [bulkEditTagMode, setBulkEditTagMode] = useState<"add" | "remove">("add");
  const [bulkEditTags, setBulkEditTags] = useState<string[]>([]);
  const [newBulkTag, setNewBulkTag] = useState("");

  // Update filter when URL param changes
  useEffect(() => {
    if (initialContactType) {
      updateFilter('contactType', initialContactType);
    }
  }, [initialContactType, updateFilter]);

  // Fetch contacts with filters
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/crm/contacts", buildQueryParams()],
    queryFn: () => {
      const queryString = buildQueryParams();
      return apiRequest("GET", `/api/crm/contacts?${queryString}`).then(res => res.json());
    },
  });

  // Fetch companies for inline editing and filters
  const { data: companiesData } = useQuery({
    queryKey: ["/api/crm/companies"],
    queryFn: () => apiRequest("GET", "/api/crm/companies").then(res => res.json()),
  });
  const companies = (companiesData as any)?.companies || [];

  // Check for investor contacts that could be migrated
  const { data: investorData } = useQuery({
    queryKey: ["/api/investor-contacts"],
    queryFn: () => apiRequest("GET", "/api/investor-contacts?limit=1").then(res => res.json()),
  });

  const createContactMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/crm/contacts", { body: data }).then(res => res.json()),
    onSuccess: () => {
      // Invalidate all contact-related queries to ensure dropdowns and lists are fresh
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      setIsCreateDialogOpen(false);
      setNewContact({ email: "", firstName: "", lastName: "", phone: "", companyId: "" });
      toast({ title: "Contact created" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact",
        variant: "destructive"
      });
    },
  });

  const migrateMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/crm/migrate-contacts", {}).then(res => res.json()),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"], refetchType: 'all' });
      setHasMigrated(true);
      if (result.contactsMigrated > 0) {
        toast({
          title: "Migration complete",
          description: `Imported ${result.contactsMigrated} contacts and ${result.companiesCreated} companies`
        });
      } else {
        toast({ title: "No contacts to migrate", description: result.message });
      }
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Migration failed",
        description: error.message || "Failed to migrate contacts",
        variant: "destructive"
      });
    },
  });

  // Update contact mutation (for inline editing)
  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: Record<string, any> }) =>
      apiRequest("PATCH", `/api/crm/contacts/${contactId}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
    },
  });

  // Helper for inline contact updates
  const handleContactUpdate = useCallback(async (contactId: number, field: string, value: string | number | null) => {
    await updateContactMutation.mutateAsync({ contactId, data: { [field]: value } });
  }, [updateContactMutation]);

  // Auto-migrate on first load if no contacts
  useEffect(() => {
    const contacts = (data as any)?.contacts || [];
    const investorContacts = (investorData as any)?.contacts || [];

    if (!hasMigrated && !isLoading && contacts.length === 0 && investorContacts.length > 0) {
      migrateMutation.mutate();
    }
  }, [data, investorData, isLoading, hasMigrated]);

  const allContacts = (data as any)?.contacts || [];
  const investorContacts = (investorData as any)?.contacts || [];
  const hasInvestorContacts = investorContacts.length > 0;
  const showMigrateButton = hasInvestorContacts && allContacts.length === 0 && !migrateMutation.isPending;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.contactType, filters.leadStatus, filters.companies]);

  // Pagination calculations
  const totalItems = allContacts.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const contacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allContacts.slice(start, start + pageSize);
  }, [allContacts, currentPage, pageSize]);

  // Get contact type badge color
  const getContactTypeColor = (type: string) => {
    switch (type) {
      case 'buyer': return 'bg-green-100 text-green-700';
      case 'seller': return 'bg-blue-100 text-blue-700';
      case 'advisor': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Get sort icon for column
  const getSortIcon = (field: string) => {
    if (sorting.field !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    return sorting.direction === 'asc'
      ? <ArrowUp className="h-3 w-3 text-blue-600" />
      : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  // Export contacts to CSV
  const handleExport = () => {
    if (allContacts.length === 0) {
      toast({ title: "No contacts to export", variant: "destructive" });
      return;
    }

    const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "Title", "Type", "Status", "Source", "Last Activity", "Created"];
    const rows = allContacts.map((c: any) => [
      c.firstName || "",
      c.lastName || "",
      c.email || "",
      c.phone || "",
      c.company?.name || "",
      c.title || "",
      c.contactType || "",
      c.leadStatus || "",
      c.source || "",
      c.lastActivityDate ? new Date(c.lastActivityDate).toLocaleDateString() : "",
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `contacts-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: `Exported ${allContacts.length} contacts` });
  };

  // Selection handlers
  const toggleSelectContact = (contactId: number) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((c: any) => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedContacts(new Set());
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    const promises = Array.from(selectedContacts).map(id =>
      apiRequest("DELETE", `/api/crm/contacts/${id}`)
    );
    try {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      toast({ title: `${selectedContacts.size} contact(s) deleted` });
      clearSelection();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete some contacts", variant: "destructive" });
    }
  };

  const handleBulkEdit = async () => {
    if (selectedContacts.size === 0 || !bulkEditProperty) return;

    // For tags, check that there are tags selected
    if (bulkEditProperty === 'tags' && bulkEditTags.length === 0) return;
    // For other properties, check that a value is selected
    if (bulkEditProperty !== 'tags' && !bulkEditValue) return;

    try {
      if (bulkEditProperty === 'tags') {
        // Handle tags specially - need to get current tags and add/remove
        const selectedContactsList = allContacts.filter((c: any) => selectedContacts.has(c.id));

        const promises = selectedContactsList.map((contact: any) => {
          const currentTags = contact.tags || [];
          let newTags: string[];

          if (bulkEditTagMode === 'add') {
            // Add tags that aren't already present
            newTags = [...new Set([...currentTags, ...bulkEditTags])];
          } else {
            // Remove specified tags
            newTags = currentTags.filter((tag: string) => !bulkEditTags.includes(tag));
          }

          return apiRequest("PATCH", `/api/crm/contacts/${contact.id}`, { body: { tags: newTags } });
        });

        await Promise.all(promises);
      } else {
        const updateData: Record<string, any> = {};
        if (bulkEditProperty === 'leadStatus') {
          updateData.leadStatus = bulkEditValue;
        } else if (bulkEditProperty === 'contactType') {
          updateData.contactType = bulkEditValue;
        } else if (bulkEditProperty === 'source') {
          updateData.source = bulkEditValue;
        }

        const promises = Array.from(selectedContacts).map(id =>
          apiRequest("PATCH", `/api/crm/contacts/${id}`, { body: updateData })
        );

        await Promise.all(promises);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      toast({ title: `${selectedContacts.size} contact(s) updated` });
      clearSelection();
      setIsBulkEditOpen(false);
      setBulkEditProperty("");
      setBulkEditValue("");
      setBulkEditTags([]);
      setNewBulkTag("");
    } catch (error) {
      toast({ title: "Error", description: "Failed to update some contacts", variant: "destructive" });
    }
  };

  const handleBulkExport = () => {
    const selectedContactsList = allContacts.filter((c: any) => selectedContacts.has(c.id));
    if (selectedContactsList.length === 0) return;

    const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "Title", "Type", "Status", "Source", "Created"];
    const rows = selectedContactsList.map((c: any) => [
      c.firstName || "",
      c.lastName || "",
      c.email || "",
      c.phone || "",
      c.company?.name || "",
      c.title || "",
      c.contactType || "",
      c.leadStatus || "",
      c.source || "",
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `contacts-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: `Exported ${selectedContactsList.length} contact(s)` });
  };

  // Render cell content based on column
  const renderCell = (contact: any, columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2 group">
            {contact.avatarUrl ? (
              <img
                src={contact.avatarUrl}
                alt={`${contact.firstName} ${contact.lastName}`}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-medium flex-shrink-0">
                {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
              </div>
            )}
            <span className="font-medium text-gray-900 group-hover:text-blue-600 truncate">
              {contact.firstName} {contact.lastName}
            </span>
          </Link>
        );
      case 'email':
        return (
          <InlineEditEmail
            value={contact.email}
            onSave={(val) => handleContactUpdate(contact.id, 'email', val || null)}
            emptyText="Add email"
          />
        );
      case 'phone':
        return (
          <div className="flex items-center gap-1">
            <InlineEdit
              value={contact.phone}
              onSave={(val) => handleContactUpdate(contact.id, 'phone', val || null)}
              type="phone"
              emptyText="Add phone"
              displayClassName="text-gray-600"
            />
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="text-gray-400 hover:text-green-600 ml-1 flex-shrink-0">
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        );
      case 'company':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={contact.companyId?.toString() || "none"}
              onValueChange={async (val) => {
                const companyId = val === "none" ? null : parseInt(val);
                await handleContactUpdate(contact.id, 'companyId', companyId);
              }}
            >
              <SelectTrigger className="h-7 text-sm border-0 bg-transparent hover:bg-gray-100 px-2 -mx-2 min-w-[120px]">
                <SelectValue>
                  {contact.company?.name || <span className="text-gray-400 italic">Add company</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-gray-400">No company</span>
                </SelectItem>
                {companies.map((company: any) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'contactType':
        return contact.contactType ? (
          <Badge className={`${getContactTypeColor(contact.contactType)} text-xs`}>
            {contact.contactType.charAt(0).toUpperCase() + contact.contactType.slice(1)}
          </Badge>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        );
      case 'leadStatus':
        return contact.leadStatus ? (
          <Badge variant="outline" className="text-xs">
            {contact.leadStatus.charAt(0).toUpperCase() + contact.leadStatus.slice(1)}
          </Badge>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        );
      case 'title':
        return (
          <InlineEdit
            value={contact.title}
            onSave={(val) => handleContactUpdate(contact.id, 'title', val || null)}
            emptyText="Add title"
            displayClassName="text-gray-600 text-sm"
          />
        );
      case 'source':
        return contact.source ? (
          <span className="text-sm text-gray-600">{contact.source.replace(/_/g, ' ')}</span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        );
      case 'lastActivity':
        if (!contact.lastActivityDate) {
          return <span className="text-gray-400 text-sm">Never</span>;
        }
        const activityDate = new Date(contact.lastActivityDate);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        let timeAgo = '';
        let colorClass = 'text-green-600';

        if (diffDays === 0) {
          timeAgo = 'Today';
        } else if (diffDays === 1) {
          timeAgo = 'Yesterday';
        } else if (diffDays < 7) {
          timeAgo = `${diffDays}d ago`;
        } else if (diffDays < 30) {
          timeAgo = `${Math.floor(diffDays / 7)}w ago`;
          colorClass = 'text-yellow-600';
        } else if (diffDays < 90) {
          timeAgo = `${Math.floor(diffDays / 30)}mo ago`;
          colorClass = 'text-orange-500';
        } else {
          timeAgo = activityDate.toLocaleDateString();
          colorClass = 'text-red-500';
        }

        return (
          <span className={`text-sm flex items-center gap-1 ${colorClass}`}>
            <Clock className="h-3 w-3" />
            {timeAgo}
          </span>
        );
      case 'createdAt':
        return (
          <span className="text-sm text-gray-600">
            {new Date(contact.createdAt).toLocaleDateString()}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Contacts</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search contacts..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={filters.contactType || "all"}
              onValueChange={(value) => updateFilter('contactType', value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[120px] sm:w-[140px] h-8">
                <Filter className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="buyer">Buyers</SelectItem>
                <SelectItem value="seller">Sellers</SelectItem>
                <SelectItem value="advisor">Advisors</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <ContactsFilterBuilderIntegration
              filters={filters}
              updateFilter={updateFilter}
              clearFilters={clearFilters}
              activeFilterCount={activeFilterCount}
            />
            <ContactsColumnConfig
              columns={columns}
              onToggleVisibility={toggleColumnVisibility}
              onReorder={reorderColumns}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={contacts.length === 0}
              title="Export to CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {showMigrateButton && (
              <Button variant="outline" onClick={() => migrateMutation.mutate()} disabled={migrateMutation.isPending} className="flex-1 sm:flex-none h-8">
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Import</span>
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} className="flex-1 sm:flex-none h-8">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Contact</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-gray-500">Active filters:</span>
          {filters.contactType && (
            <Badge variant="secondary" className="gap-1">
              Type: {filters.contactType}
              <button onClick={() => updateFilter('contactType', '')} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.leadStatus.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.leadStatus.length}
              <button onClick={() => updateFilter('leadStatus', [])} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.companies.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              Companies: {filters.companies.length}
              <button onClick={() => updateFilter('companies', [])} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
            Clear all
          </Button>
        </div>
      )}

      {isLoading || migrateMutation.isPending ? (
        <div className="space-y-2">
          {migrateMutation.isPending && (
            <div className="text-center py-4 text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Importing contacts from investor database...</p>
            </div>
          )}
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : contacts.length > 0 ? (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {contacts.map((contact: any) => (
              <Link key={contact.id} href={`/contacts/${contact.id}`}>
                <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
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
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {contact.firstName} {contact.lastName}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{contact.email}</p>
                    </div>
                    {contact.contactType && (
                      <Badge className={`${getContactTypeColor(contact.contactType)} text-xs`}>
                        {contact.contactType.charAt(0).toUpperCase() + contact.contactType.slice(1)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                    {contact.company?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {contact.company.name}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Bulk Actions Bar */}
          {selectedContacts.size > 0 && (
            <div className="hidden md:flex bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setIsBulkEditOpen(true)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={handleBulkExport}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8">
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="py-2 px-3 w-10">
                      <Checkbox
                        checked={contacts.length > 0 && selectedContacts.size === contacts.length}
                        onCheckedChange={toggleSelectAll}
                        className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                      />
                    </th>
                    {visibleColumns.map((column) => (
                      <th
                        key={column.id}
                        className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                        style={{
                          width: column.id === 'name' ? '22%' :
                                 column.id === 'email' ? '22%' :
                                 column.id === 'phone' ? '14%' :
                                 column.id === 'company' ? '18%' :
                                 '12%'
                        }}
                        onClick={() => toggleSort(column.id)}
                      >
                        <div className="flex items-center gap-1">
                          {column.label}
                          {getSortIcon(column.id)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact: any) => (
                    <tr key={contact.id} className={`border-b hover:bg-gray-50/50 ${selectedContacts.has(contact.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="py-2 px-3 w-10">
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => toggleSelectContact(contact.id)}
                          className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                        />
                      </td>
                      {visibleColumns.map((column) => (
                        <td key={column.id} className="py-2 px-3">
                          {renderCell(contact, column.id)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No contacts yet</h3>
          <p className="text-gray-500 mt-1">Get started by adding your first contact.</p>
          <div className="flex justify-center gap-3 mt-4">
            {hasInvestorContacts && (
              <Button variant="outline" onClick={() => migrateMutation.mutate()} disabled={migrateMutation.isPending}>
                <Download className="h-4 w-4 mr-2" />
                Import from Investor Database
              </Button>
            )}
            <Button onClick={() => setIsCreateDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Contact</Button>
          </div>
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Contact</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={newContact.firstName} onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={newContact.lastName} onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Select
                value={newContact.companyId || "none"}
                onValueChange={(val) => setNewContact({ ...newContact, companyId: val === "none" ? "" : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No company</SelectItem>
                  {companies.map((company: any) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const contactData = {
                  ...newContact,
                  companyId: newContact.companyId ? parseInt(newContact.companyId) : null,
                };
                createContactMutation.mutate(contactData);
              }}
              disabled={!newContact.email.trim() || createContactMutation.isPending}
            >
              {createContactMutation.isPending ? "Creating..." : "Create Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={isBulkEditOpen} onOpenChange={(open) => {
        setIsBulkEditOpen(open);
        if (!open) {
          setBulkEditProperty("");
          setBulkEditValue("");
          setBulkEditTags([]);
          setNewBulkTag("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Property to Edit</Label>
              <Select value={bulkEditProperty} onValueChange={(val) => {
                setBulkEditProperty(val);
                setBulkEditValue("");
                setBulkEditTags([]);
                setNewBulkTag("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leadStatus">Lead Status</SelectItem>
                  <SelectItem value="contactType">Contact Type</SelectItem>
                  <SelectItem value="source">Source</SelectItem>
                  <SelectItem value="tags">Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkEditProperty && bulkEditProperty !== 'tags' && (
              <div className="space-y-2">
                <Label>New Value</Label>
                {bulkEditProperty === 'leadStatus' && (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="unqualified">Unqualified</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {bulkEditProperty === 'contactType' && (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyer">Buyer</SelectItem>
                      <SelectItem value="seller">Seller</SelectItem>
                      <SelectItem value="advisor">Advisor</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {bulkEditProperty === 'source' && (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {bulkEditProperty === 'tags' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={bulkEditTagMode} onValueChange={(val: "add" | "remove") => setBulkEditTagMode(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add Tags</SelectItem>
                      <SelectItem value="remove">Remove Tags</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tags to {bulkEditTagMode === 'add' ? 'Add' : 'Remove'}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter tag name..."
                      value={newBulkTag}
                      onChange={(e) => setNewBulkTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newBulkTag.trim()) {
                          e.preventDefault();
                          if (!bulkEditTags.includes(newBulkTag.trim())) {
                            setBulkEditTags([...bulkEditTags, newBulkTag.trim()]);
                          }
                          setNewBulkTag("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (newBulkTag.trim() && !bulkEditTags.includes(newBulkTag.trim())) {
                          setBulkEditTags([...bulkEditTags, newBulkTag.trim()]);
                          setNewBulkTag("");
                        }
                      }}
                      disabled={!newBulkTag.trim()}
                    >
                      Add
                    </Button>
                  </div>
                  {bulkEditTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {bulkEditTags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="pr-1 flex items-center gap-1 text-sm">
                          {tag}
                          <button
                            onClick={() => setBulkEditTags(bulkEditTags.filter((_, i) => i !== index))}
                            className="ml-0.5 hover:bg-gray-200 rounded p-0.5 transition-colors"
                          >
                            <X className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkEdit}
              disabled={!bulkEditProperty || (bulkEditProperty === 'tags' ? bulkEditTags.length === 0 : !bulkEditValue)}
            >
              Update {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
