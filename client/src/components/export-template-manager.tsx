import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Palette, 
  Type, 
  Layout, 
  FileImage, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Star,
  Download,
  Eye,
  Copy
} from "lucide-react";

interface ExportTemplate {
  id: number;
  name: string;
  description?: string;
  layout: 'standard' | 'executive' | 'detailed' | 'minimal';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerFont: string;
  bodyFont: string;
  fontSize: number;
  logoUrl?: string;
  logoPosition: 'header-left' | 'header-center' | 'header-right' | 'footer';
  logoSize: 'small' | 'medium' | 'large';
  headerText?: string;
  footerText?: string;
  showPageNumbers: boolean;
  showDate: boolean;
  includeCoverPage: boolean;
  includeTableOfContents: boolean;
  includeExecutiveSummary: boolean;
  includeFinancials: boolean;
  includeAppendices: boolean;
  pageSize: 'letter' | 'a4' | 'legal';
  margins: { top: number; bottom: number; left: number; right: number };
  sectionSpacing: number;
  paragraphSpacing: number;
  watermarkText?: string;
  confidentialityNotice?: string;
  isDefault: boolean;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const defaultTemplate: Partial<ExportTemplate> = {
  name: "",
  description: "",
  layout: "standard",
  primaryColor: "#1e40af",
  secondaryColor: "#64748b",
  accentColor: "#dc2626",
  headerFont: "Inter",
  bodyFont: "Inter",
  fontSize: 11,
  logoPosition: "header-left",
  logoSize: "medium",
  showPageNumbers: true,
  showDate: true,
  includeCoverPage: true,
  includeTableOfContents: true,
  includeExecutiveSummary: true,
  includeFinancials: true,
  includeAppendices: true,
  pageSize: "letter",
  margins: { top: 72, bottom: 72, left: 54, right: 54 },
  sectionSpacing: 24,
  paragraphSpacing: 12,
};

export function ExportTemplateManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<ExportTemplate>>(defaultTemplate);

