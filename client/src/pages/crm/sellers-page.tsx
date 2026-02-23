import { useState, useMemo, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { TablePagination } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Users,
  Building2,
  Download,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Trash2,
  LayoutGrid,
  List,
  DollarSign,
  TrendingUp,
  Calendar,
  ChevronRight,
} from "lucide-react";

function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

const SELLER_STAGES = [
  { id: 'lead', label: 'Lead', color: '#6B7280' },
  { id: 'meeting', label: 'Meeting', color: '#3B82F6' },
  { id: 'proposal', label: 'Proposal', color: '#F59E0B' },
  { id: 'engaged', label: 'Engaged', color: '#10B981' },
];

const REVENUE_RANGES: Record<string, string> = {
  under_500k: 'Under $500K',
  '500k_1m': '$500K-$1M',
  '1m_5m': '$1M-$5M',
  '5m_10m': '$5M-$10M',
  '10m_25m': '$10M-$25M',
  '25m_plus': '$25M+',
};

const TIMELINE_LABELS: Record<string, string> = {
  immediate: 'Immediate',
  '3_months': '3 Months',
  '6_months': '6 Months',
  '12_months': '12 Months',
  flexible: 'Flexible',
};

function getDaysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

// Seller Kanban Card
const SellerCard = memo(function SellerCard({ seller, isOverlay }: { seller: any; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: seller.id,
    data: seller,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0 : 1,
    transition: isDragging ? 'none' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing p-3 ${
        isOverlay ? "ring-2 ring-blue-500 shadow-lg" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      <Link href={`/sellers/${seller.id}`}>
        <h4 className="font-medium text-gray-900 truncate hover:text-blue-600 text-sm">
          {seller.firstName} {seller.lastName}
        </h4>
      </Link>
      {seller.sellerIndustry && (
        <div className="flex items-center gap-1.5 text-gray-500 text-xs mt-1.5">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{seller.sellerIndustry}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {seller.sellerRevenueRange && (
          <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
            {REVENUE_RANGES[seller.sellerRevenueRange] || seller.sellerRevenueRange}
          </span>
        )}
        {seller.sellerAskingPrice && (
          <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <DollarSign className="h-2.5 w-2.5" />{seller.sellerAskingPrice}
          </span>
        )}
      </div>
      {seller.sellerTimeline && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1.5">
          <Calendar className="h-3 w-3" />
          <span>{TIMELINE_LABELS[seller.sellerTimeline] || seller.sellerTimeline}</span>
        </div>
      )}
      {seller.createdAt && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
          <Clock className="h-3 w-3" />
          <span>{getDaysSince(seller.createdAt)}d in stage</span>
        </div>
      )}
    </div>
  );
});

// Stage Column for Kanban
const StageColumn = memo(function StageColumn({ stage, children, count }: { stage: typeof SELLER_STAGES[0]; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: stage,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 bg-gray-50 rounded-lg ${isOver ? "ring-2 ring-blue-400 bg-blue-50" : ""}`}
    >
      <div className="p-3 border-b bg-white rounded-t-lg" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="font-medium text-sm text-gray-900">{stage.label}</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{count}</span>
        </div>
      </div>
      <div className="p-2 space-y-2 min-h-[100px] max-h-[calc(100vh-280px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
});

export default function SellersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({ queryKey: ["/api/profile"], enabled: !!user });
  const brandColor = (profile as any)?.pdfPrimaryColor || (profile as any)?.brandColors?.[0];
  const needsDarkText = brandColor ? isLightColor(brandColor) : false;

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSeller, setNewSeller] = useState({
    email: "", firstName: "", lastName: "", phone: "",
    sellerRevenueRange: "", sellerProfitRange: "", sellerIndustry: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [activeSeller, setActiveSeller] = useState<any>(null);

  // Fetch sellers
  const { data, isLoading } = useQuery({
    queryKey: ["/api/crm/contacts", "seller", searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('contactType', 'seller');
      if (searchQuery) params.set('search', searchQuery);
      return apiRequest("GET", `/api/crm/contacts?${params.toString()}`).then(res => res.json());
    },
  });

  const allSellers = (data as any)?.contacts || [];

  // Group sellers by stage for Kanban
  const sellersByStage = useMemo(() => {
    const grouped: Record<string, any[]> = {
      lead: [], meeting: [], proposal: [], engaged: [],
    };
    let filtered = allSellers;
    if (stageFilter) {
      filtered = filtered.filter((s: any) => s.sellerStage === stageFilter);
    }
    for (const seller of filtered) {
      const stage = seller.sellerStage || 'lead';
      if (grouped[stage]) {
        grouped[stage].push(seller);
      } else {
        grouped.lead.push(seller);
      }
    }
    return grouped;
  }, [allSellers, stageFilter]);

  // Filtered + sorted for table view
  const filteredSellers = useMemo(() => {
    let result = allSellers;
    if (stageFilter) result = result.filter((s: any) => s.sellerStage === stageFilter);
    // Sort
    result = [...result].sort((a: any, b: any) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [allSellers, stageFilter, sortField, sortDirection]);

  const totalItems = filteredSellers.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedSellers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSellers.slice(start, start + pageSize);
  }, [filteredSellers, currentPage, pageSize]);

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const moveStageMutation = useMutation({
    mutationFn: ({ contactId, stage }: { contactId: number; stage: string }) =>
      apiRequest("PATCH", `/api/crm/contacts/${contactId}`, { body: { sellerStage: stage } }).then(res => res.json()),
    onMutate: async ({ contactId, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/crm/contacts", "seller"] });
      const prev = queryClient.getQueryData(["/api/crm/contacts", "seller", searchQuery]);
      queryClient.setQueryData(["/api/crm/contacts", "seller", searchQuery], (old: any) => {
        if (!old?.contacts) return old;
        return {
          ...old,
          contacts: old.contacts.map((c: any) => c.id === contactId ? { ...c, sellerStage: stage } : c),
        };
      });
      return { prev };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/crm/contacts", "seller", searchQuery], ctx.prev);
      toast({ title: "Error", description: "Failed to move seller", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveSeller(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSeller(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('stage-')) return;
    const newStage = overId.replace('stage-', '');
    const seller = active.data.current as any;
    if (seller.sellerStage === newStage || (!seller.sellerStage && newStage === 'lead')) return;
    moveStageMutation.mutate({ contactId: seller.id, stage: newStage });
  };

  const createSellerMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/crm/contacts", { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      setIsCreateDialogOpen(false);
      setNewSeller({ email: "", firstName: "", lastName: "", phone: "", sellerRevenueRange: "", sellerProfitRange: "", sellerIndustry: "" });
      toast({ title: "Seller created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create seller", variant: "destructive" });
    },
  });

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  const getStageBadge = (stage: string) => {
    const colors: Record<string, string> = {
      lead: 'bg-gray-100 text-gray-700',
      meeting: 'bg-blue-100 text-blue-700',
      proposal: 'bg-yellow-100 text-yellow-700',
      engaged: 'bg-green-100 text-green-700',
    };
    return <Badge className={`${colors[stage] || colors.lead} text-xs`}>{stage.charAt(0).toUpperCase() + stage.slice(1)}</Badge>;
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    try {
      await Promise.all(Array.from(selectedContacts).map(id => apiRequest("DELETE", `/api/crm/contacts/${id}`)));
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      toast({ title: `${selectedContacts.size} seller(s) deleted` });
      setSelectedContacts(new Set());
    } catch { toast({ title: "Error", description: "Failed to delete some sellers", variant: "destructive" }); }
  };

  const handleExport = () => {
    if (filteredSellers.length === 0) return;
    const headers = ["First Name", "Last Name", "Email", "Phone", "Industry", "Stage", "Revenue Range", "Profit Range", "Asking Price", "Timeline", "Created"];
    const rows = filteredSellers.map((c: any) => [
      c.firstName || "", c.lastName || "", c.email || "", c.phone || "",
      c.sellerIndustry || "", c.sellerStage || "lead",
      REVENUE_RANGES[c.sellerRevenueRange] || c.sellerRevenueRange || "",
      c.sellerProfitRange || "", c.sellerAskingPrice || "",
      TIMELINE_LABELS[c.sellerTimeline] || c.sellerTimeline || "",
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
    ]);
    const csvContent = [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sellers-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: `Exported ${filteredSellers.length} sellers` });
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 p-2 md:p-2.5 rounded-lg md:rounded-xl shadow-md"
            style={{
              background: brandColor
                ? `linear-gradient(to bottom right, ${brandColor}, ${brandColor}dd)`
                : 'linear-gradient(to bottom right, #3B82F6, #2563EB)'
            }}
          >
            <Users className={`h-5 w-5 ${needsDarkText ? 'text-slate-800' : 'text-white'}`} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Sellers</h1>
            <p className="text-sm text-gray-500">{allSellers.length} seller{allSellers.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search sellers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full sm:w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Select value={stageFilter || "all"} onValueChange={(val) => setStageFilter(val === "all" ? "" : val)}>
              <SelectTrigger className="w-[130px] h-8">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {SELLER_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* View toggle */}
            <div className="flex items-center border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 ${viewMode === 'kanban' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title="Kanban view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 ${viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredSellers.length === 0} title="Export to CSV">
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} className="h-8">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Seller</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : allSellers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No sellers yet</h3>
          <p className="text-gray-500 mt-1">Get started by adding your first seller contact.</p>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />Add Seller
          </Button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {SELLER_STAGES.map((stage) => (
              <StageColumn key={stage.id} stage={stage} count={sellersByStage[stage.id]?.length || 0}>
                {(sellersByStage[stage.id] || []).map((seller: any) => (
                  <SellerCard key={seller.id} seller={seller} />
                ))}
              </StageColumn>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeSeller ? <SellerCard seller={activeSeller} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Table View */
        <>
          {/* Bulk Actions */}
          {selectedContacts.size > 0 && (
            <div className="flex bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-900">{selectedContacts.size} selected</span>
                <Button variant="outline" size="sm" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleBulkDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedContacts(new Set())} className="h-8"><X className="h-3.5 w-3.5 mr-1" />Clear</Button>
            </div>
          )}

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="py-2 px-3 w-10">
                      <Checkbox
                        checked={paginatedSellers.length > 0 && selectedContacts.size === paginatedSellers.length}
                        onCheckedChange={() => {
                          if (selectedContacts.size === paginatedSellers.length) setSelectedContacts(new Set());
                          else setSelectedContacts(new Set(paginatedSellers.map((s: any) => s.id)));
                        }}
                        className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                      />
                    </th>
                    {[
                      { id: 'name', label: 'Name', width: '20%' },
                      { id: 'email', label: 'Email', width: '18%' },
                      { id: 'industry', label: 'Industry', width: '14%' },
                      { id: 'sellerStage', label: 'Stage', width: '10%' },
                      { id: 'sellerRevenueRange', label: 'Revenue', width: '12%' },
                      { id: 'sellerProfitRange', label: 'Profit', width: '10%' },
                      { id: 'sellerAskingPrice', label: 'Asking Price', width: '10%' },
                      { id: 'lastActivity', label: 'Activity', width: '6%' },
                    ].map(col => (
                      <th
                        key={col.id}
                        className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        style={{ width: col.width }}
                        onClick={() => toggleSort(col.id)}
                      >
                        <div className="flex items-center gap-1">{col.label}{getSortIcon(col.id)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSellers.map((seller: any) => (
                    <tr key={seller.id} className={`border-b hover:bg-gray-50/50 ${selectedContacts.has(seller.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="py-2 px-3 w-10">
                        <Checkbox
                          checked={selectedContacts.has(seller.id)}
                          onCheckedChange={() => {
                            setSelectedContacts(prev => {
                              const next = new Set(prev);
                              if (next.has(seller.id)) next.delete(seller.id); else next.add(seller.id);
                              return next;
                            });
                          }}
                          className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Link href={`/sellers/${seller.id}`} className="flex items-center gap-2 group">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-medium flex-shrink-0">
                            {(seller.firstName?.[0] || '').toUpperCase()}{(seller.lastName?.[0] || '').toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">{seller.firstName} {seller.lastName}</span>
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-600 truncate">{seller.email || '-'}</td>
                      <td className="py-2 px-3 text-sm text-gray-600 truncate">{seller.sellerIndustry || '-'}</td>
                      <td className="py-2 px-3">{getStageBadge(seller.sellerStage || 'lead')}</td>
                      <td className="py-2 px-3 text-sm text-gray-600">{REVENUE_RANGES[seller.sellerRevenueRange] || seller.sellerRevenueRange || '-'}</td>
                      <td className="py-2 px-3 text-sm text-gray-600">{seller.sellerProfitRange ? seller.sellerProfitRange.replace(/_/g, ' ') : '-'}</td>
                      <td className="py-2 px-3 text-sm text-gray-600">{seller.sellerAskingPrice || '-'}</td>
                      <td className="py-2 px-3">
                        {seller.lastActivityDate ? (
                          <span className="text-xs text-gray-500">{getDaysSince(seller.lastActivityDate)}d ago</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
          </div>
        </>
      )}

      {/* Create Seller Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Seller</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={newSeller.firstName} onChange={(e) => setNewSeller({ ...newSeller, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={newSeller.lastName} onChange={(e) => setNewSeller({ ...newSeller, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={newSeller.email} onChange={(e) => setNewSeller({ ...newSeller, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={newSeller.phone} onChange={(e) => setNewSeller({ ...newSeller, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Revenue Range</Label>
                <Select value={newSeller.sellerRevenueRange || "none"} onValueChange={(val) => setNewSeller({ ...newSeller, sellerRevenueRange: val === "none" ? "" : val })}>
                  <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="under_500k">Under $500K</SelectItem>
                    <SelectItem value="500k_1m">$500K-$1M</SelectItem>
                    <SelectItem value="1m_5m">$1M-$5M</SelectItem>
                    <SelectItem value="5m_10m">$5M-$10M</SelectItem>
                    <SelectItem value="10m_25m">$10M-$25M</SelectItem>
                    <SelectItem value="25m_plus">$25M+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Profit Range</Label>
                <Select value={newSeller.sellerProfitRange || "none"} onValueChange={(val) => setNewSeller({ ...newSeller, sellerProfitRange: val === "none" ? "" : val })}>
                  <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="under_100k">Under $100K</SelectItem>
                    <SelectItem value="100k_250k">$100K-$250K</SelectItem>
                    <SelectItem value="250k_500k">$250K-$500K</SelectItem>
                    <SelectItem value="500k_1m">$500K-$1M</SelectItem>
                    <SelectItem value="1m_5m">$1M-$5M</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={newSeller.sellerIndustry} onChange={(e) => setNewSeller({ ...newSeller, sellerIndustry: e.target.value })} placeholder="e.g. Manufacturing, SaaS, Healthcare" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSellerMutation.mutate({
                ...newSeller,
                contactType: 'seller',
                sellerStage: 'lead',
                sellerRevenueRange: newSeller.sellerRevenueRange || null,
                sellerProfitRange: newSeller.sellerProfitRange || null,
                sellerIndustry: newSeller.sellerIndustry || null,
              })}
              disabled={!newSeller.email.trim() || createSellerMutation.isPending}
            >
              {createSellerMutation.isPending ? "Creating..." : "Create Seller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
