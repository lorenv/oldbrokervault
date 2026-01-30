import { useState, useCallback, useMemo, useEffect } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Building2,
  Calendar,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  Clock,
  Download,
  Upload,
  User,
  Users,
  BriefcaseBusiness,
  Pencil,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { useDealFilters, DEFAULT_FILTERS, DEFAULT_SORTING, DEFAULT_COLUMNS } from "@/hooks/use-deal-filters";
import { DealsFilterBuilderIntegration } from "@/components/crm/deals-filter-builder-integration";
import { DealsViewManager } from "@/components/crm/deals-view-manager";
import { DealsColumnConfig } from "@/components/crm/deals-column-config";
import { TablePagination } from "@/components/ui/pagination";

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
  owner?: { id: number; email: string; firstName: string | null; lastName: string | null } | null;
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
  const isMobile = useIsMobile();

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isCurrentlyDragging ? 0 : (isDragging ? 0.5 : 1),
    transition: isCurrentlyDragging ? 'none' : undefined,
  };

  const ownerName = deal.owner
    ? (deal.owner.name ||
       (deal.owner.firstName && deal.owner.lastName
         ? `${deal.owner.firstName} ${deal.owner.lastName}`
         : deal.owner.email))
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isMobile ? "p-5 min-h-[120px]" : "p-4"
      } ${isOverlay ? "ring-2 ring-blue-500 shadow-lg" : ""}`}
      {...listeners}
      {...attributes}
    >
      <div className="flex-1 min-w-0">
        <Link href={`/deals/${deal.id}`}>
          <h4 className={`font-medium text-gray-900 truncate hover:text-blue-600 ${
            isMobile ? "text-lg mb-3" : "text-base"
          }`}>
            {deal.name}
          </h4>
        </Link>
        {deal.company && (
          <div className={`flex items-center gap-1.5 text-gray-500 ${isMobile ? "text-base mt-3" : "text-sm mt-2"}`}>
            <Building2 className={isMobile ? "h-4 w-4" : "h-3.5 w-3.5"} />
            <span className="truncate">{deal.company.name}</span>
          </div>
        )}
        {deal.amount && (
          <div className={`font-semibold text-green-600 ${isMobile ? "text-base mt-3" : "text-sm mt-2"}`}>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: deal.currency || "USD",
              minimumFractionDigits: 0,
            }).format(parseFloat(deal.amount))}
          </div>
        )}
        {deal.closeDate && (
          <div className={`flex items-center gap-1.5 text-gray-500 ${isMobile ? "text-sm mt-3" : "text-sm mt-2"}`}>
            <Calendar className={isMobile ? "h-4 w-4" : "h-3.5 w-3.5"} />
            <span>{new Date(deal.closeDate).toLocaleDateString()}</span>
          </div>
        )}
        {/* Owner name */}
        {ownerName && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
            {deal.owner?.profilePhoto ? (
              <img
                src={deal.owner.profilePhoto}
                alt={ownerName}
                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-blue-600">
                  {ownerName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="truncate">{ownerName}</span>
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

  const displayValue = renderValue ? renderValue(value) : (value ?? '-');

  return (
    <div
      className="cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 min-h-[24px] flex items-center text-sm"
      onDoubleClick={() => setIsEditing(true)}
      title="Double-click to edit"
    >
      <span className="text-sm text-gray-900">{displayValue}</span>
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
      className={`text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none ${className || 'py-2 px-3'}`}
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

// Helper to determine if a color is light (needs dark text)
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

export default function DealsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Get brand color from profile
  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });
  const brandColor = (profile as any)?.brandColors?.[0];
  const needsDarkText = brandColor ? isLightColor(brandColor) : false;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [newDeal, setNewDeal] = useState({
    name: "",
    amount: "",
    closeDate: "",
    companyId: "",
    ownerId: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedDeals, setSelectedDeals] = useState<Set<number>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditProperty, setBulkEditProperty] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState<string>("");

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
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/deals?${queryParams}`);
      const data = await res.json();
      console.log('[DealsPage] First deal owner:', data.deals?.[0]?.owner);
      return data;
    },
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
  const { data: membersData } = useQuery<{ id: number; userId: number; email: string; firstName: string | null; lastName: string | null }[]>({
    queryKey: ["/api/crm/organization/members"],
    queryFn: () => apiRequest("GET", "/api/crm/organization/members").then(res => res.json()),
  });
  const members = membersData || [];

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
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
    },
  });

  // Update deal mutation (for inline editing)
  const updateDealMutation = useMutation({
    mutationFn: ({ dealId, data }: { dealId: number; data: any }) =>
      apiRequest("PATCH", `/api/crm/deals/${dealId}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
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
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
      setIsCreateDialogOpen(false);
      setNewDeal({ name: "", amount: "", closeDate: "", companyId: "", ownerId: "" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
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
      ownerId: newDeal.ownerId ? parseInt(newDeal.ownerId) : null,
    });
  };

  const handleInlineEdit = (dealId: number, field: string, value: string) => {
    updateDealMutation.mutate({ dealId, data: { [field]: value || null } });
  };

  // Selection handlers
  const toggleSelectDeal = (dealId: number) => {
    setSelectedDeals(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDeals.size === deals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(deals.map(d => d.id)));
    }
  };

  const clearSelection = () => {
    setSelectedDeals(new Set());
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedDeals.size === 0) return;
    const promises = Array.from(selectedDeals).map(id =>
      apiRequest("DELETE", `/api/crm/deals/${id}`)
    );
    try {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
      toast({ title: `${selectedDeals.size} deal(s) deleted` });
      clearSelection();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete some deals", variant: "destructive" });
    }
  };

  const handleBulkEdit = async () => {
    if (selectedDeals.size === 0 || !bulkEditProperty || !bulkEditValue) return;

    let promises;
    if (bulkEditProperty === 'stage') {
      promises = Array.from(selectedDeals).map(id =>
        apiRequest("POST", `/api/crm/deals/${id}/move`, { body: { stageId: parseInt(bulkEditValue) } })
      );
    } else {
      const updateData: Record<string, any> = {};
      if (bulkEditProperty === 'owner') {
        updateData.ownerId = parseInt(bulkEditValue);
      } else if (bulkEditProperty === 'priority') {
        updateData.priority = bulkEditValue;
      }
      promises = Array.from(selectedDeals).map(id =>
        apiRequest("PATCH", `/api/crm/deals/${id}`, { body: updateData })
      );
    }

    try {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
      toast({ title: `${selectedDeals.size} deal(s) updated` });
      clearSelection();
      setIsBulkEditOpen(false);
      setBulkEditProperty("");
      setBulkEditValue("");
    } catch (error) {
      toast({ title: "Error", description: "Failed to update some deals", variant: "destructive" });
    }
  };

  const handleBulkExport = () => {
    const selectedDealsList = allDeals.filter((d: Deal) => selectedDeals.has(d.id));
    if (selectedDealsList.length === 0) return;

    const headers = ["Name", "Company", "Stage", "Value", "Currency", "Close Date", "Priority", "Source", "Created"];
    const rows = selectedDealsList.map((d: Deal) => [
      d.name || "",
      d.company?.name || "",
      d.stage?.name || "",
      d.amount || "",
      d.currency || "USD",
      d.closeDate ? new Date(d.closeDate).toLocaleDateString() : "",
      d.priority || "",
      d.source || "",
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

    toast({ title: `Exported ${selectedDealsList.length} deal(s)` });
  };

  const stages = (kanbanData as any)?.stages || [];
  const allDeals = dealsData?.deals || [];
  const aggregates = dealsData?.aggregates;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.stageIds, filters.ownerIds, filters.companyIds]);

  // Pagination calculations for list view
  const totalItems = allDeals.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const deals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allDeals.slice(start, start + pageSize);
  }, [allDeals, currentPage, pageSize]);

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

  const isMyDeals = currentUserId !== null && filters.ownerId === currentUserId;

  return (
    <div className="p-4 md:p-6">
      {/* Header - single row like contacts/companies */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 p-2 md:p-2.5 rounded-lg md:rounded-xl shadow-md"
            style={{
              background: brandColor
                ? `linear-gradient(to bottom right, ${brandColor}, ${brandColor}dd)`
                : 'linear-gradient(to bottom right, #334155, #1e293b)'
            }}
          >
            <BriefcaseBusiness className={`h-5 w-5 ${needsDarkText ? 'text-slate-800' : 'text-white'}`} />
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Deals</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search deals..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-9 w-full sm:w-48"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Toggle */}
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="rounded-r-none h-8"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-l-none h-8"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* My Deals / All Deals Toggle */}
            <Select
              value={isMyDeals ? "my" : "all"}
              onValueChange={(value) => {
                if (value === "my" && currentUserId) {
                  updateFilter('ownerId', currentUserId);
                } else {
                  updateFilter('ownerId', null);
                }
              }}
            >
              <SelectTrigger className="w-[110px] h-8 text-sm">
                {isMyDeals ? <User className="h-4 w-4 mr-2 text-gray-400" /> : <Users className="h-4 w-4 mr-2 text-gray-400" />}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Deals</SelectItem>
                <SelectItem value="my">My Deals</SelectItem>
              </SelectContent>
            </Select>

            {/* Stage Filter */}
            <Select
              value={filters.stages.length === 1 ? filters.stages[0].toString() : filters.stages.length > 1 ? 'multiple' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  updateFilter('stages', []);
                } else if (value !== 'multiple') {
                  updateFilter('stages', [parseInt(value)]);
                }
              }}
            >
              <SelectTrigger className="w-[120px] h-8 text-sm">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {allStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={filters.status}
              onValueChange={(value: 'all' | 'open' | 'won' | 'lost') => updateFilter('status', value)}
            >
              <SelectTrigger className="w-[100px] h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>

            <DealsViewManager
              currentFilters={filters}
              currentColumns={columns}
              currentSorting={sorting}
              currentViewMode={viewMode}
              onApplyView={applyView}
            />
            <DealsFilterBuilderIntegration
              filters={filters}
              onFilterChange={updateFilter}
              onClearFilters={clearFilters}
              companies={companies}
              owners={members.map((m) => ({ id: m.userId, name: m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email, profilePhoto: m.profilePhoto }))}
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
          </div>
          <Link href="/settings/data-management">
            <Button
              variant="outline"
              size="sm"
              title="Import deals"
              className="h-8"
            >
              <Upload className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} className="h-8">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Deal</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-gray-500">Active filters:</span>
          {isMyDeals && (
            <Badge variant="secondary" className="gap-1">
              My Deals
              <button onClick={() => updateFilter('ownerId', null)} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.stages.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              Stage: {filters.stages.length === 1 ? allStages.find(s => s.id === filters.stages[0])?.name : `${filters.stages.length} selected`}
              <button onClick={() => updateFilter('stages', [])} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status}
              <button onClick={() => updateFilter('status', 'all')} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
            Clear all
          </Button>
        </div>
      )}

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
        <>
        {/* Bulk Actions Bar */}
        {selectedDeals.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedDeals.size} deal{selectedDeals.size !== 1 ? 's' : ''} selected
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
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="py-2 px-3 w-10">
                    <Checkbox
                      checked={deals.length > 0 && selectedDeals.size === deals.length}
                      onCheckedChange={toggleSelectAll}
                      className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                    />
                  </th>
                  {visibleColumns.map((col) => {
                    const sortable = ['name', 'amount', 'closeDate', 'createdAt', 'stage', 'company', 'priority'].includes(col.id);
                    // Percentage-based widths for even column distribution (totals ~100% for typical 6 columns)
                    const columnWidth = col.id === 'name' ? '28%' :
                                       col.id === 'company' ? '20%' :
                                       col.id === 'stage' ? '13%' :
                                       col.id === 'amount' ? '13%' :
                                       col.id === 'closeDate' ? '13%' :
                                       col.id === 'owner' ? '13%' : '13%';
                    const widthStyle = { width: columnWidth };
                    if (sortable) {
                      return (
                        <SortableHeader
                          key={col.id}
                          label={col.label}
                          field={col.id}
                          currentSort={sorting}
                          onSort={toggleSort}
                          style={widthStyle}
                          className="py-2 px-3"
                        />
                      );
                    }
                    return (
                      <th
                        key={col.id}
                        className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase"
                        style={widthStyle}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className={`border-b hover:bg-gray-50/50 ${selectedDeals.has(deal.id) ? 'bg-blue-50/50' : ''} ${isMobile ? "h-14" : ""}`}>
                    <td className="py-2 px-3 w-10">
                      <Checkbox
                        checked={selectedDeals.has(deal.id)}
                        onCheckedChange={() => toggleSelectDeal(deal.id)}
                        className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                      />
                    </td>
                    {visibleColumns.map((col) => (
                      <td
                        key={col.id}
                        className="py-2 px-3"
                      >
                        {col.id === 'name' && (
                          <Link href={`/deals/${deal.id}`} className="flex items-center gap-2 group">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <BriefcaseBusiness className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">{deal.name}</span>
                          </Link>
                        )}
                        {col.id === 'company' && (
                          <span className="text-sm text-gray-500">{deal.company?.name || '-'}</span>
                        )}
                        {col.id === 'stage' && deal.stage && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
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
                            renderValue={(val) => {
                              if (!val) return '-';
                              try {
                                return new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: deal.currency || "USD",
                                  minimumFractionDigits: 0,
                                }).format(parseFloat(val));
                              } catch (e) {
                                return '-';
                              }
                            }}
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
                              <span className={`capitalize text-sm ${val === 'high' || val === 'urgent' ? 'text-red-600' : 'text-gray-600'}`}>
                                {val}
                              </span>
                            ) : '-'}
                          />
                        )}
                        {col.id === 'owner' && (
                          <div className="flex items-center gap-2">
                            {deal.owner ? (
                              <>
                                {deal.owner.profilePhoto ? (
                                  <img
                                    src={deal.owner.profilePhoto}
                                    alt={deal.owner.name || deal.owner.email}
                                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-medium text-blue-600">
                                      {(deal.owner.name || deal.owner.email || '?').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <span className="text-sm text-gray-900 truncate">
                                  {deal.owner.name ||
                                   (deal.owner.firstName && deal.owner.lastName
                                    ? `${deal.owner.firstName} ${deal.owner.lastName}`
                                    : deal.owner.email)}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-gray-500">-</span>
                            )}
                          </div>
                        )}
                        {col.id === 'source' && (
                          <span className="text-sm text-gray-500">{deal.source || '-'}</span>
                        )}
                        {col.id === 'createdAt' && (
                          <span className="text-sm text-gray-500">{new Date(deal.createdAt).toLocaleDateString()}</span>
                        )}
                      </td>
                    ))}
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
          </div>

          {/* Summary Row */}
          {aggregates && allDeals.length > 0 && (
            <div className="bg-gray-50 border-t px-3 py-2 flex flex-wrap items-center gap-4 text-sm">
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
                <span className="font-semibold text-gray-700">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(aggregates.weightedAmount)}
                </span>
              </div>
            </div>
          )}
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
                  {companies.filter((company: any) => company.id != null).map((company: any) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">Deal Owner</Label>
              <Select
                value={newDeal.ownerId}
                onValueChange={(value) => setNewDeal({ ...newDeal, ownerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an owner">
                    {newDeal.ownerId && (() => {
                      const selectedMember = members.find(m => m.userId?.toString() === newDeal.ownerId);
                      if (!selectedMember) return null;
                      const displayName = selectedMember.firstName && selectedMember.lastName
                        ? `${selectedMember.firstName} ${selectedMember.lastName}`
                        : selectedMember.email;
                      return (
                        <span className="flex items-center gap-2">
                          {selectedMember.profilePhoto ? (
                            <img
                              src={selectedMember.profilePhoto}
                              alt={displayName}
                              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-blue-600">
                                {displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="truncate text-gray-900">{displayName}</span>
                        </span>
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {members.filter((member) => member.userId != null).map((member) => {
                    const displayName = member.firstName && member.lastName
                      ? `${member.firstName} ${member.lastName}`
                      : member.email;
                    return (
                      <SelectItem key={member.userId} value={member.userId.toString()}>
                        <span className="flex items-center gap-2">
                          {member.profilePhoto ? (
                            <img
                              src={member.profilePhoto}
                              alt={displayName}
                              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-blue-600">
                                {displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-gray-900">{displayName}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
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

      {/* Bulk Edit Dialog */}
      <Dialog open={isBulkEditOpen} onOpenChange={(open) => {
        setIsBulkEditOpen(open);
        if (!open) {
          setBulkEditProperty("");
          setBulkEditValue("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {selectedDeals.size} Deal{selectedDeals.size !== 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Property to Edit</Label>
              <Select value={bulkEditProperty} onValueChange={(val) => {
                setBulkEditProperty(val);
                setBulkEditValue("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stage">Stage</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkEditProperty && (
              <div className="space-y-2">
                <Label>New Value</Label>
                {bulkEditProperty === 'stage' && (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {allStages.map((stage: Stage) => (
                        <SelectItem key={stage.id} value={stage.id.toString()}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {bulkEditProperty === 'owner' && (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.userId.toString()}>
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {bulkEditProperty === 'priority' && (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkEdit} disabled={!bulkEditProperty || !bulkEditValue}>
              Update {selectedDeals.size} Deal{selectedDeals.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
