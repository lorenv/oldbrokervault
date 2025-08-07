import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface TemplateRecipient {
  id: number;
  name: string;
  title: string;
  role: string;
  signingOrder: number;
  placeholderEmail: string;
}

interface AddTemplateRecipientDialogProps {
  onAddRecipient: (recipient: Omit<TemplateRecipient, 'id'>) => void;
  existingRecipients: TemplateRecipient[];
}

export function AddTemplateRecipientDialog({ onAddRecipient, existingRecipients }: AddTemplateRecipientDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    role: "signer",
    placeholderEmail: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newRecipient = {
      ...formData,
      signingOrder: existingRecipients.length + 1,
    };

    onAddRecipient(newRecipient);
    setFormData({
      name: "",
      title: "",
      role: "signer",
      placeholderEmail: ""
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Recipient Role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Template Recipient Role</DialogTitle>
          <DialogDescription>
            Create a placeholder recipient role for this template. When using the template, you'll specify actual recipient details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Role Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Client, Witness, Manager"
              required
            />
          </div>
          

          
          <div>
            <Label htmlFor="placeholderEmail">Placeholder Email (Optional)</Label>
            <Input
              id="placeholderEmail"
              type="email"
              value={formData.placeholderEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, placeholderEmail: e.target.value }))}
              placeholder="e.g., client@example.com"
            />
          </div>
          
          <div>
            <Label htmlFor="role">Role Type</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
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
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Role</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}