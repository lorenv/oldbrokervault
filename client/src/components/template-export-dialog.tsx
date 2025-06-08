import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Palette, Star } from "lucide-react";

interface ExportTemplate {
  id: number;
  name: string;
  description?: string;
  layout: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  isDefault: boolean;
  usageCount: number;
}

interface TemplateExportDialogProps {
  documentId: number;
  documentTitle: string;
  children: React.ReactNode;
}

export function TemplateExportDialog({ documentId, documentTitle, children }: TemplateExportDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch export templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/export-templates"],
    queryFn: async () => {
      const response = await fetch("/api/export-templates");
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json() as ExportTemplate[];
    },
  });

  const handleExport = async () => {
    if (!selectedTemplateId) return;
    
    setIsExporting(true);
    try {
      const response = await fetch(`/api/cim/${documentId}/pdf?templateId=${selectedTemplateId}`);
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${documentTitle || 'CIM'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const defaultTemplate = templates?.find(t => t.isDefault);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Export with Template
          </DialogTitle>
          <DialogDescription>
            Choose a template to customize the appearance and branding of your export
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading templates...</div>
            </div>
          ) : templates && templates.length > 0 ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Template</label>
                <Select 
                  value={selectedTemplateId?.toString() || ""} 
                  onValueChange={(value) => setSelectedTemplateId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an export template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{template.name}</span>
                          {template.isDefault && (
                            <Badge variant="secondary" className="gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              Default
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplateId && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Template Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const template = templates.find(t => t.id === selectedTemplateId);
                      if (!template) return null;
                      
                      return (
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold flex items-center gap-2">
                                {template.name}
                                {template.isDefault && (
                                  <Badge variant="secondary" className="gap-1">
                                    <Star className="h-3 w-3 fill-current" />
                                    Default
                                  </Badge>
                                )}
                              </h3>
                              {template.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {template.description}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
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
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            <div>Layout: {template.layout}</div>
                            <div>Used {template.usageCount} times</div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-muted-foreground">
                  {defaultTemplate && !selectedTemplateId && (
                    <span>Default template "{defaultTemplate.name}" will be used</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExport}
                    disabled={isExporting || (!selectedTemplateId && !defaultTemplate)}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {isExporting ? "Exporting..." : "Export PDF"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Templates Available</h3>
              <p className="text-muted-foreground mb-4">
                Create your first export template to customize document exports.
              </p>
              <Button asChild>
                <a href="/export-templates">Create Template</a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}