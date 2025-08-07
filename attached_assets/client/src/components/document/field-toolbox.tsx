import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RECIPIENT_COLORS, getRecipientColor, getRecipientColorById } from "@/lib/types";
import { 
  Plus, 
  PenTool, 
  Type, 
  Calendar, 
  Edit, 
  CheckSquare, 
  User, 
  Mail,
  MoreVertical,
  Trash2
} from "lucide-react";
import type { Recipient } from "@shared/schema";

interface FieldToolboxProps {
  recipients: Recipient[];
  selectedRecipient: number;
  onRecipientSelect: (recipientId: number) => void;
  documentId?: number;
  hideRecipients?: boolean;
}

const fieldTypes = [
  { type: "signature", icon: PenTool, label: "Signature", description: "Electronic signature field" },
  { type: "initials", icon: Type, label: "Initials", description: "Initials field" },
  { type: "date", icon: Calendar, label: "Date", description: "Date stamp field" },
  { type: "text", icon: Edit, label: "Text", description: "Text input field" },
  { type: "checkbox", icon: CheckSquare, label: "Checkbox", description: "Checkbox field" },
  { type: "name", icon: User, label: "Full Name", description: "Full name field" },
  { type: "email", icon: Mail, label: "Email", description: "Email address field" },
];

export function FieldToolbox({ recipients, selectedRecipient, onRecipientSelect, documentId, hideRecipients = false }: FieldToolboxProps) {
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [newRecipient, setNewRecipient] = useState({
    fullName: "",
    email: "",
    role: "signer",
    signingOrder: (recipients?.length || 0) + 1,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addRecipientMutation = useMutation({
    mutationFn: async (recipient: typeof newRecipient) => {
      const response = await apiRequest(`/api/documents/${documentId}/recipients`, "POST", recipient);
      return response.json();
    },
    onSuccess: (newRecipientData: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}`] });
      setShowAddRecipient(false);
      setNewRecipient({
        fullName: "",
        email: "",
        role: "signer",
        signingOrder: (recipients?.length || 0) + 2,
      });
      
      // Automatically select the newly created recipient
      if (newRecipientData?.id) {
        onRecipientSelect(newRecipientData.id);
      }
      
      toast({
        title: "Recipient added",
        description: "The recipient has been added successfully. You can now add fields for this recipient.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add recipient",
        variant: "destructive",
      });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: async (data: { recipientId: number; updates: Partial<Recipient> }) => {
      const response = await apiRequest(`/api/recipients/${data.recipientId}`, "PATCH", data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}`] });
      setEditingRecipient(null);
      toast({
        title: "Recipient updated",
        description: "Recipient details have been updated successfully",
      });
    },
    onError: (error) => {
      console.error("Update recipient error:", error);
      toast({
        title: "Error",
        description: "Failed to update recipient. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: async (recipientId: number) => {
      const response = await apiRequest(`/api/recipients/${recipientId}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}`] });
      toast({
        title: "Recipient removed",
        description: "Recipient has been removed successfully",
      });
    },
    onError: (error) => {
      console.error("Delete recipient error:", error);
      toast({
        title: "Error",
        description: "Failed to remove recipient. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (e: React.DragEvent, fieldType: string) => {
    e.dataTransfer.setData("text/plain", fieldType);
    e.dataTransfer.effectAllowed = "copy";
  };

  const getRecipientColor = (recipientId: number) => {
    return RECIPIENT_COLORS[recipientId] || RECIPIENT_COLORS[1];
  };

  const handleAddRecipient = () => {
    if (!newRecipient.fullName || !newRecipient.email) {
      toast({
        title: "Missing information",
        description: "Please fill in both name and email",
        variant: "destructive",
      });
      return;
    }

    addRecipientMutation.mutate(newRecipient);
  };

  const handleEditRecipient = (recipient: Recipient) => {
    setEditingRecipient({
      ...recipient,
      fullName: recipient.fullName,
      email: recipient.email,
      role: recipient.role
    });
  };

  const handleUpdateRecipient = () => {
    if (!editingRecipient) return;
    
    updateRecipientMutation.mutate({
      recipientId: editingRecipient.id,
      updates: {
        fullName: editingRecipient.fullName,
        email: editingRecipient.email,
        role: editingRecipient.role
      }
    });
  };

  const handleDeleteRecipient = (recipientId: number) => {
    if (recipients.length <= 1) {
      toast({
        title: "Cannot delete",
        description: "Document must have at least one recipient",
        variant: "destructive",
      });
      return;
    }
    deleteRecipientMutation.mutate(recipientId);
  };

  return (
    <div className="w-72 bg-white flex flex-col">
      
      {/* Recipients Section - Only show if not hidden */}
      {!hideRecipients && (
        <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Recipients</h3>
          <Dialog open={showAddRecipient} onOpenChange={setShowAddRecipient}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Recipient</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={newRecipient.fullName}
                    onChange={(e) => setNewRecipient(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newRecipient.email}
                    onChange={(e) => setNewRecipient(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={newRecipient.role} 
                    onValueChange={(value) => setNewRecipient(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="signer">Signer</SelectItem>
                      <SelectItem value="reviewer">Reviewer</SelectItem>
                      <SelectItem value="cc">CC Recipient</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowAddRecipient(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddRecipient}
                    disabled={addRecipientMutation.isPending}
                  >
                    {addRecipientMutation.isPending ? "Adding..." : "Add Recipient"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="space-y-2">
          {recipients.map((recipient, recipientIndex) => {
            const color = getRecipientColor(recipientIndex);
            return (
              <div
                key={recipient.id}
                className="flex items-center p-3 border rounded-lg cursor-pointer transition-colors"
                style={{
                  backgroundColor: selectedRecipient === recipient.id ? color.background : '#f8fafc',
                  borderColor: selectedRecipient === recipient.id ? color.border : '#e2e8f0'
                }}
                onClick={() => onRecipientSelect(recipient.id)}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: color.primary }}
                >
                  {recipient.signingOrder}
                </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-slate-900">{recipient.fullName}</p>
                <p className="text-xs text-slate-500">{recipient.email}</p>
                <Badge variant="secondary" className="text-xs mt-1">
                  {recipient.role}
                  {recipient.id === 1 && " (Me)"}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEditRecipient(recipient)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Details
                  </DropdownMenuItem>
                  {recipients.length > 1 && (
                    <DropdownMenuItem 
                      onClick={() => handleDeleteRecipient(recipient.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            );
          })}
        </div>
        
        {/* Edit Recipient Dialog */}
        <Dialog open={!!editingRecipient} onOpenChange={() => setEditingRecipient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Recipient</DialogTitle>
            </DialogHeader>
            {editingRecipient && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editFullName">Full Name</Label>
                  <Input
                    id="editFullName"
                    value={editingRecipient.fullName}
                    onChange={(e) => setEditingRecipient(prev => prev ? ({ ...prev, fullName: e.target.value }) : null)}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="editEmail">Email</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editingRecipient.email}
                    onChange={(e) => setEditingRecipient(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="editRole">Role</Label>
                  <Select 
                    value={editingRecipient.role} 
                    onValueChange={(value) => setEditingRecipient(prev => prev ? ({ ...prev, role: value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="signer">Signer</SelectItem>
                      <SelectItem value="reviewer">Reviewer</SelectItem>
                      <SelectItem value="cc">CC Recipient</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setEditingRecipient(null)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateRecipient}
                    disabled={updateRecipientMutation.isPending}
                  >
                    {updateRecipientMutation.isPending ? "Updating..." : "Update Recipient"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
      )}

      {/* Field Types Section */}
      <div className="flex-1 p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Field Types</h3>
        
        <div className="space-y-2">
          {fieldTypes.map((fieldType) => {
            const Icon = fieldType.icon;
            const selectedRecipientData = recipients.find(r => r.id === selectedRecipient);
            // Use direct ID-based color mapping for consistency
            const color = getRecipientColorById(selectedRecipient);
            
            return (
              <div
                key={fieldType.type}
                className="field-item p-3 border rounded-lg cursor-grab transition-colors"
                style={{
                  borderColor: color.border,
                  backgroundColor: 'white'
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, fieldType.type)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = color.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <div className="flex items-center">
                  <Icon 
                    className="w-5 h-5" 
                    style={{ color: color.primary }}
                  />
                  <span className="ml-3 text-sm font-medium text-slate-900">{fieldType.label}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{fieldType.description}</p>
                {selectedRecipientData && (
                  <div className="flex items-center mt-2">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: color.primary }}
                    />
                    <span className="text-xs" style={{ color: color.text }}>
                      {selectedRecipientData.fullName}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
