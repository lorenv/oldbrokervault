import { useState, useMemo } from "react";
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

  const { data: companiesData } = useQuery({
    queryKey: ["/api/crm/companies"],
    enabled: type === "deal",
  });
  const companies = (companiesData as any)?.companies || [];

  const createDealMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/deals", { body: data }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
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
                <Label>Amount</Label>
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
    daysSinceActivity: number;
    reason: string;
    suggestedAction: string;
  }>;
  riskAlerts: Array<{
    dealId: number;
    dealName: string;
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
    items: Array<{ id: number; title: string; recipientName: string }>;
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

  // If mode=cim, show CIM generator
  if (mode === 'cim') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <main className="container mx-auto px-4 md:px-6 py-4 md:py-6">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <main className="container mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here's what needs your attention today
          </p>
        </div>

        {/* AI Briefing Card */}
        <Card className="mb-6 border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-200/60 rounded-lg">
                  <Sparkles className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium text-slate-800">AI Daily Briefing</CardTitle>
                  {briefingResponse?.generatedAt && (
                    <p className="text-xs text-slate-500">
                      Generated {formatTimeAgo(briefingResponse.generatedAt)}
                      {briefingResponse.cached && " (cached)"}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshBriefingMutation.mutate()}
                disabled={isRefreshing}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {briefingLoading || isRefreshing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-slate-400 rounded-full animate-pulse" />
                  <div className="h-2 w-2 bg-slate-400 rounded-full animate-pulse [animation-delay:150ms]" />
                  <div className="h-2 w-2 bg-slate-400 rounded-full animate-pulse [animation-delay:300ms]" />
                  <span className="text-sm text-slate-500 ml-1">Analyzing your deals and tasks...</span>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              </div>
            ) : briefing ? (
              <p className="text-slate-700 leading-relaxed">{briefing.summary}</p>
            ) : (
              <p className="text-slate-500">Unable to load briefing. Click refresh to try again.</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {briefing ? formatCurrency(briefing.quickStats.pipelineValue) : '-'}
                  </p>
                  <p className="text-xs text-gray-500">Pipeline Value</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Kanban className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {briefing?.quickStats.openDeals ?? '-'}
                  </p>
                  <p className="text-xs text-gray-500">Open Deals</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {briefing?.quickStats.dealsWonThisMonth ?? '-'}
                  </p>
                  <p className="text-xs text-gray-500">Won This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  overdueTasks.length > 0 ? "bg-red-100" : "bg-gray-100"
                )}>
                  <CheckSquare className={cn(
                    "h-5 w-5",
                    overdueTasks.length > 0 ? "text-red-600" : "text-gray-600"
                  )} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {overdueTasks.length}
                  </p>
                  <p className="text-xs text-gray-500">Overdue Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Priority Deals & Tasks */}
          <div className="lg:col-span-2 space-y-6">
            {/* Priority Deals */}
            {briefing?.priorityDeals && briefing.priorityDeals.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Priority Deals
                    </CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/deals">
                        View All
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {briefing.priorityDeals.slice(0, 4).map((deal) => (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{deal.name}</h4>
                          <p className="text-sm text-gray-600 mt-0.5">{deal.reason}</p>
                          {deal.suggestedAction && (
                            <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                              <ArrowRight className="h-3 w-3" />
                              {deal.suggestedAction}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {deal.value && (
                            <p className="font-semibold text-gray-900">{formatCurrency(deal.value)}</p>
                          )}
                          <Badge variant="secondary" className="text-xs mt-1">
                            {deal.stage}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Risk Alerts */}
            {briefing?.riskAlerts && briefing.riskAlerts.length > 0 && (
              <Card className="border-red-200 bg-red-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    Deals at Risk
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {briefing.riskAlerts.slice(0, 3).map((alert, i) => (
                    <Link
                      key={i}
                      href={`/deals/${alert.dealId}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-red-100 hover:border-red-300 transition-colors"
                    >
                      <span className="font-medium text-gray-900">{alert.dealName}</span>
                      <span className="text-sm text-red-600">{alert.message}</span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* My Tasks */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-blue-500" />
                    My Tasks
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/tasks">
                      View All
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
                {briefing?.tasksOverview && (
                  <CardDescription>{briefing.tasksOverview.message}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {overdueTasks.length === 0 && dueTodayTasks.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckSquare className="h-10 w-10 text-green-300 mx-auto mb-2" />
                    <p className="text-gray-500">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {overdueTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-red-50 border border-red-100"
                      >
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          <p className="text-xs text-red-600">Overdue</p>
                        </div>
                      </div>
                    ))}
                    {dueTodayTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-100"
                      >
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          <p className="text-xs text-amber-600">Due today</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Signatures, Approvals, Quick Actions */}
          <div className="space-y-6">
            {/* Pending Signatures */}
            {briefing?.pendingSignatures && briefing.pendingSignatures.count > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSignature className="h-4 w-4 text-purple-500" />
                      Awaiting Signatures
                    </CardTitle>
                    <Badge variant="secondary">{briefing.pendingSignatures.count}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {briefing.pendingSignatures.items.slice(0, 3).map((sig) => (
                    <Link
                      key={sig.id}
                      href={`/esign`}
                      className="block p-2 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{sig.title}</p>
                      <p className="text-xs text-gray-500">Waiting on: {sig.recipientName}</p>
                    </Link>
                  ))}
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link href="/esign">
                      View All E-Signatures
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Pending NDA Approvals */}
            {briefing?.pendingApprovals && briefing.pendingApprovals.count > 0 && (
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                      <FileCheck className="h-4 w-4" />
                      NDA Approvals Needed
                    </CardTitle>
                    <Badge className="bg-amber-500">{briefing.pendingApprovals.count}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {briefing.pendingApprovals.items.slice(0, 3).map((approval, i) => (
                    <Link
                      key={i}
                      href={`/analytics`}
                      className="block p-2 rounded-lg bg-white border border-amber-100 hover:border-amber-300 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{approval.documentTitle}</p>
                      <p className="text-xs text-gray-500">From: {approval.signerEmail}</p>
                    </Link>
                  ))}
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link href="/analytics">
                      Review All Approvals
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Unread Messages */}
            {briefing?.unreadMessages && briefing.unreadMessages.count > 0 && (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                      <MessageSquare className="h-4 w-4" />
                      Unread Messages
                    </CardTitle>
                    <Badge className="bg-blue-500">{briefing.unreadMessages.count}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {briefing.unreadMessages.items.slice(0, 3).map((msg, i) => (
                    <Link
                      key={i}
                      href={`/messages/${msg.threadId}`}
                      className="block p-2 rounded-lg bg-white border border-blue-100 hover:border-blue-300 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{msg.subject || 'No subject'}</p>
                      <p className="text-xs text-gray-600 truncate">{msg.preview}</p>
                      <p className="text-xs text-gray-500 mt-0.5">From: {msg.inquirerName}</p>
                    </Link>
                  ))}
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link href="/messages">
                      View All Messages
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setQuickCreateType("deal")}
                >
                  <Kanban className="h-4 w-4 mr-2" />
                  Create Deal
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setQuickCreateType("contact")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setQuickCreateType("company")}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/dashboard?mode=cim">
                    <FileText className="h-4 w-4 mr-2" />
                    Create CIM
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            {briefing?.recentActivity && briefing.recentActivity.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {briefing.recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">{activity.description}</p>
                          <p className="text-xs text-gray-400">{formatTimeAgo(activity.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
