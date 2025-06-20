import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NdaTemplateEditor from '@/components/nda-template-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FileText, Plus } from 'lucide-react';

interface NdaTemplate {
  id: number;
  name: string;
  fileContent: string;
  signatureFields: any[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function NdaTemplateEditorPage() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute('/nda-templates/:id?');
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const templateId = params?.id ? parseInt(params.id) : null;
  const isNewTemplate = templateId === null;

  // Fetch existing templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/nda-templates'],
    enabled: !isEditing
  });

  // Fetch specific template if editing
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['/api/nda-templates', templateId],
    enabled: !!templateId && !isNewTemplate
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: {
      name: string;
      fileContent: string;
      signatureFields: any[];
    }) => {
      const url = isNewTemplate 
        ? '/api/nda-templates'
        : `/api/nda-templates/${templateId}`;
      
      const method = isNewTemplate ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save template');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
      setIsEditing(false);
      setLocation('/nda-templates');
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/nda-templates/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
      toast({
        title: "Template deleted",
        description: "NDA template has been deleted successfully"
      });
      setLocation('/nda-templates');
    },
  });

  const handleSave = async (templateData: {
    name: string;
    fileContent: string;
    signatureFields: any[];
  }) => {
    await saveTemplateMutation.mutateAsync(templateData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocation('/nda-templates');
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      await deleteTemplateMutation.mutateAsync(id);
    }
  };

  if (isEditing || isNewTemplate) {
    return (
      <NdaTemplateEditor
        templateId={templateId}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  if (templatesLoading || templateLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">NDA Templates</h1>
          <p className="text-gray-600 mt-2">
            Create and manage drag & drop signature templates for your NDAs
          </p>
        </div>
        <Button onClick={() => setIsEditing(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates?.map((template: NdaTemplate) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {template.name}
                  </CardTitle>
                  {template.isDefault && (
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full mt-2">
                      Default
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>{template.signatureFields?.length || 0} signature fields</p>
                <p>Updated {new Date(template.updatedAt).toLocaleDateString()}</p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocation(`/nda-templates/${template.id}`);
                    setIsEditing(true);
                  }}
                  className="flex-1"
                >
                  Edit
                </Button>
                {!template.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Empty State */}
        {(!templates || templates.length === 0) && (
          <div className="col-span-full">
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No NDA Templates</h3>
                <p className="text-gray-600 text-center mb-4">
                  Create your first drag & drop signature template to get started
                </p>
                <Button onClick={() => setIsEditing(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}