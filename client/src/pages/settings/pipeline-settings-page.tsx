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
import { PageHeader } from "@/components/layout/page-header";
import { Plus, GripVertical, Trash2, Pencil, Sliders, Kanban, Database, Building2, Users, Briefcase, Type, Hash, Calendar, List, CheckSquare, Link, Mail, Phone, DollarSign } from "lucide-react";
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

interface CustomField {
  id: number;
  objectType: string;
  name: string;
  label: string;
  fieldType: string;
  description: string | null;
  placeholder: string | null;
  options: { value: string; label: string; color?: string }[];
  isRequired: boolean;
  isVisible: boolean;
  displayOrder: number;
  groupName: string;
}

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  number: Hash,
  date: Calendar,
  select: List,
  multiselect: List,
  checkbox: CheckSquare,
  url: Link,
  email: Mail,
  phone: Phone,
  currency: DollarSign,
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  multiselect: "Multi-select",
  checkbox: "Checkbox",
  url: "URL",
  email: "Email",
  phone: "Phone",
  currency: "Currency",
};

const OBJECT_TYPE_ICONS: Record<string, React.ElementType> = {
  deal: Briefcase,
  contact: Users,
  company: Building2,
};

function SortableStage({ stage, onEdit, onDelete }: { stage: Stage; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </button>
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
      <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
      {!stage.isWon && !stage.isLost && (
        <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" /></Button>
      )}
    </div>
  );
}

