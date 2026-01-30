import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
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
  FileSignature,
  FileText,
  LifeBuoy,
  Paperclip,
  X,
  Keyboard,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from "@/components/ui/notification-bell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";

// Convert hex color to a very light tint (pastel version)
function hexToLightTint(hex: string, lightness: number = 0.92): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const newR = Math.round(r + (255 - r) * lightness);
  const newG = Math.round(g + (255 - g) * lightness);
  const newB = Math.round(b + (255 - b) * lightness);
  return `rgb(${newR}, ${newG}, ${newB})`;
}

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

  // Reset forms when dialog opens
  useEffect(() => {
    if (type) {
      setDealForm({ name: "", amount: "", ownerId: "", contactId: "" });
      setContactForm({ firstName: "", lastName: "", email: "", phone: "" });
      setCompanyForm({ name: "", website: "" });
      setTaskForm({ title: "", dueDate: "", assignedTo: "" });
      setContactSearch("");
    }
  }, [type]);

  // Fetch team members for owner/assignee dropdowns
  const { data: teamMembers = [], isLoading: isLoadingMembers } = useQuery<Array<{ id: number; userId: number; email: string; firstName: string | null; lastName: string | null; profilePhoto?: string | null }>>({
    queryKey: ["/api/crm/organization/members"],
    enabled: type === "deal" || type === "task",
    staleTime: 0, // Always refetch when dialog opens
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
      // Use refetchType: 'all' to ensure all cached queries are refreshed
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      toast({ title: "Deal created" });
      onClose();
      navigate(`/deals/${data.id}`);
    },
    onError: () => toast({ title: "Failed to create deal", variant: "destructive" }),
  });

  const createContactMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/contacts", { body: data }).then(r => r.json()),
    onSuccess: (data) => {
      // Use refetchType: 'all' to ensure all cached queries are refreshed
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      toast({ title: "Contact created" });
      onClose();
      navigate(`/contacts/${data.id}`);
    },
    onError: () => toast({ title: "Failed to create contact", variant: "destructive" }),
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/companies", { body: data }).then(r => r.json()),
    onSuccess: (data) => {
      // Use refetchType: 'all' to ensure all cached queries are refreshed
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"], refetchType: 'all' });
      toast({ title: "Company created" });
      onClose();
      navigate(`/companies/${data.id}`);
    },
    onError: () => toast({ title: "Failed to create company", variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/tasks", { body: data }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"], refetchType: 'all' });
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
                    {isLoadingMembers ? (
                      <div className="px-2 py-3 text-sm text-gray-500 text-center">Loading team members...</div>
                    ) : teamMembers.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-gray-500 text-center">No team members found</div>
                    ) : (
                      teamMembers.filter(m => m.userId != null).map((member) => (
                        <SelectItem key={member.userId} value={member.userId.toString()}>
                          <div className="flex items-center gap-2">
                            {member.profilePhoto ? (
                              <img src={member.profilePhoto} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-medium">
                                {(member.firstName?.[0] || member.email[0] || '').toUpperCase()}
                              </div>
                            )}
                            <span className="text-gray-900">{member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : member.email}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
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
                  placeholder="example.com"
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
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingMembers ? (
                      <div className="px-2 py-3 text-sm text-gray-500 text-center">Loading team members...</div>
                    ) : teamMembers.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-gray-500 text-center">No team members found</div>
                    ) : (
                      teamMembers.filter(m => m.userId != null).map((member) => (
                        <SelectItem key={member.userId} value={member.userId.toString()}>
                          <div className="flex items-center gap-2">
                            {member.profilePhoto ? (
                              <img src={member.profilePhoto} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-medium">
                                {(member.firstName?.[0] || member.email[0] || '').toUpperCase()}
                              </div>
                            )}
                            <span className="text-gray-900">{member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : member.email}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
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

// Support Dialog Component
interface SupportDialogProps {
  open: boolean;
  onClose: () => void;
}

function SupportDialog({ open, onClose }: SupportDialogProps) {
  const { toast } = useToast();
  const [location] = useLocation();
  const [form, setForm] = useState({
    type: "bug",
    subject: "",
    description: "",
  });
  const [attachments, setAttachments] = useState<Array<{ file: File; preview: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm({ type: "bug", subject: "", description: "" });
      setAttachments([]);
    }
  }, [open]);

  const submitMutation = useMutation({
    mutationFn: async (data: { type: string; subject: string; description: string; attachments: any[]; browserInfo: string; pageUrl: string }) => {
      const response = await apiRequest("POST", "/api/support/ticket", { body: data });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Support ticket submitted", description: "We'll get back to you soon." });
      onClose();
    },
    onError: () => toast({ title: "Failed to submit ticket", variant: "destructive" }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Array<{ file: File; preview: string }> = [];
    Array.from(files).forEach(file => {
      // Only allow images and videos, max 10MB
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast({ title: "Invalid file type", description: "Only images and videos are allowed", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" });
        return;
      }
      const preview = URL.createObjectURL(file);
      newAttachments.push({ file, preview });
    });

    setAttachments(prev => [...prev, ...newAttachments].slice(0, 5)); // Max 5 attachments
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAttachments = [...prev];
      URL.revokeObjectURL(newAttachments[index].preview);
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    // Convert files to base64 for submission (in production, you'd upload to storage)
    const attachmentData = await Promise.all(
      attachments.map(async (att) => {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(att.file);
        });
        return {
          url: base64,
          filename: att.file.name,
          mimeType: att.file.type,
          size: att.file.size,
        };
      })
    );

    submitMutation.mutate({
      type: form.type,
      subject: form.subject,
      description: form.description,
      attachments: attachmentData,
      browserInfo: navigator.userAgent,
      pageUrl: window.location.href,
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-blue-600" />
            Contact Support
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Brief description of your issue"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Please describe your issue in detail. Include steps to reproduce if reporting a bug."
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
                disabled={attachments.length >= 5}
              >
                <Paperclip className="h-4 w-4" />
                Add Screenshot or Video
              </Button>
              <p className="text-xs text-gray-500">Max 5 files, 10MB each. Images and videos only.</p>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((att, index) => (
                    <div key={index} className="relative group">
                      {att.file.type.startsWith('image/') ? (
                        <img
                          src={att.preview}
                          alt={att.file.name}
                          className="h-16 w-16 object-cover rounded border"
                        />
                      ) : (
                        <div className="h-16 w-16 flex items-center justify-center bg-gray-100 rounded border">
                          <FileText className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "Submitting..." : "Submit Ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SearchResult {
  type: "deal" | "contact" | "company" | "cim" | "esign";
  id: number;
  title: string;
  subtitle?: string;
  envelopeId?: string; // For esign results
}

export function GlobalHeader() {
  const [location, navigate] = useLocation();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<"all" | "deal" | "contact" | "company" | "cim" | "esign">("all");
  const [quickCreateType, setQuickCreateType] = useState<"deal" | "contact" | "company" | "task" | null>(null);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Keyboard shortcuts
  const {
    enabled: shortcutsEnabled,
    toggleEnabled: toggleShortcuts,
    shortcuts,
    showHelp: showShortcutsHelp,
    setShowHelp: setShowShortcutsHelp,
  } = useKeyboardShortcuts();

  // Fetch profile data for logo and brand colors
  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
  });

  // Get brand color and create light tint for header background
  const brandColor = (profile as any)?.brandColors?.[0];
  const headerBgColor = brandColor ? hexToLightTint(brandColor, 0.92) : '#ffffff';

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

  // Listen for keyboard shortcut to open create menu
  useEffect(() => {
    const handleOpenCreateMenu = () => {
      setCreateMenuOpen(true);
    };
    window.addEventListener('open-create-menu', handleOpenCreateMenu);
    return () => window.removeEventListener('open-create-menu', handleOpenCreateMenu);
  }, []);

  // Global search query
  const { data: searchResults } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/crm/search", searchQuery, searchFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ q: searchQuery, type: searchFilter });
      const response = await apiRequest("GET", `/api/crm/search?${params.toString()}`);
      return response.json();
    },
    enabled: searchQuery.length >= 2,
    staleTime: 0, // Always refetch when filter changes
  });

  const results = searchResults?.results || [];

  const handleSelect = (result: SearchResult) => {
    setSearchFocused(false);
    setSearchQuery("");
    setSearchFilter("all");
    if (result.type === "esign") {
      navigate(`/esign/${result.envelopeId || result.id}`);
    } else if (result.type === "cim") {
      navigate(`/cim/${result.id}`);
    } else {
      navigate(`/${result.type}s/${result.id}`);
    }
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
      case "cim": return <FileText className="h-4 w-4 text-rose-600" />;
      case "esign": return <FileSignature className="h-4 w-4 text-amber-600" />;
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
        <header
          className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-3 gap-3"
          style={{ backgroundColor: headerBgColor }}
        >
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

          {/* Logo */}
          <Link href="/dashboard" className="flex-1">
            {(profile as any)?.businessLogo ? (
              <img
                src={(profile as any).businessLogo}
                alt={(profile as any)?.businessName || "BrokerVault.ai"}
                className="h-8 max-w-[140px] object-contain"
              />
            ) : (
              <span className="text-lg font-bold text-gray-900">
                BrokerVault<span className="text-indigo-600">.ai</span>
              </span>
            )}
          </Link>

          {/* Search Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setSearchFocused(true)}
          >
            <Search className="h-4 w-4 text-gray-600" />
          </Button>

          {/* Support Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setSupportDialogOpen(true)}
            title="Contact Support"
          >
            <LifeBuoy className="h-4 w-4 text-gray-600" />
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
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  {[
                    { value: "all", label: "All" },
                    { value: "deal", label: "Deals", icon: Kanban, color: "text-green-600" },
                    { value: "contact", label: "Contacts", icon: Contact, color: "text-blue-600" },
                    { value: "company", label: "Companies", icon: Building2, color: "text-purple-600" },
                    { value: "cim", label: "CIMs", icon: FileText, color: "text-rose-600" },
                    { value: "esign", label: "eSign", icon: FileSignature, color: "text-amber-600" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setSearchFilter(filter.value as typeof searchFilter)}
                      className={`px-2.5 py-1.5 text-xs rounded-md flex items-center gap-1 transition-colors ${
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
                    <p className="text-sm">
                      No results found{searchFilter !== "all" && ` in ${
                        searchFilter === "deal" ? "Deals" :
                        searchFilter === "contact" ? "Contacts" :
                        searchFilter === "company" ? "Companies" :
                        searchFilter === "cim" ? "CIMs" :
                        searchFilter === "esign" ? "eSignatures" : ""
                      }`}
                    </p>
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
                        <span className="text-xs text-gray-500 capitalize flex-shrink-0">
                          {result.type === "esign" ? "eSign" : result.type === "cim" ? "CIM" : result.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <QuickCreateDialog type={quickCreateType} onClose={() => setQuickCreateType(null)} />
        <SupportDialog open={supportDialogOpen} onClose={() => setSupportDialogOpen(false)} />
      </>
    );
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-4 gap-4"
        style={{ backgroundColor: headerBgColor }}
      >
        {/* Logo */}
        <Link href="/dashboard" className="flex-shrink-0">
          {(profile as any)?.businessLogo ? (
            <img
              src={(profile as any).businessLogo}
              alt={(profile as any)?.businessName || "BrokerVault.ai"}
              className="h-10 max-w-[160px] object-contain"
            />
          ) : (
            <span className="text-xl font-bold text-gray-900">
              BrokerVault<span className="text-indigo-600">.ai</span>
            </span>
          )}
        </Link>

        {/* Global Search - wider search bar */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={inputRef}
            placeholder="Search deals, contacts, companies..."
            className="pl-9 pr-16 h-10 bg-white/80 border-gray-200 focus:bg-white transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center justify-center rounded border bg-gray-100 px-1.5 font-mono text-xs font-medium text-gray-500">
            /
          </kbd>

          {/* Search Results Dropdown */}
          {searchFocused && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md border border-gray-200 shadow-lg z-50 overflow-hidden">
              {/* Quick Filters - larger buttons */}
              <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
                <span className="text-sm text-gray-500 mr-1">Filter:</span>
                {[
                  { value: "all", label: "All" },
                  { value: "deal", label: "Deals", icon: Kanban, color: "text-green-600" },
                  { value: "contact", label: "Contacts", icon: Contact, color: "text-blue-600" },
                  { value: "company", label: "Companies", icon: Building2, color: "text-purple-600" },
                  { value: "cim", label: "CIMs", icon: FileText, color: "text-rose-600" },
                  { value: "esign", label: "eSign", icon: FileSignature, color: "text-amber-600" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setSearchFilter(filter.value as typeof searchFilter)}
                    className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 transition-colors ${
                      searchFilter === filter.value
                        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {filter.icon && <filter.icon className={`h-3.5 w-3.5 ${searchFilter === filter.value ? "text-blue-600" : filter.color}`} />}
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
                  No results found{searchFilter !== "all" && ` in ${
                    searchFilter === "deal" ? "Deals" :
                    searchFilter === "contact" ? "Contacts" :
                    searchFilter === "company" ? "Companies" :
                    searchFilter === "cim" ? "CIMs" :
                    searchFilter === "esign" ? "eSignatures" : ""
                  }`}
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
                      <span className="text-xs text-gray-500 capitalize flex-shrink-0">
                        {result.type === "esign" ? "eSign" : result.type === "cim" ? "CIM" : result.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions - pushed to right */}
        <div className="ml-auto flex items-center gap-1">
          {/* Keyboard Shortcuts */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setShowShortcutsHelp(true)}
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4 text-gray-600" />
          </Button>

          {/* Support */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setSupportDialogOpen(true)}
            title="Contact Support"
          >
            <LifeBuoy className="h-4 w-4 text-gray-600" />
          </Button>

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
          <DropdownMenu open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 ml-2">
                <Plus className="h-4 w-4" />
                <span>Create</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setQuickCreateType("deal"); setCreateMenuOpen(false); }}>
                <Kanban className="h-4 w-4 mr-2 text-green-600" />
                New Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setQuickCreateType("contact"); setCreateMenuOpen(false); }}>
                <Contact className="h-4 w-4 mr-2 text-blue-600" />
                New Contact
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setQuickCreateType("company"); setCreateMenuOpen(false); }}>
                <Building2 className="h-4 w-4 mr-2 text-purple-600" />
                New Company
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setQuickCreateType("task"); setCreateMenuOpen(false); }}>
                <CheckSquare className="h-4 w-4 mr-2 text-orange-600" />
                New Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <QuickCreateDialog type={quickCreateType} onClose={() => setQuickCreateType(null)} />
      <SupportDialog open={supportDialogOpen} onClose={() => setSupportDialogOpen(false)} />
      <KeyboardShortcutsDialog
        open={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
        shortcuts={shortcuts}
        enabled={shortcutsEnabled}
        onToggleEnabled={toggleShortcuts}
      />
    </>
  );
}
