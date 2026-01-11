import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  User,
  Plus,
  GripVertical,
  Calendar,
  Mail,
  Phone,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DealBuyer {
  id: number;
  dealId: number;
  stageId: number;
  contactId: number | null;
  companyId: number | null;
  notes: string | null;
  lastContactDate: string | null;
  nextFollowUp: string | null;
  contact?: { id: number; email: string; firstName: string; lastName: string } | null;
  company?: { id: number; name: string } | null;
  stage?: { id: number; name: string; color: string };
}

interface BuyerStage {
  id: number;
  name: string;
  displayOrder: number;
  color: string;
}

interface BuyerPipelineProps {
  dealId: number;
  buyers: DealBuyer[];
  stages: BuyerStage[];
  onAddBuyer?: () => void;
}

// Draggable buyer card component
function DraggableBuyerCard({
  buyer,
  isDragging = false,
}: {
  buyer: DealBuyer;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: buyer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${
        isDragging ? "ring-2 ring-blue-500 shadow-lg" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
              {buyer.company ? (
                <Building2 className="h-4 w-4 text-blue-600" />
              ) : (
                <User className="h-4 w-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {buyer.company?.name ||
                  (buyer.contact
                    ? `${buyer.contact.firstName} ${buyer.contact.lastName}`
                    : "Unknown Buyer")}
              </p>
              {buyer.contact && (
                <p className="text-xs text-gray-500 truncate">
                  {buyer.contact.email}
                </p>
              )}
            </div>
          </div>

          {/* Contact info and follow-up */}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {buyer.nextFollowUp && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
                <Calendar className="h-3 w-3" />
                {new Date(buyer.nextFollowUp).toLocaleDateString()}
              </span>
            )}
            {buyer.lastContactDate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                Last: {new Date(buyer.lastContactDate).toLocaleDateString()}
              </span>
            )}
          </div>

          {buyer.notes && (
            <p className="mt-2 text-xs text-gray-500 line-clamp-2">{buyer.notes}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {buyer.contact?.email && (
              <DropdownMenuItem onClick={() => window.open(`mailto:${buyer.contact?.email}`)}>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </DropdownMenuItem>
            )}
            <DropdownMenuItem>
              <Phone className="h-4 w-4 mr-2" />
              Log Call
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Calendar className="h-4 w-4 mr-2" />
              Set Follow-up
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Stage column component
function StageColumn({
  stage,
  buyers,
  isOver,
}: {
  stage: BuyerStage;
  buyers: DealBuyer[];
  isOver?: boolean;
}) {
  return (
    <div
      className={`flex-1 min-w-[280px] max-w-[320px] bg-gray-50 rounded-lg p-3 ${
        isOver ? "ring-2 ring-blue-400 bg-blue-50" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <span className="font-medium text-sm">{stage.name}</span>
        <Badge variant="secondary" className="ml-auto">
          {buyers.length}
        </Badge>
      </div>

      <SortableContext
        items={buyers.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 min-h-[100px]">
          {buyers.length > 0 ? (
            buyers.map((buyer) => (
              <DraggableBuyerCard key={buyer.id} buyer={buyer} />
            ))
          ) : (
            <div className="flex items-center justify-center h-[100px] border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-xs text-gray-400">Drop buyers here</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function BuyerPipeline({
  dealId,
  buyers,
  stages,
  onAddBuyer,
}: BuyerPipelineProps) {
  const [activeBuyer, setActiveBuyer] = useState<DealBuyer | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Mutation to move buyer to different stage
  const moveBuyerMutation = useMutation({
    mutationFn: async ({ buyerId, stageId }: { buyerId: number; stageId: number }) => {
      return apiRequest("PATCH", `/api/crm/deals/${dealId}/buyers/${buyerId}`, {
        body: { stageId },
      }).then((res) => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", dealId.toString(), "buyers"] });
      toast({ title: "Buyer moved", description: "Stage updated successfully." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to move buyer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const buyer = buyers.find((b) => b.id === active.id);
    if (buyer) {
      setActiveBuyer(buyer);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveBuyer(null);

    if (!over) return;

    const buyerId = active.id as number;
    const buyer = buyers.find((b) => b.id === buyerId);
    if (!buyer) return;

    // Find which stage the buyer was dropped on
    // Check if dropped over another buyer
    const overBuyer = buyers.find((b) => b.id === over.id);
    let targetStageId: number | null = null;

    if (overBuyer) {
      // Dropped on another buyer - use that buyer's stage
      targetStageId = overBuyer.stageId;
    } else {
      // Dropped on empty stage area - find stage by checking if over.id matches stage id
      const overStage = stages.find((s) => s.id === over.id);
      if (overStage) {
        targetStageId = overStage.id;
      }
    }

    // Only update if moved to a different stage
    if (targetStageId && targetStageId !== buyer.stageId) {
      moveBuyerMutation.mutate({ buyerId, stageId: targetStageId });
    }
  };

  // Sort stages by display order
  const sortedStages = [...stages].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Buyer Pipeline</CardTitle>
          <Button size="sm" variant="outline" onClick={onAddBuyer}>
            <Plus className="h-4 w-4 mr-2" />
            Add Buyer
          </Button>
        </div>
        <p className="text-sm text-gray-500">
          Drag and drop buyers between stages to track their progress
        </p>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {sortedStages.map((stage) => {
              const stageBuyers = buyers.filter((b) => b.stageId === stage.id);
              return (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  buyers={stageBuyers}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeBuyer ? (
              <DraggableBuyerCard buyer={activeBuyer} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}

export default BuyerPipeline;
