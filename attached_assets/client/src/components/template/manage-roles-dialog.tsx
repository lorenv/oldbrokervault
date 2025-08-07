import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getRecipientColorById } from "@/lib/types";
import { Plus, MoreVertical, Edit, Trash2 } from "lucide-react";
import type { TemplateRecipient } from "@shared/schema";

interface ManageRolesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  roles: TemplateRecipient[];
  onAddRole: (role: Omit<TemplateRecipient, 'id'>) => void;
  onUpdateRole: (roleId: number, updates: Partial<TemplateRecipient>) => void;
  onDeleteRole: (roleId: number) => void;
  templateId: number;
}

export function ManageRolesDialog({ 
  isOpen, 
  onOpenChange, 
  roles, 
  onAddRole, 
  onUpdateRole, 
  onDeleteRole,
  templateId
}: ManageRolesDialogProps) {
  const [showAddRole, setShowAddRole] = useState(false);
  const [editingRole, setEditingRole] = useState<TemplateRecipient | null>(null);
  const [newRole, setNewRole] = useState({
    name: "",
    title: "",
    role: "signer",
    placeholderEmail: ""
  });

  const handleSubmitNewRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.name.trim()) return;

    onAddRole({
      ...newRole,
      templateId: templateId,
      signingOrder: roles.length + 1,
    });
    
    setNewRole({
      name: "",
      title: "",
      role: "signer",
      placeholderEmail: ""
    });
    setShowAddRole(false);
  };

  const handleUpdateRole = () => {
    if (!editingRole) return;
    
    onUpdateRole(editingRole.id, {
      name: editingRole.name,
      title: editingRole.title,
      role: editingRole.role,
      placeholderEmail: editingRole.placeholderEmail
    });
    
    setEditingRole(null);
  };

  const handleEditRole = (role: TemplateRecipient) => {
    setEditingRole({ ...role });
  };

  const handleDeleteRole = (roleId: number) => {
    if (roles.length <= 1) return; // Prevent deleting last role
    onDeleteRole(roleId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Template Roles</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Role List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {roles.map((role) => {
              const color = getRecipientColorById(role.id);
              
              return (
                <div
                  key={role.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  style={{
                    backgroundColor: color.background,
                    borderColor: color.border
                  }}
                >
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: color.primary }}
                    />
                    <div>
                      <div className="font-medium text-slate-900">{role.name}</div>
                      {role.title && (
                        <div className="text-sm text-slate-600">{role.title}</div>
                      )}
                      <div className="text-xs text-slate-500">
                        {role.placeholderEmail || "No placeholder email"}
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {role.role}
                      </Badge>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditRole(role)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Role
                      </DropdownMenuItem>
                      {roles.length > 1 && (
                        <DropdownMenuItem 
                          onClick={() => handleDeleteRole(role.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Role
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>

          {/* Add New Role */}
          {!showAddRole ? (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowAddRole(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Role
            </Button>
          ) : (
            <form onSubmit={handleSubmitNewRole} className="space-y-3 p-3 border rounded-lg bg-slate-50">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="roleName">Role Name *</Label>
                  <Input
                    id="roleName"
                    value={newRole.name}
                    onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Client, Witness"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="roleTitle">Title (Optional)</Label>
                  <Input
                    id="roleTitle"
                    value={newRole.title}
                    onChange={(e) => setNewRole(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Property Manager"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="roleType">Role Type</Label>
                  <Select value={newRole.role} onValueChange={(value) => setNewRole(prev => ({ ...prev, role: value }))}>
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
                <div>
                  <Label htmlFor="placeholderEmail">Placeholder Email</Label>
                  <Input
                    id="placeholderEmail"
                    type="email"
                    value={newRole.placeholderEmail}
                    onChange={(e) => setNewRole(prev => ({ ...prev, placeholderEmail: e.target.value }))}
                    placeholder="client@example.com"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddRole(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Add Role
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Edit Role Dialog */}
        {editingRole && (
          <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Role</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="editRoleName">Role Name</Label>
                    <Input
                      id="editRoleName"
                      value={editingRole.name}
                      onChange={(e) => setEditingRole(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                      placeholder="e.g., Client, Witness"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editRoleTitle">Title</Label>
                    <Input
                      id="editRoleTitle"
                      value={editingRole.title || ""}
                      onChange={(e) => setEditingRole(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                      placeholder="e.g., Property Manager"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="editRoleType">Role Type</Label>
                    <Select 
                      value={editingRole.role} 
                      onValueChange={(value) => setEditingRole(prev => prev ? ({ ...prev, role: value }) : null)}
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
                  <div>
                    <Label htmlFor="editPlaceholderEmail">Placeholder Email</Label>
                    <Input
                      id="editPlaceholderEmail"
                      type="email"
                      value={editingRole.placeholderEmail || ""}
                      onChange={(e) => setEditingRole(prev => prev ? ({ ...prev, placeholderEmail: e.target.value }) : null)}
                      placeholder="client@example.com"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setEditingRole(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateRole}>
                    Update Role
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}