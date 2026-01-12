import { useState, useCallback, useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  GripVertical,
  Building2,
  DollarSign,
  Calendar,
  MoreHorizontal,
  Trash2,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Check,
  X,
  Clock,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useDealFilters, DEFAULT_FILTERS, DEFAULT_SORTING, DEFAULT_COLUMNS } from "@/hooks/use-deal-filters";
import { DealsQuickFilters } from "@/components/crm/deals-quick-filters";
import { DealsAdvancedFilters } from "@/components/crm/deals-advanced-filters";
import { DealsViewManager } from "@/components/crm/deals-view-manager";
import { DealsColumnConfig } from "@/components/crm/deals-column-config";

interface Deal {
  id: number;
  name: string;
  amount: string | null;
  currency: string;
  stageId: number;
  pipelineId: number;
  closeDate: string | null;
  companyId: number | null;
  ownerId: number | null;
  priority: string | null;
  source: string | null;
  company?: { id: number; name: string } | null;
  stage?: { id: number; name: string; color: string; probability: number };
  createdAt: string;
}

interface Stage {
  id: number;
  name: string;
  displayOrder: number;
  probability: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  deals: Deal[];
}

interface Pipeline {
  id: number;
  name: string;
  isDefault: boolean;
  stages: Stage[];
}

interface DealsResponse {
  deals: Deal[];
  total: number;
  page: number;
  limit: number;
  aggregates: {
    count: number;
    totalAmount: number;
    avgAmount: number;
    weightedAmount: number;
  };
}

// Helper to calculate days since a date
function getDaysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Get color for days indicator based on age
function getDaysColor(days: number): string {
  if (days <= 7) return "text-green-600";
  if (days <= 14) return "text-yellow-600";
  if (days <= 30) return "text-orange-500";
  return "text-red-500";
}