function SortableCustomField({ field, onEdit, onDelete }: { field: CustomField; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const Icon = FIELD_TYPE_ICONS[field.fieldType] || Type;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </button>
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
        <Icon className="h-4 w-4 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{field.label}</p>
          {field.isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
          {!field.isVisible && <Badge variant="outline" className="text-xs">Hidden</Badge>}
        </div>
        <p className="text-xs text-gray-500">{FIELD_TYPE_LABELS[field.fieldType]} &middot; {field.name}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" /></Button>
    </div>
  );
}

function PipelinesSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{pipeline?.name || "Sales Pipeline"}</CardTitle>
            <CardDescription>Drag and drop to reorder stages</CardDescription>
          </div>
          <Button onClick={() => setIsAddStageOpen(true)} size="sm"><Plus className="h-4 w-4 mr-2" />Add Stage</Button>
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

function CustomFieldsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedObjectType, setSelectedObjectType] = useState<string>("deal");
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [newField, setNewField] = useState({
    name: "",
    label: "",
    fieldType: "text",
    description: "",
    placeholder: "",
    isRequired: false,
    options: [] as { value: string; label: string }[],
  });
  const [newOption, setNewOption] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: customFieldsData, isLoading } = useQuery<{ fields: CustomField[]; fieldTypes: string[]; objectTypes: string[] }>({
    queryKey: ["/api/crm/custom-fields", selectedObjectType],
    queryFn: () =>
      apiRequest("GET", `/api/crm/custom-fields?objectType=${selectedObjectType}`).then(res => res.json()),
  });

  const fields = customFieldsData?.fields || [];

  const createFieldMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/crm/custom-fields", { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/custom-fields"] });
      setIsAddFieldOpen(false);
      setNewField({ name: "", label: "", fieldType: "text", description: "", placeholder: "", isRequired: false, options: [] });
      toast({ title: "Custom field created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create field", variant: "destructive" });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/crm/custom-fields/${id}`, { body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/custom-fields"] });
      setEditingField(null);
      toast({ title: "Custom field updated" });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/custom-fields/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/custom-fields"] });
      toast({ title: "Custom field deleted" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (fieldIds: number[]) =>
      apiRequest("POST", "/api/crm/custom-fields/reorder", { body: { fieldIds, objectType: selectedObjectType } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/crm/custom-fields"] }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const newOrder = arrayMove(fields, oldIndex, newIndex);
    reorderMutation.mutate(newOrder.map((f) => f.id));
  };

  const generateFieldName = (label: string) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const handleAddOption = () => {
    if (newOption.trim()) {
      const value = newOption.toLowerCase().replace(/\s+/g, "_");
      setNewField({
        ...newField,
        options: [...newField.options, { value, label: newOption.trim() }],
      });
      setNewOption("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setNewField({
      ...newField,
      options: newField.options.filter((_, i) => i !== index),
    });
  };

  const showOptionsField = ["select", "multiselect"].includes(newField.fieldType);

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-gray-200 rounded" />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Custom Fields</CardTitle>
            <CardDescription>Add custom properties to your CRM objects</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedObjectType} onValueChange={setSelectedObjectType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deal">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Deals
                  </div>
                </SelectItem>
                <SelectItem value="contact">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Contacts
                  </div>
                </SelectItem>
                <SelectItem value="company">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Companies
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsAddFieldOpen(true)} size="sm"><Plus className="h-4 w-4 mr-2" />Add Field</Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <SortableCustomField
                      key={field.id}
                      field={field}
                      onEdit={() => setEditingField(field)}
                      onDelete={() => deleteFieldMutation.mutate(field.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No custom fields for {selectedObjectType}s</p>
              <p className="text-sm text-gray-400 mt-1">Create fields to capture additional information</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Field Dialog */}
      <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Custom Field</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Field Label</Label>
              <Input
                value={newField.label}
                onChange={(e) => setNewField({
                  ...newField,
                  label: e.target.value,
                  name: generateFieldName(e.target.value),
                })}
                placeholder="e.g., Industry Sector"
              />
              {newField.name && (
                <p className="text-xs text-gray-500">Internal name: {newField.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select value={newField.fieldType} onValueChange={(v) => setNewField({ ...newField, fieldType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => {
                    const Icon = FIELD_TYPE_ICONS[value];
                    return (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {showOptionsField && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex gap-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Add option..."
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                  />
                  <Button type="button" variant="outline" onClick={handleAddOption}>Add</Button>
                </div>
                {newField.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newField.options.map((opt, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {opt.label}
                        <button onClick={() => handleRemoveOption(i)} className="ml-1 hover:text-red-500">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={newField.description}
                onChange={(e) => setNewField({ ...newField, description: e.target.value })}
                placeholder="Help text for users"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Placeholder (optional)</Label>
              <Input
                value={newField.placeholder}
                onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                placeholder="Placeholder text..."
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Required Field</Label>
                <p className="text-xs text-gray-500">Users must fill this field</p>
              </div>
              <Switch
                checked={newField.isRequired}
                onCheckedChange={(checked) => setNewField({ ...newField, isRequired: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddFieldOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createFieldMutation.mutate({
                objectType: selectedObjectType,
                name: newField.name,
                label: newField.label,
                fieldType: newField.fieldType,
                description: newField.description || null,
                placeholder: newField.placeholder || null,
                isRequired: newField.isRequired,
                options: newField.options,
              })}
              disabled={!newField.label || !newField.name || createFieldMutation.isPending}
            >
              {createFieldMutation.isPending ? "Creating..." : "Create Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={!!editingField} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Custom Field</DialogTitle></DialogHeader>
          {editingField && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Field Label</Label>
                <Input
                  value={editingField.label}
                  onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Field Type</Label>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {(() => { const Icon = FIELD_TYPE_ICONS[editingField.fieldType]; return <Icon className="h-4 w-4" />; })()}
                  {FIELD_TYPE_LABELS[editingField.fieldType]}
                  <span className="text-xs">(cannot be changed)</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingField.description || ""}
                  onChange={(e) => setEditingField({ ...editingField, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={editingField.placeholder || ""}
                  onChange={(e) => setEditingField({ ...editingField, placeholder: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Required Field</Label>
                  <p className="text-xs text-gray-500">Users must fill this field</p>
                </div>
                <Switch
                  checked={editingField.isRequired}
                  onCheckedChange={(checked) => setEditingField({ ...editingField, isRequired: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Visible</Label>
                  <p className="text-xs text-gray-500">Show this field in forms</p>
                </div>
                <Switch
                  checked={editingField.isVisible}
                  onCheckedChange={(checked) => setEditingField({ ...editingField, isVisible: checked })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>Cancel</Button>
            <Button
              onClick={() => editingField && updateFieldMutation.mutate({
                id: editingField.id,
                data: {
                  label: editingField.label,
                  description: editingField.description,
                  placeholder: editingField.placeholder,
                  isRequired: editingField.isRequired,
                  isVisible: editingField.isVisible,
                },
              })}
              disabled={updateFieldMutation.isPending}
            >
              {updateFieldMutation.isPending ? "Saving..." : "Save Changes"}
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
    if (['pipelines', 'fields'].includes(hash)) return hash;
    return 'pipelines';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 overflow-x-hidden">
      <PageHeader
        title="Customization"
        description="Configure pipelines, stages, and custom fields for your CRM"
        icon={<Sliders className="h-5 w-5" />}
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          window.history.replaceState({}, '', `/settings/customization#${v}`);
        }}
        className="max-w-4xl"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="pipelines" className="gap-2">
            <Kanban className="h-4 w-4" />
            Pipelines
          </TabsTrigger>
          <TabsTrigger value="fields" className="gap-2">
            <Database className="h-4 w-4" />
            Custom Fields
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipelines">
          <PipelinesSection />
        </TabsContent>

        <TabsContent value="fields">
          <CustomFieldsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
