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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ContactDetailModal } from "@/components/contact-detail-modal";
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, closestCorners, useDroppable, useDraggable } from "@dnd-kit/core";

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
  Info,
  LayoutGrid,
  List,
  Filter,
  GripVertical,
  Settings,
  Search,
  X,
  BarChart3
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

// Draggable Kanban Card Component - uses useDraggable for cross-container dragging
function DraggableKanbanCard({ signature, onClick }: { signature: any, onClick?: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: signature.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-3 rounded-md shadow-sm border hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">{signature.signerName}</div>
          <div className="text-xs text-gray-500 truncate">{signature.signerEmail}</div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(signature.signedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Droppable Stage Component
function DroppableStage({
  id,
  children,
  className
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
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

  // Sync local state with document data when it changes
  useEffect(() => {
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
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // View mode and filter state
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>(() => {
    return (localStorage.getItem('ndaViewMode') as 'table' | 'kanban') || 'table';
  });
  const [quickFilter, setQuickFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'viewed'>('all');
  const [customStages, setCustomStages] = useState<string[]>([]);
  const [isManagingStages, setIsManagingStages] = useState(false);
  const [newStageName, setNewStageName] = useState('');

  // Drag and drop state  - track which signature stage each signature belongs to
  const [signatureStages, setSignatureStages] = useState<Record<number, string>>({});
  const [activeId, setActiveId] = useState<number | null>(null);

  // Signer analytics modal state
  const [analyticsSignerEmail, setAnalyticsSignerEmail] = useState<string | null>(null);
  const [analyticsSignerName, setAnalyticsSignerName] = useState<string>('');

  // Fetch signer analytics when modal is open
  const { data: signerAnalytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['/api/cim', cimDocument.id, 'signer-analytics', analyticsSignerEmail],
    queryFn: async () => {
      if (!analyticsSignerEmail) return null;
      const response = await fetch(`/api/cim/${cimDocument.id}/signer-analytics/${encodeURIComponent(analyticsSignerEmail)}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    enabled: !!analyticsSignerEmail
  });

  // Helper to format time spent
  const formatTimeSpent = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Setup DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Initialize signature stages from database when signatures load
  useEffect(() => {
    if (ndaSignatures.length > 0) {
      const stages: Record<number, string> = {};
      ndaSignatures.forEach(sig => {
        stages[sig.id] = sig.stage || 'pending';
      });
      setSignatureStages(stages);
    }
  }, [ndaSignatures]);

  // Handle drag end - update stage in database
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const signatureId = active.id as number;
    const newStage = over.id as string;
    const currentStage = signatureStages[signatureId];

    // If stage changed, update in database
    if (newStage !== currentStage) {
      // Optimistic update
      setSignatureStages(prev => ({
        ...prev,
        [signatureId]: newStage
      }));

      // Persist to database
      updateStageMutation.mutate({ signatureId, stage: newStage });
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

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

  // Reject signer mutation
  const rejectSignerMutation = useMutation({
    mutationFn: async (signatureId: number) => {
      const response = await apiRequest('POST', `/api/cim/${cimDocument.id}/nda-signatures/${signatureId}/reject`);
      if (!response.ok) throw new Error('Failed to reject signer');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Signer Rejected",
        description: "The signer has been rejected and will receive a notification email."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}/nda-signatures`] });
    },
    onError: () => {
      toast({
        title: "Rejection Failed",
        description: "Failed to reject signer. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Batch reject signers mutation
  const batchRejectSignersMutation = useMutation({
    mutationFn: async (signatureIds: number[]) => {
      const response = await apiRequest('POST', `/api/cim/${cimDocument.id}/nda-signatures/reject-batch`, {
        body: {
          signatureIds
        }
      });
      if (!response.ok) throw new Error('Failed to reject signers');
      return response.json();
    },
    onSuccess: (data) => {
      const rejectedCount = data.signatures?.length || 0;
      toast({
        title: "Signers Rejected",
        description: `${rejectedCount} signers have been rejected and will receive notification emails.`
      });
      setSelectedSignatures([]);
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}/nda-signatures`] });
    },
    onError: () => {
      toast({
        title: "Batch Rejection Failed",
        description: "Failed to reject signers. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update signature stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ signatureId, stage }: { signatureId: number, stage: string }) => {
      const response = await fetch(`/api/nda-signatures/${signatureId}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ stage })
      });
      if (!response.ok) throw new Error('Failed to update stage');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}/nda-signatures`] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update signature stage. Please try again.",
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

  // Filter signatures based on search term and quick filters
  const filteredSignatures = stablySortedSignatures.filter(signature => {
    // Apply search filter
    const matchesSearch = signature.signerName.toLowerCase().includes(signatureSearchTerm.toLowerCase()) ||
      signature.signerEmail.toLowerCase().includes(signatureSearchTerm.toLowerCase()) ||
      (signature.signerLocation && signature.signerLocation.toLowerCase().includes(signatureSearchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // Apply quick filter
    if (quickFilter === 'pending') {
      return cimDocument.ndaApprovalRequired && !signature.approved && !signature.rejected;
    } else if (quickFilter === 'approved') {
      return !cimDocument.ndaApprovalRequired || signature.approved;
    } else if (quickFilter === 'rejected') {
      return signature.rejected;
    } else if (quickFilter === 'viewed') {
      return signature.viewCount > 0;
    }

    return true; // 'all' filter
  });

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

  // Handle individual rejection
  const handleRejectSignature = (signatureId: number) => {
    rejectSignerMutation.mutate(signatureId);
  };

  // Handle batch rejection
  const handleBatchRejection = () => {
    if (selectedSignatures.length === 0) return;
    batchRejectSignersMutation.mutate(selectedSignatures);
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
        ? (sig.rejected ? 'Rejected' : sig.approved ? 'Approved' : 'Pending')
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
    const baseUrl = window.location.hostname === 'localhost' ? window.location.origin : 'https://brokervault.ai';
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
        <CardContent className="space-y-4 pt-6">
          {/* Main Protection Toggle with Template - Combined on One Line */}
          <div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="nda-protection" className="text-base font-semibold text-gray-900">
                <span className="hidden sm:inline">Require NDA Before Access</span>
                <span className="sm:hidden">Require NDA</span>
              </Label>
              <div className="flex items-center gap-3">
                {/* Template Selection - Inline when toggle is on */}
                {ndaSettings.ndaProtected && (
                  <div className="flex-shrink-0 animate-in slide-in-from-left-2 duration-200">
                    <Select
                      value={ndaSettings.ndaTemplateId?.toString() || ""}
                      onValueChange={(value) => {
                        if (value === "manage-templates") {
                          setLocation('/nda-templates');
                        } else {
                          handleSettingChange('ndaTemplateId', parseInt(value));
                        }
                      }}
                      disabled={updateNdaSettingsMutation.isPending}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Choose template" />
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
                  </div>
                )}
                <Switch
                  id="nda-protection"
                  checked={ndaSettings.ndaProtected}
                  onCheckedChange={(checked) =>
                    handleSettingChange('ndaProtected', checked)
                  }
                />
              </div>
            </div>
            {/* Warning message if no templates */}
            {ndaSettings.ndaProtected && ndaTemplates.length === 0 && (
              <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md mt-3">
                No templates available. Create one to enable NDA protection.
              </p>
            )}
          </div>

          {/* Additional Settings - Flat and Compact */}
          {ndaSettings.ndaProtected && (
            <div className="space-y-3 pt-3 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
              {/* Manual Approval Toggle - Flat */}
              <div className="flex items-center justify-between py-2">
                <Label htmlFor="manual-approval" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-gray-500" />
                  Manual Approval
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>When enabled, you must manually approve each NDA signer before they can access the document. Signers will receive the document only after you approve them. This adds an extra layer of security for sensitive information.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Switch
                  id="manual-approval"
                  checked={ndaSettings.ndaApprovalRequired}
                  onCheckedChange={(checked) =>
                    handleSettingChange('ndaApprovalRequired', checked)
                  }
                />
              </div>

              {/* Copy Me on CIM Emails Toggle - Flat */}
              <div className="flex items-center justify-between py-2">
                <Label htmlFor="copy-emails" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  Copy me on CIM emails
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>When enabled, you'll be CC'd on all emails sent to NDA signers when they receive access to your CIM document. This helps you track who has been granted access and when documents are sent.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Switch
                  id="copy-emails"
                  checked={ndaSettings.copyMeOnEmails}
                  onCheckedChange={(checked) =>
                    handleSettingChange('copyMeOnEmails', checked)
                  }
                />
              </div>
            </div>
          )}


        </CardContent>
      </Card>





      {/* NDA Signatures Table */}
      <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
        <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 pb-4 pt-6 px-4 sm:px-6 shadow-lg">
          <div className="flex flex-col gap-3">
            {/* Title and Action Buttons Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Title */}
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-white flex-wrap">
                <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-sm">
                  <FileSignature className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <span className="whitespace-nowrap">NDA Signatures</span>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 shadow-sm text-xs">
                  {ndaSignatures.length}
                </Badge>
                {cimDocument.ndaApprovalRequired && ndaSignatures.filter(sig => !sig.approved).length > 0 && (
                  <Badge className="bg-amber-500 text-white border-amber-400 shadow-md text-xs font-semibold animate-pulse">
                    {ndaSignatures.filter(sig => !sig.approved).length} Pending
                  </Badge>
                )}
              </CardTitle>

              {/* Action Buttons - Desktop */}
              <div className="hidden sm:flex items-center gap-2">
                {/* View Toggle */}
                <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setViewMode('table');
                            localStorage.setItem('ndaViewMode', 'table');
                          }}
                          className={`h-8 px-2 ${viewMode === 'table' ? 'bg-white text-slate-700' : 'text-white hover:bg-white/20'}`}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Table View</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setViewMode('kanban');
                            localStorage.setItem('ndaViewMode', 'kanban');
                          }}
                          className={`h-8 px-2 ${viewMode === 'kanban' ? 'bg-white text-slate-700' : 'text-white hover:bg-white/20'}`}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Kanban View</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                  <Input
                    placeholder="Search..."
                    value={signatureSearchTerm}
                    onChange={(e) => setSignatureSearchTerm(e.target.value)}
                    className="pl-8 pr-8 h-8 w-48 bg-white/10 border-white/30 text-white placeholder:text-white/60 focus:bg-white/20 focus:border-white/50"
                  />
                  {signatureSearchTerm && (
                    <button
                      onClick={() => setSignatureSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Add Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setIsAddManualSignerOpen(true)}
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30 h-8 px-2"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add manual NDA signer</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Mobile Search and Actions Row */}
            <div className="flex sm:hidden items-center gap-2">
              {/* Search - Full Width on Mobile */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                <Input
                  placeholder="Search..."
                  value={signatureSearchTerm}
                  onChange={(e) => setSignatureSearchTerm(e.target.value)}
                  className="pl-8 pr-8 h-8 w-full bg-white/10 border-white/30 text-white placeholder:text-white/60 focus:bg-white/20 focus:border-white/50"
                />
                {signatureSearchTerm && (
                  <button
                    onClick={() => setSignatureSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* View Toggle */}
              <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setViewMode('table');
                    localStorage.setItem('ndaViewMode', 'table');
                  }}
                  className={`h-8 px-2 ${viewMode === 'table' ? 'bg-white text-slate-700' : 'text-white hover:bg-white/20'}`}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setViewMode('kanban');
                    localStorage.setItem('ndaViewMode', 'kanban');
                  }}
                  className={`h-8 px-2 ${viewMode === 'kanban' ? 'bg-white text-slate-700' : 'text-white hover:bg-white/20'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>

              {/* Add Button */}
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsAddManualSignerOpen(true)}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 h-8 px-2"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'pending', 'approved', 'rejected', 'viewed'] as const).map((filter) => {
                const isActive = quickFilter === filter;
                const labels = {
                  all: 'All',
                  pending: 'Pending',
                  approved: 'Approved',
                  rejected: 'Rejected',
                  viewed: 'Viewed'
                };
                const counts = {
                  all: ndaSignatures.length,
                  pending: ndaSignatures.filter(sig => cimDocument.ndaApprovalRequired && !sig.approved && !sig.rejected).length,
                  approved: ndaSignatures.filter(sig => !cimDocument.ndaApprovalRequired || sig.approved).length,
                  rejected: ndaSignatures.filter(sig => sig.rejected).length,
                  viewed: ndaSignatures.filter(sig => sig.viewCount > 0).length
                };

                return (
                  <button
                    key={filter}
                    onClick={() => setQuickFilter(filter)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-slate-700 shadow-md'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <span>{labels[filter]}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isActive
                        ? filter === 'pending' && counts[filter] > 0
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-700'
                        : 'bg-white/20 text-white'
                    }`}>
                      {counts[filter]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bulk Actions */}
            {selectedSignatures.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-4 border-t border-white/20">
              <span className="text-xs sm:text-sm text-white/90">
                {selectedSignatures.length} selected
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {cimDocument.ndaApprovalRequired && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleBatchApproval}
                      disabled={batchApproveSignersMutation.isPending || selectedSignatures.length === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline">{batchApproveSignersMutation.isPending ? "Approving..." : `Approve ${selectedSignatures.length}`}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBatchRejection}
                      disabled={batchRejectSignersMutation.isPending || selectedSignatures.length === 0}
                      className="text-red-600 border-red-300 hover:bg-red-50 bg-white"
                    >
                      <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline">{batchRejectSignersMutation.isPending ? "Rejecting..." : `Reject ${selectedSignatures.length}`}</span>
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const selectedSigs = stablySortedSignatures.filter(sig => selectedSignatures.includes(sig.id));
                    const emails = selectedSigs.map(sig => sig.signerEmail).join(', ');
                    navigator.clipboard.writeText(emails);
                    toast({
                      title: "Email addresses copied",
                      description: `${selectedSigs.length} email address${selectedSigs.length > 1 ? 'es' : ''} copied to clipboard`
                    });
                  }}
                  disabled={selectedSignatures.length === 0}
                  className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                >
                  <Copy className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Copy Emails</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportSignaturesToCSV}
                  disabled={selectedSignatures.length === 0}
                  className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export CSV</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelections}
                  disabled={selectedSignatures.length === 0}
                  className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                >
                  Clear
                </Button>
              </div>
            </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 px-2 sm:px-6">
          {filteredSignatures.length > 0 ? (
            <>
              {/* Kanban Board View */}
              {viewMode === 'kanban' && (
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  collisionDetection={closestCorners}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-700">Pipeline Stages</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsManagingStages(true)}
                        className="text-xs"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Manage Stages
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {/* Pending Stage */}
                      {cimDocument.ndaApprovalRequired && (
                        <DroppableStage id="pending" className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-orange-900 flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Pending
                            </h4>
                            <Badge className="bg-orange-200 text-orange-800">
                              {filteredSignatures.filter(sig => signatureStages[sig.id] === 'pending').length}
                            </Badge>
                          </div>
                          <div className="space-y-2 max-h-96 overflow-y-auto min-h-[100px]">
                            {filteredSignatures
                              .filter(sig => signatureStages[sig.id] === 'pending')
                              .map(signature => (
                                <DraggableKanbanCard
                                  key={signature.id}
                                  signature={signature}
                                />
                              ))}
                            {filteredSignatures.filter(sig => signatureStages[sig.id] === 'pending').length === 0 && (
                              <div className="text-center text-xs text-gray-400 py-8">
                                No contacts in this stage
                              </div>
                            )}
                          </div>
                        </DroppableStage>
                      )}

                      {/* Approved Stage */}
                      <DroppableStage id="approved" className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-green-900 flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            Approved
                          </h4>
                          <Badge className="bg-green-200 text-green-800">
                            {filteredSignatures.filter(sig => signatureStages[sig.id] === 'approved').length}
                          </Badge>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto min-h-[100px]">
                          {filteredSignatures
                            .filter(sig => signatureStages[sig.id] === 'approved')
                            .map(signature => (
                              <DraggableKanbanCard
                                key={signature.id}
                                signature={signature}
                              />
                            ))}
                          {filteredSignatures.filter(sig => signatureStages[sig.id] === 'approved').length === 0 && (
                            <div className="text-center text-xs text-gray-400 py-8">
                              No contacts in this stage
                            </div>
                          )}
                        </div>
                      </DroppableStage>

                      {/* Viewed Document Stage */}
                      <DroppableStage id="viewed" className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Viewed Document
                          </h4>
                          <Badge className="bg-blue-200 text-blue-800">
                            {filteredSignatures.filter(sig => signatureStages[sig.id] === 'viewed').length}
                          </Badge>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto min-h-[100px]">
                          {filteredSignatures
                            .filter(sig => signatureStages[sig.id] === 'viewed')
                            .map(signature => (
                              <DraggableKanbanCard
                                key={signature.id}
                                signature={signature}
                              />
                            ))}
                          {filteredSignatures.filter(sig => signatureStages[sig.id] === 'viewed').length === 0 && (
                            <div className="text-center text-xs text-gray-400 py-8">
                              No contacts in this stage
                            </div>
                          )}
                        </div>
                      </DroppableStage>

                      {/* Custom Stages */}
                      {customStages.map((stageName, index) => (
                        <DroppableStage key={index} id={stageName} className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                              <Tag className="h-4 w-4" />
                              {stageName}
                            </h4>
                            <Badge className="bg-purple-200 text-purple-800">
                              {filteredSignatures.filter(sig => signatureStages[sig.id] === stageName).length}
                            </Badge>
                          </div>
                          <div className="space-y-2 max-h-96 overflow-y-auto min-h-[100px]">
                            {filteredSignatures
                              .filter(sig => signatureStages[sig.id] === stageName)
                              .map(signature => (
                                <DraggableKanbanCard
                                  key={signature.id}
                                  signature={signature}
                                />
                              ))}
                            {filteredSignatures.filter(sig => signatureStages[sig.id] === stageName).length === 0 && (
                              <div className="text-center text-xs text-gray-400 py-8">
                                No contacts in this stage yet
                              </div>
                            )}
                          </div>
                        </DroppableStage>
                      ))}
                    </div>
                  </div>

                  {/* Drag Overlay - shows the card following the cursor */}
                  <DragOverlay>
                    {activeId ? (
                      <div className="bg-white p-3 rounded-md shadow-lg border-2 border-blue-500 opacity-90 rotate-3 scale-105">
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {filteredSignatures.find(sig => sig.id === activeId)?.signerName}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {filteredSignatures.find(sig => sig.id === activeId)?.signerEmail}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {filteredSignatures.find(sig => sig.id === activeId)?.signedAt &&
                                new Date(filteredSignatures.find(sig => sig.id === activeId)!.signedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}

              {/* Desktop Table View */}
              {viewMode === 'table' && (
              <div className="hidden md:block">
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
                                setIsContactModalOpen(true);
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
                                setIsContactModalOpen(true);
                              }
                            }
                          } catch (error) {
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
                            setIsContactModalOpen(true);
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
                        signature.rejected ? (
                          <Badge variant="destructive" className="bg-red-100 text-red-800">
                            <X className="h-3 w-3 mr-1" />
                            Rejected
                          </Badge>
                        ) : signature.approved ? (
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
                        {cimDocument.ndaApprovalRequired && !signature.approved && !signature.rejected && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApproveSignature(signature.id)}
                              disabled={approvingSignatureId === signature.id}
                              title="Approve signer"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {approvingSignatureId === signature.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectSignature(signature.id)}
                              disabled={rejectSignerMutation.isPending}
                              title="Reject signer"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAnalyticsSignerEmail(signature.signerEmail);
                            setAnalyticsSignerName(signature.signerName);
                          }}
                          title="View engagement analytics"
                        >
                          <BarChart3 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/ndas/${signature.id}`)}
                          title="Open in NDA Hub"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              )}

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">

                {filteredSignatures.map((signature) => (
                  <div
                    key={signature.id}
                    className={`p-4 rounded-lg border ${
                      selectedSignatures.includes(signature.id)
                        ? 'bg-muted/50 border-primary'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedSignatures.includes(signature.id)}
                          onChange={() => toggleSignatureSelection(signature.id)}
                          className="rounded mt-1 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-left font-medium text-base hover:text-blue-600 hover:underline transition-colors truncate w-full"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const response = await apiRequest('GET', `/api/investor-contacts?email=${encodeURIComponent(signature.signerEmail)}`);
                                if (response.ok) {
                                  const contacts = await response.json();
                                  if (contacts && contacts.length > 0) {
                                    const contact = {
                                      ...contacts[0],
                                      totalNdaSignatures: 1,
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
                                    setIsContactModalOpen(true);
                                  } else {
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
                                    setIsContactModalOpen(true);
                                  }
                                }
                              } catch (error) {
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
                                setIsContactModalOpen(true);
                              }
                            }}
                          >
                            {signature.signerName}
                          </button>
                          <p className="text-sm text-muted-foreground truncate">{signature.signerEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cimDocument.ndaApprovalRequired ? (
                          signature.rejected ? (
                            <Badge variant="destructive" className="bg-red-100 text-red-800 text-xs">
                              <X className="h-3 w-3 mr-1" />
                              Rejected
                            </Badge>
                          ) : signature.approved ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{signature.signerLocation || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground justify-end">
                        <Eye className="h-3 w-3 shrink-0" />
                        <span>{signature.viewCount || 0} views</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground col-span-2">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="text-xs">
                          {format(new Date(signature.signedAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-3 border-t">
                      {cimDocument.ndaApprovalRequired && !signature.approved && !signature.rejected && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveSignature(signature.id)}
                            disabled={approvingSignatureId === signature.id}
                            className="flex-1 min-w-[100px] bg-green-600 hover:bg-green-700"
                          >
                            {approvingSignatureId === signature.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            ) : (
                              <Check className="h-3 w-3 mr-2" />
                            )}
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRejectSignature(signature.id)}
                            disabled={rejectSignerMutation.isPending}
                            className="flex-1 min-w-[100px] text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <X className="h-3 w-3 mr-2" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copySignerShareLink(signature)}
                        className="flex-1"
                        title="Copy link"
                      >
                        <Copy className="h-3 w-3 mr-2" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendShareLink(signature)}
                        disabled={resendEmailMutation.isPending}
                        className="flex-1"
                        title="Email"
                      >
                        <Mail className="h-3 w-3 mr-2" />
                        Email
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
                        title="Download"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeShareLink(signature)}
                        title="Revoke"
                      >
                        <Link2Off className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
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

      {/* Contact Detail Modal - using shared component */}
      <ContactDetailModal
        contact={viewingContact}
        open={isContactModalOpen}
        onOpenChange={(open) => {
          setIsContactModalOpen(open);
          if (!open) setViewingContact(null);
        }}
      />

      {/* Stage Management Dialog */}
      <Dialog open={isManagingStages} onOpenChange={setIsManagingStages}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Pipeline Stages</DialogTitle>
            <DialogDescription>
              Add custom stages to organize your NDA signers. The default stages (Pending, Approved, Viewed Document) cannot be removed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* List of custom stages */}
            {customStages.length > 0 && (
              <div className="space-y-2">
                <Label>Custom Stages</Label>
                {customStages.map((stageName, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{stageName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newStages = customStages.filter((_, i) => i !== index);
                        setCustomStages(newStages);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new stage */}
            <div className="space-y-2">
              <Label htmlFor="new-stage">Add New Stage</Label>
              <div className="flex gap-2">
                <Input
                  id="new-stage"
                  placeholder="Enter stage name..."
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newStageName.trim()) {
                      setCustomStages([...customStages, newStageName.trim()]);
                      setNewStageName('');
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (newStageName.trim()) {
                      setCustomStages([...customStages, newStageName.trim()]);
                      setNewStageName('');
                    }
                  }}
                  disabled={!newStageName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsManagingStages(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signer Analytics Modal */}
      <Dialog open={!!analyticsSignerEmail} onOpenChange={(open) => !open && setAnalyticsSignerEmail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Engagement Analytics
            </DialogTitle>
            <DialogDescription>
              Viewing activity for {analyticsSignerName}
            </DialogDescription>
          </DialogHeader>

          {isLoadingAnalytics ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : signerAnalytics ? (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{signerAnalytics.totalViews}</div>
                  <div className="text-xs text-blue-700">Total Views</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatTimeSpent(signerAnalytics.totalTimeSpentSeconds)}
                  </div>
                  <div className="text-xs text-green-700">Time Spent</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600">{signerAnalytics.totalDownloads}</div>
                  <div className="text-xs text-purple-700">Downloads</div>
                </div>
              </div>

              {/* View Sessions */}
              {signerAnalytics.viewSessions.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Recent Views</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {signerAnalytics.viewSessions.slice(0, 10).map((session: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 rounded px-3 py-2">
                        <span className="text-gray-600">
                          {format(new Date(session.viewedAt), 'MMM d, h:mm a')}
                        </span>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimeSpent(session.timeSpentSeconds)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Downloads */}
              {signerAnalytics.downloads.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Downloads</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {signerAnalytics.downloads.map((download: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 rounded px-3 py-2">
                        <span className="text-gray-600">
                          {format(new Date(download.downloadedAt), 'MMM d, h:mm a')}
                        </span>
                        <Badge variant="secondary">
                          <Download className="h-3 w-3 mr-1" />
                          {download.downloadType.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {signerAnalytics.totalViews === 0 && signerAnalytics.totalDownloads === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No activity recorded yet</p>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalyticsSignerEmail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}