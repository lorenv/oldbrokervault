import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  GripVertical,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Settings2,
  RotateCcw,
  Save,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Field type options for the create field dialog
const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown (Single)" },
  { value: "multiselect", label: "Dropdown (Multiple)" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "currency", label: "Currency" },
];

// Types
interface FieldConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  isCustomField?: boolean;
}

interface SectionConfig {
  id: string;
  title: string;
  visible: boolean;
  collapsed: boolean;
  order: number;
  fields: FieldConfig[];
}

interface CustomField {
  id: number;
  name: string;
  label: string;
  fieldType: string;
}

interface LayoutData {
  layout: SectionConfig[] | null;
  customFields: CustomField[];
}

// Section zone types
type SectionZone = "main" | "sidebar";

interface SectionConfigWithZone extends SectionConfig {
  zone: SectionZone;
  supportsCustomFields?: boolean;
}

// Default layouts for each object type
const getDefaultLayout = (objectType: string, customFields: CustomField[]): SectionConfigWithZone[] => {
  if (objectType === "deal") {
    // Deal: sidebar only is reorderable (tabs are fixed in main content)
    return [
      // Sidebar sections (reorderable)
      {
        id: "key-people",
        title: "Key People",
        visible: true,
        collapsed: false,
        order: 0,
        zone: "sidebar",
        supportsCustomFields: false,
        fields: [
          { id: "owner", label: "Deal Owner", visible: true, order: 0 },
          { id: "company", label: "Company", visible: true, order: 1 },
          { id: "primaryContact", label: "Primary Contact", visible: true, order: 2 },
        ],
      },
      {
        id: "deal-details",
        title: "Deal Details",
        visible: true,
        collapsed: false,
        order: 1,
        zone: "sidebar",
        supportsCustomFields: true,
        fields: [
          { id: "amount", label: "Value", visible: true, order: 0 },
          { id: "closeDate", label: "Close Date", visible: true, order: 1 },
          { id: "pipeline", label: "Pipeline", visible: true, order: 2 },
          { id: "createdAt", label: "Created", visible: true, order: 3 },
          { id: "updatedAt", label: "Last Updated", visible: true, order: 4 },
          // Add custom fields here
          ...customFields.map((cf, index) => ({
            id: `custom_${cf.name}`,
            label: cf.label,
            visible: true,
            order: 5 + index,
            isCustomField: true,
          })),
        ],
      },
      {
        id: "quick-actions",
        title: "Quick Actions",
        visible: true,
        collapsed: false,
        order: 2,
        zone: "sidebar",
        supportsCustomFields: false,
        fields: [],
      },
    ];
  }

  if (objectType === "contact") {
    return [
      // Main sections
      {
        id: "contact-info",
        title: "Contact Information",
        visible: true,
        collapsed: false,
        order: 0,
        zone: "main",
        supportsCustomFields: true,
        fields: [
          { id: "firstName", label: "First Name", visible: true, order: 0 },
          { id: "lastName", label: "Last Name", visible: true, order: 1 },
          { id: "title", label: "Title", visible: true, order: 2 },
          { id: "email", label: "Email", visible: true, order: 3 },
          { id: "phone", label: "Phone", visible: true, order: 4 },
          { id: "company", label: "Company", visible: true, order: 5 },
          { id: "linkedinUrl", label: "LinkedIn", visible: true, order: 6 },
          { id: "tags", label: "Tags", visible: true, order: 7 },
          { id: "source", label: "Source", visible: true, order: 8 },
          { id: "notes", label: "Notes", visible: true, order: 9 },
          // Add custom fields here
          ...customFields.map((cf, index) => ({
            id: `custom_${cf.name}`,
            label: cf.label,
            visible: true,
            order: 10 + index,
            isCustomField: true,
          })),
        ],
      },
      {
        id: "engagement-history",
        title: "Engagement History",
        visible: true,
        collapsed: false,
        order: 1,
        zone: "main",
        supportsCustomFields: false,
        fields: [],
      },
      {
        id: "email-activity",
        title: "Email Activity",
        visible: true,
        collapsed: false,
        order: 2,
        zone: "main",
        supportsCustomFields: false,
        fields: [],
      },
      {
        id: "tasks",
        title: "Tasks",
        visible: true,
        collapsed: false,
        order: 3,
        zone: "main",
        supportsCustomFields: false,
        fields: [],
      },
      // Sidebar sections
      {
        id: "associated-deals",
        title: "Associated Deals",
        visible: true,
        collapsed: false,
        order: 0,
        zone: "sidebar",
        supportsCustomFields: false,
        fields: [],
      },
      {
        id: "quick-info",
        title: "Quick Info",
        visible: true,
        collapsed: false,
        order: 1,
        zone: "sidebar",
        supportsCustomFields: true,
        fields: [
          { id: "createdAt", label: "Created", visible: true, order: 0 },
          { id: "lastActivity", label: "Last Activity", visible: true, order: 1 },
          { id: "lifecycleStage", label: "Lifecycle Stage", visible: true, order: 2 },
        ],
      },
    ];
  }

  if (objectType === "company") {
    return [
      // Main sections
      {
        id: "company-info",
        title: "Company Information",
        visible: true,
        collapsed: false,
        order: 0,
        zone: "main",
        supportsCustomFields: true,
        fields: [
          { id: "website", label: "Website", visible: true, order: 0 },
          { id: "phone", label: "Phone", visible: true, order: 1 },
          { id: "location", label: "Location", visible: true, order: 2 },
          { id: "industry", label: "Industry", visible: true, order: 3 },
          { id: "description", label: "Description", visible: true, order: 4 },
          // Add custom fields here
          ...customFields.map((cf, index) => ({
            id: `custom_${cf.name}`,
            label: cf.label,
            visible: true,
            order: 5 + index,
            isCustomField: true,
          })),
        ],
      },
      {
        id: "associated-contacts",
        title: "Associated Contacts",
        visible: true,
        collapsed: false,
        order: 1,
        zone: "main",
        supportsCustomFields: false,
        fields: [],
      },
      {
        id: "tasks",
        title: "Tasks",
        visible: true,
        collapsed: false,
        order: 2,
        zone: "main",
        supportsCustomFields: false,
        fields: [],
      },
      // Sidebar sections
      {
        id: "deals",
        title: "Deals",
        visible: true,
        collapsed: false,
        order: 0,
        zone: "sidebar",
        supportsCustomFields: false,
        fields: [],
      },
    ];
  }

  return [];
};

