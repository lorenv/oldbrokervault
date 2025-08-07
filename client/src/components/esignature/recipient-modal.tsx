import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NdaRecipient } from '@shared/schema';
import { X } from 'lucide-react';

interface RecipientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipient: Partial<NdaRecipient>) => void;
  recipient?: Partial<NdaRecipient> | null;
  isEdit?: boolean;
}

export default function RecipientModal({
  isOpen,
  onClose,
  onSave,
  recipient,
  isEdit = false
}: RecipientModalProps) {
  const [formData, setFormData] = useState<Partial<NdaRecipient>>({
    name: '',
    email: '',
    role: 'signer'
  });

  useEffect(() => {
    if (recipient) {
      setFormData(recipient);
    } else {
      setFormData({
        name: '',
        email: '',
        role: 'signer'
      });
    }
  }, [recipient, isOpen]);

  const handleSave = () => {
    if (!formData.name?.trim() || !formData.email?.trim()) {
      return; // Don't save if required fields are empty
    }

    onSave({
      ...formData,
      id: recipient?.id || Date.now(),
      status: 'pending',
      accessToken: '',
      signedAt: null,
      ipAddress: null,
      userAgent: null,
      location: null
    });
    onClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      role: 'signer'
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEdit ? 'Edit Recipient' : 'Add Recipient'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update recipient information and role' : 'Add a new recipient to the signing workflow'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Enter full name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="border-2 border-purple-300 focus:border-purple-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role || 'signer'}
              onValueChange={(value) => setFormData({ ...formData, role: value as 'signer' | 'viewer' | 'approver' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="signer">Signer</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formData.name?.trim() || !formData.email?.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isEdit ? 'Update' : 'Add'} Recipient
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}