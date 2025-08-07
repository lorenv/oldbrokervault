import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { UploadModal } from "@/components/document/upload-modal";
import { PostUploadDialog } from "@/components/document/post-upload-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Download,
  ChevronDown,
  Edit
} from "lucide-react";
import type { Document } from "@shared/schema";

export default function Dashboard() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPostUploadDialog, setShowPostUploadDialog] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<Document | null>(null);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  // Get current user info
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  // Get recipients for all documents to check action required
  const { data: allRecipients = [] } = useQuery({
    queryKey: ["/api/recipients"],
    enabled: !!user,
  });

  // Calculate status counts
  // Action required = documents where current user is a recipient with pending signature
  const actionRequired = documents.filter(doc => {
    if (!user || !allRecipients) return false;
    const docRecipients = (allRecipients as any[]).filter((r: any) => r.documentId === doc.id);
    const userAsRecipient = docRecipients.find((r: any) => r.email === (user as any).email);
    return userAsRecipient && userAsRecipient.status === "pending";
  }).length;
  const waitingForOthers = documents.filter(doc => doc.status === "sent").length;
  const signed = documents.filter(doc => doc.status === "completed").length;

  // Get recent documents (last 5)
  const recentDocuments = documents
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "draft": return "Action required";
      case "sent": return "Waiting for others";
      case "completed": return "Completed";
      default: return status;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="glass-card border-none px-8 py-6 h-[89px] flex items-center paper-shadow">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-ink-violet to-document-gray-dark bg-clip-text text-transparent">Dashboard</h1>
      </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-8 ink-flow document-texture">
          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <Link to="/documents?filter=action-required">
              <Card className="glass-card ink-ripple hover:scale-105 transition-all duration-300 cursor-pointer group">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 signature-gradient rounded-2xl mr-3 sm:mr-4 flex-shrink-0 group-hover:animate-floating">
                      <Edit className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm text-document-gray-dark/70 mb-1">Action required</div>
                      <div className="text-2xl sm:text-3xl font-bold text-ink-violet-dark">{actionRequired}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/documents?filter=waiting-for-others">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm text-slate-600 mb-1">Waiting for others</div>
                      <div className="text-2xl sm:text-3xl font-bold text-slate-900">{waitingForOthers}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/documents?filter=completed">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
                      <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm text-slate-600 mb-1">Signed</div>
                      <div className="text-2xl sm:text-3xl font-bold text-slate-900">{signed}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Upload Area */}
          <Card className="mb-8">
            <CardContent className="p-4 sm:p-8">
              <div 
                className="border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-lg p-8 sm:p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mx-auto mb-3 sm:mb-4" />
                <p className="text-slate-700 text-base sm:text-lg mb-2">Drag and drop files here to start, or</p>
                <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50">
                  Upload
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">Recent activity</CardTitle>
              <Link to="/documents">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentDocuments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No documents yet. Upload your first document to get started!</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {recentDocuments.map((doc, index) => (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between py-4 ${
                        index !== recentDocuments.length - 1 ? 'border-b border-slate-100' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <Link to={`/document/${doc.id}`} className="hover:text-blue-600 transition-colors">
                          <div className="font-medium text-slate-900 mb-1">{doc.title}</div>
                        </Link>
                        <div className="text-sm text-slate-500">{getStatusText(doc.status)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-600">
                          {formatDate(doc.createdAt.toString())} @ {formatTime(doc.createdAt.toString())}
                        </div>
                        <Button variant="ghost" size="sm" className="mt-1 h-8 w-8 p-0">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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