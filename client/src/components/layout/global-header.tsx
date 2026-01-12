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
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from "@/components/ui/notification-bell";

interface QuickCreateDialogProps {
  type: "deal" | "contact" | "company" | "task" | null;
  onClose: () => void;
}

function QuickCreateDialog({ type, onClose }: QuickCreateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Form states
  const [dealForm, setDealForm] = useState({ name: "", amount: "", companyId: "" });
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "" });
  const [companyForm, setCompanyForm] = useState({ name: "", website: "" });
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "" });

  // Fetch companies for deal creation
  const { data: companiesData } = useQuery({
    queryKey: ["/api/crm/companies"],
    enabled: type === "deal",
  });
  const companies = (companiesData as any)?.companies || [];

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
          companyId: dealForm.companyId ? parseInt(dealForm.companyId) : null,
        });
        break;
      case "contact":
        if (!contactForm.email.trim()) return;
        createContactMutation.mutate(contactForm);
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
                <Label>Company</Label>
                <Select value={dealForm.companyId} onValueChange={(v) => setDealForm({ ...dealForm, companyId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
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
  const [, navigate] = useLocation();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<"all" | "deal" | "contact" | "company">("all");
  const [quickCreateType, setQuickCreateType] = useState<"deal" | "contact" | "company" | "task" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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

  // Don't render header on mobile - use bottom nav instead
  if (isMobile) {
    return <QuickCreateDialog type={quickCreateType} onClose={() => setQuickCreateType(null)} />;
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
