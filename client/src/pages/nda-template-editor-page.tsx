import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CachedNdaTemplateEditor from '@/components/cached-nda-template-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
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
  const [, params] = useRoute('/nda-templates/edit/:id');
  const [createMatch] = useRoute('/nda-templates/create');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const templateId = params?.id ? parseInt(params.id) : null;
  const isNewTemplate = !!createMatch;

  // Fetch specific template if editing
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['/api/nda-templates', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const response = await apiRequest('GET', `/api/nda-templates/${templateId}`);
      return response.json();
    },
    enabled: !!templateId && !isNewTemplate
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: {
      name: string;
      fileContent: string;
      signatureFields: any[];
    }) => {
      console.log('Saving template with data:', {
        name: templateData.name,
        hasFileContent: !!templateData.fileContent,
        signatureFieldsCount: templateData.signatureFields?.length || 0
      });

      const url = isNewTemplate 
        ? '/api/nda-templates'
        : `/api/nda-templates/${templateId}`;
      
      const method = isNewTemplate ? 'POST' : 'PUT';
      
      const response = await apiRequest(
        method,
        url,
        {
          name: templateData.name,
          fileContent: templateData.fileContent,
          signatureFields: templateData.signatureFields || [],
          isDefault: false
        }
      );
      
      return response.json();
    },
    onSuccess: (template) => {
      console.log('Template saved successfully:', template.id);
      toast({
        title: "Template saved",
        description: "Your NDA template has been saved successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
      setIsEditing(false);
      setLocation('/nda-templates');
    },
    onError: (error) => {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/nda-templates/${id}`);
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

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => setLocation('/nda-templates')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Templates
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isNewTemplate ? 'Create New' : 'Edit'} NDA Template
          </h1>
          <p className="text-gray-600 mt-2">
            {isNewTemplate ? 'Upload a PDF and add signature fields' : 'Update template and signature fields'}
          </p>
        </div>
      </div>

      {templateLoading && !isNewTemplate ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <CachedNdaTemplateEditor
          initialTemplate={template}
          onSave={handleSave}
          isLoading={saveTemplateMutation.isPending}
        />
      )}
    </div>
  );
}