// Draggable Deal Card Component
function DealCard({ deal, isDragging, isOverlay }: { deal: Deal; isDragging?: boolean; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isCurrentlyDragging } = useDraggable({
    id: deal.id,
    data: deal,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isCurrentlyDragging ? 0 : (isDragging ? 0.5 : 1),
    transition: isCurrentlyDragging ? 'none' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isOverlay ? "ring-2 ring-blue-500 shadow-lg" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start gap-3">
        <GripVertical className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <Link href={`/deals/${deal.id}`}>
            <h4 className="font-medium text-base text-gray-900 truncate hover:text-blue-600">
              {deal.name}
            </h4>
          </Link>
          {deal.company && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate">{deal.company.name}</span>
            </div>
          )}
          {deal.amount && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600 mt-2">
              <DollarSign className="h-3.5 w-3.5" />
              <span>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: deal.currency || "USD",
                  minimumFractionDigits: 0,
                }).format(parseFloat(deal.amount))}
              </span>
            </div>
          )}
          {deal.closeDate && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>{new Date(deal.closeDate).toLocaleDateString()}</span>
            </div>
          )}
          {/* Days in pipeline indicator */}
          {deal.createdAt && (
            <div className={`flex items-center gap-1.5 text-xs mt-2 ${getDaysColor(getDaysSince(deal.createdAt))}`}>
              <Clock className="h-3 w-3" />
              <span>{getDaysSince(deal.createdAt)}d in pipeline</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Droppable Stage Column
function StageColumn({
  stage,
  children,
}: {
  stage: Stage;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: stage,
  });

  const dealCount = stage.deals?.length || 0;
  const totalValue = stage.deals?.reduce((sum, deal) => {
    return sum + (deal.amount ? parseFloat(deal.amount) : 0);
  }, 0) || 0;

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 bg-gray-50 rounded-lg ${
        isOver ? "ring-2 ring-blue-400 bg-blue-50" : ""
      }`}
    >
      <div
        className="p-3 border-b bg-white rounded-t-lg"
        style={{ borderTopColor: stage.color, borderTopWidth: 3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-medium text-sm text-gray-900">{stage.name}</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {dealCount}
            </span>
          </div>
          <span className="text-xs text-gray-500">{stage.probability}%</span>
        </div>
        {totalValue > 0 && (
          <div className="text-xs text-green-600 font-medium mt-1">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 0,
            }).format(totalValue)}
          </div>
        )}
      </div>
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

// Inline Editable Cell
function InlineEditableCell({
  value,
  onSave,
  type = 'text',
  options,
  renderValue,
}: {
  value: string | number | null;
  onSave: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'select' | 'currency';
  options?: { value: string; label: string; color?: string }[];
  renderValue?: (value: any) => React.ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(value ?? ''));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (isEditing) {
    if (type === 'select' && options) {
      return (
        <Select value={editValue} onValueChange={(val) => { setEditValue(val); onSave(val); setIsEditing(false); }}>
          <SelectTrigger className="h-7 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.color && (
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: opt.color }} />
                )}
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <Input
          type={type === 'currency' ? 'number' : type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm w-full"
          autoFocus
        />
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSave}>
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCancel}>
          <X className="h-3.5 w-3.5 text-gray-400" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 min-h-[24px] flex items-center"
      onDoubleClick={() => setIsEditing(true)}
      title="Double-click to edit"
    >
      {renderValue ? renderValue(value) : (value ?? '-')}
    </div>
  );
}

// Sortable Column Header
function SortableHeader({
  label,
  field,
  currentSort,
  onSort,
  className = '',
  style,
}: {
  label: string;
  field: string;
  currentSort: { field: string; direction: 'asc' | 'desc' };
  onSort: (field: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const isActive = currentSort.field === field;

  return (
    <th
      className={`text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none ${className}`}
      style={style}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentSort.direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-gray-300" />
        )}
      </div>
    </th>
  );
}

export default function DealsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [newDeal, setNewDeal] = useState({
    name: "",
    amount: "",
    closeDate: "",
    companyId: "",
  });

  // Use the filters hook
  const {
    filters,
    updateFilter,
    updateCustomFieldFilter,
    clearFilters,
    activeFilterCount,
    sorting,
    toggleSort,
    columns,
    visibleColumns,
    toggleColumnVisibility,
    reorderColumns,
    viewMode,
    setViewMode,
    buildQueryParams,
    applyView,
    getCurrentViewConfig,
  } = useDealFilters();

  // Fetch pipelines with stages
  const { data: pipelines, isLoading: pipelinesLoading } = useQuery<Pipeline[]>({
    queryKey: ["/api/crm/pipelines"],
  });

  const defaultPipeline = pipelines?.[0];
  const allStages = defaultPipeline?.stages || [];

  // Fetch deals with filters (for list view)
  const queryParams = buildQueryParams();
  const { data: dealsData, isLoading: dealsLoading } = useQuery<DealsResponse>({
    queryKey: ["/api/crm/deals", queryParams],
    queryFn: () => apiRequest("GET", `/api/crm/deals?${queryParams}`).then(res => res.json()),
    enabled: viewMode === 'list',
  });

  // Fetch Kanban data
  const { data: kanbanData, isLoading: kanbanLoading } = useQuery({
    queryKey: ["/api/crm/deals/kanban", defaultPipeline?.id],
    queryFn: () =>
      defaultPipeline
        ? apiRequest("GET", `/api/crm/deals/kanban/${defaultPipeline.id}`).then(res => res.json())
        : null,
    enabled: !!defaultPipeline?.id && viewMode === 'kanban',
  });

  // Fetch companies
  const { data: companiesData } = useQuery({
    queryKey: ["/api/crm/companies"],
  });
  const companies = (companiesData as any)?.companies || [];

  // Fetch organization members for owners
  const { data: membersData } = useQuery({
    queryKey: ["/api/crm/members"],
  });
  const members = (membersData as any)?.members || [];

  // Fetch custom fields for deals
  const { data: customFieldsData } = useQuery<{ fields: { id: number; name: string; label: string; fieldType: string; options?: { value: string; label: string }[] }[] }>({
    queryKey: ["/api/crm/custom-fields", "deal"],
    queryFn: () => apiRequest("GET", "/api/crm/custom-fields?objectType=deal").then(res => res.json()),
  });
  const customFields = customFieldsData?.fields || [];

  // Get current user ID from auth
  const currentUserId = user?.id ?? null;

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Move deal mutation
  const moveDealMutation = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: number; stageId: number }) =>
      apiRequest("POST", `/api/crm/deals/${dealId}/move`, {
        body: { stageId },
      }).then(res => res.json()),
    onMutate: async ({ dealId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/crm/deals/kanban", defaultPipeline?.id] });
      const previousKanban = queryClient.getQueryData(["/api/crm/deals/kanban", defaultPipeline?.id]);

      queryClient.setQueryData(["/api/crm/deals/kanban", defaultPipeline?.id], (old: any) => {
        if (!old?.stages) return old;
        const newStages = old.stages.map((stage: Stage) => {
          const filteredDeals = stage.deals?.filter((d: Deal) => d.id !== dealId) || [];
          if (stage.id === stageId) {
            const movedDeal = old.stages
              .flatMap((s: Stage) => s.deals || [])
              .find((d: Deal) => d.id === dealId);
            if (movedDeal) {
              return { ...stage, deals: [...filteredDeals, { ...movedDeal, stageId }] };
            }
          }
          return { ...stage, deals: filteredDeals };
        });
        return { ...old, stages: newStages };
      });

      return { previousKanban };
    },
    onError: (err, variables, context) => {
      if (context?.previousKanban) {
        queryClient.setQueryData(["/api/crm/deals/kanban", defaultPipeline?.id], context.previousKanban);
      }
      toast({ title: "Error", description: "Failed to move deal", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
    },
  });

  // Update deal mutation (for inline editing)
  const updateDealMutation = useMutation({
    mutationFn: ({ dealId, data }: { dealId: number; data: any }) =>
      apiRequest("PATCH", `/api/crm/deals/${dealId}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update deal", variant: "destructive" });
    },
  });

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/crm/deals", { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"] });
      setIsCreateDialogOpen(false);
      setNewDeal({ name: "", amount: "", closeDate: "", companyId: "" });
      toast({ title: "Deal created", description: "Your new deal has been created successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create deal", variant: "destructive" });
    },
  });

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: (dealId: number) =>
      apiRequest("DELETE", `/api/crm/deals/${dealId}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"] });
      toast({ title: "Deal deleted" });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDeal(event.active.data.current as Deal);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    if (!over) return;

    const dealId = active.id as number;
    const overId = over.id as string;

    if (overId.startsWith("stage-")) {
      const stageId = parseInt(overId.replace("stage-", ""));
      const deal = active.data.current as Deal;
      if (deal.stageId !== stageId) {
        moveDealMutation.mutate({ dealId, stageId });
      }
    }
  };

  const handleCreateDeal = () => {
    if (!newDeal.name.trim()) {
      toast({ title: "Error", description: "Deal name is required", variant: "destructive" });
      return;
    }
    createDealMutation.mutate({
      name: newDeal.name,
      amount: newDeal.amount || null,
      closeDate: newDeal.closeDate || null,
      companyId: newDeal.companyId ? parseInt(newDeal.companyId) : null,
    });
  };

  const handleInlineEdit = (dealId: number, field: string, value: string) => {
    updateDealMutation.mutate({ dealId, data: { [field]: value || null } });
  };

  const stages = (kanbanData as any)?.stages || [];
  const deals = dealsData?.deals || [];
  const aggregates = dealsData?.aggregates;

  // Export deals to CSV
  const handleExport = () => {
    const exportDeals = viewMode === 'kanban'
      ? stages.flatMap((s: Stage) => s.deals || [])
      : deals;

    if (exportDeals.length === 0) {
      toast({ title: "No deals to export", variant: "destructive" });
      return;
    }

    const headers = ["Name", "Company", "Stage", "Value", "Currency", "Close Date", "Priority", "Source", "Days in Pipeline", "Created"];
    const rows = exportDeals.map((d: Deal) => [
      d.name || "",
      d.company?.name || "",
      d.stage?.name || "",
      d.amount || "",
      d.currency || "USD",
      d.closeDate ? new Date(d.closeDate).toLocaleDateString() : "",
      d.priority || "",
      d.source || "",
      d.createdAt ? getDaysSince(d.createdAt) : "",
      d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `deals-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: `Exported ${exportDeals.length} deals` });
  };

  const isLoading = pipelinesLoading || (viewMode === 'kanban' ? kanbanLoading : dealsLoading);

  // Filter deals for kanban based on search
  const filteredKanbanStages = useMemo(() => {
    if (!filters.search) return stages;
    return stages.map((stage: Stage) => ({
      ...stage,
      deals: stage.deals?.filter((deal: Deal) =>
        deal.name.toLowerCase().includes(filters.search.toLowerCase())
      ),
    }));
  }, [stages, filters.search]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-72 h-96 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Deals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your sales pipeline and track deal progress
          </p>
        </div>
        <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Deal
        </Button>
      </div>

      {/* Toolbar Row 1: Search, View Toggle, View Manager */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search deals..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <DealsViewManager
            currentFilters={filters}
            currentColumns={columns}
            currentSorting={sorting}
            currentViewMode={viewMode}
            onApplyView={applyView}
          />
        </div>
      </div>

      {/* Toolbar Row 2: Quick Filters, Advanced Filters, Column Config */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b pb-3">
        <DealsQuickFilters
          filters={filters}
          onFilterChange={updateFilter}
          onClearFilters={clearFilters}
          stages={allStages}
          currentUserId={currentUserId}
          activeFilterCount={activeFilterCount}
        />
        <div className="flex items-center gap-2 ml-auto">
          <DealsAdvancedFilters
            filters={filters}
            onFilterChange={updateFilter}
            onCustomFieldFilterChange={updateCustomFieldFilter}
            onClearFilters={clearFilters}
            companies={companies}
            owners={members.map((m: any) => ({ id: m.userId, name: m.user?.email || `User ${m.userId}` }))}
            customFields={customFields}
            activeFilterCount={activeFilterCount}
          />
          {viewMode === 'list' && (
            <DealsColumnConfig
              columns={columns}
              onToggleVisibility={toggleColumnVisibility}
              onReorder={reorderColumns}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === "kanban" && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {filteredKanbanStages.map((stage: Stage) => (
              <StageColumn key={stage.id} stage={stage}>
                {stage.deals?.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </StageColumn>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDeal ? <DealCard deal={activeDeal} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="w-full bg-white rounded-lg border overflow-x-auto">
          <table className="w-full table-auto">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {visibleColumns.map((col) => {
                    const sortable = ['name', 'amount', 'closeDate', 'createdAt', 'stage', 'company', 'priority'].includes(col.id);
                    // Name column expands to fill remaining space, others size to content
                    const widthStyle = col.id === 'name' ? { width: '100%' } : { whiteSpace: 'nowrap' as const };
                    if (sortable) {
                      return (
                        <SortableHeader
                          key={col.id}
                          label={col.label}
                          field={col.id}
                          currentSort={sorting}
                          onSort={toggleSort}
                          style={widthStyle}
                        />
                      );
                    }
                    return (
                      <th
                        key={col.id}
                        className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase"
                        style={widthStyle}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                  <th
                    className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-b hover:bg-gray-50">
                    {visibleColumns.map((col) => (
                      <td
                        key={col.id}
                        className="py-3 px-4"
                        style={col.id === 'name' ? { width: '100%' } : { whiteSpace: 'nowrap' }}
                      >
                        {col.id === 'name' && (
                          <InlineEditableCell
                            value={deal.name}
                            onSave={(val) => handleInlineEdit(deal.id, 'name', val)}
                            renderValue={() => (
                              <Link href={`/deals/${deal.id}`} className="font-medium text-blue-600 hover:underline">
                                {deal.name}
                              </Link>
                            )}
                          />
                        )}
                        {col.id === 'company' && (
                          <span className="text-gray-500">{deal.company?.name || '-'}</span>
                        )}
                        {col.id === 'stage' && deal.stage && (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: deal.stage.color + '20',
                              color: deal.stage.color,
                              border: `1px solid ${deal.stage.color}40`,
                            }}
                          >
                            {deal.stage.name}
                          </span>
                        )}
                        {col.id === 'amount' && (
                          <InlineEditableCell
                            value={deal.amount}
                            type="currency"
                            onSave={(val) => handleInlineEdit(deal.id, 'amount', val)}
                            renderValue={(val) =>
                              val
                                ? new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: deal.currency || "USD",
                                    minimumFractionDigits: 0,
                                  }).format(parseFloat(val))
                                : '-'
                            }
                          />
                        )}
                        {col.id === 'closeDate' && (
                          <InlineEditableCell
                            value={deal.closeDate ? new Date(deal.closeDate).toISOString().split('T')[0] : null}
                            type="date"
                            onSave={(val) => handleInlineEdit(deal.id, 'closeDate', val)}
                            renderValue={(val) => val ? new Date(val).toLocaleDateString() : '-'}
                          />
                        )}
                        {col.id === 'priority' && (
                          <InlineEditableCell
                            value={deal.priority}
                            type="select"
                            options={[
                              { value: 'low', label: 'Low' },
                              { value: 'normal', label: 'Normal' },
                              { value: 'high', label: 'High' },
                              { value: 'urgent', label: 'Urgent' },
                            ]}
                            onSave={(val) => handleInlineEdit(deal.id, 'priority', val)}
                            renderValue={(val) => val ? (
                              <span className={`capitalize ${val === 'high' || val === 'urgent' ? 'text-red-600' : 'text-gray-600'}`}>
                                {val}
                              </span>
                            ) : '-'}
                          />
                        )}
                        {col.id === 'owner' && (
                          <span className="text-gray-500">{deal.ownerId ? `User ${deal.ownerId}` : '-'}</span>
                        )}
                        {col.id === 'source' && (
                          <span className="text-gray-500">{deal.source || '-'}</span>
                        )}
                        {col.id === 'createdAt' && (
                          <span className="text-gray-500">{new Date(deal.createdAt).toLocaleDateString()}</span>
                        )}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/deals/${deal.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteDealMutation.mutate(deal.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {deals.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-gray-500">
                      No deals found. Try adjusting your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

          {/* Summary Row */}
          {aggregates && deals.length > 0 && (
            <div className="bg-gray-50 border-t px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Total:</span>
                <span className="font-semibold text-gray-900">{aggregates.count} deals</span>
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Value:</span>
                <span className="font-semibold text-green-600">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(aggregates.totalAmount)}
                </span>
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Avg:</span>
                <span className="font-semibold text-gray-900">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(aggregates.avgAmount)}
                </span>
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Weighted:</span>
                <span className="font-semibold text-blue-600">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(aggregates.weightedAmount)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Deal Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Deal Name *</Label>
              <Input
                id="name"
                value={newDeal.name}
                onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                placeholder="e.g., Acme Corp Acquisition"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Deal Value</Label>
              <Input
                id="amount"
                type="number"
                value={newDeal.amount}
                onChange={(e) => setNewDeal({ ...newDeal, amount: e.target.value })}
                placeholder="e.g., 500000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Select
                value={newDeal.companyId}
                onValueChange={(value) => setNewDeal({ ...newDeal, companyId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company: any) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closeDate">Expected Close Date</Label>
              <Input
                id="closeDate"
                type="date"
                value={newDeal.closeDate}
                onChange={(e) => setNewDeal({ ...newDeal, closeDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDeal} disabled={createDealMutation.isPending}>
              {createDealMutation.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
