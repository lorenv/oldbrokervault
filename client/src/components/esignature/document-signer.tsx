import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  FileText, 
  Signature, 
  User, 
  Mail, 
  Calendar,
  Type,
  CheckSquare,
  PenTool,
  Save,
  X,
  Eye,
  Clock
} from 'lucide-react';
import SignaturePad from 'signature_pad';

interface SigningField {
  id: string;
  type: 'signature' | 'name' | 'email' | 'date' | 'text' | 'checkbox' | 'initials';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  required: boolean;
  completed?: boolean;
  fieldValue?: string;
  recipientId?: number;
}

interface SigningRecipient {
  id: number;
  name: string;
  email: string;
  role: 'signer' | 'cc' | 'approver';
  status: 'pending' | 'sent' | 'viewed' | 'signed';
  accessToken?: string;
}

interface SigningSession {
  id: number;
  title: string;
  message?: string;
  status: 'draft' | 'active' | 'completed' | 'expired';
  templateId: number;
  shareSlug: string;
  createdAt: string;
  expiresAt?: string;
  recipients: SigningRecipient[];
  fieldAssignments: {
    id: number;
    fieldId: string;
    recipientId: number;
    required: boolean;
    completed: boolean;
    fieldValue?: string;
  }[];
  currentRecipient: SigningRecipient;
}

interface DocumentSignerProps {
  accessToken: string;
}

