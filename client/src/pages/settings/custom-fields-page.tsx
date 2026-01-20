import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { Plus, GripVertical, Trash2, Pencil, Building2, Users, Briefcase, Type, Hash, Calendar, List, CheckSquare, Link, Mail, Phone, DollarSign, Database } from "lucide-react";
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

const OBJECT_TYPES = [
  { value: "deal", label: "Deals", icon: Briefcase },
  { value: "contact", label: "Contacts", icon: Users },
  { value: "company", label: "Companies", icon: Building2 },
];

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
          <p className="font-medium truncate text-gray-900">{field.label}</p>
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

function CustomFieldsList({ objectType }: { objectType: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
    queryKey: ["/api/crm/custom-fields", objectType],
    queryFn: () =>
      apiRequest("GET", `/api/crm/custom-fields?objectType=${objectType}`).then(res => res.json()),
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
      apiRequest("POST", "/api/crm/custom-fields/reorder", { body: { fieldIds, objectType } }),
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
  const objectLabel = OBJECT_TYPES.find(t => t.value === objectType)?.label.toLowerCase() || objectType;

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {fields.length} custom field{fields.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => setIsAddFieldOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

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
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Database className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No custom fields for {objectLabel}</p>
              <p className="text-sm text-gray-400 mt-1">Create fields to capture additional information</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Field Dialog */}
      <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Custom Field</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-gray-900">Field Label</Label>
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
              <Label className="text-gray-900">Field Type</Label>
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
                <Label className="text-gray-900">Options</Label>
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
              <Label className="text-gray-900">Description (optional)</Label>
              <Textarea
                value={newField.description}
                onChange={(e) => setNewField({ ...newField, description: e.target.value })}
                placeholder="Help text for users"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Placeholder (optional)</Label>
              <Input
                value={newField.placeholder}
                onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                placeholder="Placeholder text..."
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-900">Required Field</Label>
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
                objectType,
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
                <Label className="text-gray-900">Field Label</Label>
                <Input
                  value={editingField.label}
                  onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-900">Field Type</Label>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {(() => { const Icon = FIELD_TYPE_ICONS[editingField.fieldType]; return <Icon className="h-4 w-4" />; })()}
                  {FIELD_TYPE_LABELS[editingField.fieldType]}
                  <span className="text-xs">(cannot be changed)</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-900">Description</Label>
                <Textarea
                  value={editingField.description || ""}
                  onChange={(e) => setEditingField({ ...editingField, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-900">Placeholder</Label>
                <Input
                  value={editingField.placeholder || ""}
                  onChange={(e) => setEditingField({ ...editingField, placeholder: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-900">Required Field</Label>
                  <p className="text-xs text-gray-500">Users must fill this field</p>
                </div>
                <Switch
                  checked={editingField.isRequired}
                  onCheckedChange={(checked) => setEditingField({ ...editingField, isRequired: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-900">Visible</Label>
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
    </div>
  );
}

export default function CustomFieldsPage() {
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    if (['deal', 'contact', 'company'].includes(hash)) return hash;
    return 'deal';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  return (
    <SettingsLayout
      title="Custom Fields"
      description="Add custom properties to your CRM objects"
    >
      <div className="max-w-4xl">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            window.history.replaceState({}, '', `/settings/custom-fields#${v}`);
          }}
        >
          <TabsList className="mb-6">
            {OBJECT_TYPES.map((type) => (
              <TabsTrigger key={type.value} value={type.value} className="gap-2">
                <type.icon className="h-4 w-4" />
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {OBJECT_TYPES.map((type) => (
            <TabsContent key={type.value} value={type.value}>
              <CustomFieldsList objectType={type.value} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </SettingsLayout>
  );
}
