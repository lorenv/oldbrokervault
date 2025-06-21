import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Edit, Trash2, Calendar } from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

interface NdaTemplate {
  id: number;
  name: string;
  createdAt: string;
  signatureFields: any[];
}

export default function NdaTemplatesPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/nda-templates'],
    queryFn: () => apiRequest('/api/nda-templates')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/nda-templates/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
      toast({
        title: "Template deleted",
        description: "NDA template has been deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete template",
        variant: "destructive"
      });
    }
  });

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">NDA Templates</h1>
            <p className="text-gray-600 mt-2">Create and manage your NDA templates with signature fields</p>
          </div>
          <Button 
            onClick={() => setLocation('/nda-templates/create')}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-600 mb-4">
              Create your first NDA template to get started with e-signature collection
            </p>
            <Button 
              onClick={() => setLocation('/nda-templates/create')}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template: NdaTemplate) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    {template.name}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLocation(`/nda-templates/edit/${template.id}`)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(template.id, template.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    Created {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {template.signatureFields?.length || 0} signature fields
                    </Badge>
                  </div>
                  
                  <Button 
                    className="w-full"
                    onClick={() => setLocation(`/nda-templates/edit/${template.id}`)}
                  >
                    Edit Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}