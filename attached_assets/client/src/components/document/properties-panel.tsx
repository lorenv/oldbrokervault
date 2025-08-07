import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MousePointer, Trash2 } from "lucide-react";
import type { SignatureField, Recipient } from "@shared/schema";

interface PropertiesPanelProps {
  selectedField: SignatureField | null;
  recipients: Recipient[];
  onFieldDelete: (fieldId: number) => void;
  onFieldUpdate: (field: SignatureField) => void;
}

export function PropertiesPanel({
  selectedField,
  recipients,
  onFieldDelete,
  onFieldUpdate
}: PropertiesPanelProps) {
  const [fieldData, setFieldData] = useState<Partial<SignatureField>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (selectedField) {
      setFieldData(selectedField);
    } else {
      setFieldData({});
    }
  }, [selectedField]);

  const updateFieldMutation = useMutation({
    mutationFn: async (updates: Partial<SignatureField>) => {
      return apiRequest("PATCH", `/api/fields/${selectedField!.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      onFieldUpdate(selectedField!);
      toast({
        title: "Field updated",
        description: "The field properties have been saved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update field properties",
        variant: "destructive",
      });
    },
  });

  const handleFieldUpdate = (key: keyof SignatureField, value: any) => {
    const updatedData = { ...fieldData, [key]: value };
    setFieldData(updatedData);
    
    // Auto-save after a short delay
    setTimeout(() => {
      if (selectedField) {
        updateFieldMutation.mutate({ [key]: value });
      }
    }, 500);
  };

  const handleDelete = () => {
    if (selectedField) {
      onFieldDelete(selectedField.id);
    }
  };

  if (!selectedField) {
    return (
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Field Properties</h3>
        </div>
        
        <div className="flex-1 p-4">
          <div className="text-center py-8 text-slate-500">
            <MousePointer className="h-12 w-12 mx-auto mb-3 text-slate-400" />
            <p className="text-sm">Select a field to edit its properties</p>
          </div>
        </div>
      </div>
    );
  }

  const getRecipientName = (recipientId: number) => {
    const recipient = recipients.find(r => r.id === recipientId);
    return recipient ? recipient.fullName : `Recipient ${recipientId}`;
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Field Properties</h3>
        <p className="text-sm text-slate-500 mt-1">
          {selectedField.type.charAt(0).toUpperCase() + selectedField.type.slice(1)} Field
        </p>
      </div>
      
      <div className="flex-1 p-4 space-y-4">
        {/* Field Label */}
        <div>
          <Label htmlFor="fieldLabel">Field Label</Label>
          <Input
            id="fieldLabel"
            value={fieldData.label || ""}
            onChange={(e) => handleFieldUpdate("label", e.target.value)}
            placeholder="Enter field label"
          />
        </div>

        {/* Assigned Recipient */}
        <div>
          <Label htmlFor="recipient">Assigned to</Label>
          <Select 
            value={fieldData.recipientId?.toString()} 
            onValueChange={(value) => handleFieldUpdate("recipientId", parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select recipient" />
            </SelectTrigger>
            <SelectContent>
              {recipients.map((recipient) => (
                <SelectItem key={recipient.id} value={recipient.id.toString()}>
                  {recipient.fullName}
                  {recipient.id === 1 && " (Me)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>



        {/* Page Number */}
        <div>
          <Label htmlFor="pageNumber">Page Number</Label>
          <Input
            id="pageNumber"
            type="number"
            value={fieldData.pageNumber || 1}
            onChange={(e) => handleFieldUpdate("pageNumber", parseInt(e.target.value))}
            min={1}
          />
        </div>

        {/* Required Field */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="required"
            checked={fieldData.required || false}
            onCheckedChange={(checked) => handleFieldUpdate("required", checked)}
          />
          <Label htmlFor="required" className="text-sm">
            Required field
          </Label>
        </div>

        {/* Field Value (if filled) */}
        {fieldData.value && (
          <div>
            <Label htmlFor="fieldValue">Current Value</Label>
            <Input
              id="fieldValue"
              value={fieldData.value}
              readOnly
              className="bg-slate-50"
            />
          </div>
        )}

        {/* Delete Button */}
        <div className="pt-4 border-t border-slate-200">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Field
          </Button>
        </div>
      </div>
    </div>
  );
}
