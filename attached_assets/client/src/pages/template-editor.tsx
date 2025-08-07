import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { DocumentViewer } from "@/components/document/document-viewer";
import { FieldToolbox } from "@/components/document/field-toolbox";
import { AddTemplateRecipientDialog } from "@/components/template/add-template-recipient-dialog";
import { ManageRolesDialog } from "@/components/template/manage-roles-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Users, ArrowLeft, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getRecipientColor, getRecipientColorById } from "@/lib/types";
import type { Template, TemplateField, SignatureField } from "@shared/schema";
import { Link } from "wouter";

interface TemplateData {
  template: Template;
  fields: TemplateField[];
  roles: TemplateRecipient[];
}

interface TemplateRecipient {
  id: number;
  name: string;
  title: string;
  role: string;
  signingOrder: number;
  placeholderEmail: string;
}

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [selectedRole, setSelectedRole] = useState<number>(1);
  const [showManageRoles, setShowManageRoles] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const { data, isLoading, error } = useQuery<TemplateData>({
    queryKey: [`/api/templates/${id}`],
    enabled: !!id,
  });

  // Use API data for roles, fallback to empty array if loading
  const roles = data?.roles || [];

  // Auto-select first role when roles are loaded
  useEffect(() => {
    if (roles.length > 0 && !roles.some(role => role.id === selectedRole)) {
      setSelectedRole(roles[0].id);
    }
  }, [roles, selectedRole]);

  // Template recipient mutations
  const addRecipientMutation = useMutation({
    mutationFn: async (recipientData: Omit<TemplateRecipient, 'id'>) => {
      const response = await apiRequest(`/api/templates/${id}/recipients`, "POST", recipientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/templates/${id}`] });
      toast({
        title: "Recipient added",
        description: "Template recipient has been added successfully",
      });
    },
    onError: (error) => {
      console.error("Add recipient error:", error);
      toast({
        title: "Error",
        description: "Failed to add template recipient",
        variant: "destructive",
      });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: async (recipientId: number) => {
      const response = await apiRequest(`/api/template-recipients/${recipientId}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/templates/${id}`] });
      toast({
        title: "Recipient removed",
        description: "Template recipient has been removed successfully",
      });
    },
    onError: (error) => {
      console.error("Delete recipient error:", error);
      toast({
        title: "Error",
        description: "Failed to remove template recipient",
        variant: "destructive",
      });
    },
  });

  const addTemplateRecipient = (recipientData: Omit<TemplateRecipient, 'id'>) => {
    addRecipientMutation.mutate(recipientData);
  };

  const removeTemplateRecipient = (recipientId: number) => {
    deleteRecipientMutation.mutate(recipientId);
  };

  const updateRecipientMutation = useMutation({
    mutationFn: async (data: { recipientId: number; updates: Partial<TemplateRecipient> }) => {
      const response = await apiRequest(`/api/template-recipients/${data.recipientId}`, "PATCH", data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/templates/${id}`] });
      toast({
        title: "Role updated",
        description: "Template role has been updated successfully",
      });
    },
    onError: (error) => {
      console.error("Update recipient error:", error);
      toast({
        title: "Error",
        description: "Failed to update role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateTemplateRole = (roleId: number, updates: Partial<TemplateRecipient>) => {
    updateRecipientMutation.mutate({ recipientId: roleId, updates });
  };

  const addFieldMutation = useMutation({
    mutationFn: async (field: Omit<TemplateField, "id">) => {
      const response = await apiRequest(`/api/templates/${id}/fields`, "POST", field);
      return response.json();
    },
    onSuccess: (newField) => {
      // Immediately add the new field to cache for instant UI feedback
      queryClient.setQueryData([`/api/templates/${id}`], (oldData: TemplateData | undefined) => {
        if (!oldData) return oldData;
        
        // Check if field already exists to avoid duplicates
        const fieldExists = oldData.fields.some(f => f.id === newField.id);
        if (fieldExists) return oldData;
        
        return {
          ...oldData,
          fields: [...oldData.fields, newField]
        };
      });
    },
    onError: (error) => {
      console.error("Failed to create field:", error);
      toast({
        title: "Error",
        description: "Failed to add field. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ fieldId, updates }: { fieldId: number; updates: Partial<TemplateField> }) => {
      return apiRequest(`/api/template-fields/${fieldId}`, "PATCH", updates);
    },
    onMutate: async ({ fieldId, updates }) => {
      // Optimistic update - immediately update field in cache
      queryClient.setQueryData([`/api/templates/${id}`], (oldData: TemplateData | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          fields: oldData.fields.map(field => 
            field.id === fieldId ? { ...field, ...updates } : field
          )
        };
      });
    },
    onSuccess: () => {
      // No need to invalidate - optimistic update already applied
    },
    onError: (error) => {
      console.error("Failed to update field:", error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: [`/api/templates/${id}`] });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: number) => {
      return apiRequest(`/api/template-fields/${fieldId}`, "DELETE");
    },
    onSuccess: (_, fieldId) => {
      // Immediately remove from UI
      queryClient.setQueryData([`/api/templates/${id}`], (oldData: TemplateData | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          fields: oldData.fields.filter(field => field.id !== fieldId)
        };
      });
      setSelectedField(null);
    },
    onError: (error) => {
      console.error("Failed to delete field:", error);
      toast({
        title: "Error",
        description: "Failed to delete field. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Save template mutation (this actually just shows a success message since changes are auto-saved)
  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      // In this system, template changes are automatically saved when made
      // This is just for user feedback
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Template saved",
        description: "All changes have been saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFieldDrop = (
    fieldType: string,
    x: number,
    y: number,
    pageNumber: number
  ) => {
    // Check if we have roles
    if (!roles || roles.length === 0) {
      toast({
        title: "No roles",
        description: "Please add a role before placing template fields",
        variant: "destructive",
      });
      return;
    }

    const fieldDimensions = {
      signature: { width: 200, height: 50 },
      initials: { width: 80, height: 40 },
      date: { width: 120, height: 30 },
      text: { width: 150, height: 30 },
      checkbox: { width: 20, height: 20 },
      name: { width: 150, height: 30 },
      email: { width: 200, height: 30 },
    };

    const dimensions = fieldDimensions[fieldType as keyof typeof fieldDimensions] || { width: 100, height: 30 };

    // Use the selectedRole if it exists
    const validRole = roles.find(r => r.id === selectedRole) || roles[0];

    const newField = {
      templateId: parseInt(id!),
      recipientRole: `${validRole?.role || "signer"}_${validRole?.id || 1}`, // Include ID to differentiate between same roles
      type: fieldType,
      label: fieldType.charAt(0).toUpperCase() + fieldType.slice(1),
      pageNumber,
      x: Math.round(x),
      y: Math.round(y),
      width: dimensions.width,
      height: dimensions.height,
      required: true,
    };

    // Add field using mutation
    addFieldMutation.mutate(newField);
  };

  const handleFieldSelect = (field: TemplateField) => {
    setSelectedField(field);
  };

  // Wrapper for DocumentViewer that handles SignatureField format
  const handleDocumentFieldSelect = (field: SignatureField) => {
    // Find the corresponding template field
    const templateField = data?.fields?.find(f => f.id === field.id);
    if (templateField) {
      setSelectedField(templateField);
    }
  };

  const debouncedFieldUpdate = useCallback((fieldId: number, updates: Partial<TemplateField>) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      updateFieldMutation.mutate({ fieldId, updates });
    }, 150); // 150ms for snappy response
  }, [updateFieldMutation]);

  const handleFieldMove = (fieldId: number, x: number, y: number) => {
    // Immediately update the cache for instant UI response
    queryClient.setQueryData([`/api/templates/${id}`], (oldData: TemplateData | undefined) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        fields: oldData.fields.map(field => 
          field.id === fieldId ? { ...field, x: Math.round(x), y: Math.round(y) } : field
        )
      };
    });
    
    // Then persist to backend with debouncing
    debouncedFieldUpdate(fieldId, { x: Math.round(x), y: Math.round(y) });
  };

  const handleFieldResize = (fieldId: number, width: number, height: number) => {
    // Calculate font size based on field height (minimum 12px, maximum 28px) - bigger default sizes
    const fontSize = Math.max(12, Math.min(28, Math.round(height * 0.5)));
    
    // Immediately update the cache for instant UI response
    queryClient.setQueryData([`/api/templates/${id}`], (oldData: TemplateData | undefined) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        fields: oldData.fields.map(field => 
          field.id === fieldId ? { 
            ...field, 
            width: Math.round(width), 
            height: Math.round(height),
            fontSize: fontSize
          } : field
        )
      };
    });
    
    // Then persist to backend with debouncing
    debouncedFieldUpdate(fieldId, { 
      width: Math.round(width), 
      height: Math.round(height),
      fontSize: fontSize
    });
  };

  const handleFieldDelete = (fieldId: number) => {
    deleteFieldMutation.mutate(fieldId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading template...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load template</p>
          <Link href="/templates">
            <Button variant="outline">Back to Templates</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/templates">
              <Button variant="ghost" size="sm" className="mr-3">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{data.template.title}</h1>
              <p className="text-sm text-slate-500">Template Editor</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowManageRoles(true)}
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Roles
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => saveTemplateMutation.mutate()}
              disabled={saveTemplateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveTemplateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-slate-200 overflow-y-auto flex flex-col">
          {/* Recipients Section */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-700">Recipients</h3>
            </div>
            
            <div className="space-y-2 mb-3">
              {roles.map((role, index) => {
                const color = getRecipientColorById(role.id);
                const isSelected = selectedRole === role.id;
                
                return (
                  <div 
                    key={role.id} 
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                      isSelected 
                        ? `border-[${color.border}]` 
                        : 'border-transparent hover:bg-slate-100'
                    }`}
                    style={{
                      backgroundColor: isSelected ? color.background : '#f8fafc'
                    }}
                    onClick={() => setSelectedRole(role.id)}
                  >
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: color.primary }}
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-900">{role.name}</div>
                        <div className="text-xs text-slate-500">{role.placeholderEmail}</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent recipient selection when clicking delete
                        removeTemplateRecipient(role.id);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={deleteRecipientMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            
            <AddTemplateRecipientDialog 
              onAddRecipient={addTemplateRecipient}
              existingRecipients={roles}
            />
          </div>

          {/* Field Types */}
          <div className="flex-1">
            <FieldToolbox 
              recipients={roles.map((role, index) => ({
                id: role.id,
                email: role.placeholderEmail || `${role.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
                fullName: role.name,
                title: null,
                role: role.role,
                signingOrder: role.signingOrder,
                status: "pending",
                documentId: parseInt(id!),
                signedAt: null,
                accessToken: ""
              }))}
              selectedRecipient={selectedRole}
              onRecipientSelect={setSelectedRole}
              hideRecipients={true}
            />
          </div>
        </div>

        {/* Document Viewer */}
        <DocumentViewer
          document={{
            id: data.template.id,
            title: data.template.title,
            originalFileName: data.template.originalFileName,
            fileType: data.template.fileType,
            fileContent: data.template.fileContent,
            fileStorageUrl: data.template.fileStorageUrl,
            pageCount: data.template.pageCount || 1,
            imageUrls: data.template.imageUrls || [],
            createdAt: data.template.createdAt,
            createdById: data.template.createdById,
            templateId: null,
            status: "draft",
            completedAt: null
          }}
          fields={(data.fields || []).map(field => {
            // Extract recipient ID from recipientRole (format: "role_id")
            const roleMatch = field.recipientRole.match(/^(.+)_(\d+)$/);
            const recipientId = roleMatch ? parseInt(roleMatch[2]) : 
              // Fallback: find first recipient with matching role
              roles.find(role => role.role === field.recipientRole)?.id || 1;
            
            return {
              id: field.id,
              type: field.type,
              label: field.label,
              pageNumber: field.pageNumber,
              x: field.x,
              y: field.y,
              width: field.width,
              height: field.height,
              fontSize: null,
              required: field.required,
              value: null,
              documentId: field.templateId,
              recipientId: recipientId
            };
          })}
          recipients={roles.map((role, index) => ({
            id: role.id,
            email: `${role.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
            fullName: role.name,
            title: null,
            role: role.role,
            signingOrder: role.signingOrder,
            status: "pending",
            documentId: parseInt(id!),
            signedAt: null,
            accessToken: ""
          }))}
          onFieldDrop={handleFieldDrop}
          onFieldSelect={handleDocumentFieldSelect}
          onFieldMove={handleFieldMove}
          onFieldResize={handleFieldResize}
          onFieldDelete={handleFieldDelete}
          selectedField={selectedField ? {
            id: selectedField.id,
            type: selectedField.type,
            label: selectedField.label,
            pageNumber: selectedField.pageNumber,
            x: selectedField.x,
            y: selectedField.y,
            width: selectedField.width,
            height: selectedField.height,
            fontSize: null,
            required: selectedField.required,
            value: null,
            documentId: selectedField.templateId,
            recipientId: (() => {
              const roleMatch = selectedField.recipientRole.match(/^(.+)_(\d+)$/);
              return roleMatch ? parseInt(roleMatch[2]) : 
                roles.find(role => role.role === selectedField.recipientRole)?.id || 1;
            })()
          } : null}
          isTemplate={true}
        />
      </div>
      
      {/* Manage Roles Dialog */}
      <ManageRolesDialog
        isOpen={showManageRoles}
        onOpenChange={setShowManageRoles}
        roles={roles}
        onAddRole={addTemplateRecipient}
        onUpdateRole={updateTemplateRole}
        onDeleteRole={removeTemplateRecipient}
        templateId={parseInt(id!)}
      />
    </div>
  );
}