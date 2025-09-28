import { useState, useEffect } from "react";
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  Shield,
  ExternalLink,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Check,
  Copy,
  Link2Off,
  Loader2,
  Eye,
  Download,
  FileSignature,
  UserCheck,
  Plus,
  Users,
  Tag,
  FileText,
  Info
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { AddManualNdaSigner } from "@/components/add-manual-nda-signer";
import type { InvestorContact } from "@shared/schema";

interface DocumentNdaTabProps {
  cimDocument: any;
  ndaSignatures: any[];
}

export function DocumentNdaTab({ cimDocument, ndaSignatures }: DocumentNdaTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // State for NDA settings - sync with document data
  const [ndaSettings, setNdaSettings] = useState({
    ndaProtected: cimDocument.ndaProtected || false,
    ndaTemplateId: cimDocument.ndaTemplateId || null,
    ndaApprovalRequired: cimDocument.ndaApprovalRequired || false,
    copyMeOnEmails: cimDocument.copyMeOnEmails || false
  });

  // Maintain a stable sort order for signatures by storing IDs
  const [sortOrderIds, setSortOrderIds] = useState<number[]>([]);

  // Debug logging
  console.log('📋 NDA Tab - Document data received:', {
    ndaProtected: cimDocument.ndaProtected,
    ndaTemplateId: cimDocument.ndaTemplateId,
    ndaApprovalRequired: cimDocument.ndaApprovalRequired
  });
  
  // Check if we have stored NDA data from generation
  const storedNda = sessionStorage.getItem(`doc_${cimDocument.id}_nda`);
  if (storedNda) {
    console.log('📋 NDA Tab - Stored NDA data from generation:', JSON.parse(storedNda));
  }

  // Sync local state with document data when it changes
  useEffect(() => {
    console.log('🔄 NDA Tab - Syncing settings from document');
    setNdaSettings({
      ndaProtected: cimDocument.ndaProtected || false,
      ndaTemplateId: cimDocument.ndaTemplateId || null,
      ndaApprovalRequired: cimDocument.ndaApprovalRequired || false,
      copyMeOnEmails: cimDocument.copyMeOnEmails || false
    });
  }, [cimDocument.ndaProtected, cimDocument.ndaTemplateId, cimDocument.ndaApprovalRequired, cimDocument.copyMeOnEmails]);

  // Initialize and maintain stable sort order for signatures
  useEffect(() => {
    // Only initialize sort order if we don't have one yet
    if (sortOrderIds.length === 0 && ndaSignatures.length > 0) {
      // Set initial sort order based on how signatures come from backend
      setSortOrderIds(ndaSignatures.map(sig => sig.id));
    } else if (sortOrderIds.length > 0) {
      // When signatures are updated, preserve existing order and add new ones at the end
      const existingIds = new Set(sortOrderIds);
      const newSignatures = ndaSignatures.filter(sig => !existingIds.has(sig.id));
      if (newSignatures.length > 0) {
        setSortOrderIds([...sortOrderIds, ...newSignatures.map(sig => sig.id)]);
      }
    }
  }, [ndaSignatures]);


  const [signatureSearchTerm, setSignatureSearchTerm] = useState('');
  const [selectedSignatures, setSelectedSignatures] = useState<number[]>([]);
  const [approvingSignatureId, setApprovingSignatureId] = useState<number | null>(null);
  const [isAddManualSignerOpen, setIsAddManualSignerOpen] = useState(false);
  const [viewingContact, setViewingContact] = useState<any | null>(null);

  // Fetch NDA templates
  const { data: ndaTemplates = [] } = useQuery({
    queryKey: ['/api/nda-templates'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/nda-templates');
      if (!response.ok) throw new Error('Failed to fetch NDA templates');
      return response.json();
    },
    staleTime: 5000, // Reduced stale time to refresh more frequently
    refetchOnWindowFocus: true
  });

  // Update NDA settings mutation
  const updateNdaSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await apiRequest('PATCH', `/api/cim/${cimDocument.id}/share-settings`, {
        body: {
          ndaProtected: settings.ndaProtected,
          ndaTemplateId: settings.ndaTemplateId,
          ndaApprovalRequired: settings.ndaApprovalRequired,
          copyMeOnEmails: settings.copyMeOnEmails
        }
      });
      if (!response.ok) throw new Error('Failed to update NDA settings');
      return response.json();
    },
    onSuccess: (data) => {
      // Show brief success indicator for template changes
      toast({
        title: "Settings Saved",
        description: "NDA settings updated successfully",
        duration: 2000
      });

      // Update local state with server response to prevent reversion
      if (data) {
        const newSettings = {
          ndaProtected: data.ndaProtected !== undefined ? data.ndaProtected : ndaSettings.ndaProtected,
          ndaTemplateId: data.ndaTemplateId !== undefined ? data.ndaTemplateId : ndaSettings.ndaTemplateId,
          ndaApprovalRequired: data.ndaApprovalRequired !== undefined ? data.ndaApprovalRequired : ndaSettings.ndaApprovalRequired,
          copyMeOnEmails: data.copyMeOnEmails !== undefined ? data.copyMeOnEmails : ndaSettings.copyMeOnEmails
        };
        setNdaSettings(newSettings);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}/share-settings`] });
      queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
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
        body: {
          signatureIds
        }
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
      ndaApprovalRequired: newSettings.ndaApprovalRequired,
      ndaTemplateId: newSettings.ndaTemplateId, // Always include template ID
      copyMeOnEmails: newSettings.copyMeOnEmails
    };

    updateNdaSettingsMutation.mutate(backendSettings);
  };



  // Sort signatures based on stable sort order
  const stablySortedSignatures = sortOrderIds.length > 0
    ? sortOrderIds
        .map(id => ndaSignatures.find(sig => sig.id === id))
        .filter((sig): sig is NonNullable<typeof sig> => sig !== undefined)
    : ndaSignatures;

  // Filter signatures based on search term
  const filteredSignatures = stablySortedSignatures.filter(signature =>
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
      ? stablySortedSignatures.filter(sig => selectedSignatures.includes(sig.id))
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
        body: {
          signatureIds
        }
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
      {/* NDA Protection Settings - Enhanced Professional Design */}
      <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
        <CardHeader className="bg-gradient-to-r from-cyan-600 to-cyan-700 pb-4 pt-6 px-6 shadow-lg">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-sm">
              <Shield className="h-5 w-5 text-white" />
            </div>
            NDA Protection Settings
          </CardTitle>
          <CardDescription className="text-emerald-50 mt-1 text-sm">
            Control who can access your confidential information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-8">
          {/* Main Protection Toggle - Enhanced Design */}
          <div className="flex items-center justify-between py-6 px-8 rounded-2xl border-2 border-emerald-200/50 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-lg">
            <div className="space-y-2">
              <Label htmlFor="nda-protection" className="text-lg font-semibold text-emerald-900">
                Require NDA Before Access
              </Label>
              <p className="text-sm text-emerald-700 max-w-md">
                Visitors must sign an agreement before viewing this document
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                ndaSettings.ndaProtected
                  ? 'text-emerald-700 bg-emerald-100'
                  : 'text-gray-600 bg-gray-100'
              }`}>
                {ndaSettings.ndaProtected ? '🔒 Protected' : '🌐 Open'}
              </span>
              <Switch
                id="nda-protection"
                checked={ndaSettings.ndaProtected}
                onCheckedChange={(checked) =>
                  handleSettingChange('ndaProtected', checked)
                }
              />
            </div>
          </div>

          {/* Protected Content Settings - Cleaner Nested Options */}
          {ndaSettings.ndaProtected && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
              {/* Template Selection - Simplified */}
              <div className="space-y-3">
                <Label htmlFor="nda-template" className="text-sm font-medium text-gray-700">
                  NDA Template
                </Label>
                <Select
                  value={ndaSettings.ndaTemplateId?.toString() || ""}
                  onValueChange={(value) => {
                    if (value === "manage-templates") {
                      setLocation('/account?tab=templates');
                    } else {
                      handleSettingChange('ndaTemplateId', parseInt(value));
                    }
                  }}
                  disabled={updateNdaSettingsMutation.isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a template" />
                    {updateNdaSettingsMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {ndaTemplates.map((template: any) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="manage-templates"
                      className="text-blue-600 font-medium border-t border-gray-200"
                    >
                      Manage Templates
                    </SelectItem>
                  </SelectContent>
                </Select>
                {ndaTemplates.length === 0 && (
                  <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md">
                    No templates available. Create one to enable NDA protection.
                  </p>
                )}
              </div>

              {/* Manual Approval Toggle - Simplified */}
              <div className="flex items-center justify-between py-3 px-4 rounded-md border border-gray-200 bg-gray-50/50">
                <div className="space-y-1">
                  <Label htmlFor="manual-approval" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-gray-500" />
                    Manual Approval
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>When enabled, you must manually approve each NDA signer before they can access the document. This adds an extra layer of security for sensitive information.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <p className="text-xs text-gray-500">
                    Review each signature before granting access
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="manual-approval"
                    checked={ndaSettings.ndaApprovalRequired}
                    onCheckedChange={(checked) =>
                      handleSettingChange('ndaApprovalRequired', checked)
                    }
                  />
                </div>
              </div>

              {/* Copy Me on CIM Emails Toggle - New */}
              <div className="flex items-center justify-between py-3 px-4 rounded-md border border-gray-200 bg-gray-50/50">
                <div className="space-y-1">
                  <Label htmlFor="copy-emails" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    Copy me on CIM emails
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>When enabled, you'll be CC'd on all emails sent to NDA signers when they receive access to your CIM document. This helps you track who has been granted access.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <p className="text-xs text-gray-500">
                    Get CC'd when documents are sent to signers
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="copy-emails"
                    checked={ndaSettings.copyMeOnEmails}
                    onCheckedChange={(checked) =>
                      handleSettingChange('copyMeOnEmails', checked)
                    }
                  />
                </div>
              </div>
            </div>
          )}


        </CardContent>
      </Card>





      {/* NDA Signatures Table */}
      <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
        <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 pb-4 pt-6 px-6 shadow-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-sm">
                <FileSignature className="h-5 w-5 text-white" />
              </div>
              NDA Signatures ({ndaSignatures.length})
              {cimDocument.ndaApprovalRequired && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 shadow-sm text-xs">
                  {ndaSignatures.filter(sig => !sig.approved).length} Pending Approval
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsAddManualSignerOpen(true)}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                title="Add manual NDA signer"
              >
                <Plus className="h-4 w-4" />
              </Button>
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
        <CardContent className="pt-6">
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
                    <TableCell className="font-medium">
                      <button
                        className="text-left hover:text-blue-600 hover:underline transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          // Fetch investor contact by email
                          try {
                            const response = await apiRequest('GET', `/api/investor-contacts?email=${encodeURIComponent(signature.signerEmail)}`);
                            if (response.ok) {
                              const contacts = await response.json();
                              if (contacts && contacts.length > 0) {
                                // Get the first matching contact and enrich it with signature info
                                const contact = {
                                  ...contacts[0],
                                  totalNdaSignatures: 1, // We know they have at least this signature
                                  documents: [{
                                    documentId: cimDocument.id,
                                    documentTitle: cimDocument.title,
                                    signedAt: signature.signedAt,
                                    signerName: signature.signerName,
                                    cimDocumentId: cimDocument.id,
                                    signatureId: signature.id
                                  }],
                                  lastNdaSigned: new Date(signature.signedAt).getTime()
                                };
                                setViewingContact(contact);
                              } else {
                                // Create a temporary contact object for viewing
                                setViewingContact({
                                  id: null,
                                  name: signature.signerName,
                                  email: signature.signerEmail,
                                  company: signature.signerCompany || '',
                                  phone: signature.signerPhone || '',
                                  notes: '',
                                  tags: [],
                                  status: 'new',
                                  totalNdaSignatures: 1,
                                  documents: [{
                                    documentId: cimDocument.id,
                                    documentTitle: cimDocument.title,
                                    signedAt: signature.signedAt,
                                    signerName: signature.signerName,
                                    cimDocumentId: cimDocument.id,
                                    signatureId: signature.id
                                  }],
                                  lastNdaSigned: new Date(signature.signedAt).getTime(),
                                  createdAt: new Date(),
                                  lastSeenAt: new Date(signature.signedAt)
                                });
                              }
                            }
                          } catch (error) {
                            console.error('Failed to fetch investor contact:', error);
                            // Still show the modal with basic info
                            setViewingContact({
                              id: null,
                              name: signature.signerName,
                              email: signature.signerEmail,
                              company: signature.signerCompany || '',
                              phone: signature.signerPhone || '',
                              notes: '',
                              tags: [],
                              status: 'new',
                              totalNdaSignatures: 1,
                              documents: [{
                                documentId: cimDocument.id,
                                documentTitle: cimDocument.title,
                                signedAt: signature.signedAt,
                                signerName: signature.signerName,
                                cimDocumentId: cimDocument.id,
                                signatureId: signature.id
                              }],
                              lastNdaSigned: new Date(signature.signedAt).getTime(),
                              createdAt: new Date(),
                              lastSeenAt: new Date(signature.signedAt)
                            });
                          }
                        }}
                      >
                        {signature.signerName}
                      </button>
                    </TableCell>
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
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/cim/${cimDocument.id}/nda-signatures/${signature.id}/download`, {
                                method: 'GET',
                                credentials: 'include'
                              });

                              if (response.ok) {
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `nda-${signature.signerName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);

                                toast({
                                  title: "Download Started",
                                  description: `Signed NDA for ${signature.signerName} is being downloaded.`
                                });
                              } else {
                                throw new Error('Failed to download NDA');
                              }
                            } catch (error) {
                              toast({
                                title: "Download Failed",
                                description: "Failed to download the signed NDA. Please try again.",
                                variant: "destructive"
                              });
                            }
                          }}
                          title="Download signed NDA"
                        >
                          <Download className="h-3 w-3" />
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

      {/* Add Manual NDA Signer Modal */}
      <AddManualNdaSigner
        isOpen={isAddManualSignerOpen}
        onClose={() => setIsAddManualSignerOpen(false)}
        cimDocumentId={cimDocument.id}
        onSuccess={() => {
          // Refresh the NDA signatures list
          queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}/nda-signatures`] });
        }}
      />

      {/* Contact Detail Modal */}
      <Dialog open={!!viewingContact} onOpenChange={() => setViewingContact(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contact Details
            </DialogTitle>
            <DialogDescription>
              View detailed information for this NDA signer
            </DialogDescription>
          </DialogHeader>

          {viewingContact && (
            <div className="space-y-6 mt-6">
              {/* Main Contact Information Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                        <p className="text-base font-medium mt-1">{viewingContact.name}</p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                        <p className="text-base mt-1">
                          <a
                            href={`mailto:${viewingContact.email}`}
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {viewingContact.email}
                          </a>
                        </p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                        <p className="text-base mt-1">
                          {viewingContact.phone || 'Not provided'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Company</Label>
                        <p className="text-base mt-1">
                          {viewingContact.company || 'Not provided'}
                        </p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                        <p className="text-base mt-1">
                          {viewingContact.location || 'Not provided'}
                        </p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <Badge variant="outline" className="mt-1">
                          {viewingContact.status || 'New'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Document History Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Document History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">{viewingContact.totalNdaSignatures} NDA signature(s)</span>
                      </div>
                      {viewingContact.lastNdaSigned && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Last signed: {new Date(viewingContact.lastNdaSigned).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {viewingContact.documents && viewingContact.documents.length > 0 && (
                      <div className="space-y-2">
                        {viewingContact.documents.map((doc: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 border rounded-md">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{doc.documentTitle}</p>
                                <p className="text-xs text-muted-foreground">
                                  Signed on {new Date(doc.signedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Notes Section */}
              {viewingContact.notes && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{viewingContact.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setViewingContact(null)}>
              Close
            </Button>
            {viewingContact?.id && (
              <Button
                onClick={() => {
                  // Navigate to investor database with this contact selected
                  setLocation(`/investors?contact=${viewingContact.id}`);
                }}
              >
                View in Investor Database
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}