import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InlineEdit } from "@/components/ui/inline-edit";
import {
  Building2,
  User,
  Plus,
  GripVertical,
  Calendar,
  Mail,
  Phone,
  MoreHorizontal,
  List,
  LayoutGrid,
  Search,
  Check,
  Users,
  Trash2,
  Download,
  CheckSquare,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  contact?: { id: number; email: string; firstName: string; lastName: string; phone?: string } | null;
  company?: { id: number; name: string } | null;
  stage?: { id: number; name: string; color: string };
}

interface BuyerStage {
  id: number;
  name: string;
  displayOrder: number;
  color: string;
}

interface Contact {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
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

// List view row component
function BuyerListRow({
  buyer,
  stages,
  onStageChange,
  onRemove,
  onUpdateContact,
  isSelected,
  onSelectChange,
}: {
  buyer: DealBuyer;
  stages: BuyerStage[];
  onStageChange: (buyerId: number, stageId: number) => void;
  onRemove: (buyerId: number) => void;
  onUpdateContact: (contactId: number, field: string, value: string) => void;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-4 p-3 border-b last:border-b-0 hover:bg-gray-50/50 ${isSelected ? 'bg-blue-50/50' : ''}`}>
      <Checkbox
        checked={isSelected}
        onCheckedChange={onSelectChange}
        className="flex-shrink-0"
      />
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
        {buyer.company ? (
          <Building2 className="h-5 w-5 text-blue-600" />
        ) : (
          <User className="h-5 w-5 text-blue-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate text-gray-900">
          {buyer.company?.name ||
            (buyer.contact
              ? `${buyer.contact.firstName} ${buyer.contact.lastName}`
              : "Unknown Buyer")}
        </p>
      </div>

      <div className="w-48 flex items-center gap-1">
        {buyer.contact ? (
          <>
            <InlineEdit
              value={buyer.contact.email}
              onSave={(val) => onUpdateContact(buyer.contact!.id, 'email', val)}
              type="email"
              emptyText="Add email"
              displayClassName="text-sm text-gray-600 truncate"
            />
            {buyer.contact.email && (
              <a href={`mailto:${buyer.contact.email}`} className="text-blue-500 hover:text-blue-600 ml-1 flex-shrink-0" title="Send email">
                <Mail className="h-3.5 w-3.5" />
              </a>
            )}
          </>
        ) : (
          <span className="text-sm text-gray-400 italic">No contact</span>
        )}
      </div>

      <div className="w-36 flex items-center gap-1">
        {buyer.contact ? (
          <>
            <InlineEdit
              value={buyer.contact.phone || ''}
              onSave={(val) => onUpdateContact(buyer.contact!.id, 'phone', val)}
              type="phone"
              emptyText="Add phone"
              displayClassName="text-sm text-gray-600"
            />
            {buyer.contact.phone && (
              <a href={`tel:${buyer.contact.phone}`} className="text-green-500 hover:text-green-600 ml-1 flex-shrink-0" title="Call">
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
          </>
        ) : (
          <span className="text-sm text-gray-400 italic">-</span>
        )}
      </div>

      <div className="w-36">
        <Select
          value={buyer.stageId.toString()}
          onValueChange={(val) => onStageChange(buyer.id, parseInt(val))}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id.toString()}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
          <DropdownMenuItem onClick={() => onRemove(buyer.id)} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Buyer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function BuyerPipeline({
  dealId,
  buyers,
  stages,
}: BuyerPipelineProps) {
  const [activeBuyer, setActiveBuyer] = useState<DealBuyer | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [isAddBuyerOpen, setIsAddBuyerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [buyerMode, setBuyerMode] = useState<"existing" | "new">("existing");
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Selection helpers
  const toggleBuyerSelection = (buyerId: number, checked: boolean) => {
    setSelectedBuyerIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(buyerId);
      } else {
        newSet.delete(buyerId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBuyerIds(new Set(buyers.map(b => b.id)));
    } else {
      setSelectedBuyerIds(new Set());
    }
  };

  const isAllSelected = buyers.length > 0 && selectedBuyerIds.size === buyers.length;
  const isSomeSelected = selectedBuyerIds.size > 0;
  const selectedBuyers = buyers.filter(b => selectedBuyerIds.has(b.id));

  // Bulk email selected buyers
  const handleBulkEmail = () => {
    const emails = selectedBuyers
      .filter(b => b.contact?.email)
      .map(b => b.contact!.email);
    if (emails.length > 0) {
      window.open(`mailto:${emails.join(',')}`);
    } else {
      toast({ title: "No emails", description: "Selected buyers have no email addresses.", variant: "destructive" });
    }
  };

  // Export selected buyers to CSV
  const handleExportCSV = () => {
    const buyersToExport = selectedBuyers.length > 0 ? selectedBuyers : buyers;
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Stage'].join(','),
      ...buyersToExport.map(b => [
        b.contact ? `${b.contact.firstName} ${b.contact.lastName}` : (b.company?.name || 'Unknown'),
        b.contact?.email || '',
        b.contact?.phone || '',
        b.company?.name || '',
        stages.find(s => s.id === b.stageId)?.name || '',
      ].map(val => `"${(val || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `buyers-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "Exported", description: `${buyersToExport.length} buyer${buyersToExport.length !== 1 ? 's' : ''} exported to CSV.` });
  };

  // Fetch all contacts for the add buyer dialog
  const { data: allContactsData } = useQuery({
    queryKey: ["/api/crm/contacts"],
    queryFn: () => apiRequest("GET", "/api/crm/contacts").then((res) => res.json()),
  });
  const allContacts: Contact[] = (allContactsData as any)?.contacts || [];

  // Filter out contacts that are already buyers
  const existingBuyerContactIds = new Set(buyers.filter(b => b.contactId).map(b => b.contactId));
  const availableContacts = allContacts.filter(c => !existingBuyerContactIds.has(c.id));

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
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to move buyer. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation to add buyer to deal
  const addBuyerMutation = useMutation({
    mutationFn: async ({ contactId }: { contactId: number }) => {
      return apiRequest("POST", `/api/crm/deals/${dealId}/buyers`, {
        body: { contactId },
      }).then((res) => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", dealId.toString(), "buyers"] });
      setIsAddBuyerOpen(false);
      setSelectedContactId("");
      setContactSearch("");
      toast({ title: "Buyer added", description: "Contact has been added as a buyer." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add buyer. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation to remove buyer from deal
  const removeBuyerMutation = useMutation({
    mutationFn: async (buyerId: number) => {
      return apiRequest("DELETE", `/api/crm/deals/${dealId}/buyers/${buyerId}`).then((res) => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", dealId.toString(), "buyers"] });
      toast({ title: "Buyer removed" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove buyer.",
        variant: "destructive",
      });
    },
  });

  // Mutation to update contact (for inline editing)
  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: Record<string, any> }) =>
      apiRequest("PATCH", `/api/crm/contacts/${contactId}`, { body: data }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", dealId.toString(), "buyers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
    },
  });

  const handleContactUpdate = useCallback(async (contactId: number, field: string, value: string) => {
    await updateContactMutation.mutateAsync({ contactId, data: { [field]: value || null } });
  }, [updateContactMutation]);

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
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Buyers</CardTitle>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2 rounded-r-none"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "pipeline" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2 rounded-l-none"
                  onClick={() => setViewMode("pipeline")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsAddBuyerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Buyer
              </Button>
            </div>
          </div>
          {viewMode === "pipeline" && (
            <p className="text-sm text-gray-500">
              Drag and drop buyers between stages to track their progress
            </p>
          )}
        </CardHeader>
        <CardContent>
          {viewMode === "list" ? (
            // List View
            <div className="border rounded-lg">
              {/* Bulk Actions Bar */}
              {isSomeSelected && (
                <div className="flex items-center gap-3 p-2 bg-blue-50 border-b">
                  <span className="text-sm text-blue-700 font-medium ml-2">
                    {selectedBuyerIds.size} selected
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button size="sm" variant="outline" onClick={handleBulkEmail}>
                      <Mail className="h-4 w-4 mr-2" />
                      Email Selected
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedBuyerIds(new Set())}
                      className="text-gray-500"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              {/* Header */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                  className="flex-shrink-0"
                />
                <div className="w-10" />
                <div className="flex-1">Name</div>
                <div className="w-48">Email</div>
                <div className="w-36">Phone</div>
                <div className="w-36">Stage</div>
                <div className="w-8" />
              </div>
              {/* Rows */}
              {buyers.length > 0 ? (
                buyers.map((buyer) => (
                  <BuyerListRow
                    key={buyer.id}
                    buyer={buyer}
                    stages={sortedStages}
                    onStageChange={(buyerId, stageId) => moveBuyerMutation.mutate({ buyerId, stageId })}
                    onRemove={(buyerId) => removeBuyerMutation.mutate(buyerId)}
                    onUpdateContact={handleContactUpdate}
                    isSelected={selectedBuyerIds.has(buyer.id)}
                    onSelectChange={(checked) => toggleBuyerSelection(buyer.id, !!checked)}
                  />
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-medium text-gray-700">No buyers yet</p>
                  <p className="text-sm mt-1">Add buyers to track interested parties</p>
                  <Button size="sm" variant="outline" className="mt-4" onClick={() => setIsAddBuyerOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Buyer
                  </Button>
                </div>
              )}
              {/* Footer with export all */}
              {buyers.length > 0 && !isSomeSelected && (
                <div className="flex items-center justify-end p-2 bg-gray-50 border-t">
                  <Button size="sm" variant="ghost" onClick={handleExportCSV} className="text-gray-600">
                    <Download className="h-4 w-4 mr-2" />
                    Export All to CSV
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Pipeline View
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
          )}
        </CardContent>
      </Card>

      {/* Add Buyer Dialog */}
      <Dialog open={isAddBuyerOpen} onOpenChange={(open) => {
        setIsAddBuyerOpen(open);
        if (!open) {
          setContactSearch("");
          setSelectedContactId("");
          setBuyerMode("existing");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Buyer to Deal</DialogTitle>
            <DialogDescription>
              Add an existing contact or create a new one as a buyer.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Selection */}
          <div className="flex gap-2 py-2">
            <Button
              variant={buyerMode === "existing" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setBuyerMode("existing")}
            >
              <Users className="h-4 w-4 mr-2" />
              Existing Contact
            </Button>
            <Button
              variant={buyerMode === "new" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setBuyerMode("new")}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Contact
            </Button>
          </div>

          {buyerMode === "existing" ? (
            <div className="space-y-4 py-2">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contacts by name or email..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Contact List */}
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {availableContacts.filter(c =>
                  `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(contactSearch.toLowerCase())
                ).length > 0 ? (
                  availableContacts
                    .filter(c =>
                      `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(contactSearch.toLowerCase())
                    )
                    .slice(0, 20)
                    .map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => setSelectedContactId(contact.id.toString())}
                        className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 text-left transition-colors ${
                          selectedContactId === contact.id.toString() ? "bg-blue-50 border-blue-200" : ""
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                        </div>
                        {selectedContactId === contact.id.toString() && (
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        )}
                      </button>
                    ))
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {contactSearch ? "No contacts match your search" : "No available contacts"}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
              <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">Create a new contact in your CRM first</p>
              <Button asChild>
                <a href={`/contacts`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Go to Contacts
                </a>
              </Button>
            </div>
          )}

          {buyerMode === "existing" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddBuyerOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedContactId) {
                    addBuyerMutation.mutate({ contactId: parseInt(selectedContactId) });
                  }
                }}
                disabled={!selectedContactId || addBuyerMutation.isPending}
              >
                {addBuyerMutation.isPending ? "Adding..." : "Add as Buyer"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BuyerPipeline;
