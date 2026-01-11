import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Deal {
  id: number;
  name: string;
  amount: string | null;
  currency: string;
  stageId: number;
  pipelineId: number;
  closeDate: string | null;
  companyId: number | null;
  company?: { id: number; name: string } | null;
  stage?: { id: number; name: string; color: string };
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

// Draggable Deal Card Component
function DealCard({ deal, isDragging, isOverlay }: { deal: Deal; isDragging?: boolean; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isCurrentlyDragging } = useDraggable({
    id: deal.id,
    data: deal,
  });

  // Hide the original card while dragging (we show the DragOverlay instead)
  // This prevents the "snap back" animation when the card is dropped
  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isCurrentlyDragging ? 0 : (isDragging ? 0.5 : 1),
    // Prevent any transition on the original card during drag
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

  // Calculate stage totals
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
      {/* Stage Header */}
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

      {/* Deals List */}
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [newDeal, setNewDeal] = useState({
    name: "",
    amount: "",
    closeDate: "",
    companyId: "",
  });

  // Fetch pipelines with stages and deals
  const { data: pipelines, isLoading: pipelinesLoading } = useQuery<Pipeline[]>({
    queryKey: ["/api/crm/pipelines"],
  });

  // Use the first (default) pipeline for Kanban
  const defaultPipeline = pipelines?.[0];

  // Fetch Kanban data for the default pipeline
  const { data: kanbanData, isLoading: kanbanLoading } = useQuery({
    queryKey: ["/api/crm/deals/kanban", defaultPipeline?.id],
    queryFn: () =>
      defaultPipeline
        ? apiRequest("GET", `/api/crm/deals/kanban/${defaultPipeline.id}`).then(res => res.json())
        : null,
    enabled: !!defaultPipeline?.id,
  });

  // Fetch companies for the create dialog
  const { data: companiesData } = useQuery({
    queryKey: ["/api/crm/companies"],
  });
  const companies = (companiesData as any)?.companies || [];

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Move deal mutation with optimistic updates
  const moveDealMutation = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: number; stageId: number }) =>
      apiRequest("POST", `/api/crm/deals/${dealId}/move`, {
        body: { stageId },
      }).then(res => res.json()),
    onMutate: async ({ dealId, stageId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/crm/deals/kanban", defaultPipeline?.id] });

      // Snapshot the previous value
      const previousKanban = queryClient.getQueryData(["/api/crm/deals/kanban", defaultPipeline?.id]);

      // Optimistically update the kanban data
      queryClient.setQueryData(["/api/crm/deals/kanban", defaultPipeline?.id], (old: any) => {
        if (!old?.stages) return old;

        const newStages = old.stages.map((stage: Stage) => {
          // Remove deal from its current stage
          const filteredDeals = stage.deals?.filter((d: Deal) => d.id !== dealId) || [];

          // If this is the target stage, add the deal
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
      // Rollback on error
      if (context?.previousKanban) {
        queryClient.setQueryData(["/api/crm/deals/kanban", defaultPipeline?.id], context.previousKanban);
      }
      toast({
        title: "Error",
        description: "Failed to move deal",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch to ensure data is in sync
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"] });
    },
  });

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/crm/deals", {
        body: data,
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"] });
      setIsCreateDialogOpen(false);
      setNewDeal({ name: "", amount: "", closeDate: "", companyId: "" });
      toast({
        title: "Deal created",
        description: "Your new deal has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to create deal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create deal",
        variant: "destructive",
      });
    },
  });

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: (dealId: number) =>
      apiRequest("DELETE", `/api/crm/deals/${dealId}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"] });
      toast({
        title: "Deal deleted",
        description: "The deal has been deleted.",
      });
    },
  });

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const deal = active.data.current as Deal;
    setActiveDeal(deal);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const dealId = active.id as number;
    const overId = over.id as string;

    // Check if dropped on a stage
    if (overId.startsWith("stage-")) {
      const stageId = parseInt(overId.replace("stage-", ""));
      const deal = active.data.current as Deal;

      // Only move if the stage is different
      if (deal.stageId !== stageId) {
        moveDealMutation.mutate({ dealId, stageId });
      }
    }
  };

  const handleCreateDeal = () => {
    if (!newDeal.name.trim()) {
      toast({
        title: "Error",
        description: "Deal name is required",
        variant: "destructive",
      });
      return;
    }

    createDealMutation.mutate({
      name: newDeal.name,
      amount: newDeal.amount || null,
      closeDate: newDeal.closeDate || null,
      companyId: newDeal.companyId ? parseInt(newDeal.companyId) : null,
    });
  };

  const stages = (kanbanData as any)?.stages || [];

  if (pipelinesLoading || kanbanLoading) {
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
    <div className="p-4 md:p-6">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Deals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your sales pipeline and track deal progress
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <div className="flex items-center gap-2">
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
            <Button onClick={() => setIsCreateDialogOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Deal</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
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
            {stages.map((stage: Stage) => (
              <StageColumn key={stage.id} stage={stage}>
                {stage.deals
                  ?.filter((deal) =>
                    deal.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((deal) => (
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
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Deal Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Company
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Stage
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Close Date
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {stages.flatMap((stage: Stage) =>
                stage.deals
                  ?.filter((deal) =>
                    deal.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((deal) => (
                    <tr key={deal.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link
                          href={`/deals/${deal.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {deal.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {deal.company?.name || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: stage.color + '20',
                            color: stage.color,
                            border: `1px solid ${stage.color}40`,
                          }}
                        >
                          {stage.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-900">
                        {deal.amount
                          ? new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: deal.currency || "USD",
                              minimumFractionDigits: 0,
                            }).format(parseFloat(deal.amount))
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {deal.closeDate
                          ? new Date(deal.closeDate).toLocaleDateString()
                          : "-"}
                      </td>
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
                  ))
              )}
            </tbody>
          </table>
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
                onChange={(e) =>
                  setNewDeal({ ...newDeal, name: e.target.value })
                }
                placeholder="e.g., Acme Corp Acquisition"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Deal Value</Label>
              <Input
                id="amount"
                type="number"
                value={newDeal.amount}
                onChange={(e) =>
                  setNewDeal({ ...newDeal, amount: e.target.value })
                }
                placeholder="e.g., 500000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Select
                value={newDeal.companyId}
                onValueChange={(value) =>
                  setNewDeal({ ...newDeal, companyId: value })
                }
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
                onChange={(e) =>
                  setNewDeal({ ...newDeal, closeDate: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateDeal}
              disabled={createDealMutation.isPending}
            >
              {createDealMutation.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to determine if text should be dark or light based on background color
function getContrastColor(hexColor: string | undefined | null): string {
  if (!hexColor) return '#1f2937';

  try {
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return '#ffffff';

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.45 ? '#1f2937' : '#ffffff';
  } catch {
    return '#ffffff';
  }
}
