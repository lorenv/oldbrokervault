import { useState } from "react";
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { 
  FileSignature, 
  ExternalLink, 
  Mail, 
  MapPin,
  Calendar,
  Clock,
  Check,
  Copy,
  Link2Off,
  Loader2,
  Eye
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface DocumentNdaTabProps {
  cimDocument: any;
  ndaSignatures: any[];
}

export function DocumentNdaTab({ cimDocument, ndaSignatures }: DocumentNdaTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  
  // State for NDA settings
  const [ndaSettings, setNdaSettings] = useState({
    ndaProtected: cimDocument.ndaProtected || false,
    ndaTemplateId: cimDocument.ndaTemplateId || null,
    ndaApprovalRequired: cimDocument.ndaApprovalRequired || false
  });
  

  const [signatureSearchTerm, setSignatureSearchTerm] = useState('');
  const [selectedSignatures, setSelectedSignatures] = useState<number[]>([]);
  const [approvingSignatureId, setApprovingSignatureId] = useState<number | null>(null);

  // Fetch NDA templates
  const { data: ndaTemplates = [] } = useQuery({
    queryKey: ['/api/nda-templates'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/nda-templates');
      if (!response.ok) throw new Error('Failed to fetch NDA templates');
      return response.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // Update NDA settings mutation
  const updateNdaSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await apiRequest('PATCH', `/api/cim/${cimDocument.id}/share-settings`, {
        ndaProtected: settings.ndaProtected,
        ndaTemplateId: settings.ndaTemplateId,
        ndaRequiresManualApproval: settings.ndaApprovalRequired
      });
      if (!response.ok) throw new Error('Failed to update NDA settings');
      return response.json();
    },
    onSuccess: () => {
      // Silent auto-save success - no toast needed for better UX
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}/share-settings`] });
    },
    onError: () => {
      toast({
        title: "Auto-save Failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Approve signer mutation
  const approveSignerMutation = useMutation({
    mutationFn: async (signatureId: number) => {
      setApprovingSignatureId(signatureId);
      const response = await apiRequest('POST', `/api/cim/${cimDocument.id}/nda-signatures/${signatureId}/approve`);
      if (!response.ok) throw new Error('Failed to approve signer');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Signer Approved",
        description: "The signer has been approved and will receive access to the document."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}/nda-signatures`] });
      setApprovingSignatureId(null);
    },
    onError: () => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve signer. Please try again.",
        variant: "destructive"
      });
      setApprovingSignatureId(null);
    }
  });

  // Batch approve signers mutation
  const batchApproveSignersMutation = useMutation({
    mutationFn: async (signatureIds: number[]) => {
      const response = await apiRequest('POST', `/api/cim/${cimDocument.id}/nda-signatures/approve-batch`, {
        signatureIds
      });
      if (!response.ok) throw new Error('Failed to approve signers');
      return response.json();
    },
    onSuccess: (data) => {
      const approvedCount = data.signatures?.length || data.approved || 0;
      toast({
        title: "Signers Approved",
        description: `${approvedCount} signers have been approved and will receive access to the document.`
      });
      setSelectedSignatures([]);
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}/nda-signatures`] });
    },
    onError: () => {
      toast({
        title: "Batch Approval Failed",
        description: "Failed to approve signers. Please try again.",
        variant: "destructive"
      });
    }
  });



  // Auto-save NDA settings when they change
  const handleSettingChange = (setting: string, value: any) => {
    const newSettings = { ...ndaSettings, [setting]: value };
    setNdaSettings(newSettings);
    
    // Auto-save to backend with proper mapping
    const backendSettings: any = {
      ndaProtected: newSettings.ndaProtected,
      ndaApprovalRequired: newSettings.ndaApprovalRequired // Fixed: was using ndaRequiresManualApproval
    };
    
    if (newSettings.ndaTemplateId) {
      backendSettings.ndaTemplateId = newSettings.ndaTemplateId;
    }
    
    updateNdaSettingsMutation.mutate(backendSettings);
  };



  // Filter signatures based on search term
  const filteredSignatures = ndaSignatures.filter(signature =>
    signature.signerName.toLowerCase().includes(signatureSearchTerm.toLowerCase()) ||
    signature.signerEmail.toLowerCase().includes(signatureSearchTerm.toLowerCase()) ||
    (signature.signerLocation && signature.signerLocation.toLowerCase().includes(signatureSearchTerm.toLowerCase()))
  );

  // Separate pending and approved signatures
  const pendingSignatures = filteredSignatures.filter(signature => !signature.approved);
  const approvedSignatures = filteredSignatures.filter(signature => signature.approved);

  // Handle individual approval
  const handleApproveSignature = (signatureId: number) => {
    approveSignerMutation.mutate(signatureId);
  };

  // Handle batch approval
  const handleBatchApproval = () => {
    if (selectedSignatures.length === 0) return;
    batchApproveSignersMutation.mutate(selectedSignatures);
  };

  // Toggle signature selection
  const toggleSignatureSelection = (signatureId: number) => {
    setSelectedSignatures(prev => 
      prev.includes(signatureId) 
        ? prev.filter(id => id !== signatureId)
        : [...prev, signatureId]
    );
  };

  // Select all signatures
  const selectAllSignatures = () => {
    setSelectedSignatures(filteredSignatures.map(sig => sig.id));
  };

  // Handle bulk resend emails
  const handleBulkResendEmails = () => {
    if (selectedSignatures.length === 0) return;
    bulkResendEmailMutation.mutate(selectedSignatures);
  };

  // Export to CSV
  const exportSignaturesToCSV = () => {
    const selectedSigs = selectedSignatures.length > 0 
      ? ndaSignatures.filter(sig => selectedSignatures.includes(sig.id))
      : filteredSignatures;

    const csvData = selectedSigs.map(sig => ({
      'Signer Name': sig.signerName,
      'Email': sig.signerEmail,
      'Location': sig.signerLocation || 'Unknown',
      'Signed Date': format(new Date(sig.signedAt), 'yyyy-MM-dd HH:mm:ss'),
      'Status': cimDocument.ndaApprovalRequired 
        ? (sig.approved ? 'Approved' : 'Pending') 
        : 'Active',
      'Views': sig.viewCount || 0
    }));

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nda-signatures-${cimDocument.title.replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Export Complete",
      description: `Exported ${csvData.length} signatures to CSV`
    });
  };

  // Clear all selections
  const clearSelections = () => {
    setSelectedSignatures([]);
  };

  // Generate share link for a specific signer
  const generateSignerShareLink = (signature: any) => {
    const baseUrl = window.location.hostname === 'localhost' ? window.location.origin : 'https://cimshare.com';
    return `${baseUrl}/share/${cimDocument.shareSlug}?token=${signature.accessToken}`;
  };

  // Copy share link
  const copySignerShareLink = (signature: any) => {
    const shareLink = generateSignerShareLink(signature);
    navigator.clipboard.writeText(shareLink);
    toast({
      title: "Share Link Copied",
      description: "The personal share link has been copied to your clipboard"
    });
  };

  // Create mutations for email operations
  const resendEmailMutation = useMutation({
    mutationFn: async (signatureId: number) => {
      const response = await apiRequest('POST', `/api/cim/${cimDocument.id}/nda-signatures/${signatureId}/resend-email`);
      if (!response.ok) throw new Error('Failed to resend email');
      return response.json();
    },
    onSuccess: (data, signatureId) => {
      const signature = ndaSignatures.find(s => s.id === signatureId);
      toast({
        title: "Email Sent",
        description: `Share link sent to ${signature?.signerEmail}`
      });
    },
    onError: () => {
      toast({
        title: "Email Failed",
        description: "Failed to send email. Please try again.",
        variant: "destructive"
      });
    }
  });

  const bulkResendEmailMutation = useMutation({
    mutationFn: async (signatureIds: number[]) => {
      const response = await apiRequest('POST', `/api/cim/${cimDocument.id}/nda-signatures/resend-batch`, {
        signatureIds
      });
      if (!response.ok) throw new Error('Failed to resend emails');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Emails Sent",
        description: data.message
      });
      setSelectedSignatures([]);
    },
    onError: () => {
      toast({
        title: "Bulk Email Failed",
        description: "Failed to send some emails. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Resend share link via email
  const resendShareLink = (signature: any) => {
    resendEmailMutation.mutate(signature.id);
  };

  // Revoke share link for individual signer
  const revokeShareLink = async (signature: any) => {
    try {
      const response = await apiRequest('POST', `/api/cim/${cimDocument.id}/nda-signatures/${signature.id}/revoke`);
      if (response.ok) {
        toast({
          title: "Access Revoked",
          description: `Access has been revoked for ${signature.signerEmail}`
        });
        queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}/nda-signatures`] });
      }
    } catch (error) {
      toast({
        title: "Revoke Failed",
        description: "Failed to revoke access. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* NDA Protection Settings */}
      <Card className="border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl text-blue-900">
            <div className="p-2 rounded-lg bg-blue-100">
              <FileSignature className="h-5 w-5 text-blue-700" />
            </div>
            NDA Protection Settings
          </CardTitle>
          <CardDescription className="text-blue-700/70">
            Secure your confidential information with legally binding agreements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Protection Toggle */}
          <div className="p-4 rounded-xl border-2 border-blue-200 bg-white/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <Label htmlFor="nda-protection" className="text-base font-semibold text-gray-900">
                    Enable NDA Protection
                  </Label>
                </div>
                <p className="text-sm text-gray-600 ml-4">
                  Require visitors to sign a legal agreement before viewing confidential content
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-500">
                  {ndaSettings.ndaProtected ? 'Protected' : 'Open Access'}
                </span>
                <Switch
                  id="nda-protection"
                  checked={ndaSettings.ndaProtected}
                  onCheckedChange={(checked) => 
                    handleSettingChange('ndaProtected', checked)
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>
          </div>
          
          {/* Protected Content Settings */}
          {ndaSettings.ndaProtected && (
            <div className="space-y-4 pl-4 border-l-2 border-blue-200 animate-in slide-in-from-top-2 duration-300">
              {/* Template Selection */}
              <div className="p-4 rounded-lg bg-white border border-gray-200">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                    <Label htmlFor="nda-template" className="font-medium text-gray-900">
                      NDA Template
                    </Label>
                  </div>
                  <Select
                    value={ndaSettings.ndaTemplateId?.toString() || ""}
                    onValueChange={(value) => 
                      handleSettingChange('ndaTemplateId', parseInt(value))
                    }
                  >
                    <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Choose your legal template" />
                    </SelectTrigger>
                    <SelectContent>
                      {ndaTemplates.map((template: any) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          <div className="flex items-center gap-2">
                            <FileSignature className="h-4 w-4 text-blue-600" />
                            {template.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {ndaTemplates.length === 0 && (
                    <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                      No templates available. Create one using the template manager below.
                    </p>
                  )}
                </div>
              </div>
              
              {/* Manual Approval Toggle */}
              <div className="p-4 rounded-lg bg-white border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                      <Label htmlFor="manual-approval" className="font-medium text-gray-900">
                        Manual Approval Required
                      </Label>
                    </div>
                    <p className="text-sm text-gray-600 ml-4">
                      Review and approve each signer individually before granting document access
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500">
                      {ndaSettings.ndaApprovalRequired ? 'Manual' : 'Automatic'}
                    </span>
                    <Switch
                      id="manual-approval"
                      checked={ndaSettings.ndaApprovalRequired}
                      onCheckedChange={(checked) => 
                        handleSettingChange('ndaApprovalRequired', checked)
                      }
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Template Management Section */}
          <div className="pt-4 border-t border-blue-200">
            <div className="p-4 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-gray-200">
                      <FileSignature className="h-4 w-4 text-gray-700" />
                    </div>
                    <Label className="text-base font-semibold text-gray-900">Template Management</Label>
                  </div>
                  <p className="text-sm text-gray-600 ml-7">
                    Create, edit, and organize your NDA templates with drag-and-drop signature fields
                  </p>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => setLocation('/nda-templates')}
                  className="bg-white hover:bg-gray-50 border-gray-300 text-gray-700 hover:text-gray-900 font-medium"
                >
                  <FileSignature className="h-4 w-4 mr-2" />
                  Manage NDA Templates
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>





      {/* NDA Signatures Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              NDA Signatures ({ndaSignatures.length})
              {cimDocument.ndaApprovalRequired && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {ndaSignatures.filter(sig => !sig.approved).length} Pending Approval
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search signatures..."
                value={signatureSearchTerm}
                onChange={(e) => setSignatureSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
          {selectedSignatures.length > 0 && (
            <div className="flex items-center gap-2 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedSignatures.length} selected
              </span>
              {cimDocument.ndaApprovalRequired && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBatchApproval}
                  disabled={batchApproveSignersMutation.isPending || selectedSignatures.length === 0}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {batchApproveSignersMutation.isPending ? "Approving..." : `Approve ${selectedSignatures.length}`}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkResendEmails}
                disabled={bulkResendEmailMutation.isPending || selectedSignatures.length === 0}
              >
                <Mail className="h-4 w-4 mr-2" />
                {bulkResendEmailMutation.isPending ? "Sending..." : `Email ${selectedSignatures.length}`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportSignaturesToCSV}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelections}
              >
                Clear
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filteredSignatures.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedSignatures.length === filteredSignatures.length && filteredSignatures.length > 0}
                      onChange={() => {
                        if (selectedSignatures.length === filteredSignatures.length) {
                          clearSelections();
                        } else {
                          selectAllSignatures();
                        }
                      }}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Signer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Signed Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSignatures.map((signature) => (
                  <TableRow 
                    key={signature.id}
                    className={selectedSignatures.includes(signature.id) ? "bg-muted/50" : ""}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedSignatures.includes(signature.id)}
                        onChange={() => toggleSignatureSelection(signature.id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{signature.signerName}</TableCell>
                    <TableCell>{signature.signerEmail}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{signature.signerLocation || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(signature.signedAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {cimDocument.ndaApprovalRequired ? (
                        signature.approved ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline">
                          <Check className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Eye className="h-3 w-3 mr-1" />
                        {signature.viewCount || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {cimDocument.ndaApprovalRequired && !signature.approved && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveSignature(signature.id)}
                            disabled={approvingSignatureId === signature.id}
                            title="Approve signer"
                          >
                            {approvingSignatureId === signature.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copySignerShareLink(signature)}
                          title="Copy personal share link"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resendShareLink(signature)}
                          disabled={resendEmailMutation.isPending}
                          title="Resend share link via email"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeShareLink(signature)}
                          title="Revoke access"
                        >
                          <Link2Off className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileSignature className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {ndaSignatures.length === 0 ? "No signatures yet" : "No signatures match your search"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ndaSignatures.length === 0 
                  ? "Enable NDA protection and share your document to start collecting signatures"
                  : "Try adjusting your search terms"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}