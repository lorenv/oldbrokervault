import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Edit, FileSignature, Share2, Eye, Users, Calendar, TrendingUp } from "lucide-react";
import { useCimDocument, useFinancialFiles, useCustomSections, useNdaSignatures } from "@/hooks/use-cim-document";
import { DocumentSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CimDisplay } from "@/components/cim-display";
import { DocumentExport } from "@/components/document-export";

// Tab Components
import { DocumentAnalyticsTab } from "@/components/document-tabs/analytics-tab";
import { DocumentEditTab } from "@/components/document-tabs/edit-tab";
import { DocumentNdaTab } from "@/components/document-tabs/nda-tab";
import { DocumentShareTab } from "@/components/document-tabs/share-tab";

export function DocumentDetailPage() {
  const [matched, params] = useRoute('/documents/:id');
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const docId = params?.id ? parseInt(params.id) : undefined;
  
  // Get current tab from URL or default to analytics
  const urlTab = new URLSearchParams(window.location.search).get('tab') || 'analytics';
  const [activeTab, setActiveTab] = useState(urlTab);
  
  // Fetch document data
  const { data: cimDocument, isLoading: docLoading, error: docError } = useCimDocument(docId, !!docId);
  const { data: financialFiles } = useFinancialFiles(docId, !!docId);
  const { data: customSections } = useCustomSections(docId, !!docId);
  const { data: ndaSignatures } = useNdaSignatures(docId, !!docId);
  
  // Update URL when tab changes
  useEffect(() => {
    if (docId) {
      const newUrl = `/documents/${docId}${activeTab !== 'analytics' ? `?tab=${activeTab}` : ''}`;
      if (window.location.pathname + window.location.search !== newUrl) {
        window.history.replaceState(null, '', newUrl);
      }
    }
  }, [activeTab, docId]);
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  if (!matched || !docId) {
    setLocation('/documents');
    return null;
  }
  
  if (docLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
          </div>
          <DocumentSkeleton />
        </main>
      </div>
    );
  }
  
  if (docError || !cimDocument) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
              <p className="text-gray-600 mb-4">The CIM document you're looking for doesn't exist or you don't have access to it.</p>
              <Link href="/documents">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Documents
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  
  // Ensure user owns the document
  if (cimDocument.userId !== user?.id) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">You don't have permission to view this document.</p>
              <Link href="/documents">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Documents
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{cimDocument.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={cimDocument.shareEnabled ? "default" : "secondary"}>
                  {cimDocument.shareEnabled ? "Shared" : "Private"}
                </Badge>
                {cimDocument.ndaProtected && (
                  <Badge variant="outline">
                    <FileSignature className="h-3 w-3 mr-1" />
                    NDA Protected
                  </Badge>
                )}
                {ndaSignatures && ndaSignatures.length > 0 && (
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {ndaSignatures.length} Signature{ndaSignatures.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Created {new Date(cimDocument.createdAt).toLocaleDateString()}
          </div>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit CIM
            </TabsTrigger>
            <TabsTrigger value="nda" className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              NDA Signatures
            </TabsTrigger>
            <TabsTrigger value="share" className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Share CIM
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="analytics" className="mt-6">
            <DocumentAnalyticsTab 
              cimDocument={cimDocument}
              ndaSignatures={ndaSignatures || []}
            />
          </TabsContent>
          
          <TabsContent value="edit" className="mt-6">
            <DocumentEditTab 
              cimDocument={cimDocument}
              financialFiles={financialFiles || []}
              customSections={customSections || []}
            />
          </TabsContent>
          
          <TabsContent value="nda" className="mt-6">
            <DocumentNdaTab 
              cimDocument={cimDocument}
              ndaSignatures={ndaSignatures || []}
            />
          </TabsContent>
          
          <TabsContent value="share" className="mt-6">
            <DocumentShareTab 
              cimDocument={cimDocument}
              user={user}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}