import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, FileImage } from "lucide-react";

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
    <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
      <CardHeader className="bg-gradient-to-r from-violet-600 to-violet-700 pb-6 pt-8 px-8 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-sm">
            <FileImage className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-white">PDF Background Templates</CardTitle>
            <CardDescription className="text-violet-100 mt-1">
              Choose a background template for your CIM PDF exports. This applies to all PDF downloads from your documents.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-8">
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
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{template.name}</h3>
                  {selectedTemplate === template.id && (
                    <Badge variant="default" className="bg-blue-600">
                      <Check className="h-3 w-3 mr-1" />
                      Selected
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Template Preview Image */}
              <div className="mb-3 flex justify-center">
                {template.id === 'none' ? (
                  <div className="w-32 h-40 border-2 border-dashed border-gray-300 rounded bg-white flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <FileImage className="h-8 w-8 mx-auto mb-1" />
                      <span className="text-xs">No Background</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-32 h-40 border rounded shadow-sm overflow-hidden bg-white">
                    <img 
                      src={`/template-thumbnails/${template.id}.png`}
                      alt={`${template.name} preview`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // Fallback if thumbnail fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center text-gray-400">
                            <div class="text-center">
                              <svg class="h-8 w-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                              </svg>
                              <span class="text-xs">Template</span>
                            </div>
                          </div>
                        `;
                      }}
                    />
                  </div>
                )}
              </div>
              
              <p className="text-sm text-gray-600">{template.description}</p>
            </div>
          ))}
        </div>

        {updateTemplateMutation.isPending && (
          <div className="text-sm text-gray-600">
            Saving template preference...
          </div>
        )}
      </CardContent>


    </Card>
  );
}