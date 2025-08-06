import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnhancedCimDisplay } from "@/components/enhanced-cim-display";
import { DocumentExport } from "@/components/document-export";
import { EmailShareDialog } from "@/components/email-share-dialog";
import { CimEditTour, useCimEditTour } from "@/components/cim-edit-tour";
import { ArrowLeft, Share2, Download, ExternalLink, Copy, Mail, FileDown, Settings, Menu, X, Edit3, Save, Plus } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export default function EnhancedCimPage() {
  const { id } = useParams<{ id: string }>();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [emailShareDialog, setEmailShareDialog] = useState({ open: false, documentTitle: "", shareToken: "" });
  const [isMobileEditSidebarOpen, setIsMobileEditSidebarOpen] = useState(false);
  const { toast } = useToast();
  const { shouldShowTour, completeTour } = useCimEditTour();

  const { data: cimDocument, isLoading } = useQuery({
    queryKey: ['/api/cim', parseInt(id!)],
    queryFn: async () => {
      const response = await fetch(`/api/cim/${id}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch CIM document');
      return response.json();
    },
    enabled: !!id
  });

  // Helper functions for sharing
  const copyShareUrl = async () => {
    if (!cimDocument?.shareEnabled || !cimDocument?.shareSlug) {
      toast({
        title: "Sharing Not Enabled",
        description: "Please enable sharing in the share settings first.",
        variant: "destructive"
      });
      return;
    }
    const shareUrl = `${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${cimDocument.shareSlug}`;
    await navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Share Link Copied",
      description: "The share link has been copied to your clipboard"
    });
  };

  const openSharePage = () => {
    if (!cimDocument?.shareEnabled || !cimDocument?.shareSlug) {
      toast({
        title: "Sharing Not Enabled",
        description: "Please enable sharing in the share settings first.",
        variant: "destructive"
      });
      return;
    }
    const shareUrl = `${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${cimDocument.shareSlug}`;
    window.open(shareUrl, '_blank');
  };

  const handleEmailShare = () => {
    if (!cimDocument?.shareEnabled || !cimDocument?.shareSlug) {
      toast({
        title: "Sharing Not Enabled",
        description: "Please enable sharing in the share settings first.",
        variant: "destructive"
      });
      return;
    }
    setEmailShareDialog({
      open: true,
      documentTitle: cimDocument?.title || `CIM Document #${id}`,
      shareToken: cimDocument.shareSlug
    });
  };

  const downloadPdf = async () => {
    try {
      const response = await fetch(`/api/cim/export/pdf/${id}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cimDocument?.title || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF Downloaded",
        description: "Your CIM has been exported as a PDF"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export to PDF",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!cimDocument) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
            <p className="text-gray-600 mb-4">The CIM document you're looking for doesn't exist.</p>
            <Link href="/cims">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to CIMs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Mobile Edit Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out
        ${isMobileEditSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:hidden
      `}>
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-lg font-semibold text-gray-800">Edit CIM</h2>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsMobileEditSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto h-full pb-20">
          {/* Quick Actions */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start" 
              onClick={downloadPdf}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
              onClick={() => {
                setShowShareDialog(true);
                setIsMobileEditSidebarOpen(false);
              }}
            >
              <Settings className="h-4 w-4 mr-2" />
              Share Settings
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
              onClick={() => {
                copyShareUrl();
                setIsMobileEditSidebarOpen(false);
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Share Link
            </Button>
          </div>

          {/* Editing Tips */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Editing Tips</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Tap any text to edit</li>
              <li>• Drag sections to reorder</li>
              <li>• Save happens automatically</li>
              <li>• Delete sections with trash icon</li>
            </ul>
          </div>

          {/* Section Management */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Section Management</h3>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Section
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Edit Overlay */}
      {isMobileEditSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileEditSidebarOpen(false)}
        />
      )}

      {/* Mobile Floating Edit Button */}
      <Button
        className="fixed bottom-6 right-6 z-30 lg:hidden shadow-xl bg-blue-600 hover:bg-blue-700 rounded-full h-14 w-14 p-0"
        onClick={() => setIsMobileEditSidebarOpen(true)}
      >
        <Edit3 className="h-6 w-6 text-white" />
      </Button>

      <div className="container mx-auto p-4 lg:p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/documents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to CIMs</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
          
          <h1 className="text-xl lg:text-2xl font-bold text-center flex-1 px-2">{cimDocument.title}</h1>
          
          {/* Desktop Controls */}
          <div className="hidden lg:flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-tour="share-button">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Share Link Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyShareUrl}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Share Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleEmailShare}>
                  <Mail className="h-4 w-4 mr-2" />
                  Share via Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadPdf} data-tour="export-button">
                  <FileDown className="h-4 w-4 mr-2" />
                  Export to PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="default" onClick={openSharePage}>
              <ExternalLink className="h-4 w-4 mr-2" />
              <span className="hidden xl:inline">View Share Link</span>
              <span className="xl:hidden">View</span>
            </Button>
          </div>

          {/* Mobile Menu */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openSharePage}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Share Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyShareUrl}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Share Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadPdf}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Enhanced CIM Display */}
        <div className="cim-document-container pb-20 lg:pb-0">
          <EnhancedCimDisplay
            analysis={cimDocument.analysis}
            docId={parseInt(id!)}
            logoUrl={cimDocument.logoUrl}
            selectedImages={cimDocument.selectedImages}
            websiteUrl={cimDocument.websiteUrl}
            isSharedView={false}
            cimDocument={cimDocument}
          />
        </div>
      </div>

      {/* CIM Edit Tour for first-time users */}
      <CimEditTour 
        isFirstTime={shouldShowTour}
        onComplete={completeTour}
      />

      {/* Comprehensive Share Dialog */}
      <DocumentExport
        analysis={cimDocument.analysis}
        docId={parseInt(id!)}
        autoTriggerShare={showShareDialog}
        onShareTriggered={() => setShowShareDialog(false)}
        isSharedView={false}
        websiteUrl={cimDocument.websiteUrl}
        logoUrl={cimDocument.logoUrl}
        selectedImages={cimDocument.selectedImages}
      />

      {/* Email Share Dialog */}
      <EmailShareDialog
        open={emailShareDialog.open}
        onOpenChange={(open) => setEmailShareDialog(prev => ({ ...prev, open }))}
        documentTitle={emailShareDialog.documentTitle}
        shareUrl={emailShareDialog.shareToken ? `${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${emailShareDialog.shareToken}` : ''}
      />
    </div>
  );
}