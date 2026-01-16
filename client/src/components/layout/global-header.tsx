import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Kanban,
  Contact,
  Building2,
  CheckSquare,
  Settings,
  Menu,
  ChevronLeft,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from "@/components/ui/notification-bell";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface QuickCreateDialogProps {
  type: "deal" | "contact" | "company" | "task" | null;
  onClose: () => void;
}

function QuickCreateDialog({ type, onClose }: QuickCreateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Form states
  const [dealForm, setDealForm] = useState({ name: "", amount: "", ownerId: "", contactId: "" });
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [companyForm, setCompanyForm] = useState({ name: "", website: "" });
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "", assignedTo: "" });
  const [contactSearch, setContactSearch] = useState("");

  // Fetch team members for owner/assignee dropdowns
  const { data: teamMembers = [] } = useQuery<Array<{ id: number; email: string; firstName: string | null; lastName: string | null; profilePhoto?: string | null }>>({
    queryKey: ["/api/team-members"],
    enabled: type === "deal" || type === "task",
  });

  // Fetch contacts for deal creation
  const { data: contactsData } = useQuery({
    queryKey: ["/api/crm/contacts"],
    enabled: type === "deal",
  });
  const contacts = (contactsData as any)?.contacts || [];

  // Filter contacts based on search
  const filteredContacts = contacts.filter((c: any) => {
    if (!contactSearch) return true;
    const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    return name.includes(contactSearch.toLowerCase()) || c.email?.toLowerCase().includes(contactSearch.toLowerCase());
  });

  // Mutations
  const createDealMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/deals", { body: data }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      toast({ title: "Deal created" });
      onClose();
      navigate(`/deals/${data.id}`);
    },
    onError: () => toast({ title: "Failed to create deal", variant: "destructive" }),
  });

  const createContactMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/contacts", { body: data }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Contact created" });
      onClose();
      navigate(`/contacts/${data.id}`);
    },
    onError: () => toast({ title: "Failed to create contact", variant: "destructive" }),
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/companies", { body: data }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      toast({ title: "Company created" });
      onClose();
      navigate(`/companies/${data.id}`);
    },
    onError: () => toast({ title: "Failed to create company", variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/tasks", { body: data }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      toast({ title: "Task created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
  });

  const handleSubmit = () => {
    switch (type) {
      case "deal":
        if (!dealForm.name.trim()) return;
        createDealMutation.mutate({
          name: dealForm.name,
          amount: dealForm.amount || null,
          ownerId: dealForm.ownerId ? parseInt(dealForm.ownerId) : null,
          primaryContactId: dealForm.contactId ? parseInt(dealForm.contactId) : null,
        });
        break;
      case "contact":
        if (!contactForm.email.trim()) return;
        createContactMutation.mutate({
          firstName: contactForm.firstName,
          lastName: contactForm.lastName,
          email: contactForm.email,
          phone: contactForm.phone || null,
        });
        break;
      case "company":
        if (!companyForm.name.trim()) return;
        createCompanyMutation.mutate(companyForm);
        break;
      case "task":
        if (!taskForm.title.trim()) return;
        createTaskMutation.mutate({
          title: taskForm.title,
          dueDate: taskForm.dueDate || null,
          assignedTo: taskForm.assignedTo ? parseInt(taskForm.assignedTo) : null,
        });
        break;
    }
  };

  const isPending = createDealMutation.isPending || createContactMutation.isPending ||
                    createCompanyMutation.isPending || createTaskMutation.isPending;

  const getTitle = () => {
    switch (type) {
      case "deal": return "Quick Create Deal";
      case "contact": return "Quick Create Contact";
      case "company": return "Quick Create Company";
      case "task": return "Quick Create Task";
      default: return "";
    }
  };

  return (
    <Dialog open={!!type} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {type === "deal" && (
            <>
              <div className="space-y-2">
                <Label>Deal Name *</Label>
                <Input
                  value={dealForm.name}
                  onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })}
                  placeholder="e.g., Acme Corp Acquisition"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type="number"
                  value={dealForm.amount}
                  onChange={(e) => setDealForm({ ...dealForm, amount: e.target.value })}
                  placeholder="e.g., 500000"
                />
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={dealForm.ownerId} onValueChange={(v) => setDealForm({ ...dealForm, ownerId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id.toString()}>
                        <div className="flex items-center gap-2">
                          {member.profilePhoto ? (
                            <img src={member.profilePhoto} alt="" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-medium">
                              {(member.firstName?.[0] || member.email[0] || '').toUpperCase()}
                            </div>
                          )}
                          <span>{member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : member.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contact</Label>
                <Select value={dealForm.contactId} onValueChange={(v) => setDealForm({ ...dealForm, contactId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 sticky top-0 bg-white border-b">
                      <Input
                        placeholder="Search contacts..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        className="h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {filteredContacts.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-gray-500 text-center">No contacts found</div>
                    ) : (
                      filteredContacts.slice(0, 20).map((c: any) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          <div className="flex items-center gap-2">
                            {c.avatarUrl ? (
                              <img src={c.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-medium">
                                {(c.firstName?.[0] || '').toUpperCase()}{(c.lastName?.[0] || '').toUpperCase()}
                              </div>
                            )}
                            <span>{c.firstName} {c.lastName}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {type === "contact" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={contactForm.firstName}
                    onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={contactForm.lastName}
                    onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="e.g., +1 (555) 123-4567"
                />
              </div>
            </>
          )}
          {type === "company" && (
            <>
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
            </>
          )}
          {type === "task" && (
            <>
              <div className="space-y-2">
                <Label>Task Title *</Label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={taskForm.assignedTo} onValueChange={(v) => setTaskForm({ ...taskForm, assignedTo: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id.toString()}>
                        <div className="flex items-center gap-2">
                          {member.profilePhoto ? (
                            <img src={member.profilePhoto} alt="" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-medium">
                              {(member.firstName?.[0] || member.email[0] || '').toUpperCase()}
                            </div>
                          )}
                          <span>{member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : member.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SearchResult {
  type: "deal" | "contact" | "company";
  id: number;
  title: string;
  subtitle?: string;
}

export function GlobalHeader() {
  const [location, navigate] = useLocation();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<"all" | "deal" | "contact" | "company">("all");
  const [quickCreateType, setQuickCreateType] = useState<"deal" | "contact" | "company" | "task" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Check if we're on a detail page
  const isDetailPage = /^\/(deals|contacts|companies)\/\d+/.test(location);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchFocused(true);
      }
      // Close search on Escape
      if (e.key === "Escape" && searchFocused) {
        setSearchFocused(false);
        setSearchQuery("");
        setSearchFilter("all");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchFocused]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
        setSearchFilter("all");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global search query
  const { data: searchResults } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/crm/search", searchQuery, searchFilter],
    queryFn: () => {
      const params = new URLSearchParams({ q: searchQuery });
      if (searchFilter !== "all") params.set("type", searchFilter);
      return apiRequest("GET", `/api/crm/search?${params.toString()}`).then(r => r.json());
    },
    enabled: searchQuery.length >= 2,
  });

  const allResults = searchResults?.results || [];
  // Client-side filter as backup (in case backend doesn't support type filter)
  const results = searchFilter === "all"
    ? allResults
    : allResults.filter(r => r.type === searchFilter);

  const handleSelect = (result: SearchResult) => {
    setSearchFocused(false);
    setSearchQuery("");
    setSearchFilter("all");
    navigate(`/${result.type}s/${result.id}`);
  };

  const handleCloseSearch = () => {
    setSearchFocused(false);
    setSearchQuery("");
    setSearchFilter("all");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "deal": return <Kanban className="h-4 w-4 text-green-600" />;
      case "contact": return <Contact className="h-4 w-4 text-blue-600" />;
      case "company": return <Building2 className="h-4 w-4 text-purple-600" />;
      default: return null;
    }
  };

  // Get back navigation path
  const getBackPath = () => {
    if (location.startsWith('/deals/')) return '/deals';
    if (location.startsWith('/contacts/')) return '/contacts';
    if (location.startsWith('/companies/')) return '/companies';
    return '/dashboard';
  };

  // Mobile header - simplified with hamburger and quick create
  if (isMobile) {
    return (
      <>
        <header className="sticky top-0 z-40 h-12 border-b border-gray-200 bg-white flex items-center px-3 gap-3">
          {/* Back Button (detail pages) or Hamburger Menu (list pages) */}
          {isDetailPage ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => navigate(getBackPath())}
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </Button>
          ) : (
            <SidebarTrigger className="h-9 w-9 p-0">
              <Menu className="h-5 w-5 text-gray-700" />
            </SidebarTrigger>
          )}

          {/* App Title/Logo */}
          <div className="flex-1 font-semibold text-gray-900">
            VenueVision
          </div>

          {/* Search Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setSearchFocused(true)}
          >
            <Search className="h-4 w-4 text-gray-600" />
          </Button>

          {/* Quick Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 px-3 gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="text-sm">Create</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setQuickCreateType("deal")}>
                <Kanban className="h-4 w-4 mr-2 text-green-600" />
                New Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickCreateType("contact")}>
                <Contact className="h-4 w-4 mr-2 text-blue-600" />
                New Contact
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickCreateType("company")}>
                <Building2 className="h-4 w-4 mr-2 text-purple-600" />
                New Company
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickCreateType("task")}>
                <CheckSquare className="h-4 w-4 mr-2 text-orange-600" />
                New Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Full-screen Mobile Search Modal */}
        <Dialog open={searchFocused} onOpenChange={setSearchFocused}>
          <DialogContent className="p-0 gap-0 max-w-full h-full m-0 rounded-none">
            <div className="flex flex-col h-full">
              {/* Search Header */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 flex-shrink-0"
                    onClick={handleCloseSearch}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      ref={inputRef}
                      placeholder="Search deals, contacts, companies..."
                      className="pl-9 h-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Quick Filters */}
                <div className="flex items-center gap-2 mt-3">
                  {[
                    { value: "all", label: "All" },
                    { value: "deal", label: "Deals", icon: Kanban, color: "text-green-600" },
                    { value: "contact", label: "Contacts", icon: Contact, color: "text-blue-600" },
                    { value: "company", label: "Companies", icon: Building2, color: "text-purple-600" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setSearchFilter(filter.value as typeof searchFilter)}
                      className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1 transition-colors ${
                        searchFilter === filter.value
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {filter.icon && <filter.icon className={`h-3 w-3 ${filter.color}`} />}
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-y-auto">
                {searchQuery.length < 2 ? (
                  <div className="p-8 text-center text-gray-600">
                    <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Type at least 2 characters to search</p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-8 text-center text-gray-600">
                    <p className="text-sm">No results found</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {results.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 text-left"
                      >
                        <div className="flex-shrink-0">
                          {getIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{result.title}</div>
                          {result.subtitle && (
                            <div className="text-sm text-gray-600 truncate">{result.subtitle}</div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 capitalize flex-shrink-0">{result.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <QuickCreateDialog type={quickCreateType} onClose={() => setQuickCreateType(null)} />
      </>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-4">
        {/* Global Search - always visible */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={inputRef}
            placeholder="Search deals, contacts, companies..."
            className="pl-9 pr-16 h-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-gray-100 px-1.5 font-mono text-[10px] font-medium text-gray-500">
            <span className="text-xs">⌘</span>K
          </kbd>

          {/* Search Results Dropdown */}
          {searchFocused && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md border border-gray-200 shadow-lg z-50 overflow-hidden">
              {/* Quick Filters */}
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                <span className="text-xs text-gray-500 mr-1">Filter:</span>
                {[
                  { value: "all", label: "All" },
                  { value: "deal", label: "Deals", icon: Kanban, color: "text-green-600" },
                  { value: "contact", label: "Contacts", icon: Contact, color: "text-blue-600" },
                  { value: "company", label: "Companies", icon: Building2, color: "text-purple-600" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setSearchFilter(filter.value as typeof searchFilter)}
                    className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 transition-colors ${
                      searchFilter === filter.value
                        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {filter.icon && <filter.icon className={`h-3 w-3 ${searchFilter === filter.value ? "text-blue-600" : filter.color}`} />}
                    {filter.label}
                  </button>
                ))}
              </div>

              {searchQuery.length < 2 ? (
                <div className="px-4 py-3 text-sm text-gray-600">
                  Type at least 2 characters to search
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-600">
                  No results found{searchFilter !== "all" && ` for ${searchFilter}s`}
                </div>
              ) : (
                <div className="py-1 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">
                    {results.length} Result{results.length !== 1 ? "s" : ""}
                  </div>
                  {results.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-left"
                    >
                      {getIcon(result.type)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-xs text-gray-600 truncate">{result.subtitle}</div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 capitalize flex-shrink-0">{result.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions - pushed to right */}
        <div className="ml-auto flex items-center gap-2">
          {/* Settings */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => navigate("/settings")}
            title="Settings"
          >
            <Settings className="h-4 w-4 text-gray-600" />
          </Button>

          {/* Notifications */}
          <NotificationBell />

          {/* Quick Create Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span>Create</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setQuickCreateType("deal")}>
                <Kanban className="h-4 w-4 mr-2 text-green-600" />
                New Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickCreateType("contact")}>
                <Contact className="h-4 w-4 mr-2 text-blue-600" />
                New Contact
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickCreateType("company")}>
                <Building2 className="h-4 w-4 mr-2 text-purple-600" />
                New Company
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickCreateType("task")}>
                <CheckSquare className="h-4 w-4 mr-2 text-orange-600" />
                New Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <QuickCreateDialog type={quickCreateType} onClose={() => setQuickCreateType(null)} />
    </>
  );
}
