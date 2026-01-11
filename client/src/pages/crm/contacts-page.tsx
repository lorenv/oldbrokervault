import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Search, User, Mail, Building2, Phone, RefreshCw, Download, Filter, X } from "lucide-react";
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

  // Parse contact type from URL params
  const initialContactType = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('contactType') || '';
  }, [searchString]);

  const [searchQuery, setSearchQuery] = useState("");
  const [contactTypeFilter, setContactTypeFilter] = useState(initialContactType);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({ email: "", firstName: "", lastName: "", phone: "" });
  const [hasMigrated, setHasMigrated] = useState(false);

  // Update filter when URL param changes
  useEffect(() => {
    setContactTypeFilter(initialContactType);
  }, [initialContactType]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/crm/contacts", searchQuery, contactTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (contactTypeFilter) params.append('contactType', contactTypeFilter);
      return apiRequest("GET", `/api/crm/contacts?${params.toString()}`).then(res => res.json());
    },
  });

  // Check for investor contacts that could be migrated
  const { data: investorData } = useQuery({
    queryKey: ["/api/investor-contacts"],
    queryFn: () => apiRequest("GET", "/api/investor-contacts?limit=1").then(res => res.json()),
  });

  const createContactMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/crm/contacts", { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setIsCreateDialogOpen(false);
      setNewContact({ email: "", firstName: "", lastName: "", phone: "" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
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

  // Auto-migrate on first load if no contacts
  useEffect(() => {
    const contacts = (data as any)?.contacts || [];
    const investorContacts = (investorData as any)?.contacts || [];

    if (!hasMigrated && !isLoading && contacts.length === 0 && investorContacts.length > 0) {
      migrateMutation.mutate();
    }
  }, [data, investorData, isLoading, hasMigrated]);

  const contacts = (data as any)?.contacts || [];
  const investorContacts = (investorData as any)?.contacts || [];
  const hasInvestorContacts = investorContacts.length > 0;
  const showMigrateButton = hasInvestorContacts && contacts.length === 0 && !migrateMutation.isPending;

  return (
    <div className="p-4 md:p-6">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your contact relationships</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search contacts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full sm:w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Select value={contactTypeFilter || "all"} onValueChange={(value) => setContactTypeFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-[120px] sm:w-[140px]">
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
            {contactTypeFilter && (
              <Button variant="ghost" size="sm" onClick={() => setContactTypeFilter("")} className="h-8 px-2">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showMigrateButton && (
              <Button variant="outline" onClick={() => migrateMutation.mutate()} disabled={migrateMutation.isPending} className="flex-1 sm:flex-none">
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Import from Investor DB</span>
                <span className="sm:hidden">Import</span>
              </Button>
            )}
            <Button onClick={() => setIsCreateDialogOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Contact</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </div>

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

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Phone</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact: any) => (
                  <tr key={contact.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2">
                        {contact.avatarUrl ? (
                          <img
                            src={contact.avatarUrl}
                            alt={`${contact.firstName} ${contact.lastName}`}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium">
                            {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-blue-600 hover:underline">
                          {contact.firstName} {contact.lastName}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{contact.email}</td>
                    <td className="py-3 px-4 text-gray-500">{contact.company?.name || "-"}</td>
                    <td className="py-3 px-4 text-gray-500">{contact.phone || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createContactMutation.mutate(newContact)} disabled={!newContact.email.trim() || createContactMutation.isPending}>
              {createContactMutation.isPending ? "Creating..." : "Create Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
