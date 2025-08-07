import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
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
  ChevronDown
} from "lucide-react";
import type { Document } from "@shared/schema";

export default function Dashboard() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPostUploadDialog, setShowPostUploadDialog] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<Document | null>(null);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  // Calculate status counts
  const actionRequired = documents.filter(doc => doc.status === "draft").length;
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
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-8">
          {/* Status Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mr-4">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-1">Action required</div>
                    <div className="text-3xl font-bold text-slate-900">{actionRequired}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mr-4">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-1">Waiting for others</div>
                    <div className="text-3xl font-bold text-slate-900">{waitingForOthers}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mr-4">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-1">Signed</div>
                    <div className="text-3xl font-bold text-slate-900">{signed}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload Area */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div 
                className="border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <p className="text-slate-700 text-lg mb-2">Drag and drop files here to start, or</p>
                <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50">
                  Upload
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent activity</CardTitle>
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
                          {formatDate(doc.createdAt)} @ {formatTime(doc.createdAt)}
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
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={(document: Document) => {
            setUploadedDocument(document);
            setShowUploadModal(false);
            setShowPostUploadDialog(true);
          }}
        />

        {/* Post Upload Dialog */}
        <PostUploadDialog
          isOpen={showPostUploadDialog}
          onClose={() => setShowPostUploadDialog(false)}
          document={uploadedDocument}
        />
      </div>
    </div>
  );
}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No documents yet</h3>
              <p className="text-slate-500 mb-6">Get started by uploading your first document</p>
              <Button 
                onClick={() => setShowUploadModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((document) => (
                <Card key={document.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Link href={`/document/${document.id}`}>
                            <h3 className="text-lg font-medium text-slate-900 hover:text-blue-600 cursor-pointer">
                              {document.title}
                            </h3>
                          </Link>
                          <Badge className={getStatusColor(document.status)}>
                            {document.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-6 text-sm text-slate-500">
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-1" />
                            {document.pageCount} pages
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            Created {formatDate(document.createdAt.toString())}
                          </div>
                          <span className="text-slate-400">•</span>
                          <span>{document.originalFileName}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Link href={`/document/${document.id}`}>
                          <Button variant="outline" size="sm">
                            {document.status === "draft" ? "Edit" : "View"}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <UploadModal 
        open={showUploadModal} 
        onOpenChange={setShowUploadModal}
        onUploadSuccess={(document: Document) => {
          setUploadedDocument(document);
          setShowUploadModal(false);
          setShowPostUploadDialog(true);
        }}
      />

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
