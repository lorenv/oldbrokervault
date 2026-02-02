import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CimGenerator } from "@/components/cim-generator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { useLocation, useSearch, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  RefreshCw,
  DollarSign,
  TrendingUp,
  CheckSquare,
  AlertTriangle,
  Clock,
  FileSignature,
  FileCheck,
  ArrowRight,
  Plus,
  Kanban,
  Users,
  Building2,
  FileText,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Calendar,
  X,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Quick Create Dialog Component
type QuickCreateType = "deal" | "contact" | "company" | null;

interface QuickCreateDialogProps {
  type: QuickCreateType;
  onClose: () => void;
}

function QuickCreateDialog({ type, onClose }: QuickCreateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [dealForm, setDealForm] = useState({ name: "", amount: "", companyId: "" });
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "" });
  const [companyForm, setCompanyForm] = useState({ name: "", website: "" });

  // Reset forms when dialog opens
  useEffect(() => {
    if (type) {
      setDealForm({ name: "", amount: "", companyId: "" });
      setContactForm({ firstName: "", lastName: "", email: "" });
      setCompanyForm({ name: "", website: "" });
    }
  }, [type]);

  const { data: companiesData } = useQuery({
    queryKey: ["/api/crm/companies"],
    enabled: type === "deal",
  });
  const companies = (companiesData as any)?.companies || [];

  const createDealMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/deals", { body: data }).then(r => r.json()),
    onSuccess: (data) => {
      // Use refetchType: 'all' to ensure all cached queries are refreshed
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/ai-briefing"] });
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
    }
  };

  const isPending = createDealMutation.isPending || createContactMutation.isPending || createCompanyMutation.isPending;

  const getTitle = () => {
    switch (type) {
      case "deal": return "Create Deal";
      case "contact": return "Add Contact";
      case "company": return "Add Company";
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
                  placeholder="example.com"
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

interface BriefingData {
  summary: string;
  priorityDeals: Array<{
    id: number;
    name: string;
    value: number | null;
    stage: string;
    stageProbability?: number;
    daysSinceActivity: number;
    daysUntilClose?: number | null;
    isHighValue?: boolean;
    isLateStage?: boolean;
    isUrgent?: boolean;
    isOverdue?: boolean;
    priorityScore?: number;
    reason: string;
    suggestedAction: string;
  }>;
  riskAlerts: Array<{
    dealId: number;
    dealName: string;
    value?: number | null;
    stage?: string;
    daysSinceActivity?: number;
    message: string;
  }>;
  tasksOverview: {
    dueToday: number;
    overdue: number;
    upcoming: number;
    message: string;
  };
  pendingSignatures: {
    count: number;
    items: Array<{
      id: number;
      title: string;
      recipientName: string;
      recipientEmail?: string;
      daysPending?: number;
      hasViewed?: boolean;
      needsReminder?: boolean;
      isStale?: boolean;
    }>;
    staleCount?: number;
    needsReminderCount?: number;
    message: string;
  };
  pendingApprovals: {
    count: number;
    items: Array<{ documentId: number; documentTitle: string; signerEmail: string }>;
    message: string;
  };
  unreadMessages: {
    count: number;
    items: Array<{ threadId: number; subject: string; inquirerName: string; preview: string }>;
    message: string;
  };
  quickStats: {
    pipelineValue: number;
    openDeals: number;
    dealsWonThisMonth: number;
    wonValueThisMonth: number;
  };
  recentActivity: Array<{
    id: number;
    type: string;
    description: string;
    timestamp: string;
    dealName?: string;
  }>;
}

interface BriefingResponse {
  briefing: BriefingData;
  generatedAt: string;
  cached: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const queryClient = useQueryClient();
  const [quickCreateType, setQuickCreateType] = useState<QuickCreateType>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    signatures: false,
    approvals: false,
    messages: false,
    tasks: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Parse mode from URL
  const mode = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('mode');
  }, [searchString]);

  // Parse dealId from URL (for CIM creation)
  const dealId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const id = params.get('dealId');
    return id ? parseInt(id) : null;
  }, [searchString]);

  // All hooks must be called before any conditional returns
  // Fetch user profile
  const { data: userProfile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user && mode !== 'cim',
    staleTime: 1000 * 60 * 5,
  });

  // Fetch AI briefing
  const {
    data: briefingResponse,
    isLoading: briefingLoading,
    isFetching: briefingFetching,
    refetch: refetchBriefing
  } = useQuery<BriefingResponse>({
    queryKey: ["/api/dashboard/ai-briefing"],
    queryFn: () => apiRequest("GET", "/api/dashboard/ai-briefing").then(res => res.json()),
    enabled: !!user && mode !== 'cim',
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
  });

  // Refresh briefing mutation
  const refreshBriefingMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/dashboard/ai-briefing?refresh=true").then(res => res.json()),
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/dashboard/ai-briefing"], data);
    },
  });

  // Fetch my tasks (due today + overdue)
  const { data: myTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/crm/tasks", "myTasks=true"],
    queryFn: () => apiRequest("GET", "/api/crm/tasks?myTasks=true").then(res => res.json()),
    enabled: !!user && mode !== 'cim',
    staleTime: 1000 * 60 * 2,
  });

  const firstName = (userProfile as any)?.name?.split(' ')[0] ||
    (userProfile as any)?.firstName ||
    user?.email?.split('@')[0] || '';

  const briefing = briefingResponse?.briefing;
  const isRefreshing = refreshBriefingMutation.isPending || briefingFetching;

  // DEBUG: Log briefing data
  console.log('[Dashboard] briefingResponse:', briefingResponse);
  console.log('[Dashboard] briefing:', briefing);
  console.log('[Dashboard] quickStats:', briefing?.quickStats);

  // Filter tasks for display
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const overdueTasks = myTasks.filter(t =>
    t.dueDate &&
    new Date(t.dueDate) < now &&
    t.status !== 'completed' &&
    t.status !== 'cancelled'
  );

  const dueTodayTasks = myTasks.filter(t => {
    if (!t.dueDate || t.status === 'completed' || t.status === 'cancelled') return false;
    const due = new Date(t.dueDate);
    return due >= todayStart && due < todayEnd;
  });

  // Build unified action items list (must be before early returns to follow Rules of Hooks)
  const actionItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'deal' | 'task' | 'signature' | 'approval' | 'message';
      priority: 'urgent' | 'high' | 'medium';
      title: string;
      subtitle: string;
      href: string;
      value?: number;
      meta?: string;
    }> = [];

    // Add overdue/urgent deals
    if (briefing?.priorityDeals) {
      briefing.priorityDeals.slice(0, 3).forEach(deal => {
        items.push({
          id: `deal-${deal.id}`,
          type: 'deal',
          priority: deal.isOverdue ? 'urgent' : deal.isUrgent ? 'high' : 'medium',
          title: deal.name,
          subtitle: deal.isOverdue
            ? `Past close date - needs immediate follow-up`
            : deal.isUrgent
              ? `Closing in ${deal.daysUntilClose}d - confirm next steps`
              : `Suggested follow-up: ${deal.daysSinceActivity} days since last activity`,
          href: `/deals/${deal.id}`,
          value: deal.value || undefined,
          meta: deal.stage,
        });
      });
    }

    // Add overdue tasks
    overdueTasks.slice(0, 2).forEach(task => {
      items.push({
        id: `task-${task.id}`,
        type: 'task',
        priority: 'urgent',
        title: task.title,
        subtitle: 'Overdue task',
        href: '/tasks',
      });
    });

    // Add stale signatures
    if (briefing?.pendingSignatures?.items) {
      briefing.pendingSignatures.items
        .filter(s => s.isStale || s.needsReminder)
        .slice(0, 2)
        .forEach(sig => {
          items.push({
            id: `sig-${sig.id}`,
            type: 'signature',
            priority: sig.isStale ? 'urgent' : 'high',
            title: sig.title,
            subtitle: `Waiting on ${sig.recipientName} (${sig.daysPending}d)`,
            href: `/esign/envelope/${sig.id}`,
          });
        });
    }

    // Add pending approvals
    if (briefing?.pendingApprovals?.items) {
      briefing.pendingApprovals.items.slice(0, 2).forEach((approval, i) => {
        items.push({
          id: `approval-${approval.documentId}`,
          type: 'approval',
          priority: 'high',
          title: `NDA approval: ${approval.signerEmail}`,
          subtitle: `For ${approval.documentTitle}`,
          href: `/esign/envelope/${approval.documentId}`,
        });
      });
    }

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2 };
    return items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 8);
  }, [briefing, overdueTasks]);

  // Count urgent items for the header
  const urgentCount = actionItems.filter(i => i.priority === 'urgent').length;
  const totalActionItems = actionItems.length;

  // If mode=cim, show CIM generator (after all hooks)
  if (mode === 'cim') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <main className="px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Create CIM</h1>
              <p className="text-sm text-gray-500 mt-1">Generate a professional Confidential Information Memorandum</p>
            </div>
            <Button variant="outline" onClick={() => setLocation('/dashboard')}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
            <CimGenerator dealId={dealId} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        {/* Compact Header with Quick Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
            </h1>
            <p className="text-sm text-gray-500">
              {urgentCount > 0
                ? `${urgentCount} urgent item${urgentCount > 1 ? 's' : ''} need${urgentCount === 1 ? 's' : ''} attention`
                : totalActionItems > 0
                  ? `${totalActionItems} item${totalActionItems > 1 ? 's' : ''} to review`
                  : "You're all caught up"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickCreateType("deal")}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Deal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshBriefingMutation.mutate()}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* AI Summary - Compact */}
        <Card className="mb-5 border-gray-200">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-md flex-shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                {briefingLoading || isRefreshing ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                ) : briefing ? (
                  <p className="text-sm text-gray-700 leading-relaxed">{briefing.summary}</p>
                ) : (
                  <p className="text-sm text-gray-500">Unable to load briefing.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats - With Icons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <button
            onClick={() => setLocation('/deals')}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900">
                  {briefingLoading ? '—' : briefing ? formatCurrency(briefing.quickStats.pipelineValue) : '$0'}
                </p>
                <p className="text-sm text-gray-500">Pipeline</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setLocation('/deals')}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Kanban className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900">
                  {briefingLoading ? '—' : briefing?.quickStats.openDeals ?? 0}
                </p>
                <p className="text-sm text-gray-500">Open Deals</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setLocation('/deals')}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-emerald-600">
                  {briefingLoading ? '—' : briefing?.quickStats.dealsWonThisMonth ?? 0}
                </p>
                <p className="text-sm text-gray-500">Won This Month</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setLocation('/tasks')}
            className={cn(
              "bg-white rounded-lg border p-4 text-left hover:shadow-sm transition-all",
              overdueTasks.length > 0 ? "border-red-200 hover:border-red-300" : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                overdueTasks.length > 0 ? "bg-red-100" : "bg-gray-100"
              )}>
                <AlertTriangle className={cn(
                  "h-5 w-5",
                  overdueTasks.length > 0 ? "text-red-600" : "text-gray-500"
                )} />
              </div>
              <div>
                <p className={cn("text-xl font-semibold", overdueTasks.length > 0 ? "text-red-600" : "text-gray-900")}>
                  {overdueTasks.length}
                </p>
                <p className="text-sm text-gray-500">Overdue Tasks</p>
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Column - Action Required */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    Priorities for Today
                    {totalActionItems > 0 && (
                      <span className="text-xs font-normal text-gray-500">
                        {totalActionItems} item{totalActionItems > 1 ? 's' : ''}
                      </span>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {actionItems.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckSquare className="h-12 w-12 text-green-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">You're all caught up!</p>
                    <p className="text-sm text-gray-400 mt-1">No urgent items need your attention</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {actionItems.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                      >
                        {/* Priority Indicator */}
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full flex-shrink-0",
                          item.priority === 'urgent' ? "bg-red-500" :
                          item.priority === 'high' ? "bg-amber-500" : "bg-blue-400"
                        )} />

                        {/* Type Icon */}
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                          item.type === 'deal' ? "bg-blue-50" :
                          item.type === 'task' ? "bg-orange-50" :
                          item.type === 'signature' ? "bg-purple-50" :
                          item.type === 'approval' ? "bg-amber-50" : "bg-teal-50"
                        )}>
                          {item.type === 'deal' && <Kanban className="h-4.5 w-4.5 text-blue-600" />}
                          {item.type === 'task' && <CheckSquare className="h-4.5 w-4.5 text-orange-600" />}
                          {item.type === 'signature' && <FileSignature className="h-4.5 w-4.5 text-purple-600" />}
                          {item.type === 'approval' && <Users className="h-4.5 w-4.5 text-amber-600" />}
                          {item.type === 'message' && <MessageSquare className="h-4.5 w-4.5 text-teal-600" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                        </div>

                        {/* Value & Meta */}
                        <div className="text-right flex-shrink-0">
                          {item.value && (
                            <p className="text-sm font-medium text-gray-900">{formatCurrency(item.value)}</p>
                          )}
                          {item.meta && (
                            <p className="text-xs text-gray-400">{item.meta}</p>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}

                {/* View More Links */}
                {totalActionItems > 0 && (
                  <div className="border-t border-gray-100 px-4 py-3 flex gap-4">
                    <Link href="/deals" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      All Deals →
                    </Link>
                    <Link href="/tasks" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      All Tasks →
                    </Link>
                    <Link href="/esign" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      E-Signatures →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Condensed Info */}
          <div className="space-y-4">
            {/* Pending Items - Collapsible Sections */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-gray-700">Pending Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3 pt-0">
                {/* E-Signatures */}
                <div>
                  <button
                    onClick={() => toggleSection('signatures')}
                    className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 text-gray-400 transition-transform",
                        expandedSections.signatures && "rotate-90"
                      )} />
                      <FileSignature className="h-4 w-4 text-purple-500" />
                      <span className="text-sm text-gray-700">E-Signatures</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(briefing?.pendingSignatures?.staleCount || 0) > 0 && (
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {briefing?.pendingSignatures?.count || 0}
                      </span>
                    </div>
                  </button>
                  {expandedSections.signatures && briefing?.pendingSignatures?.items && briefing.pendingSignatures.items.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1">
                      {briefing.pendingSignatures.items.map((sig) => (
                        <Link
                          key={sig.id}
                          href={`/esign/envelope/${sig.id}`}
                          className="flex items-center justify-between p-2 rounded text-xs hover:bg-gray-50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-700 truncate">{sig.title}</p>
                            <p className="text-gray-500">Waiting: {sig.recipientName}</p>
                          </div>
                          {sig.isStale && (
                            <span className="text-red-600 font-medium ml-2">{sig.daysPending}d</span>
                          )}
                          {sig.needsReminder && !sig.isStale && (
                            <span className="text-amber-600 font-medium ml-2">{sig.daysPending}d</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* NDA Approvals */}
                <div>
                  <button
                    onClick={() => toggleSection('approvals')}
                    className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 text-gray-400 transition-transform",
                        expandedSections.approvals && "rotate-90"
                      )} />
                      <Users className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-gray-700">NDA Approvals</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {briefing?.pendingApprovals?.count || 0}
                    </span>
                  </button>
                  {expandedSections.approvals && briefing?.pendingApprovals?.items && briefing.pendingApprovals.items.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1">
                      {briefing.pendingApprovals.items.map((approval, i) => (
                        <Link
                          key={i}
                          href={`/esign/envelope/${approval.documentId}`}
                          className="block p-2 rounded text-xs hover:bg-gray-50"
                        >
                          <p className="text-gray-700 truncate">{approval.signerEmail}</p>
                          <p className="text-gray-500 truncate">For: {approval.documentTitle}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unread Messages */}
                <div>
                  <button
                    onClick={() => toggleSection('messages')}
                    className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 text-gray-400 transition-transform",
                        expandedSections.messages && "rotate-90"
                      )} />
                      <MessageSquare className="h-4 w-4 text-teal-500" />
                      <span className="text-sm text-gray-700">Unread Messages</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {briefing?.unreadMessages?.count || 0}
                    </span>
                  </button>
                  {expandedSections.messages && briefing?.unreadMessages?.items && briefing.unreadMessages.items.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1">
                      {briefing.unreadMessages.items.map((msg, i) => (
                        <Link
                          key={i}
                          href={`/messages/${msg.threadId}`}
                          className="block p-2 rounded text-xs hover:bg-gray-50"
                        >
                          <p className="text-gray-700 truncate">{msg.subject || 'No subject'}</p>
                          <p className="text-gray-500 truncate">From: {msg.inquirerName}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tasks Due Today */}
                <div>
                  <button
                    onClick={() => toggleSection('tasks')}
                    className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 text-gray-400 transition-transform",
                        expandedSections.tasks && "rotate-90"
                      )} />
                      <CheckSquare className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-gray-700">Tasks Due Today</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {dueTodayTasks.length}
                    </span>
                  </button>
                  {expandedSections.tasks && dueTodayTasks.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1">
                      {dueTodayTasks.map((task) => (
                        <Link
                          key={task.id}
                          href="/tasks"
                          className="block p-2 rounded text-xs hover:bg-gray-50"
                        >
                          <p className="text-gray-700 truncate">{task.title}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions - Simplified */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-xs h-9"
                  onClick={() => setQuickCreateType("deal")}
                >
                  <Kanban className="h-3.5 w-3.5 mr-1.5" />
                  Deal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-xs h-9"
                  onClick={() => setQuickCreateType("contact")}
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Contact
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-xs h-9"
                  onClick={() => setQuickCreateType("company")}
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />
                  Company
                </Button>
                <Button variant="outline" size="sm" className="justify-start text-xs h-9" asChild>
                  <Link href="/dashboard?mode=cim">
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    CIM
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <QuickCreateDialog
        type={quickCreateType}
        onClose={() => setQuickCreateType(null)}
      />
    </div>
  );
}
