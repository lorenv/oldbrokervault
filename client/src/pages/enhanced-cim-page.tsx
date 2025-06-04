import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnhancedCimDisplay } from "@/components/enhanced-cim-display";
import { DocumentExport } from "@/components/document-export";
import { EmailShareDialog } from "@/components/email-share-dialog";
import { ArrowLeft, Share2, Download } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function EnhancedCimPage() {
  const { id } = useParams<{ id: string }>();
  const [showShareDialog, setShowShareDialog] = useState(false);

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
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/cims">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to CIMs
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{cimDocument.title}</h1>
        </div>
        <div className="flex gap-2">
          <DocumentExport 
            analysis={cimDocument.analysis} 
            title={cimDocument.title}
            docId={parseInt(id!)}
            logoUrl={cimDocument.logoUrl}
            selectedImages={cimDocument.selectedImages}
            websiteUrl={cimDocument.websiteUrl}
            cimDocument={cimDocument}
          />
        </div>
      </div>

      {/* Enhanced CIM Display */}
      <EnhancedCimDisplay
        analysis={cimDocument.analysis}
        docId={parseInt(id!)}
        logoUrl={cimDocument.logoUrl}
        selectedImages={cimDocument.selectedImages}
        websiteUrl={cimDocument.websiteUrl}
        title={cimDocument.title}
        isSharedView={false}
        cimDocument={cimDocument}
      />

      {/* Share Dialog */}
      {showShareDialog && (
        <EmailShareDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          docId={parseInt(id!)}
        />
      )}
    </div>
  );
}