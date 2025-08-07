import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";

import { UploadModal } from "@/components/document/upload-modal";
import { PostUploadDialog } from "@/components/document/post-upload-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  FileText, 
  Search, 
  Filter,
  Download,
  Eye,
  MoreHorizontal,
  Copy,
  Mail,
  XCircle,
  Trash2
} from "lucide-react";
import type { Document } from "@shared/schema";

export default function Documents() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPostUploadDialog, setShowPostUploadDialog] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle URL parameters for filtering
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    if (filterParam) {
      setStatusFilter(filterParam);
    }
  }, [location]);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  // Get current user info
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  // Get recipients for all documents to check action required
  const { data: allRecipients = [] } = useQuery<any[]>({
    queryKey: ["/api/recipients"],
    enabled: !!user,
  });

  // Filter and sort documents
  const filteredDocuments = documents
    .filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           doc.originalFileName.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesStatus = false;
      if (statusFilter === "all") {
        matchesStatus = true;
      } else if (statusFilter === "action-required") {
        // Action required means documents where current user is a recipient with pending signature
        if (!user) {
          matchesStatus = false;
        } else {
          const docRecipients = allRecipients.filter((r: any) => r.documentId === doc.id);
          const userAsRecipient = docRecipients.find((r: any) => r.email === (user as any)?.email);
          matchesStatus = userAsRecipient && userAsRecipient.status === "pending";
        }
      } else if (statusFilter === "waiting-for-others") {
        matchesStatus = doc.status === "sent";
      } else {
        matchesStatus = doc.status === statusFilter;
      }
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "sent": return "bg-blue-100 text-blue-800";
      case "completed": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "draft": return "Draft";
      case "sent": return "Waiting for others";
      case "completed": return "Completed";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Action handlers
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/documents/${documentId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document deleted",
        description: "The document has been permanently deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const voidDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/documents/${documentId}/void`, 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document voided",
        description: "The document has been voided and can no longer be signed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to void document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/documents/${documentId}/resend`, 'POST', {});
    },
    onSuccess: () => {
      toast({
        title: "Invitations resent",
        description: "Signing invitations have been sent to all pending recipients.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resend invitations. Please try again.",
        variant: "destructive",
      });
    },
  });

  const duplicateDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/documents/${documentId}/duplicate`, 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document duplicated",
        description: "A copy of the document has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to duplicate document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleView = (documentId: number) => {
    window.open(`/document/${documentId}`, '_blank');
  };

  const handleDownload = async (documentId: number, title: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download started",
        description: "The document is being downloaded.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCardClick = (documentId: number, event: React.MouseEvent) => {
    // Don't navigate if clicking on buttons
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    window.location.href = `/document/${documentId}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-6 h-auto md:h-[89px] flex items-center justify-center">
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full max-w-7xl gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Documents</h1>
            <p className="text-sm text-slate-500 mt-1 hidden sm:block">
              Manage your signature documents and track their progress
            </p>
          </div>
          <div className="shrink-0">
            <Button 
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Document
            </Button>
          </div>
        </div>
      </header>

        {/* Search and Filters */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex justify-center">
          <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4 w-full max-w-7xl">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="action-required">Action Required</SelectItem>
                  <SelectItem value="waiting-for-others">Waiting for others</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <main className="flex-1 overflow-auto p-4 md:p-8 flex justify-center">
          <div className="w-full max-w-7xl">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="h-5 bg-slate-200 rounded w-1/3 mb-2"></div>
                        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="h-8 w-8 bg-slate-200 rounded"></div>
                        <div className="h-8 w-8 bg-slate-200 rounded"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {searchQuery || statusFilter !== "all" ? "No documents found" : "No documents yet"}
              </h3>
              <p className="text-slate-600 mb-6">
                {searchQuery || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Upload your first document to get started"}
              </p>
              {!(searchQuery || statusFilter !== "all") && (
                <Button 
                  onClick={() => setShowUploadModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((document) => (
                <Card 
                  key={document.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer border-slate-200 hover:border-slate-300"
                  onClick={(e) => handleCardClick(document.id, e)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 hover:text-blue-600 transition-colors text-lg line-clamp-1">
                              {document.title}
                            </h3>
                            <p className="text-sm text-slate-600 line-clamp-1 mt-1">
                              {document.originalFileName}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Badge className={getStatusColor(document.status)}>
                              {getStatusText(document.status)}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-slate-500">
                            <span>{formatDate(document.createdAt.toString())}</span>
                            <span className="flex items-center">
                              <FileText className="h-4 w-4 mr-1" />
                              {document.pageCount} pages
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleView(document.id);
                              }}
                              title="View document"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {document.status === "completed" && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(document.id, document.title);
                                }}
                                title="Download completed document"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => e.stopPropagation()}
                                  title="More actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateDocumentMutation.mutate(document.id);
                                  }}
                                  disabled={duplicateDocumentMutation.isPending}
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                
                                {document.status === "sent" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        resendDocumentMutation.mutate(document.id);
                                      }}
                                      disabled={resendDocumentMutation.isPending}
                                    >
                                      <Mail className="h-4 w-4 mr-2" />
                                      Resend invitations
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        voidDocumentMutation.mutate(document.id);
                                      }}
                                      disabled={voidDocumentMutation.isPending}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Void document
                                    </DropdownMenuItem>
                                  </>
                                )}
                                
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
                                      deleteDocumentMutation.mutate(document.id);
                                    }
                                  }}
                                  disabled={deleteDocumentMutation.isPending}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          </div>
        </main>

        {/* Upload Modal */}
        <UploadModal
          open={showUploadModal}
          onOpenChange={setShowUploadModal}
          onUploadSuccess={(document: Document) => {
            setUploadedDocument(document);
            setShowUploadModal(false);
            setShowPostUploadDialog(true);
          }}
        />

        {/* Post Upload Dialog */}
        {uploadedDocument && (
          <PostUploadDialog
            isOpen={showPostUploadDialog}
            onClose={() => {
              setShowPostUploadDialog(false);
              setUploadedDocument(null);
            }}
            documentId={uploadedDocument.id}
            documentTitle={uploadedDocument.title}
          />
        )}
    </div>
  );
}