// Sortable Section Component
function SortableSection({
  section,
  onToggleVisibility,
  onToggleCollapsed,
  onFieldToggle,
  onFieldReorder,
  onAddField,
  supportsCustomFields,
}: {
  section: SectionConfig;
  onToggleVisibility: () => void;
  onToggleCollapsed: () => void;
  onFieldToggle: (fieldId: string) => void;
  onFieldReorder: (oldIndex: number, newIndex: number) => void;
  onAddField?: () => void;
  supportsCustomFields?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg bg-white mb-2",
        !section.visible && "opacity-60"
      )}
    >
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50 rounded-t-lg">
        <button
          {...attributes}
          {...listeners}
          className="p-1 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>

        <button
          onClick={onToggleCollapsed}
          className="p-1 hover:bg-gray-200 rounded"
        >
          {section.collapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </button>

        <span className="font-medium text-sm flex-1">{section.title}</span>

        {supportsCustomFields && onAddField && (
          <button
            onClick={onAddField}
            className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"
            title="Add custom field"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={onToggleVisibility}
          className={cn(
            "p-1 rounded transition-colors",
            section.visible
              ? "hover:bg-gray-200 text-gray-600"
              : "hover:bg-gray-200 text-gray-400"
          )}
          title={section.visible ? "Hide section" : "Show section"}
        >
          {section.visible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>
      </div>

      {!section.collapsed && section.fields.length > 0 && (
        <div className="p-3 space-y-1">
          {section.fields
            .sort((a, b) => a.order - b.order)
            .map((field) => (
              <div
                key={field.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded border bg-gray-50",
                  !field.visible && "opacity-50"
                )}
              >
                <GripVertical className="h-3.5 w-3.5 text-gray-300" />
                <span className="text-sm flex-1">
                  {field.label}
                  {field.isCustomField && (
                    <span className="ml-1.5 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      Custom
                    </span>
                  )}
                </span>
                <Switch
                  checked={field.visible}
                  onCheckedChange={() => onFieldToggle(field.id)}
                  className="scale-75"
                />
              </div>
            ))}
        </div>
      )}

      {!section.collapsed && section.fields.length === 0 && (
        <div className="p-3 text-sm text-gray-400 text-center">
          This section has no configurable fields
        </div>
      )}
    </div>
  );
}

// Main Component
interface DetailPageCustomizerProps {
  objectType: "deal" | "contact" | "company";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetailPageCustomizer({
  objectType,
  open,
  onOpenChange,
}: DetailPageCustomizerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sections, setSections] = useState<SectionConfigWithZone[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeZone, setActiveZone] = useState<SectionZone | null>(null);

  // Create custom field dialog state
  const [isCreateFieldOpen, setIsCreateFieldOpen] = useState(false);
  const [createFieldSectionId, setCreateFieldSectionId] = useState<string | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Fetch layout and custom fields
  const { data: layoutData, isLoading } = useQuery<LayoutData>({
    queryKey: ["/api/crm/layouts", objectType],
    queryFn: () =>
      apiRequest("GET", `/api/crm/layouts/${objectType}`).then((res) =>
        res.json()
      ),
    enabled: open,
  });

  // Initialize sections when data loads
  useEffect(() => {
    if (layoutData) {
      if (layoutData.layout && Array.isArray(layoutData.layout) && layoutData.layout.length > 0) {
        // Check if saved layout has zone info (new format)
        const hasZones = layoutData.layout.some((s: any) => s.zone);

        if (hasZones) {
          // Use saved layout, but merge any new custom fields
          const existingCustomFieldIds = new Set(
            layoutData.layout
              .flatMap((s: any) => s.fields || [])
              .filter((f: any) => f.isCustomField)
              .map((f: any) => f.id)
          );

          const newCustomFields = layoutData.customFields
            .filter((cf) => !existingCustomFieldIds.has(`custom_${cf.name}`))
            .map((cf, index) => ({
              id: `custom_${cf.name}`,
              label: cf.label,
              visible: true,
              order: 100 + index,
              isCustomField: true,
            }));

          // Add new custom fields to sections that support them
          const updatedLayout = (layoutData.layout as SectionConfigWithZone[]).map((section) => {
            if (section.supportsCustomFields && newCustomFields.length > 0) {
              const maxOrder = Math.max(...section.fields.map(f => f.order), 0);
              return {
                ...section,
                fields: [
                  ...section.fields,
                  ...newCustomFields.map((cf, i) => ({ ...cf, order: maxOrder + 1 + i })),
                ],
              };
            }
            return section;
          });

          setSections(updatedLayout);
        } else {
          // Old format without zones - use default layout
          setSections(getDefaultLayout(objectType, layoutData.customFields));
        }
      } else {
        // Use default layout
        setSections(getDefaultLayout(objectType, layoutData.customFields));
      }
      setHasChanges(false);
    }
  }, [layoutData, objectType]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/crm/layouts/${objectType}`, {
        body: { layout: sections },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/layouts", objectType] });
      setHasChanges(false);
      toast({
        title: "Layout saved",
        description: "Your detail page layout has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save layout.",
        variant: "destructive",
      });
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/crm/layouts/${objectType}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/layouts", objectType] });
      if (layoutData) {
        setSections(getDefaultLayout(objectType, layoutData.customFields));
      }
      setHasChanges(false);
      toast({
        title: "Layout reset",
        description: "Your detail page layout has been reset to default.",
      });
    },
  });

  // Create custom field mutation
  const createFieldMutation = useMutation({
    mutationFn: (data: {
      name: string;
      label: string;
      fieldType: string;
      isRequired: boolean;
      options?: { value: string; label: string }[];
    }) =>
      apiRequest("POST", "/api/crm/custom-fields", {
        body: {
          objectType,
          ...data,
        },
      }).then((res) => res.json()),
    onSuccess: (newField) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/layouts", objectType] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/custom-fields"] });

      // Add the new field to the target section
      if (createFieldSectionId) {
        setSections((prev) =>
          prev.map((s) => {
            if (s.id === createFieldSectionId) {
              const maxOrder = Math.max(...s.fields.map((f) => f.order), 0);
              return {
                ...s,
                fields: [
                  ...s.fields,
                  {
                    id: `custom_${newField.name}`,
                    label: newField.label,
                    visible: true,
                    order: maxOrder + 1,
                    isCustomField: true,
                  },
                ],
              };
            }
            return s;
          })
        );
        setHasChanges(true);
      }

      // Reset dialog state
      setIsCreateFieldOpen(false);
      setCreateFieldSectionId(null);
      setNewFieldLabel("");
      setNewFieldType("text");
      setNewFieldRequired(false);
      setNewFieldOptions([]);
      setNewOptionInput("");

      toast({
        title: "Field created",
        description: `Custom field "${newField.label}" has been created.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create custom field.",
        variant: "destructive",
      });
    },
  });

  // Helper to generate field name from label
  const generateFieldName = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 50);
  };

  // Handle creating the custom field
  const handleCreateField = () => {
    if (!newFieldLabel.trim()) {
      toast({
        title: "Error",
        description: "Please enter a field label.",
        variant: "destructive",
      });
      return;
    }

    const fieldName = generateFieldName(newFieldLabel);
    const options =
      newFieldType === "select" || newFieldType === "multiselect"
        ? newFieldOptions.map((opt) => ({ value: opt, label: opt }))
        : undefined;

    createFieldMutation.mutate({
      name: fieldName,
      label: newFieldLabel.trim(),
      fieldType: newFieldType,
      isRequired: newFieldRequired,
      options,
    });
  };

  // Open the create field dialog for a specific section
  const openCreateFieldDialog = (sectionId: string) => {
    setCreateFieldSectionId(sectionId);
    setIsCreateFieldOpen(true);
  };

  // Add option to the list
  const addOption = () => {
    if (newOptionInput.trim() && !newFieldOptions.includes(newOptionInput.trim())) {
      setNewFieldOptions([...newFieldOptions, newOptionInput.trim()]);
      setNewOptionInput("");
    }
  };

  // Remove option from the list
  const removeOption = (option: string) => {
    setNewFieldOptions(newFieldOptions.filter((o) => o !== option));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const sectionId = event.active.id as string;
    const section = sections.find((s) => s.id === sectionId);
    setActiveId(sectionId);
    setActiveZone(section?.zone || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveZone(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeSection = sections.find((s) => s.id === active.id);
    const overSection = sections.find((s) => s.id === over.id);

    // Only allow reordering within the same zone
    if (!activeSection || !overSection || activeSection.zone !== overSection.zone) {
      return;
    }

    const zone = activeSection.zone;

    setSections((prev) => {
      // Get only sections in the same zone
      const zoneSections = prev.filter((s) => s.zone === zone);
      const otherSections = prev.filter((s) => s.zone !== zone);

      const oldIndex = zoneSections.findIndex((s) => s.id === active.id);
      const newIndex = zoneSections.findIndex((s) => s.id === over.id);

      // Reorder within zone and update order numbers
      const reorderedZone = arrayMove(zoneSections, oldIndex, newIndex).map(
        (s, index) => ({ ...s, order: index })
      );

      return [...otherSections, ...reorderedZone];
    });
    setHasChanges(true);
  };

  const toggleSectionVisibility = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      )
    );
    setHasChanges(true);
  };

  const toggleSectionCollapsed = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s
      )
    );
  };

  const toggleFieldVisibility = (sectionId: string, fieldId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f) =>
                f.id === fieldId ? { ...f, visible: !f.visible } : f
              ),
            }
          : s
      )
    );
    setHasChanges(true);
  };

  const activeSection = sections.find((s) => s.id === activeId);

  // Group sections by zone
  const mainSections = sections.filter((s) => s.zone === "main").sort((a, b) => a.order - b.order);
  const sidebarSections = sections.filter((s) => s.zone === "sidebar").sort((a, b) => a.order - b.order);

  const objectLabel =
    objectType === "deal"
      ? "Deal"
      : objectType === "contact"
      ? "Contact"
      : "Company";

  // Render a zone group
  const renderZone = (zoneSections: SectionConfigWithZone[], zoneLabel: string, zoneDescription: string) => {
    if (zoneSections.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-700">{zoneLabel}</h3>
          <p className="text-xs text-gray-500">{zoneDescription}</p>
        </div>
        <SortableContext
          items={zoneSections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {zoneSections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              onToggleVisibility={() => toggleSectionVisibility(section.id)}
              onToggleCollapsed={() => toggleSectionCollapsed(section.id)}
              onFieldToggle={(fieldId) => toggleFieldVisibility(section.id, fieldId)}
              onFieldReorder={() => {}}
              onAddField={() => openCreateFieldDialog(section.id)}
              supportsCustomFields={section.supportsCustomFields}
            />
          ))}
        </SortableContext>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Customize {objectLabel} Page
          </SheetTitle>
          <SheetDescription>
            Drag sections to reorder within their zone. Toggle visibility for sections and fields.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* For deals, only show sidebar (tabs are fixed) */}
              {objectType === "deal" ? (
                renderZone(sidebarSections, "Sidebar Sections", "Reorder cards in the right sidebar")
              ) : (
                <>
                  {renderZone(mainSections, "Main Content", "Cards in the main content area")}
                  {renderZone(sidebarSections, "Sidebar", "Cards in the right sidebar")}
                </>
              )}

              <DragOverlay>
                {activeSection && (
                  <div className="border rounded-lg bg-white shadow-lg p-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-sm">
                        {activeSection.title}
                      </span>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* Create Custom Field Dialog */}
      <Dialog open={isCreateFieldOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateFieldOpen(false);
          setCreateFieldSectionId(null);
          setNewFieldLabel("");
          setNewFieldType("text");
          setNewFieldRequired(false);
          setNewFieldOptions([]);
          setNewOptionInput("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Custom Field</DialogTitle>
            <DialogDescription>
              Add a new custom field to this {objectType}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="field-label">Field Label</Label>
              <Input
                id="field-label"
                placeholder="e.g., Account Manager"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-type">Field Type</Label>
              <Select value={newFieldType} onValueChange={setNewFieldType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Options for select/multiselect */}
            {(newFieldType === "select" || newFieldType === "multiselect") && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add option..."
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addOption}>
                    Add
                  </Button>
                </div>
                {newFieldOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newFieldOptions.map((option) => (
                      <span
                        key={option}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                      >
                        {option}
                        <button
                          type="button"
                          onClick={() => removeOption(option)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="field-required"
                checked={newFieldRequired}
                onCheckedChange={setNewFieldRequired}
              />
              <Label htmlFor="field-required">Required field</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFieldOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateField}
              disabled={!newFieldLabel.trim() || createFieldMutation.isPending}
            >
              {createFieldMutation.isPending ? "Creating..." : "Create Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
