import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Download, FileText, File, Globe, FileDown, Link, Share2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EmailShareDialog } from "./email-share-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as SelectPrimitive from "@radix-ui/react-select";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function DocumentExport({ 
  analysis, 
  docId, 
  websiteUrl,
  logoUrl,
  selectedImages,
  user,
  isWordPressDialogOpen: externalIsWordPressDialogOpen,
  setIsWordPressDialogOpen: externalSetIsWordPressDialogOpen,
  isSharedView = false,
  shouldOpenShareDialog = false,
  setShouldOpenShareDialog,
  autoTriggerShare = false,
  onShareTriggered
}: { 
  analysis: any; 
  docId: number; 
  websiteUrl?: string;
  logoUrl?: string;
  selectedImages?: string[];
  user?: any;
  isWordPressDialogOpen?: boolean;
  setIsWordPressDialogOpen?: (isOpen: boolean) => void;
  isSharedView?: boolean;
  shouldOpenShareDialog?: boolean;
  setShouldOpenShareDialog?: (shouldOpen: boolean) => void;
  autoTriggerShare?: boolean;
  onShareTriggered?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [internalIsWordPressDialogOpen, internalSetIsWordPressDialogOpen] = useState(false);
  const [isWordPressExporting, setIsWordPressExporting] = useState(false);
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isWordLoading, setIsWordLoading] = useState(false);
  const [beaverBuilderTemplates, setBeaverBuilderTemplates] = useState<Array<{id: number, title: string, type: string}>>([]);
  
  // Share dialog state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareSettings, setShareSettings] = useState({
    shareEnabled: false,
    shareSlug: '',
    sharePassword: '',
    shareExpiresAt: '',
    customSlug: '',
    ndaProtected: false,
    ndaTemplateId: null as number | null
  });
  const [shareUrl, setShareUrl] = useState('');
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [isLoadingShareSettings, setIsLoadingShareSettings] = useState(false);
  
  // NDA related state
  // Using React Query data instead of local state
  const [isUploadingNda, setIsUploadingNda] = useState(false);
  const [newNdaTemplate, setNewNdaTemplate] = useState({
    name: '',
    file: null as File | null,
    isDefault: false
  });
  const [signatureSearchTerm, setSignatureSearchTerm] = useState('');
  
  // Email sharing state
  const [emailShareDialog, setEmailShareDialog] = useState<{
    open: boolean;
    documentTitle?: string;
    shareToken?: string;
  }>({ open: false });

  // Embed settings state
  const [embedSettings, setEmbedSettings] = useState({
    width: '100%',
    height: '600',
    border: true,
    responsive: true
  });
  
  // Use external dialog state if provided, otherwise use internal state
  const isWordPressDialogOpen = externalIsWordPressDialogOpen !== undefined ? externalIsWordPressDialogOpen : internalIsWordPressDialogOpen;
  const setIsWordPressDialogOpen = externalSetIsWordPressDialogOpen || internalSetIsWordPressDialogOpen;
  const [wordpressForm, setWordpressForm] = useState({
    wpUrl: '',
    username: '',
    password: '',
    status: 'draft',
    template: 'default',
    useToolsetFields: true
  });

  const handleWordPressFormChange = (field: string, value: string | boolean) => {
    setWordpressForm(prev => ({ ...prev, [field]: value }));
  };

  // Share functionality handlers
  const generateShareSlug = () => {
    if (shareSettings.customSlug) {
      return shareSettings.customSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    // Generate random slug immediately
    const randomId = Math.random().toString(36).substring(2, 8);
    return `cim-${randomId}`;
  };

  const updateShareSettings = async () => {
    if (!docId) {
      console.log('❌ updateShareSettings: No docId provided');
      return;
    }
    
    console.log('🔄 Starting share settings update...', {
      docId,
      shareSettings,
      userId: user?.id
    });
    
    // Validate NDA template selection when NDA protection is enabled
    if (shareSettings.ndaProtected && !shareSettings.ndaTemplateId) {
      console.log('❌ NDA validation failed: NDA protection enabled but no template selected');
      toast({
        title: "NDA Template Required",
        description: "Please select an NDA template when enabling NDA protection.",
        variant: "destructive"
      });
      return;
    }
    
    setIsUpdatingShare(true);
    try {
      const slug = shareSettings.shareEnabled ? (shareSettings.shareSlug || generateShareSlug()) : null;
      const expiresAt = shareSettings.shareExpiresAt ? new Date(shareSettings.shareExpiresAt) : null;
      
      const payload = {
        shareEnabled: shareSettings.shareEnabled,
        shareSlug: slug,
        sharePassword: shareSettings.sharePassword || null,
        shareExpiresAt: expiresAt,
        ndaProtected: shareSettings.ndaProtected,
        ndaTemplateId: shareSettings.ndaTemplateId
      };
      
      console.log('📡 Sending share settings update request:', payload);
      
      const response = await apiRequest('POST', `/api/cim/${docId}/share`, payload);
      
      console.log('📡 Share settings update response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Share settings updated successfully:', result);
        
        if (result.shareSlug) {
          const url = `${window.location.origin}/share/${result.shareSlug}`;
          console.log('🔗 Setting share URL:', url);
          setShareUrl(url);
        }
        toast({
          title: "Share settings updated",
          description: shareSettings.shareEnabled ? "Your CIM is now shareable!" : "Sharing has been disabled",
        });
      } else {
        const errorText = await response.text();
        console.error('❌ Share settings update failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Failed to update settings: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error updating share settings:', error);
      toast({
        title: "Error updating share settings",
        description: `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingShare(false);
    }
  };

  // NDA Templates Query - optimized to prevent duplicate requests
  const { data: ndaTemplatesData } = useQuery({
    queryKey: ['/api/nda-templates'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/nda-templates');
      if (!response.ok) throw new Error('Failed to fetch NDA templates');
      return response.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // NDA Signatures Query - optimized to prevent duplicate requests
  const { data: ndaSignaturesData } = useQuery({
    queryKey: [`/api/cim/${docId}/nda-signatures`],
    queryFn: async () => {
      if (!docId) return [];
      const response = await apiRequest('GET', `/api/cim/${docId}/nda-signatures`);
      if (!response.ok) throw new Error('Failed to fetch NDA signatures');
      return response.json();
    },
    enabled: !!docId,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  // Use React Query data directly instead of local state
  const ndaTemplates = ndaTemplatesData || [];
  const ndaSignatures = ndaSignaturesData || [];

  const uploadNdaTemplate = async () => {
    if (!newNdaTemplate.name || !newNdaTemplate.file) {
      toast({
        title: "Missing information",
        description: "Please provide a name and select a PDF file",
        variant: "destructive"
      });
      return;
    }

    setIsUploadingNda(true);
    try {
      const formData = new FormData();
      formData.append('name', newNdaTemplate.name);
      formData.append('ndaFile', newNdaTemplate.file);
      formData.append('isDefault', newNdaTemplate.isDefault.toString());

      const response = await fetch('/api/nda-templates', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast({
          title: "NDA template uploaded",
          description: "Your NDA template has been saved successfully"
        });
        setNewNdaTemplate({ name: '', file: null, isDefault: false });
        queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsUploadingNda(false);
    }
  };

  const deleteNdaTemplate = async (templateId: number) => {
    try {
      const response = await apiRequest('DELETE', `/api/nda-templates/${templateId}`);
      if (response.ok) {
        toast({
          title: "Template deleted",
          description: "NDA template has been removed"
        });
        queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
        // Reset selected template if it was deleted
        if (shareSettings.ndaTemplateId === templateId) {
          setShareSettings(prev => ({ ...prev, ndaTemplateId: null }));
        }
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const copyShareUrl = async () => {
    // If sharing is not enabled, automatically enable it
    if (!shareSettings.shareEnabled) {
      try {
        // Generate a new share slug
        const randomId = Math.random().toString(36).substring(2, 8);
        const newSlug = `cim-${randomId}`;
        const newShareUrl = `${window.location.origin}/share/${newSlug}`;
        
        // Update local state
        setShareSettings(prev => ({
          ...prev,
          shareEnabled: true,
          shareSlug: newSlug
        }));
        setShareUrl(newShareUrl);
        
        // Save to server
        if (docId) {
          await apiRequest('POST', `/api/cim/${docId}/share`, {
            shareEnabled: true,
            shareSlug: newSlug,
            sharePassword: shareSettings.sharePassword || null,
            shareExpiresAt: shareSettings.shareExpiresAt ? new Date(shareSettings.shareExpiresAt) : null,
            ndaProtected: shareSettings.ndaProtected,
            ndaTemplateId: shareSettings.ndaTemplateId
          });
        }
        
        // Copy the new URL
        navigator.clipboard.writeText(newShareUrl);
        toast({
          title: "Sharing enabled and link copied!",
          description: "Sharing has been automatically enabled and the link has been copied to your clipboard",
        });
      } catch (error) {
        console.error('Failed to enable sharing:', error);
        toast({
          title: "Error enabling sharing",
          description: "Failed to enable sharing. Please try again.",
          variant: "destructive"
        });
      }
    } else {
      // Normal copy operation when sharing is already enabled
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Share link copied!",
        description: "The link has been copied to your clipboard",
      });
    }
  };

  const generateEmbedCode = () => {
    if (!shareUrl) return '';
    
    const { width, height, border, responsive } = embedSettings;
    
    let iframe = `<iframe src="${shareUrl}" width="${width}" height="${height}px"`;
    
    if (!border) {
      iframe += ` style="border: none;"`;
    }
    
    iframe += ` frameborder="0" allowfullscreen></iframe>`;
    
    if (responsive && width === '100%') {
      return `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000;">
  ${iframe.replace(`height="${height}px"`, 'style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"')}
</div>`;
    }
    
    return iframe;
  };

  const copyEmbedCode = () => {
    const embedCode = generateEmbedCode();
    navigator.clipboard.writeText(embedCode);
    toast({
      title: "Embed code copied!",
      description: "The iframe code has been copied to your clipboard",
    });
  };

  // Fetch current share settings for the document
  const fetchShareSettings = async () => {
    if (!docId) {
      console.log('❌ fetchShareSettings: No docId provided');
      return;
    }
    
    console.log('🔍 Fetching share settings for document:', docId);
    setIsLoadingShareSettings(true);
    
    try {
      const response = await apiRequest('GET', `/api/cim/${docId}`);
      console.log('📡 Share settings response status:', response.status);
      
      if (response.ok) {
        const doc = await response.json();
        console.log('📋 Document data received:', {
          shareEnabled: doc.shareEnabled,
          shareSlug: doc.shareSlug,
          ndaProtected: doc.ndaProtected,
          ndaTemplateId: doc.ndaTemplateId
        });
        
        const newSettings = {
          shareEnabled: doc.shareEnabled || false,
          shareSlug: doc.shareSlug || '',
          sharePassword: doc.sharePassword || '',
          shareExpiresAt: doc.shareExpiresAt || '',
          customSlug: doc.shareSlug || '',
          ndaProtected: doc.ndaProtected || false,
          ndaTemplateId: doc.ndaTemplateId || null
        };
        
        console.log('🔄 Setting new share settings:', newSettings);
        setShareSettings(newSettings);
        
        // Set share URL if sharing is enabled
        if (doc.shareEnabled && doc.shareSlug) {
          const baseUrl = window.location.origin;
          const url = `${baseUrl}/share/${doc.shareSlug}`;
          console.log('🔗 Setting share URL:', url);
          setShareUrl(url);
        } else {
          console.log('🚫 No share URL to set (sharing disabled or no slug)');
          setShareUrl('');
        }
      } else {
        console.error('❌ Failed to fetch document:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching share settings:', error);
    } finally {
      setIsLoadingShareSettings(false);
    }
  };

  // Load share settings when component mounts with docId
  useEffect(() => {
    if (docId) {
      fetchShareSettings();
    }
  }, [docId]);

  // Load additional data when dialog opens
  useEffect(() => {
    if (isShareDialogOpen) {
      // Always refetch share settings when dialog opens to ensure current state
      fetchShareSettings();
      // React Query will automatically fetch the data when needed
    }
  }, [isShareDialogOpen]);

  // Auto-open share dialog when shouldOpenShareDialog is true
  useEffect(() => {
    if (shouldOpenShareDialog && setShouldOpenShareDialog) {
      setIsShareDialogOpen(true);
      setShouldOpenShareDialog(false);
    }
  }, [shouldOpenShareDialog, setShouldOpenShareDialog]);
  
  // Fetch Beaver Builder templates when credentials are available
  const fetchBeaverBuilderTemplates = async () => {
    const { wpUrl, username, password } = wordpressForm;
    
    if (!wpUrl || !username || !password) {
      toast({
        title: "Missing Credentials",
        description: "Please enter your WordPress site URL, username, and password first.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsFetchingTemplates(true);
      
      const response = await fetch("/api/wordpress/fetch-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wpUrl, username, password })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Check if the error response includes additional details
        if (errorData.details) {
          throw new Error(`${errorData.error || 'Failed to fetch templates'}\n\n${errorData.details}`);
        } else if (errorData.error) {
          throw new Error(errorData.error);
        } else {
          throw new Error('Failed to fetch templates');
        }
      }
      
      const { templates } = await response.json();
      
      if (!templates || templates.length === 0) {
        toast({
          title: "No Templates Found",
          description: "No Beaver Builder templates were found on your WordPress site.",
        });
        return;
      }
      
      setBeaverBuilderTemplates(templates);
      toast({
        title: "Templates Loaded",
        description: `Found ${templates.length} Beaver Builder templates.`,
      });
    } catch (error) {
      toast({
        title: "Failed to Fetch Templates",
        description: error instanceof Error ? error.message : "Could not connect to WordPress site",
        variant: "destructive"
      });
    } finally {
      setIsFetchingTemplates(false);
    }
  };

  const copyToClipboard = () => {
    try {
      const text = formatTextContent(analysis);
      
      // Browser-compatible clipboard copy using fallback methods
      copyTextToClipboard(text);
      
      toast({
        title: "Copied to clipboard",
        description: "The CIM content has been copied to your clipboard as plain text",
      });
    } catch (error) {
      console.error("Plain text clipboard error:", error);
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard. Please try a different browser or export option.",
        variant: "destructive"
      });
    }
  };
  
  // Cross-browser clipboard copy function
  const copyTextToClipboard = (text: string) => {
    // Try the modern Clipboard API first (works in most browsers)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(text);
        return;
      } catch (err) {
        console.warn("Clipboard API failed, trying fallback method", err);
      }
    }
    
    // Fallback method for browsers (especially Safari) that might have issues
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Make the textarea out of viewport to prevent visual glitches
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    
    // Select and copy
    textArea.focus();
    textArea.select();
    
    let successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (err) {
      console.error("execCommand error", err);
    }
    
    // Clean up
    document.body.removeChild(textArea);
    
    if (!successful) {
      throw new Error("Could not copy text");
    }
  };
  
  const copyHtmlToClipboard = async () => {
    try {
      // console.log("Starting HTML export for document ID:", docId);
      
      if (!docId) {
        throw new Error('Document ID is missing. Please ensure you have a valid document selected.');
      }
      
      // Create a dialog to show during export
      const exportDialog = document.createElement('div');
      exportDialog.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
      exportDialog.innerHTML = `
        <div class="bg-white p-4 rounded-md shadow-lg">
          <p class="text-lg font-medium">Preparing HTML export...</p>
          <div class="mt-2 animate-pulse">Processing document</div>
        </div>
      `;
      document.body.appendChild(exportDialog);
      
      const response = await fetch(`/api/cim/export/html/${docId}`, {
        method: 'POST',
        credentials: 'include'
      });

      // console.log("HTML export response status:", response.status);
      
      // Remove the dialog now that we've received a response
      document.body.removeChild(exportDialog);
      
      if (!response.ok) {
        // Try to get error details from the response
        let errorMessage = 'Failed to generate HTML content';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If we can't parse the error JSON, use the status text
          errorMessage = `Failed to generate HTML content (${response.status}: ${response.statusText})`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      // console.log("HTML export response received, has HTML:", Boolean(responseData.html));
      
      if (!responseData.html) {
        throw new Error('Server returned an empty HTML response');
      }
      
      // Copy HTML content using our cross-browser method
      copyTextToClipboard(responseData.html);
      
      toast({
        title: "HTML copied to clipboard",
        description: "HTML code has been copied. Paste it into a webpage, email, or any editor that accepts HTML to preserve formatting.",
      });
    } catch (error) {
      console.error("HTML clipboard export error:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to copy HTML to clipboard",
        variant: "destructive"
      });
    }
  };

  const downloadWord = async () => {
    setIsWordLoading(true);
    try {
      let response;
      
      if (isSharedView) {
        // Get share slug from current URL for shared exports
        const currentPath = window.location.pathname;
        const shareSlug = currentPath.split('/share/')[1];
        
        if (!shareSlug) {
          throw new Error('Share link not found');
        }
        
        response = await fetch(`/api/share/${shareSlug}/export/word`, {
          method: 'POST',
          credentials: 'include'
        });
      } else {
        response = await fetch(`/api/cim/export/word/${docId}`, {
          method: 'POST',
          credentials: 'include'
        });
      }

      if (!response.ok) {
        throw new Error('Failed to generate Word document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cim-${docId}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Word Document Downloaded",
        description: "Your CIM has been exported as a Word document",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export to Word",
        variant: "destructive"
      });
    } finally {
      setIsWordLoading(false);
    }
  };

  const downloadPdf = async () => {
    setIsPdfLoading(true);
    try {
      let response;
      
      if (isSharedView) {
        // Get share slug from current URL for shared exports
        const currentPath = window.location.pathname;
        const shareSlug = currentPath.split('/share/')[1];
        
        if (!shareSlug) {
          throw new Error('Share link not found');
        }
        
        response = await fetch(`/api/share/${shareSlug}/export/pdf`, {
          method: 'POST',
          credentials: 'include'
        });
      } else {
        response = await fetch(`/api/cim/export/pdf/${docId}`, {
          method: 'POST',
          credentials: 'include'
        });
      }

      if (!response.ok) {
        throw new Error('Failed to generate PDF document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cim-${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF Downloaded",
        description: "Your CIM has been exported as a PDF",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export to PDF",
        variant: "destructive"
      });
    } finally {
      setIsPdfLoading(false);
    }
  };

  const exportToGoogleDocs = async () => {
    try {
      const response = await fetch(`/api/cim/export/gdocs/${docId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.needsAuth) {
          // Redirect to Google OAuth flow
          const authResponse = await fetch('/api/auth/google');
          const { url } = await authResponse.json();
          window.location.href = url;
          return;
        }
        throw new Error(error.error || 'Failed to export to Google Docs');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export to Google Docs",
        variant: "destructive"
      });
    }
  };

  const exportToWordPress = async () => {
    try {
      setIsWordPressExporting(true);
      
      const { wpUrl, username, password, status, template, useToolsetFields } = wordpressForm;
      
      // Validate form
      if (!wpUrl || !username || !password) {
        throw new Error("Please fill in all required fields");
      }

      // Make the API request
      const response = await fetch(`/api/cim/export/wordpress/${docId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          wpUrl,
          username,
          password,
          status,
          template,
          useCustomField: true, // This indicates we want to use the custom field wpcf-text-dump
          useToolsetFields // Use Toolset fields for structured data
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Check if the error response includes additional details
        if (errorData.details) {
          throw new Error(`${errorData.error || 'Failed to export to WordPress'}\n\n${errorData.details}`);
        } else if (errorData.error) {
          throw new Error(errorData.error);
        } else {
          throw new Error('Failed to export to WordPress');
        }
      }

      const result = await response.json();
      
      toast({
        title: "WordPress Export Successful",
        description: `The document has been exported to WordPress as a ${status} post.${result.url ? ' View it on your site.' : ''}`,
      });

      if (result.url) {
        window.open(result.url, '_blank');
      }
      
      setIsWordPressDialogOpen(false);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export to WordPress",
        variant: "destructive"
      });
    } finally {
      setIsWordPressExporting(false);
    }
  };

  const canAccessPremiumFeatures = user?.isAdmin || user?.subscriptionStatus === "premium" || user?.subscriptionStatus === "admin";

  // Auto-trigger share dialog when autoTriggerShare is true
  useEffect(() => {
    if (autoTriggerShare && !isSharedView) {
      // Add slight delay to ensure proper state transition
      const timer = setTimeout(() => {
        setIsShareDialogOpen(true);
        onShareTriggered?.();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [autoTriggerShare, isSharedView, onShareTriggered]);

  return (
    <>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isUpdatingShare} data-share-trigger>
              {isUpdatingShare ? (
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              ) : isSharedView ? (
                <Download className="h-4 w-4 mr-2" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              {isUpdatingShare ? "Updating..." : isSharedView ? "Export" : "Share"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {isSharedView ? (
              // Shared view: Only show Word and PDF export options
              <>
                <DropdownMenuItem onClick={downloadWord} disabled={isWordLoading}>
                  {isWordLoading ? (
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  ) : (
                    <File className="h-4 w-4 mr-2 text-blue-600" />
                  )}
                  {isWordLoading ? "Generating Word..." : "Export to Word"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadPdf} disabled={isPdfLoading}>
                  {isPdfLoading ? (
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2 text-red-600" />
                  )}
                  {isPdfLoading ? "Generating PDF..." : "Export to PDF"}
                </DropdownMenuItem>
              </>
            ) : (
              // Regular view: Show all options
              <>
                <DropdownMenuItem onClick={copyShareUrl}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Share Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsShareDialogOpen(true)}>
                  <Link className="h-4 w-4 mr-2" />
                  Share Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  // Get document title from analysis or use fallback
                  const documentTitle = analysis?.story?.businessSummary ? 
                    `${analysis.story.businessSummary.slice(0, 50)}...` : 
                    `CIM Document #${docId}`;
                  
                  setEmailShareDialog({
                    open: true,
                    documentTitle,
                    shareToken: shareSettings.shareSlug || shareUrl.split('/').pop()
                  });
                }}>
                  <Mail className="h-4 w-4 mr-2" />
                  Share via Email
                </DropdownMenuItem>

                {canAccessPremiumFeatures && (
                  <>
                    <DropdownMenuItem onClick={downloadWord} disabled={isWordLoading}>
                      {isWordLoading ? (
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      ) : (
                        <File className="h-4 w-4 mr-2 text-blue-600" />
                      )}
                      {isWordLoading ? "Generating Word..." : "Export to Word"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadPdf} disabled={isPdfLoading}>
                      {isPdfLoading ? (
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2 text-red-600" />
                      )}
                      {isPdfLoading ? "Generating PDF..." : "Export to PDF"}
                    </DropdownMenuItem>

                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* WordPress Export Dialog */}
      <Dialog open={isWordPressDialogOpen} onOpenChange={setIsWordPressDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export to WordPress</DialogTitle>
            <DialogDescription>
              Enter your WordPress site details to export this CIM document as a "listing" post. 
              You need an Admin or Editor account with permission to create "listing" post types.
              Some WordPress sites may require an Application Password for API access.
            </DialogDescription>
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
              <h4 className="font-medium text-amber-800 mb-1">Important Requirements</h4>
              <ul className="list-disc pl-4 space-y-1 text-amber-800">
                <li>The WordPress site must have the REST API enabled</li>
                <li>A "listing" custom post type must be registered and accessible via the REST API</li>
                <li>Your user account must have permission to create posts</li>
                <li>For sites with Beaver Builder, templates will be automatically detected</li>
                <li>For structured data export, Toolset Types plugin must be installed with a "Listing Details" field group</li>
              </ul>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wp-url">WordPress Site URL</Label>
              <Input 
                id="wp-url" 
                placeholder="https://yourdomain.com" 
                value={wordpressForm.wpUrl}
                onChange={(e) => handleWordPressFormChange('wpUrl', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Enter the root URL starting with http:// or https:// (e.g., https://yourdomain.com)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wp-username">Username</Label>
                <Input 
                  id="wp-username" 
                  placeholder="admin" 
                  value={wordpressForm.username}
                  onChange={(e) => handleWordPressFormChange('username', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wp-password">Password or App Password</Label>
                <Input 
                  id="wp-password" 
                  type="password" 
                  placeholder="••••••••"
                  value={wordpressForm.password}
                  onChange={(e) => handleWordPressFormChange('password', e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For secure API access, use an <a href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Application Password</a> from your WordPress profile (Users → Profile → Application Passwords)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wp-status">Post Status</Label>
                <Select 
                  value={wordpressForm.status}
                  onValueChange={(value) => handleWordPressFormChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select post status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="publish">Published</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="wp-template">Listing Template</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button" 
                    onClick={fetchBeaverBuilderTemplates}
                    disabled={isFetchingTemplates || !wordpressForm.wpUrl || !wordpressForm.username || !wordpressForm.password}
                    className="text-xs h-7 px-2"
                  >
                    {isFetchingTemplates ? (
                      <LoadingAnimation size="sm" text="Loading..." />
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Load Templates
                      </>
                    )}
                  </Button>
                </div>
                <Select 
                  value={wordpressForm.template}
                  onValueChange={(value) => handleWordPressFormChange('template', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default WordPress Template</SelectItem>
                    {/* Regular WordPress templates */}
                    <SelectItem value="premium">Premium Template</SelectItem>
                    <SelectItem value="showcase">Showcase Template</SelectItem>
                    <SelectItem value="featured">Featured Template</SelectItem>
                    
                    {/* Beaver Builder templates */}
                    {beaverBuilderTemplates.length > 0 && (
                      <>
                        <SelectPrimitive.Separator className="my-1" />
                        <SelectPrimitive.Group>
                          <SelectPrimitive.Label className="px-2 py-1.5 text-sm font-semibold">
                            Beaver Builder Templates
                          </SelectPrimitive.Label>
                          {beaverBuilderTemplates.map(template => (
                            <SelectItem key={template.id} value={String(template.id)}>
                              {template.title}
                            </SelectItem>
                          ))}
                        </SelectPrimitive.Group>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Template applied to the listing in WordPress. Click "Load Templates" to fetch Beaver Builder templates from your site.
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Use Toolset Fields</h3>
                  <p className="text-xs text-muted-foreground">
                    Export structured CIM data to Toolset custom fields in WordPress
                  </p>
                </div>
                <Switch
                  checked={wordpressForm.useToolsetFields}
                  onCheckedChange={(checked) => handleWordPressFormChange('useToolsetFields', checked)}
                />
              </div>
              {wordpressForm.useToolsetFields && (
                <div className="mt-3 text-xs bg-blue-50 text-blue-800 p-3 rounded border border-blue-200">
                  <p className="font-medium mb-1">Fields Structure</p>
                  <p>
                    CIM data will be exported to corresponding Toolset fields in the "Listing Details" field group.
                    Make sure your WordPress site has Toolset Types plugin installed and properly configured.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex space-x-2 sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => setIsWordPressDialogOpen(false)}
              disabled={isWordPressExporting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={exportToWordPress}
              disabled={isWordPressExporting}
            >
              {isWordPressExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : 'Export to WordPress'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Share Dialog with NDA Protection */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] min-h-[500px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Share Your CIM</DialogTitle>
            <DialogDescription>
              Create and manage shareable links for your CIM document with optional NDA protection
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="share-settings" className="w-full flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="share-settings">Share Link Settings</TabsTrigger>
              <TabsTrigger value="nda-templates">NDA Templates</TabsTrigger>
              <TabsTrigger value="signatures">View Signatures</TabsTrigger>
              <TabsTrigger value="embed-code">Embed Code</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto mt-4 min-h-0">

            <TabsContent value="share-settings" className="space-y-6">
              {/* Basic Share Settings - Moved to Top */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    Share Link Settings
                  </CardTitle>
                  <CardDescription>
                    Configure your shareable link and access controls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="share-enabled">Enable Sharing</Label>
                    {isLoadingShareSettings ? (
                      <div className="w-11 h-6 bg-gray-200 rounded-full animate-pulse"></div>
                    ) : (
                      <Switch
                        id="share-enabled"
                        checked={shareSettings.shareEnabled}
                        onCheckedChange={(checked) => {
                          setShareSettings(prev => ({ ...prev, shareEnabled: checked }));
                          if (checked && !shareSettings.shareSlug && !shareSettings.customSlug) {
                            const randomId = Math.random().toString(36).substring(2, 8);
                            const newSlug = `cim-${randomId}`;
                            setShareSettings(prev => ({ ...prev, shareSlug: newSlug }));
                            setShareUrl(`${window.location.origin}/share/${newSlug}`);
                          }
                        }}
                      />
                    )}
                  </div>
            
            {shareSettings.shareEnabled && (
              <>
                {shareUrl && (
                  <div className="space-y-2">
                    <Label>Share Link</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={shareUrl}
                        readOnly
                        className="bg-gray-50"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyShareUrl}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="custom-slug">Custom URL (optional)</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">cimshare.com/share/</span>
                    <Input
                      id="custom-slug"
                      placeholder="my-business-name"
                      value={shareSettings.customSlug}
                      onChange={(e) => 
                        setShareSettings(prev => ({ ...prev, customSlug: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="share-password">Password Protection (optional)</Label>
                  <Input
                    id="share-password"
                    type="password"
                    placeholder="Enter password"
                    value={shareSettings.sharePassword}
                    onChange={(e) => 
                      setShareSettings(prev => ({ ...prev, sharePassword: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="share-expires">Expiration Date (optional)</Label>
                  <Input
                    id="share-expires"
                    type="date"
                    value={shareSettings.shareExpiresAt}
                    onChange={(e) => 
                      setShareSettings(prev => ({ ...prev, shareExpiresAt: e.target.value }))
                    }
                  />
                </div>

                {/* NDA Protection Section */}
                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-700">
                      <Users className="h-5 w-5" />
                      NDA Protection
                    </CardTitle>
                    <CardDescription>
                      Require viewers to sign an NDA before accessing the CIM
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="nda-enabled">Require NDA Signature</Label>
                      {isLoadingShareSettings ? (
                        <div className="w-11 h-6 bg-gray-200 rounded-full animate-pulse"></div>
                      ) : (
                        <Switch
                          id="nda-enabled"
                          checked={shareSettings.ndaProtected}
                          onCheckedChange={(checked) => 
                            setShareSettings(prev => ({ ...prev, ndaProtected: checked }))
                          }
                        />
                      )}
                    </div>

                    {shareSettings.ndaProtected && (
                      <div className="space-y-2">
                        <Label htmlFor="nda-template" className="text-red-600">
                          Select NDA Template *
                        </Label>
                        <Select
                          value={shareSettings.ndaTemplateId?.toString() || ""}
                          onValueChange={(value) => 
                            setShareSettings(prev => ({ 
                              ...prev, 
                              ndaTemplateId: value ? parseInt(value) : null 
                            }))
                          }
                        >
                          <SelectTrigger className={!shareSettings.ndaTemplateId ? "border-red-300" : ""}>
                            <SelectValue placeholder="Choose an NDA template (Required)" />
                          </SelectTrigger>
                          <SelectContent>
                            {ndaTemplates.map((template: any) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
                                {template.name} {template.isDefault && "(Default)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {ndaTemplates.length === 0 ? (
                          <p className="text-sm text-red-600">
                            No NDA templates found. Create one in the NDA Templates tab before enabling NDA protection.
                          </p>
                        ) : !shareSettings.ndaTemplateId ? (
                          <p className="text-sm text-red-600">
                            Please select an NDA template to enable NDA protection.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Embed Code Tab */}
            <TabsContent value="embed-code" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Embed Your CIM
                  </CardTitle>
                  <CardDescription>
                    Generate iframe code to embed your CIM document on any website
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!shareSettings.shareEnabled ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-800 text-sm">
                        Please enable sharing in the "Share Link Settings" tab first to generate embed code.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="embed-width">Width</Label>
                          <Select
                            value={embedSettings.width}
                            onValueChange={(value) => 
                              setEmbedSettings(prev => ({ ...prev, width: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="100%">100% (Responsive)</SelectItem>
                              <SelectItem value="800">800px</SelectItem>
                              <SelectItem value="1000">1000px</SelectItem>
                              <SelectItem value="1200">1200px</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="embed-height">Height</Label>
                          <Select
                            value={embedSettings.height}
                            onValueChange={(value) => 
                              setEmbedSettings(prev => ({ ...prev, height: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="400">400px</SelectItem>
                              <SelectItem value="600">600px</SelectItem>
                              <SelectItem value="800">800px</SelectItem>
                              <SelectItem value="1000">1000px</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="embed-border"
                            checked={embedSettings.border}
                            onCheckedChange={(checked) => 
                              setEmbedSettings(prev => ({ ...prev, border: checked }))
                            }
                          />
                          <Label htmlFor="embed-border">Show border</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="embed-responsive"
                            checked={embedSettings.responsive}
                            onCheckedChange={(checked) => 
                              setEmbedSettings(prev => ({ ...prev, responsive: checked }))
                            }
                          />
                          <Label htmlFor="embed-responsive">Responsive wrapper</Label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Embed Code</Label>
                        <div className="relative">
                          <textarea
                            value={generateEmbedCode()}
                            readOnly
                            className="w-full h-32 p-3 bg-gray-50 border rounded-md font-mono text-sm resize-none"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyEmbedCode}
                            className="absolute top-2 right-2"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Copy this code and paste it into any HTML page where you want to display your CIM.
                        </p>
                      </div>

                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">Embed Features</h4>
                        <ul className="list-disc pl-4 space-y-1 text-sm text-blue-700">
                          <li>Inherits all share settings (password protection, NDA requirements, expiration)</li>
                          <li>Responsive design adapts to different screen sizes</li>
                          <li>Secure iframe with proper security headers</li>
                          <li>Works on any website that allows iframe embeds</li>
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* NDA Templates Tab */}
            <TabsContent value="nda-templates" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upload New NDA Template</CardTitle>
                  <CardDescription>
                    Upload a PDF or Word document (.pdf, .docx, .doc) that will be used as the NDA template for viewers to sign. Word documents will be automatically converted to PDF.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nda-name">Template Name</Label>
                    <Input
                      id="nda-name"
                      placeholder="e.g., Standard Business NDA"
                      value={newNdaTemplate.name}
                      onChange={(e) => 
                        setNewNdaTemplate(prev => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nda-file">NDA Document File</Label>
                    <div className="relative">
                      <Input
                        id="nda-file"
                        type="file"
                        accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setNewNdaTemplate(prev => ({ ...prev, file }));
                        }}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supported formats: PDF, Word (.docx, .doc). Word documents will be converted to PDF automatically.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="nda-default"
                      checked={newNdaTemplate.isDefault}
                      onCheckedChange={(checked) => 
                        setNewNdaTemplate(prev => ({ ...prev, isDefault: checked }))
                      }
                    />
                    <Label htmlFor="nda-default">Set as default template</Label>
                  </div>

                  <Button 
                    onClick={uploadNdaTemplate}
                    disabled={isUploadingNda || !newNdaTemplate.name || !newNdaTemplate.file}
                    className="w-full"
                  >
                    {isUploadingNda ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload NDA Template
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Existing Templates */}
              <Card>
                <CardHeader>
                  <CardTitle>Existing NDA Templates</CardTitle>
                  <CardDescription>
                    Manage your uploaded NDA templates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ndaTemplates.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No NDA templates uploaded yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ndaTemplates.map((template: any) => (
                        <div key={template.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{template.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Created: {new Date(template.createdAt).toLocaleDateString()}
                              {template.isDefault && " • Default"}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteNdaTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Signatures Tab */}
            <TabsContent value="signatures" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    NDA Signatures
                  </CardTitle>
                  <CardDescription>
                    View all users who have signed the NDA for this CIM
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ndaSignatures.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No signatures yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium">Signed NDAs ({ndaSignatures.length})</h4>
                      </div>
                      
                      {/* Search functionality */}
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="Search by name or email..."
                          value={signatureSearchTerm}
                          onChange={(e) => setSignatureSearchTerm(e.target.value)}
                          className="mb-4"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        {ndaSignatures.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/cim/${docId}/nda-signatures/bulk-download`, {
                                  method: 'GET',
                                  credentials: 'include'
                                });
                                
                                if (response.ok) {
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `nda-signatures-${docId}.zip`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                  
                                  toast({
                                    title: "Download Started",
                                    description: "All signed NDAs are being downloaded as a ZIP file."
                                  });
                                } else {
                                  throw new Error('Failed to download NDAs');
                                }
                              } catch (error) {
                                toast({
                                  title: "Download Failed",
                                  description: "Failed to download signed NDAs. Please try again.",
                                  variant: "destructive"
                                });
                              }
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download All
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {ndaSignatures
                          .filter((signature: any) => {
                            if (!signatureSearchTerm) return true;
                            const searchLower = signatureSearchTerm.toLowerCase();
                            return signature.signerName.toLowerCase().includes(searchLower) || 
                                   signature.signerEmail.toLowerCase().includes(searchLower);
                          })
                          .map((signature: any) => (
                          <div key={signature.id} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex-1">
                              <div className="signature-handwriting text-lg mb-1">{signature.signerName}</div>
                              <p className="text-sm text-muted-foreground">{signature.signerEmail}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Signed: {new Date(signature.signedAt).toLocaleDateString()} • IP: {signature.signerIpAddress}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/cim/${docId}/nda-signatures/${signature.id}/download`, {
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
                                        description: `NDA for ${signature.signerName} is being downloaded.`
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
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            </div>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t bg-white flex-shrink-0">
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Close
            </Button>
            <Button 
              onClick={updateShareSettings}
              disabled={isUpdatingShare}
            >
              {isUpdatingShare ? "Updating..." : "Save Settings"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Share Dialog */}
      <EmailShareDialog
        open={emailShareDialog.open}
        onOpenChange={(open) => setEmailShareDialog({ open })}
        shareUrl={emailShareDialog.shareToken ? `${window.location.origin}/share/${emailShareDialog.shareToken}` : shareUrl}
        documentTitle={emailShareDialog.documentTitle || `CIM Document #${docId}`}
        senderName={user?.name}
      />
    </>
  );
}

function formatTextContent(analysis: any): string {
  return `
CONFIDENTIAL INFORMATION MEMORANDUM

BUSINESS OVERVIEW
================
Founded: ${analysis.story?.yearStarted || 'N/A'}
Structure: ${analysis.story?.businessStructure || 'N/A'}

${analysis.story?.businessSummary || analysis.story?.businessModel || 'N/A'}

INVESTMENT HIGHLIGHTS
===================
Key Attractions:
${analysis.executiveSummary?.buyerAttractions?.map((item: string) => `• ${item}`).join('\n') || 'N/A'}

Growth Opportunities:
${analysis.executiveSummary?.growthOpportunities?.map((item: string) => `• ${item}`).join('\n') || 'N/A'}

MARKET POSITION
=============
Target Market: ${analysis.marketAnalysis?.customerProfile || 'N/A'}

Competitors:
${analysis.marketAnalysis?.competitors?.map((item: string) => `• ${item}`).join('\n') || 'N/A'}

Business Strengths:
${analysis.marketAnalysis?.strengths?.map((item: string) => `• ${item}`).join('\n') || 'N/A'}

OPERATIONS
=========
Customer Relationships:
• Recurring Revenue: ${analysis.operations?.customers?.recurring || 'N/A'}
• Customer Base: ${analysis.operations?.customers?.relationships || 'N/A'}
• Revenue Concentration: ${analysis.operations?.customers?.concentration || 'N/A'}
• Contract Terms: ${analysis.operations?.customers?.contracts || 'N/A'}

Supply Chain:
• Number of Suppliers: ${analysis.operations?.suppliers?.count || 'N/A'}
• Supplier Terms: ${analysis.operations?.suppliers?.terms || 'N/A'}
• Concentration: ${analysis.operations?.suppliers?.concentration || 'N/A'}
• Transferability: ${analysis.operations?.suppliers?.transferability || 'N/A'}

TEAM STRUCTURE
=============
• Owner Responsibilities: ${analysis.team?.ownerResponsibilities || 'N/A'}
• Required Hours: ${analysis.team?.ownerHours || 'N/A'}
• Management Structure: ${analysis.team?.management || 'N/A'}
• Team Size: ${analysis.team?.employeeCount || 'N/A'}
• Turnover Rate: ${analysis.team?.turnover || 'N/A'}
• Retention: ${analysis.team?.retention || 'N/A'}

FACILITIES
=========
• Ownership Status: ${analysis.facility?.ownership || 'N/A'}
• Size: ${analysis.facility?.size || 'N/A'}
• Monthly Cost: ${analysis.facility?.cost || 'N/A'}
${analysis.facility?.leaseDetails ? `• Lease Details: ${analysis.facility.leaseDetails}` : ''}
`.trim();
}

function generateHtml(analysis: any): string {
  // HTML generation for export - simplified to avoid JSX conflicts
  return "HTML content generated for export";
}