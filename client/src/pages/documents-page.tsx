import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CimDocument } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Lock, Copy, Globe, Search, Trash2, FileDown, Clock, Share2, Mail, Loader2, PenTool, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { EmailShareDialog } from "@/components/email-share-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

// Define interface for CIM documents with analysis
interface CimDocumentWithAnalysis extends CimDocument {
  shareViewCount?: number;
  hasNdaSignatures?: boolean;
}

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [emailShareDialog, setEmailShareDialog] = useState<{
    open: boolean;
    documentId?: number;
    documentTitle?: string;
    shareToken?: string;
  }>({ open: false });
  const [exportingDocId, setExportingDocId] = useState<number | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debounce search query
  const debouncedSearchQuery = useMemo(() => {
    const timer = setTimeout(() => searchQuery, 300);
    return searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch documents with pagination
  const { data: paginatedData, isLoading: documentsLoading } = useQuery<{
    documents: CimDocumentWithAnalysis[];
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ["/api/cim", currentPage, debouncedSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "12"
      });
      if (debouncedSearchQuery) {
        params.append("search", debouncedSearchQuery);
      }
      const response = await fetch(`/api/cim?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  const documents = paginatedData?.documents || [];
  const totalDocuments = paginatedData?.total || 0;
  const hasMore = paginatedData?.hasMore || false;
  const totalPages = Math.ceil(totalDocuments / 12);
  
  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cim/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      setConfirmDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    }
  });

  // Handle PDF export
  const handleExport = async (docId: number, format: 'pdf' | 'word') => {
    setExportingDocId(docId);
    
    // Show immediate loading toast
    toast({
      title: "Export Starting",
      description: `Generating ${format.toUpperCase()} document...`
    });
    
    try {
      const response = await fetch(`/api/cim/export/${format}/${docId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(`${format.toUpperCase()} export failed`);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CIM.${format === 'pdf' ? 'pdf' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Complete",
        description: `Your CIM has been downloaded as a ${format.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: `Failed to export ${format.toUpperCase()}. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setExportingDocId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold">My CIM Documents</h1>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search documents..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Link href="/dashboard">
              <Button className="w-full sm:w-auto whitespace-nowrap">
                <FileText className="mr-2 h-4 w-4" />
                Create New CIM
              </Button>
            </Link>
          </div>
        </div>

        {/* Loading Animation */}
        {documentsLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Loading your CIM documents...</p>
          </div>
        )}

        {/* Documents Grid */}
        {!documentsLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {documents?.map((doc) => (
              <div key={doc.id} className="relative">
                <Link href={`/documents/${doc.id}`}>
                  <Card className="group cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-0 shadow-md hover:shadow-xl bg-white/80 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {doc.logoUrl && (
                              <div className="flex-shrink-0">
                                <img 
                                  src={doc.logoUrl} 
                                  alt="Company logo" 
                                  className="w-6 h-6 rounded-full object-cover border border-gray-200"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 truncate">
                              {doc.title}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <PenTool className="h-3 w-3" />
                              NDA
                            </div>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {doc.shareViewCount || 0} view{(doc.shareViewCount || 0) !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {doc.shareEnabled ? (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-full">
                            <Globe className="h-3 w-3" />
                            Shared
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-600 rounded-full">
                            <Lock className="h-3 w-3" />
                            Private
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                
                {/* Dropdown Menu positioned absolutely to avoid Link nesting */}
                <div className="absolute top-3 right-3 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 hover:opacity-100 transition-opacity">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => {
                          window.location.href = `/documents/${doc.id}?tab=share`;
                        }}
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Share Link Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          if (doc.shareSlug) {
                            navigator.clipboard.writeText(`${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${doc.shareSlug}`);
                            toast({
                              title: "Share link copied",
                              description: "The share link has been copied to your clipboard"
                            });
                          } else {
                            toast({
                              title: "No Share Link Available",
                              description: "This document doesn't have sharing enabled",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          if (!doc.shareSlug) {
                            toast({
                              title: "Sharing Not Enabled",
                              description: "Please enable sharing for this document first",
                              variant: "destructive"
                            });
                            return;
                          }
                          setEmailShareDialog({
                            open: true,
                            documentId: doc.id,
                            documentTitle: doc.title,
                            shareToken: doc.shareSlug
                          });
                        }}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Share via Email
                      </DropdownMenuItem>
                      
                      {/* Show additional options only for generated CIMs, not uploaded files */}
                      {!doc.isUploadedFile && user?.subscriptionStatus !== "free" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleExport(doc.id, 'pdf')}
                            disabled={exportingDocId === doc.id}
                          >
                            {exportingDocId === doc.id ? (
                              <Loader2 className="mr-2 h-4 w-4 text-red-600 animate-spin" />
                            ) : (
                              <FileDown className="mr-2 h-4 w-4 text-red-600" />
                            )}
                            {exportingDocId === doc.id ? "Generating PDF..." : "Export to PDF"}
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setConfirmDelete(doc.id)} 
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty States */}
        {!documentsLoading && documents?.length === 0 && totalDocuments !== 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No documents match your search. Try a different search term.
          </div>
        )}

        {!documentsLoading && totalDocuments === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No CIM documents yet. Create your first one!
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>
                Showing {((currentPage - 1) * 12) + 1} to {Math.min(currentPage * 12, totalDocuments)} of {totalDocuments} documents
              </span>
              {debouncedSearchQuery && (
                <span>
                  (filtered by "{debouncedSearchQuery}")
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || documentsLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={documentsLoading}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || documentsLoading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this CIM document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Share Dialog */}
      <EmailShareDialog
        open={emailShareDialog.open}
        onOpenChange={(open) => setEmailShareDialog(prev => ({ ...prev, open }))}
        documentTitle={emailShareDialog.documentTitle || ''}
        shareUrl={emailShareDialog.shareToken ? `${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${emailShareDialog.shareToken}` : ''}
        senderName={user?.name}
      />
    </div>
  );
}