  // Fetch export templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/export-templates"],
    queryFn: async () => {
      const response = await fetch("/api/export-templates");
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json() as ExportTemplate[];
    },
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: Partial<ExportTemplate>) => {
      const response = await fetch("/api/export-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateData),
      });
      if (!response.ok) throw new Error("Failed to create template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/export-templates"] });
      setIsCreating(false);
      setEditingTemplate(defaultTemplate);
      toast({
        title: "Template Created",
        description: "Your export template has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ExportTemplate> }) => {
      const response = await fetch(`/api/export-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/export-templates"] });
      setSelectedTemplate(null);
      setEditingTemplate(defaultTemplate);
      toast({
        title: "Template Updated",
        description: "Your export template has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/export-templates/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/export-templates"] });
      setSelectedTemplate(null);
      toast({
        title: "Template Deleted",
        description: "Template has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Set default template mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/export-templates/${id}/set-default`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to set default template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/export-templates"] });
      toast({
        title: "Default Template Set",
        description: "This template will now be used by default for exports.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to set default template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveTemplate = () => {
    if (!editingTemplate.name?.trim()) {
      toast({
        title: "Error",
        description: "Please enter a template name.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTemplate) {
      updateTemplateMutation.mutate({ id: selectedTemplate.id, data: editingTemplate });
    } else {
      createTemplateMutation.mutate(editingTemplate);
    }
  };

  const handleEditTemplate = (template: ExportTemplate) => {
    setSelectedTemplate(template);
    setEditingTemplate(template);
    setIsCreating(true);
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setEditingTemplate(defaultTemplate);
    setIsCreating(true);
  };

  const handleDuplicateTemplate = (template: ExportTemplate) => {
    const duplicated = {
      ...template,
      name: `${template.name} (Copy)`,
      isDefault: false,
    };
    delete (duplicated as any).id;
    delete (duplicated as any).usageCount;
    delete (duplicated as any).createdAt;
    delete (duplicated as any).updatedAt;
    
    setSelectedTemplate(null);
    setEditingTemplate(duplicated);
    setIsCreating(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {selectedTemplate ? "Edit Template" : "Create Export Template"}
            </h2>
            <p className="text-muted-foreground">
              Customize the appearance and branding of your document exports
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {selectedTemplate ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic" className="gap-2">
              <Settings className="h-4 w-4" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="h-4 w-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="typography" className="gap-2">
              <Type className="h-4 w-4" />
              Typography
            </TabsTrigger>
            <TabsTrigger value="layout" className="gap-2">
              <Layout className="h-4 w-4" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <FileImage className="h-4 w-4" />
              Content
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Template Information</CardTitle>
                <CardDescription>
                  Basic information about your export template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      value={editingTemplate.name || ""}
                      onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Professional Blue Theme"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="layout">Layout Style</Label>
                    <Select
                      value={editingTemplate.layout}
                      onValueChange={(value) => setEditingTemplate(prev => ({ ...prev, layout: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="executive">Executive</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={editingTemplate.description || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe when to use this template..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Color Scheme</CardTitle>
                <CardDescription>
                  Choose colors that represent your brand
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={editingTemplate.primaryColor}
                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-16 h-10 p-1 border rounded"
                      />
                      <Input
                        value={editingTemplate.primaryColor}
                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, primaryColor: e.target.value }))}
                        placeholder="#1e40af"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={editingTemplate.secondaryColor}
                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-16 h-10 p-1 border rounded"
                      />
                      <Input
                        value={editingTemplate.secondaryColor}
                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        placeholder="#64748b"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="accentColor"
                        type="color"
                        value={editingTemplate.accentColor}
                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="w-16 h-10 p-1 border rounded"
                      />
                      <Input
                        value={editingTemplate.accentColor}
                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, accentColor: e.target.value }))}
                        placeholder="#dc2626"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logo Settings</CardTitle>
                <CardDescription>
                  Configure your logo placement and appearance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL (Optional)</Label>
                  <Input
                    id="logoUrl"
                    value={editingTemplate.logoUrl || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Logo Position</Label>
                    <Select
                      value={editingTemplate.logoPosition}
                      onValueChange={(value) => setEditingTemplate(prev => ({ ...prev, logoPosition: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header-left">Header Left</SelectItem>
                        <SelectItem value="header-center">Header Center</SelectItem>
                        <SelectItem value="header-right">Header Right</SelectItem>
                        <SelectItem value="footer">Footer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Logo Size</Label>
                    <Select
                      value={editingTemplate.logoSize}
                      onValueChange={(value) => setEditingTemplate(prev => ({ ...prev, logoSize: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="typography" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Font Settings</CardTitle>
                <CardDescription>
                  Configure fonts and text sizing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Header Font</Label>
                    <Select
                      value={editingTemplate.headerFont}
                      onValueChange={(value) => setEditingTemplate(prev => ({ ...prev, headerFont: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inter">Inter</SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                        <SelectItem value="Georgia">Georgia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Body Font</Label>
                    <Select
                      value={editingTemplate.bodyFont}
                      onValueChange={(value) => setEditingTemplate(prev => ({ ...prev, bodyFont: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inter">Inter</SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                        <SelectItem value="Georgia">Georgia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Input
                      type="number"
                      min="8"
                      max="16"
                      value={editingTemplate.fontSize}
                      onChange={(e) => setEditingTemplate(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="layout" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Page Layout</CardTitle>
                <CardDescription>
                  Configure page size and spacing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Page Size</Label>
                    <Select
                      value={editingTemplate.pageSize}
                      onValueChange={(value) => setEditingTemplate(prev => ({ ...prev, pageSize: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="letter">Letter (8.5" × 11")</SelectItem>
                        <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                        <SelectItem value="legal">Legal (8.5" × 14")</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Section Spacing</Label>
                    <Input
                      type="number"
                      min="12"
                      max="48"
                      value={editingTemplate.sectionSpacing}
                      onChange={(e) => setEditingTemplate(prev => ({ ...prev, sectionSpacing: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Paragraph Spacing</Label>
                    <Input
                      type="number"
                      min="6"
                      max="24"
                      value={editingTemplate.paragraphSpacing}
                      onChange={(e) => setEditingTemplate(prev => ({ ...prev, paragraphSpacing: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Page Margins (in points)</Label>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Top</Label>
                      <Input
                        type="number"
                        min="36"
                        max="144"
                        value={editingTemplate.margins?.top || 72}
                        onChange={(e) => setEditingTemplate(prev => ({ 
                          ...prev, 
                          margins: { ...prev.margins!, top: parseInt(e.target.value) }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Bottom</Label>
                      <Input
                        type="number"
                        min="36"
                        max="144"
                        value={editingTemplate.margins?.bottom || 72}
                        onChange={(e) => setEditingTemplate(prev => ({ 
                          ...prev, 
                          margins: { ...prev.margins!, bottom: parseInt(e.target.value) }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Left</Label>
                      <Input
                        type="number"
                        min="36"
                        max="144"
                        value={editingTemplate.margins?.left || 54}
                        onChange={(e) => setEditingTemplate(prev => ({ 
                          ...prev, 
                          margins: { ...prev.margins!, left: parseInt(e.target.value) }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Right</Label>
                      <Input
                        type="number"
                        min="36"
                        max="144"
                        value={editingTemplate.margins?.right || 54}
                        onChange={(e) => setEditingTemplate(prev => ({ 
                          ...prev, 
                          margins: { ...prev.margins!, right: parseInt(e.target.value) }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Header & Footer</CardTitle>
                <CardDescription>
                  Customize header and footer content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Header Text (Optional)</Label>
                  <Input
                    value={editingTemplate.headerText || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, headerText: e.target.value }))}
                    placeholder="e.g., CONFIDENTIAL"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Footer Text (Optional)</Label>
                  <Input
                    value={editingTemplate.footerText || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, footerText: e.target.value }))}
                    placeholder="e.g., Company Name - All Rights Reserved"
                  />
                </div>
                <div className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showPageNumbers"
                      checked={editingTemplate.showPageNumbers}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev, showPageNumbers: checked }))}
                    />
                    <Label htmlFor="showPageNumbers">Show page numbers</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showDate"
                      checked={editingTemplate.showDate}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev, showDate: checked }))}
                    />
                    <Label htmlFor="showDate">Show date</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Sections</CardTitle>
                <CardDescription>
                  Choose which sections to include in exports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeCoverPage"
                      checked={editingTemplate.includeCoverPage}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev, includeCoverPage: checked }))}
                    />
                    <Label htmlFor="includeCoverPage">Cover Page</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeTableOfContents"
                      checked={editingTemplate.includeTableOfContents}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev, includeTableOfContents: checked }))}
                    />
                    <Label htmlFor="includeTableOfContents">Table of Contents</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeExecutiveSummary"
                      checked={editingTemplate.includeExecutiveSummary}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev, includeExecutiveSummary: checked }))}
                    />
                    <Label htmlFor="includeExecutiveSummary">Executive Summary</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeFinancials"
                      checked={editingTemplate.includeFinancials}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev, includeFinancials: checked }))}
                    />
                    <Label htmlFor="includeFinancials">Financial Information</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeAppendices"
                      checked={editingTemplate.includeAppendices}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev, includeAppendices: checked }))}
                    />
                    <Label htmlFor="includeAppendices">Appendices</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Watermark & Confidentiality</CardTitle>
                <CardDescription>
                  Add watermarks and confidentiality notices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Watermark Text (Optional)</Label>
                  <Input
                    value={editingTemplate.watermarkText || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, watermarkText: e.target.value }))}
                    placeholder="e.g., CONFIDENTIAL"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confidentiality Notice (Optional)</Label>
                  <Textarea
                    value={editingTemplate.confidentialityNotice || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, confidentialityNotice: e.target.value }))}
                    placeholder="This document contains confidential and proprietary information..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Export Templates</h2>
          <p className="text-muted-foreground">
            Manage your custom export templates with branding and layout options
          </p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="relative">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {template.name}
                      {template.isDefault && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          Default
                        </Badge>
                      )}
                    </CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
                
                {/* Color preview */}
                <div className="flex gap-1 mt-3">
                  <div 
                    className="w-4 h-4 rounded-sm border"
                    style={{ backgroundColor: template.primaryColor }}
                    title="Primary Color"
                  />
                  <div 
                    className="w-4 h-4 rounded-sm border"
                    style={{ backgroundColor: template.secondaryColor }}
                    title="Secondary Color"
                  />
                  <div 
                    className="w-4 h-4 rounded-sm border"
                    style={{ backgroundColor: template.accentColor }}
                    title="Accent Color"
                  />
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <div>Layout: {template.layout}</div>
                    <div>Font: {template.headerFont} / {template.bodyFont}</div>
                    <div>Used {template.usageCount} times</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditTemplate(template)}
                      className="gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDuplicateTemplate(template)}
                      className="gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                    {!template.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDefaultMutation.mutate(template.id)}
                        className="gap-1"
                      >
                        <Star className="h-3 w-3" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteTemplateMutation.mutate(template.id)}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Palette className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Export Templates</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Create your first export template to customize the appearance and branding of your document exports.
            </p>
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}