import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { EnhancedNdaTemplateEditor } from '@/components/esignature/enhanced-nda-template-editor';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EnhancedNdaTemplateEditorPage() {
  const [match, params] = useRoute('/nda-templates/enhanced/:id/edit');
  const [, setLocation] = useLocation();
  const templateId = params?.id ? parseInt(params.id) : null;
  const isCreating = !templateId;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch template data if editing
  const { data: template, isLoading, error } = useQuery({
    queryKey: ['/api/nda-templates', templateId],
    queryFn: () => templateId ? apiRequest(`/api/nda-templates/${templateId}`) : null,
    enabled: !!templateId,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: {
      name: string;
      fileContent: string;
      signatureFields: any[];
      recipients: any[];
    }) => {
      const response = await apiRequest('POST', '/api/nda-templates', { body: templateData });
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate queries to ensure the list is updated
      await queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });

      toast({
        title: "Template created",
        description: "NDA template has been created successfully"
      });

      // Small delay to ensure cache is updated before navigation
      setTimeout(() => {
        setLocation('/account?tab=nda-templates');
      }, 100);
    },
    onError: (error) => {
      console.error('Error creating template:', error);
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (templateData: {
      name: string;
      fileContent: string;
      signatureFields: any[];
      recipients: any[];
    }) => {
      const response = await apiRequest('PUT', `/api/nda-templates/${templateId}`, { body: templateData });
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate queries to ensure the list is updated
      await queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });

      toast({
        title: "Template updated",
        description: "NDA template has been updated successfully"
      });

      // Small delay to ensure cache is updated before navigation
      setTimeout(() => {
        setLocation('/account?tab=nda-templates');
      }, 100);
    },
    onError: (error) => {
      console.error('Error updating template:', error);
      toast({
        title: "Error",
        description: "Failed to update template. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Handle save function
  const handleSave = (data: {
    name: string;
    fileContent: string;
    signatureFields: any[];
    recipients: any[];
  }) => {
    if (isCreating) {
      createTemplateMutation.mutate(data);
    } else {
      updateTemplateMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load template. Please try again or contact support if the problem persists.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!isCreating && !template) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Template Not Found</h2>
                <p className="text-gray-600">
                  The requested template could not be found or you don't have permission to edit it.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {isCreating ? 'Create Enhanced NDA Template' : 'Edit Enhanced NDA Template'}
          </h1>
          <p className="text-gray-600 mt-2">
            Create professional NDA templates with interactive signing fields and recipient management.
          </p>
        </div>

        <EnhancedNdaTemplateEditor
          initialTemplate={template}
          onSave={handleSave}
          isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
        />
      </div>
    </div>
  );
}