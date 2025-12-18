
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X, Settings2, Save, FolderOpen, Trash2, Edit2 } from "lucide-react";
import { FormattingProfileSelector, type CustomStyleConfig } from "./formatting-profile-selector";
import type { FormattingProfile } from "@shared/formatting-config";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface SectionLine {
  id: string;
  content: string;
}

interface ContentStyleSectionProps {
  sectionDirections: SectionLine[];
  onSectionDirectionsChange: (directions: SectionLine[]) => void;
  formattingProfile: FormattingProfile;
  onFormattingProfileChange: (profile: FormattingProfile) => void;
  customStyleConfig?: CustomStyleConfig | null;
  onCustomStyleConfigChange?: (config: CustomStyleConfig | null) => void;
}

interface ContentStyleTemplate {
  id: number;
  name: string;
  sectionDirections: Record<string, string>;
  formattingProfile: FormattingProfile;
  isDefault: boolean;
  createdAt: string;
}

export function ContentStyleSection({
  sectionDirections,
  onSectionDirectionsChange,
  formattingProfile,
  onFormattingProfileChange,
  customStyleConfig,
  onCustomStyleConfigChange
}: ContentStyleSectionProps) {
  const { toast } = useToast();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Fetch user's content style templates
  const { data: templates = [], refetch: refetchTemplates } = useQuery<ContentStyleTemplate[]>({
    queryKey: ['/api/content-style-templates'],
    queryFn: () => apiRequest("GET", "/api/content-style-templates").then(res => res.json()),
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    refetchOnMount: true,
  });

  // Refetch templates when load dialog opens
  const handleOpenLoadDialog = (open: boolean) => {
    setLoadDialogOpen(open);
    if (open) {
      refetchTemplates();
    }
  };

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; sectionDirections: Record<string, string>; formattingProfile: FormattingProfile; isDefault: boolean }) => {
      const response = await apiRequest("POST", "/api/content-style-templates", { body: data });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Save failed: ${response.status} - ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Template Saved", description: "Your content & style template has been saved successfully." });
      setSaveDialogOpen(false);
      setTemplateName("");
      setSetAsDefault(false);
      queryClient.invalidateQueries({ queryKey: ['/api/content-style-templates'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Save Failed", 
        description: error.message || "Failed to save template.", 
        variant: "destructive" 
      });
    }
  });

  // Load template mutation
  const loadTemplateMutation = useMutation({
    mutationFn: async (template: ContentStyleTemplate) => {
      return template; // We already have the template data from the list
    },
    onSuccess: (template: ContentStyleTemplate) => {
      // Convert template section directions back to SectionLine format
      const sectionLines: SectionLine[] = Object.entries(template.sectionDirections).map(([id, content]) => ({
        id,
        content
      }));
      onSectionDirectionsChange(sectionLines);
      onFormattingProfileChange(template.formattingProfile);
      setLoadDialogOpen(false);
      toast({ title: "Template Loaded", description: `Template "${template.name}" has been applied.` });
    },
    onError: () => {
      toast({ title: "Load Failed", description: "Failed to load template.", variant: "destructive" });
    }
  });

  // Set default template mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await apiRequest("POST", `/api/content-style-templates/${templateId}/set-default`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Default Set", description: "Template has been set as your default." });
      queryClient.invalidateQueries({ queryKey: ['/api/content-style-templates'] });
    },
    onError: () => {
      toast({ title: "Failed", description: "Failed to set default template.", variant: "destructive" });
    }
  });

  const updateSectionLine = (index: number, content: string) => {
    const updated = [...sectionDirections];
    updated[index] = { ...updated[index], content };
    onSectionDirectionsChange(updated);
  };

  const addSectionLine = () => {
    const newLine: SectionLine = {
      id: Date.now().toString(),
      content: ""
    };
    onSectionDirectionsChange([...sectionDirections, newLine]);
  };

  const removeSectionLine = (index: number) => {
    if (sectionDirections.length > 1) {
      const updated = sectionDirections.filter((_, i) => i !== index);
      onSectionDirectionsChange(updated);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast({ title: "Name Required", description: "Please enter a template name.", variant: "destructive" });
      return;
    }

    // Convert section directions to the format expected by the API
    const sectionDirectionsObject = sectionDirections.reduce((acc, line) => {
      if (line.content.trim()) {
        acc[line.id] = line.content;
      }
      return acc;
    }, {} as Record<string, string>);

    saveTemplateMutation.mutate({
      name: templateName,
      sectionDirections: sectionDirectionsObject,
      formattingProfile,
      isDefault: setAsDefault
    });
  };

  return (
    <div className="space-y-0">
      <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Content & Style</h3>
            <p className="text-sm text-slate-200">Customize which sections to include and how the AI writes your content</p>
          </div>
        </div>
        
        {/* Template Actions */}
        <div className="flex items-center gap-2">
          <Dialog open={loadDialogOpen} onOpenChange={handleOpenLoadDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-sm bg-white/20 hover:bg-white/30 text-white border border-white/20 hover:border-white/40 backdrop-blur-sm">
                <FolderOpen className="h-4 w-4 mr-1" />
                Load Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Load Content & Style Template</DialogTitle>
                <DialogDescription>
                  Select a saved template to apply its section directions and formatting profile.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No saved templates found.</p>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{template.name}</h4>
                            {template.isDefault && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {template.formattingProfile} • {Object.keys(template.sectionDirections).length} sections
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadTemplateMutation.mutate(template)}
                            disabled={loadTemplateMutation.isPending}
                          >
                            Load
                          </Button>
                          {!template.isDefault && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDefaultMutation.mutate(template.id)}
                              disabled={setDefaultMutation.isPending}
                            >
                              Set Default
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-sm bg-white/20 hover:bg-white/30 text-white border border-white/20 hover:border-white/40 backdrop-blur-sm">
                <Save className="h-4 w-4 mr-1" />
                Save Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Content & Style Template</DialogTitle>
                <DialogDescription>
                  Save your current section directions and formatting profile as a template for future use.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Investment Deck Template"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="set-default"
                    checked={setAsDefault}
                    onCheckedChange={(checked) => setSetAsDefault(checked === true)}
                  />
                  <Label htmlFor="set-default" className="text-sm">
                    Set as my default template
                  </Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={saveTemplateMutation.isPending || !templateName.trim()}
                  >
                    Save Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-6 p-3 border border-t-0 rounded-b-lg bg-white">
        {/* Section Directions - Above */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Sections
            </Label>
            <p className="text-sm text-muted-foreground">
              Customize which sections to include in your CIM. Add, remove, or reorder sections to match your needs.
            </p>
          </div>
          <div className="space-y-2">
            {sectionDirections.map((line, index) => (
              <div key={line.id} className="group flex items-center space-x-3 py-2">
                <span className="text-sm font-medium text-gray-400 w-6 flex-shrink-0">{index + 1}.</span>

                {editingIndex === index ? (
                  <Input
                    value={line.content}
                    onChange={(e) => updateSectionLine(index, e.target.value)}
                    onBlur={() => setEditingIndex(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingIndex(null);
                      if (e.key === 'Escape') setEditingIndex(null);
                    }}
                    placeholder="Section Name - Description of what to include..."
                    className="flex-1"
                    autoFocus
                  />
                ) : (
                  <div
                    className="flex-1 group/text cursor-pointer"
                    onClick={() => setEditingIndex(index)}
                  >
                    <div className="text-sm text-gray-700 pb-1 border-b border-gray-200 group-hover/text:border-blue-400 transition-colors">
                      {line.content || (
                        <span className="text-gray-400 italic">Click to add section...</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingIndex(index)}
                    className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  {sectionDirections.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSectionLine(index)}
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addSectionLine}
            className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </div>

        {/* Separator Line */}
        <div className="border-t border-slate-200 my-6"></div>

        {/* Formatting Profile - Below in 2 columns */}
        <div className="space-y-4">
          <FormattingProfileSelector
            value={formattingProfile}
            onChange={onFormattingProfileChange}
            customStyleConfig={customStyleConfig}
            onCustomStyleConfigChange={onCustomStyleConfigChange}
          />
        </div>
      </div>
    </div>
  );
}
