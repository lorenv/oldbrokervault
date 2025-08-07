import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Users, Mail, UserCheck, Eye } from 'lucide-react';
import { NdaRecipient, InsertNdaRecipient } from '@shared/schema';

interface RecipientManagerProps {
  recipients: NdaRecipient[];
  onRecipientsChange: (recipients: Partial<NdaRecipient>[]) => void;
  className?: string;
}

const RECIPIENT_ROLES = [
  { value: 'signer', label: 'Signer', icon: UserCheck, description: 'Required to sign the document', color: 'bg-blue-100 text-blue-800' },
  { value: 'cc', label: 'CC', icon: Eye, description: 'Receives copy when completed', color: 'bg-gray-100 text-gray-800' },
  { value: 'approver', label: 'Approver', icon: UserCheck, description: 'Must approve before completion', color: 'bg-green-100 text-green-800' }
] as const;

const RECIPIENT_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'
];

export default function RecipientManager({ recipients, onRecipientsChange, className = '' }: RecipientManagerProps) {
  const [newRecipient, setNewRecipient] = useState<Partial<InsertNdaRecipient>>({
    name: '',
    email: '',
    role: 'signer'
  });

  const addRecipient = () => {
    if (!newRecipient.name || !newRecipient.email) return;

    const recipient: Partial<NdaRecipient> = {
      ...newRecipient,
      id: Date.now(), // Temporary ID for frontend
      status: 'pending',
      signingSessionId: 0 // Will be set when session is created
    };

    onRecipientsChange([...recipients, recipient]);
    setNewRecipient({ name: '', email: '', role: 'signer' });
  };

  const removeRecipient = (index: number) => {
    const updated = recipients.filter((_, i) => i !== index);
    onRecipientsChange(updated);
  };

  const updateRecipient = (index: number, updates: Partial<NdaRecipient>) => {
    const updated = recipients.map((recipient, i) => 
      i === index ? { ...recipient, ...updates } : recipient
    );
    onRecipientsChange(updated);
  };

  const getRecipientColor = (index: number) => {
    return RECIPIENT_COLORS[index % RECIPIENT_COLORS.length];
  };

  const getSignersCount = () => recipients.filter(r => r.role === 'signer').length;
  const getCCCount = () => recipients.filter(r => r.role === 'cc').length;
  const getApproversCount = () => recipients.filter(r => r.role === 'approver').length;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Recipients ({recipients.length})
          <div className="flex gap-2 ml-auto text-sm">
            {getSignersCount() > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {getSignersCount()} Signers
              </Badge>
            )}
            {getCCCount() > 0 && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                {getCCCount()} CC
              </Badge>
            )}
            {getApproversCount() > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {getApproversCount()} Approvers
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Recipient */}
        <div className="p-4 border rounded-lg bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                placeholder="Full name"
                value={newRecipient.name || ''}
                onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="email@example.com"
                value={newRecipient.email || ''}
                onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="new-role">Role</Label>
              <Select 
                value={newRecipient.role || 'signer'} 
                onValueChange={(value: any) => setNewRecipient({ ...newRecipient, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECIPIENT_ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <role.icon className="w-4 h-4" />
                        {role.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={addRecipient}
                disabled={!newRecipient.name || !newRecipient.email}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Existing Recipients */}
        {recipients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No recipients added yet</p>
            <p className="text-sm">Add recipients who need to sign or receive this document</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recipients.map((recipient, index) => {
              const role = RECIPIENT_ROLES.find(r => r.value === recipient.role);
              const RoleIcon = role?.icon || UserCheck;
              
              return (
                <div key={recipient.id || index} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                  {/* Color indicator */}
                  <div 
                    className={`w-4 h-4 rounded-full ${getRecipientColor(index)}`}
                    title={`Recipient ${index + 1}`}
                  />
                  
                  {/* Recipient info */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      value={recipient.name}
                      onChange={(e) => updateRecipient(index, { name: e.target.value })}
                      placeholder="Full name"
                    />
                    <Input
                      value={recipient.email}
                      onChange={(e) => updateRecipient(index, { email: e.target.value })}
                      placeholder="email@example.com"
                      type="email"
                    />
                    <Select 
                      value={recipient.role} 
                      onValueChange={(value: any) => updateRecipient(index, { role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECIPIENT_ROLES.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            <div className="flex items-center gap-2">
                              <role.icon className="w-4 h-4" />
                              {role.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Role badge and status */}
                  <div className="flex items-center gap-2">
                    <Badge className={role?.color}>
                      <RoleIcon className="w-3 h-3 mr-1" />
                      {role?.label}
                    </Badge>
                    
                    {recipient.status && recipient.status !== 'pending' && (
                      <Badge variant="outline">
                        {recipient.status}
                      </Badge>
                    )}
                  </div>

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRecipient(index)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Info section */}
        {recipients.length > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">Signing Process:</div>
              <ul className="space-y-1 text-blue-700">
                <li>• All signers will receive the document simultaneously (parallel signing)</li>
                <li>• CC recipients will receive a copy once all signatures are complete</li>
                <li>• Approvers must approve before the document is finalized</li>
                <li>• Each recipient gets a unique secure link to access the document</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}