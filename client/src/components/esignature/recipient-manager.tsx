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
      <CardContent className="space-y-6">
        {/* Add New Recipient */}
        <div className="p-6 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/50">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">Add Recipient</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-name" className="text-sm font-medium mb-2 block">Name</Label>
                <Input
                  id="new-name"
                  placeholder="Enter full name"
                  value={newRecipient.name || ''}
                  onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                  className="h-12 text-base"
                />
              </div>
              
              <div>
                <Label htmlFor="new-email" className="text-sm font-medium mb-2 block">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="Enter email address"
                  value={newRecipient.email || ''}
                  onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                  className="h-12 text-base"
                />
              </div>
              
              <div>
                <Label htmlFor="new-role" className="text-sm font-medium mb-2 block">Role</Label>
                <Select 
                  value={newRecipient.role || 'signer'} 
                  onValueChange={(value: any) => setNewRecipient({ ...newRecipient, role: value })}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECIPIENT_ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-3 py-1">
                          <role.icon className="w-5 h-5" />
                          <div>
                            <div className="font-medium">{role.label}</div>
                            <div className="text-xs text-gray-600">{role.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={addRecipient}
                disabled={!newRecipient.name || !newRecipient.email}
                className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Recipient
              </Button>
            </div>
          </div>
        </div>

        {/* Existing Recipients */}
        {recipients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No recipients added yet</p>
            <p className="text-sm">Add recipients who need to sign or receive this document</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recipients.map((recipient, index) => {
              const role = RECIPIENT_ROLES.find(r => r.value === recipient.role);
              const RoleIcon = role?.icon || UserCheck;
              
              return (
                <div key={recipient.id || index} className="p-6 border-2 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    {/* Color indicator and number */}
                    <div className="flex-shrink-0">
                      <div 
                        className={`w-12 h-12 rounded-full ${getRecipientColor(index)} flex items-center justify-center text-white font-bold text-lg`}
                      >
                        {index + 1}
                      </div>
                    </div>
                    
                    {/* Recipient info */}
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Name</Label>
                          <Input
                            value={recipient.name}
                            onChange={(e) => updateRecipient(index, { name: e.target.value })}
                            className="h-11 text-base"
                            placeholder="Enter name"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Email</Label>
                          <Input
                            value={recipient.email}
                            onChange={(e) => updateRecipient(index, { email: e.target.value })}
                            placeholder="Enter email address"
                            type="email"
                            className="h-11 text-base"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Role</Label>
                        <Select 
                          value={recipient.role} 
                          onValueChange={(value: any) => updateRecipient(index, { role: value })}
                        >
                          <SelectTrigger className="h-11 text-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECIPIENT_ROLES.map(role => (
                              <SelectItem key={role.value} value={role.value}>
                                <div className="flex items-center gap-3 py-1">
                                  <role.icon className="w-5 h-5" />
                                  <div>
                                    <div className="font-medium">{role.label}</div>
                                    <div className="text-xs text-gray-600">{role.description}</div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Role badge and status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={role?.color}>
                            <RoleIcon className="w-4 h-4 mr-2" />
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
                    </div>
                  </div>
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