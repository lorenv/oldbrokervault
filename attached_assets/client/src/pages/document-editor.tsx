import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { DocumentViewer } from "@/components/document/document-viewer";
import { FieldToolbox } from "@/components/document/field-toolbox";
import { PropertiesPanel } from "@/components/document/properties-panel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Document, Recipient, SignatureField } from "@shared/schema";

interface DocumentData {
  document: Document;
  recipients: Recipient[];
  fields: SignatureField[];
}

export default function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedField, setSelectedField] = useState<SignatureField | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<number>(1);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tempFieldIdRef = useRef<number | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const { data, isLoading, error } = useQuery<DocumentData>({
    queryKey: [`/api/documents/${id}`],
    enabled: !!id,
  });



  const sendDocumentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/documents/${id}/send`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Document sent",
        description: "Signing invitations have been sent to all recipients",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send document for signing",
        variant: "destructive",
      });
    },
  });

  const addFieldMutation = useMutation({
    mutationFn: async (field: Omit<SignatureField, "id" | "value">) => {
      const response = await apiRequest(`/api/documents/${id}/fields`, "POST", field);
      return response.json();
    },
    onSuccess: (newField) => {
      // Simply add the new field from backend to cache
      queryClient.setQueryData([`/api/documents/${id}`], (oldData: DocumentData | undefined) => {
        if (!oldData) return oldData;
        
        // Check if field already exists to avoid duplicates
        const fieldExists = oldData.fields.some(field => field.id === newField.id);
        if (fieldExists) {
          return oldData;
        }
        
        return {
          ...oldData,
          fields: [...oldData.fields, newField]
        };
      });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: number) => {
      const response = await apiRequest(`/api/fields/${fieldId}`, "DELETE");
      return response.json();
    },
    onSuccess: (_, fieldId) => {
      // Optimistic update - remove field immediately from cache
      queryClient.setQueryData([`/api/documents/${id}`], (oldData: DocumentData | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          fields: oldData.fields.filter(field => field.id !== fieldId)
        };
      });
      setSelectedField(null);
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ fieldId, updates }: { fieldId: number; updates: Partial<SignatureField> }) => {
      const response = await apiRequest(`/api/fields/${fieldId}`, "PATCH", updates);
      return response.json();
    },
    onMutate: async ({ fieldId, updates }) => {
      // Optimistic update - update field immediately in cache
      queryClient.setQueryData([`/api/documents/${id}`], (oldData: DocumentData | undefined) => {
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
  });

  const handleFieldDrop = (
    fieldType: string,
    x: number,
    y: number,
    pageNumber: number
  ) => {
    // Check if we have recipients
    if (!data?.recipients || data.recipients.length === 0) {
      toast({
        title: "No recipients",
        description: "Please add a recipient before placing signature fields",
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

    // Use the first recipient if selectedRecipient doesn't exist
    const validRecipientId = data.recipients.find(r => r.id === selectedRecipient)?.id || data.recipients[0]?.id;

    const newField = {
      documentId: parseInt(id!),
      recipientId: validRecipientId,
      type: fieldType,
      label: fieldType.charAt(0).toUpperCase() + fieldType.slice(1),
      pageNumber,
      x: Math.round(x),
      y: Math.round(y),
      width: dimensions.width,
      height: dimensions.height,
      required: true,
    };

    // Just persist to backend - the onSuccess will handle adding to UI
    addFieldMutation.mutate(newField);
  };

  const handleFieldSelect = (field: SignatureField) => {
    setSelectedField(field);
  };

  const debouncedFieldUpdate = useCallback((fieldId: number, updates: Partial<SignatureField>) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      updateFieldMutation.mutate({ fieldId, updates });
    }, 150); // Reduced to 150ms for snappier response
  }, [updateFieldMutation]);

  const handleFieldMove = (fieldId: number, x: number, y: number) => {
    // Immediately update the cache for instant UI response
    queryClient.setQueryData([`/api/documents/${id}`], (oldData: DocumentData | undefined) => {
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
    // Calculate font size based on field height (minimum 8px, maximum 24px)
    const fontSize = Math.max(8, Math.min(24, Math.round(height * 0.6)));
    
    // Immediately update the cache for instant UI response
    queryClient.setQueryData([`/api/documents/${id}`], (oldData: DocumentData | undefined) => {
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
    // Immediately remove from UI
    queryClient.setQueryData([`/api/documents/${id}`], (oldData: DocumentData | undefined) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        fields: oldData.fields.filter(field => field.id !== fieldId)
      };
    });
    setSelectedField(null);
    
    // Then persist to backend
    deleteFieldMutation.mutate(fieldId);
  };

  const handleSendDocument = () => {
    if (!data?.recipients.length) {
      toast({
        title: "No recipients",
        description: "Please add at least one recipient before sending",
        variant: "destructive",
      });
      return;
    }

    if (!data?.fields.length) {
      toast({
        title: "No signature fields",
        description: "Please add at least one signature field before sending",
        variant: "destructive",
      });
      return;
    }

    sendDocumentMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load document</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-slate-900">Document Preparation</h1>
              {data?.document && (
                <div className="flex items-center space-x-2 text-sm text-slate-500">
                  <span>{data.document.title}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span>{data.document.pageCount} pages</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" className="text-slate-600 hover:text-slate-800">
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button 
                onClick={handleSendDocument}
                disabled={sendDocumentMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendDocumentMutation.isPending ? "Sending..." : "Send for Signature"}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <FieldToolbox 
            recipients={data?.recipients || []}
            selectedRecipient={selectedRecipient}
            onRecipientSelect={setSelectedRecipient}
            documentId={parseInt(id!)}
          />
          
          <DocumentViewer
            document={data.document}
            fields={data?.fields || []}
            recipients={data?.recipients || []}
            onFieldDrop={handleFieldDrop}
            onFieldSelect={handleFieldSelect}
            onFieldMove={handleFieldMove}
            onFieldResize={handleFieldResize}
            onFieldDelete={handleFieldDelete}
            selectedField={selectedField}
          />
          
          <PropertiesPanel
            selectedField={selectedField}
            recipients={data?.recipients || []}
            onFieldDelete={handleFieldDelete}
            onFieldUpdate={(field) => {
              queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
            }}
          />
        </div>
    </div>
  );
}
