import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Eye, Check, FileImage } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface PdfTemplate {
  id: string;
  name: string;
  description: string;
  preview: string | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  pdfBackgroundTemplate?: string;
}

export function PdfTemplateSelector() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('classic');
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string>('');
  
  const queryClient = useQueryClient();

  // Fetch available templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/pdf-templates'],
    queryFn: async () => {
      const response = await fetch('/api/pdf-templates', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    }
  });

  // Fetch current user to get their template preference
  const { data: userData } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const response = await fetch('/api/user', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    }
  });

  // Update selected template when user data loads
  useEffect(() => {
    if (userData?.pdfBackgroundTemplate) {
      setSelectedTemplate(userData.pdfBackgroundTemplate);
    } else {
      setSelectedTemplate('none'); // Default to no background
    }
  }, [userData]);

  // Mutation to update template preference
  const updateTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch('/api/user/pdf-template', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ templateId })
      });
      if (!response.ok) throw new Error('Failed to update template');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Template Updated",
        description: "Your PDF template preference has been saved."
      });
      // Update the user data in cache
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setSelectedTemplate(data.templateId || data.pdfBackgroundTemplate);
    },
    onError: (error) => {
      toast({
        title: "Update Failed", 
        description: "Failed to update PDF template preference.",
        variant: "destructive"
      });
    }
  });

  const handleTemplateSelect = (templateId: string) => {
    updateTemplateMutation.mutate(templateId);
  };

  const handlePreview = (templateId: string) => {
    setPreviewTemplateId(templateId);
    setPreviewDialogOpen(true);
  };

  if (templatesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PDF Background Templates</CardTitle>
          <CardDescription>Loading templates...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const templates: PdfTemplate[] = templatesData?.templates || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>PDF Background Templates</CardTitle>
        <CardDescription>
          Choose a background template for your CIM PDF exports. This applies to all PDF downloads from your documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedTemplate === template.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleTemplateSelect(template.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{template.name}</h3>
                  {selectedTemplate === template.id && (
                    <Badge variant="default" className="bg-blue-600">
                      <Check className="h-3 w-3 mr-1" />
                      Selected
                    </Badge>
                  )}
                </div>
                {template.preview && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(template.id);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                )}
              </div>
              <p className="text-sm text-gray-600">{template.description}</p>
              {template.id === 'none' && (
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <FileImage className="h-4 w-4 mr-1" />
                  Clean pages without background
                </div>
              )}
            </div>
          ))}
        </div>

        {updateTemplateMutation.isPending && (
          <div className="text-sm text-gray-600">
            Saving template preference...
          </div>
        )}
      </CardContent>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Template Preview: {templates.find(t => t.id === previewTemplateId)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {previewTemplateId && previewTemplateId !== 'none' ? (
              <div className="w-full space-y-4">
                <div className="text-center">
                  <Button
                    onClick={() => window.open(`/api/pdf-templates/${previewTemplateId}/preview`, '_blank')}
                    className="mb-4"
                  >
                    Open Full Preview in New Tab
                  </Button>
                </div>
                <div className="w-full max-w-lg mx-auto">
                  <object
                    data={`/api/pdf-templates/${previewTemplateId}/preview`}
                    type="application/pdf"
                    className="w-full h-96 border rounded"
                  >
                    <div className="w-full h-96 border rounded bg-gray-50 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <FileImage className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-lg font-medium">PDF Preview</p>
                        <p className="text-sm mb-4">Click the button above to view the template</p>
                        <Button
                          variant="outline"
                          onClick={() => window.open(`/api/pdf-templates/${previewTemplateId}/preview`, '_blank')}
                        >
                          Open Preview
                        </Button>
                      </div>
                    </div>
                  </object>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-lg h-96 border rounded bg-gray-50 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <FileImage className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-lg font-medium">No Background Template</p>
                  <p className="text-sm">Clean pages without any background design</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}