export function DocumentSigner({ accessToken }: DocumentSignerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [signaturePadVisible, setSignaturePadVisible] = useState(false);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Get signing session data
  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['/api/esignature/sign', accessToken],
    queryFn: async () => {
      const response = await fetch(`/api/esignature/sign/${accessToken}`);
      if (!response.ok) throw new Error('Failed to load signing session');
      return response.json() as Promise<SigningSession>;
    },
  });

  // Sign field mutation
  const signFieldMutation = useMutation({
    mutationFn: async (data: { fieldId: string; value: string }) => {
      const response = await fetch(`/api/esignature/sign/${accessToken}/fields/${data.fieldId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: data.value }),
      });
      if (!response.ok) throw new Error('Failed to sign field');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/esignature/sign', accessToken] });
      toast({
        title: 'Field signed successfully',
        description: 'Your signature has been recorded.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Signing failed',
        description: error.message || 'Failed to sign field',
        variant: 'destructive',
      });
    },
  });

  // Initialize signature pad when canvas is available
  useEffect(() => {
    if (canvasRef.current && signaturePadVisible) {
      signaturePadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
        minWidth: 1,
        maxWidth: 3,
      });
    }
    
    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
    };
  }, [signaturePadVisible]);

  const handleFieldClick = (field: SigningField) => {
    if (field.completed) return;
    
    setSelectedFieldId(field.id);
    
    if (field.type === 'signature' || field.type === 'initials') {
      setSignaturePadVisible(true);
    }
  };

  const handleSaveSignature = () => {
    if (!signaturePadRef.current || !selectedFieldId) return;
    
    if (signaturePadRef.current.isEmpty()) {
      toast({
        title: 'Signature required',
        description: 'Please provide your signature before saving.',
        variant: 'destructive',
      });
      return;
    }
    
    const signatureDataURL = signaturePadRef.current.toDataURL();
    signFieldMutation.mutate({ fieldId: selectedFieldId, value: signatureDataURL });
    
    setSignaturePadVisible(false);
    setSelectedFieldId(null);
  };

  const handleTextFieldSave = (fieldId: string, value: string) => {
    if (!value.trim()) {
      toast({
        title: 'Value required',
        description: 'Please enter a value for this field.',
        variant: 'destructive',
      });
      return;
    }
    
    signFieldMutation.mutate({ fieldId, value });
    setFieldValues(prev => ({ ...prev, [fieldId]: '' }));
  };

  const handleCheckboxChange = (fieldId: string, checked: boolean) => {
    signFieldMutation.mutate({ fieldId, value: checked.toString() });
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'signature': return <Signature className="w-4 h-4" />;
      case 'initials': return <PenTool className="w-4 h-4" />;
      case 'name': return <User className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'date': return <Calendar className="w-4 h-4" />;
      case 'text': return <Type className="w-4 h-4" />;
      case 'checkbox': return <CheckSquare className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
              <p className="text-gray-600">
                This document may have expired or the link is invalid.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = sessionData as SigningSession;
  const myFields = session.fieldAssignments.filter(
    fa => fa.recipientId === session.currentRecipient.id
  );
  const completedFields = myFields.filter(fa => fa.completed);
  const totalFields = myFields.length;
  const progress = totalFields > 0 ? (completedFields.length / totalFields) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{session.title}</CardTitle>
                <p className="text-gray-600 mt-1">
                  Hello {session.currentRecipient.name}, please review and sign this document.
                </p>
              </div>
              <Badge className={getStatusColor(session.status)}>
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </Badge>
            </div>
            
            {session.message && (
              <Alert className="mt-4">
                <AlertDescription>{session.message}</AlertDescription>
              </Alert>
            )}
          </CardHeader>
        </Card>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Signing Progress</span>
              <span className="text-sm text-gray-600">
                {completedFields.length} of {totalFields} fields completed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* Fields to Sign */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Fields to Sign
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {myFields.map((fieldAssignment) => {
                const field = {
                  id: fieldAssignment.fieldId,
                  type: 'signature', // This would be determined from field definition
                  label: `Field ${fieldAssignment.fieldId}`,
                  required: fieldAssignment.required,
                  completed: fieldAssignment.completed,
                  fieldValue: fieldAssignment.fieldValue,
                } as SigningField;

                return (
                  <div
                    key={field.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      field.completed 
                        ? 'bg-green-50 border-green-200' 
                        : selectedFieldId === field.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => !field.completed && handleFieldClick(field)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getFieldIcon(field.type)}
                        <div>
                          <p className="font-medium">{field.label}</p>
                          <p className="text-sm text-gray-600">
                            {field.type.charAt(0).toUpperCase() + field.type.slice(1)}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {field.completed ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckSquare className="w-3 h-3 mr-1" />
                            Signed
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {!field.completed && selectedFieldId === field.id && (
                      <div className="mt-4 pt-4 border-t">
                        {(field.type === 'signature' || field.type === 'initials') && (
                          <div className="space-y-4">
                            <Label>Draw your {field.type}:</Label>
                            <div className="border rounded-lg p-4 bg-white">
                              <canvas
                                ref={canvasRef}
                                width="400"
                                height="150"
                                className="border rounded w-full"
                                style={{ touchAction: 'none' }}
                              />
                              <div className="flex gap-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => signaturePadRef.current?.clear()}
                                >
                                  Clear
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleSaveSignature}
                                  disabled={signFieldMutation.isPending}
                                >
                                  <Save className="w-4 h-4 mr-1" />
                                  Save Signature
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {field.type === 'text' && (
                          <div className="space-y-2">
                            <Label>{field.label}</Label>
                            <div className="flex gap-2">
                              <Input
                                value={fieldValues[field.id] || ''}
                                onChange={(e) => setFieldValues(prev => ({
                                  ...prev,
                                  [field.id]: e.target.value
                                }))}
                                placeholder="Enter text..."
                              />
                              <Button
                                onClick={() => handleTextFieldSave(field.id, fieldValues[field.id] || '')}
                                disabled={signFieldMutation.isPending}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {field.type === 'name' && (
                          <div className="space-y-2">
                            <Label>Full Name</Label>
                            <div className="flex gap-2">
                              <Input
                                value={fieldValues[field.id] || session.currentRecipient.name}
                                onChange={(e) => setFieldValues(prev => ({
                                  ...prev,
                                  [field.id]: e.target.value
                                }))}
                                placeholder="Enter your full name..."
                              />
                              <Button
                                onClick={() => handleTextFieldSave(field.id, fieldValues[field.id] || session.currentRecipient.name)}
                                disabled={signFieldMutation.isPending}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {field.type === 'email' && (
                          <div className="space-y-2">
                            <Label>Email Address</Label>
                            <div className="flex gap-2">
                              <Input
                                type="email"
                                value={fieldValues[field.id] || session.currentRecipient.email}
                                onChange={(e) => setFieldValues(prev => ({
                                  ...prev,
                                  [field.id]: e.target.value
                                }))}
                                placeholder="Enter email address..."
                              />
                              <Button
                                onClick={() => handleTextFieldSave(field.id, fieldValues[field.id] || session.currentRecipient.email)}
                                disabled={signFieldMutation.isPending}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {field.type === 'date' && (
                          <div className="space-y-2">
                            <Label>Date</Label>
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                value={fieldValues[field.id] || new Date().toISOString().split('T')[0]}
                                onChange={(e) => setFieldValues(prev => ({
                                  ...prev,
                                  [field.id]: e.target.value
                                }))}
                              />
                              <Button
                                onClick={() => handleTextFieldSave(field.id, fieldValues[field.id] || new Date().toISOString().split('T')[0])}
                                disabled={signFieldMutation.isPending}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {field.type === 'checkbox' && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={field.id}
                              onCheckedChange={(checked) => handleCheckboxChange(field.id, !!checked)}
                              disabled={signFieldMutation.isPending}
                            />
                            <Label htmlFor={field.id}>{field.label}</Label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Completion Status */}
        {progress === 100 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckSquare className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-green-800 mb-2">
                  Document Signed Successfully!
                </h3>
                <p className="text-gray-600">
                  Thank you for signing this document. All parties will be notified of completion.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}