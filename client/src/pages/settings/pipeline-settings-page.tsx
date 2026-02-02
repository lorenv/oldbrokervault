import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SettingsLayout, useSettingsAccess } from "@/components/layout/settings-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, GripVertical, Trash2, Pencil, Sliders, Kanban, Users, Lock } from "lucide-react";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Stage {
  id: number;
  name: string;
  displayOrder: number;
  probability: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

interface Pipeline {
  id: number;
  name: string;
  isDefault: boolean;
  dealRotting: number;
  currency: string;
  stages: Stage[];
}

function SortableStage({ stage, onEdit, onDelete, disabled }: { stage: Stage; onEdit: () => void; onDelete: () => void; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
      {!disabled && (
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
      )}
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
      <div className="flex-1">
        <p className="font-medium">{stage.name}</p>
        <p className="text-xs text-gray-500">{stage.probability}% probability</p>
      </div>
      {(stage.isWon || stage.isLost) && (
        <span className={`text-xs px-2 py-1 rounded ${stage.isWon ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {stage.isWon ? "Won" : "Lost"}
        </span>
      )}
      {!disabled && (
        <>
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          {!stage.isWon && !stage.isLost && (
            <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" /></Button>
          )}
        </>
      )}
    </div>
  );
}

function PipelinesSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit, isViewOnly } = useSettingsAccess();
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [newStage, setNewStage] = useState({ name: "", probability: "50", color: "#6B7280" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: pipelines, isLoading } = useQuery<Pipeline[]>({
    queryKey: ["/api/crm/pipelines"],
  });

  const pipeline = pipelines?.[0];

  const createStageMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/crm/pipelines/${pipeline?.id}/stages`, { body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipelines"] });
      setIsAddStageOpen(false);
      setNewStage({ name: "", probability: "50", color: "#6B7280" });
      toast({ title: "Stage added" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/crm/stages/${id}`, { body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipelines"] });
      setEditingStage(null);
      toast({ title: "Stage updated" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/stages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipelines"] });
      toast({ title: "Stage deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Cannot delete stage with deals", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (stageIds: number[]) =>
      apiRequest("POST", `/api/crm/pipelines/${pipeline?.id}/stages/reorder`, { body: { stageIds } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/crm/pipelines"] }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !pipeline) return;

    const oldIndex = pipeline.stages.findIndex((s) => s.id === active.id);
    const newIndex = pipeline.stages.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(pipeline.stages, oldIndex, newIndex);
    reorderMutation.mutate(newOrder.map((s) => s.id));
  };

  const colors = ["#6B7280", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#EC4899", "#06B6D4"];

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-gray-200 rounded" />;
  }

  return (
    <>
      {isViewOnly && (
        <Alert className="mb-4 bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            You have view-only access to pipeline settings. Contact an admin or owner to make changes.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{pipeline?.name || "Sales Pipeline"}</CardTitle>
            <CardDescription>Drag and drop to reorder stages</CardDescription>
          </div>
          {canEdit && (
            <Button onClick={() => setIsAddStageOpen(true)} size="sm"><Plus className="h-4 w-4 mr-2" />Add Stage</Button>
          )}
        </CardHeader>
        <CardContent>
          {pipeline?.stages && pipeline.stages.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={pipeline.stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {pipeline.stages.map((stage) => (
                    <SortableStage
                      key={stage.id}
                      stage={stage}
                      onEdit={() => setEditingStage(stage)}
                      onDelete={() => deleteStageMutation.mutate(stage.id)}
                      disabled={isViewOnly}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-gray-500 text-center py-8">No stages configured</p>
          )}
        </CardContent>
      </Card>

      {/* Add Stage Dialog */}
      <Dialog open={isAddStageOpen} onOpenChange={setIsAddStageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Pipeline Stage</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Stage Name</Label>
              <Input value={newStage.name} onChange={(e) => setNewStage({ ...newStage, name: e.target.value })} placeholder="e.g., Qualified" />
            </div>
            <div className="space-y-2">
              <Label>Win Probability (%)</Label>
              <Input type="number" min="0" max="100" value={newStage.probability} onChange={(e) => setNewStage({ ...newStage, probability: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewStage({ ...newStage, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${newStage.color === color ? "border-gray-900 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStageOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createStageMutation.mutate({
                name: newStage.name,
                probability: parseInt(newStage.probability),
                color: newStage.color,
                displayOrder: (pipeline?.stages?.length || 0),
              })}
              disabled={!newStage.name || createStageMutation.isPending}
            >
              {createStageMutation.isPending ? "Adding..." : "Add Stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stage Dialog */}
      <Dialog open={!!editingStage} onOpenChange={(open) => !open && setEditingStage(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Stage</DialogTitle></DialogHeader>
          {editingStage && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Stage Name</Label>
                <Input
                  value={editingStage.name}
                  onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Win Probability (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editingStage.probability}
                  onChange={(e) => setEditingStage({ ...editingStage, probability: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingStage({ ...editingStage, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${editingStage.color === color ? "border-gray-900 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStage(null)}>Cancel</Button>
            <Button
              onClick={() => editingStage && updateStageMutation.mutate({
                id: editingStage.id,
                data: { name: editingStage.name, probability: editingStage.probability, color: editingStage.color },
              })}
              disabled={updateStageMutation.isPending}
            >
              {updateStageMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface BuyerStage {
  id: number;
  name: string;
  displayOrder: number;
  color: string;
}

function SortableBuyerStage({ stage, onEdit, onDelete, disabled }: { stage: BuyerStage; onEdit: () => void; onDelete: () => void; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
      {!disabled && (
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
      )}
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
      <div className="flex-1">
        <p className="font-medium">{stage.name}</p>
      </div>
      {!disabled && (
        <>
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" /></Button>
        </>
      )}
    </div>
  );
}

function BuyerPipelineSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit, isViewOnly } = useSettingsAccess();
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<BuyerStage | null>(null);
  const [newStage, setNewStage] = useState({ name: "", color: "#6B7280" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: stages, isLoading } = useQuery<BuyerStage[]>({
    queryKey: ["/api/crm/buyer-stages"],
    queryFn: () => apiRequest("GET", "/api/crm/buyer-stages").then(res => res.json()),
  });

  const createStageMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/crm/buyer-stages", { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/buyer-stages"] });
      setIsAddStageOpen(false);
      setNewStage({ name: "", color: "#6B7280" });
      toast({ title: "Stage added" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create stage", variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/crm/buyer-stages/${id}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/buyer-stages"] });
      setEditingStage(null);
      toast({ title: "Stage updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update stage", variant: "destructive" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/buyer-stages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/buyer-stages"] });
      toast({ title: "Stage deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Cannot delete stage with buyers", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (stageIds: number[]) =>
      apiRequest("POST", "/api/crm/buyer-stages/reorder", { body: { stageIds } }).then(res => res.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/crm/buyer-stages"] }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !stages) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(stages, oldIndex, newIndex);
    reorderMutation.mutate(newOrder.map((s) => s.id));
  };

  const colors = ["#D1FAE5", "#A7F3D0", "#6EE7B7", "#34D399", "#10B981", "#059669", "#FCA5A5", "#F87171", "#6B7280", "#3B82F6", "#8B5CF6", "#F59E0B"];

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-gray-200 rounded" />;
  }

  return (
    <>
      {isViewOnly && (
        <Alert className="mb-4 bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            You have view-only access to pipeline settings. Contact an admin or owner to make changes.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Buyer Pipeline</CardTitle>
            <CardDescription>Customize stages for tracking buyers through your deal process</CardDescription>
          </div>
          {canEdit && (
            <Button onClick={() => setIsAddStageOpen(true)} size="sm"><Plus className="h-4 w-4 mr-2" />Add Stage</Button>
          )}
        </CardHeader>
        <CardContent>
          {stages && stages.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {stages.map((stage) => (
                    <SortableBuyerStage
                      key={stage.id}
                      stage={stage}
                      onEdit={() => setEditingStage(stage)}
                      onDelete={() => deleteStageMutation.mutate(stage.id)}
                      disabled={isViewOnly}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-gray-500 text-center py-8">No buyer stages configured</p>
          )}
        </CardContent>
      </Card>

      {/* Add Stage Dialog */}
      <Dialog open={isAddStageOpen} onOpenChange={setIsAddStageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Buyer Pipeline Stage</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Stage Name</Label>
              <Input value={newStage.name} onChange={(e) => setNewStage({ ...newStage, name: e.target.value })} placeholder="e.g., NDA Signed" />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewStage({ ...newStage, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${newStage.color === color ? "border-gray-900 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStageOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createStageMutation.mutate({
                name: newStage.name,
                color: newStage.color,
                displayOrder: stages?.length || 0,
              })}
              disabled={!newStage.name || createStageMutation.isPending}
            >
              {createStageMutation.isPending ? "Adding..." : "Add Stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stage Dialog */}
      <Dialog open={!!editingStage} onOpenChange={(open) => !open && setEditingStage(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Buyer Stage</DialogTitle></DialogHeader>
          {editingStage && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Stage Name</Label>
                <Input
                  value={editingStage.name}
                  onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingStage({ ...editingStage, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${editingStage.color === color ? "border-gray-900 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStage(null)}>Cancel</Button>
            <Button
              onClick={() => editingStage && updateStageMutation.mutate({
                id: editingStage.id,
                data: { name: editingStage.name, color: editingStage.color },
              })}
              disabled={updateStageMutation.isPending}
            >
              {updateStageMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PipelineSettingsPage() {
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    if (['pipelines', 'buyer-pipeline'].includes(hash)) return hash;
    return 'pipelines';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  return (
    <SettingsLayout
      title="Pipeline Settings"
      description="Configure sales and buyer pipelines"
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          window.history.replaceState({}, '', `/settings/pipelines#${v}`);
        }}
        className="max-w-4xl"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="pipelines" className="gap-2">
            <Kanban className="h-4 w-4" />
            Sales Pipeline
          </TabsTrigger>
          <TabsTrigger value="buyer-pipeline" className="gap-2">
            <Users className="h-4 w-4" />
            Buyer Pipeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipelines">
          <PipelinesSection />
        </TabsContent>

        <TabsContent value="buyer-pipeline">
          <BuyerPipelineSection />
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  );
}
