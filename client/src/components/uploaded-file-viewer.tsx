import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, User, Phone, Mail, Building, Archive, Eye } from "lucide-react";
import JSZip from 'jszip';

interface UploadedFileViewerProps {
  cimDocument: any;
  shareSlug: string;
  userProfile: any;
  uploadedFiles: any[];
}

export function UploadedFileViewer({ cimDocument, shareSlug, userProfile, uploadedFiles }: UploadedFileViewerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [selectedFileForViewing, setSelectedFileForViewing] = useState<string | null>(null);

  // Map the uploaded files to the expected format
  const files = (uploadedFiles || []).map(file => ({
    id: file.id,
    name: file.fileName,
    mimeType: file.mimeType,
    size: file.fileSize,
    url: `/api/share/${shareSlug}/download/${file.id}`
  }));

  const isPdf = files.length === 1 && files[0]?.mimeType === 'application/pdf';
  const singleFileUrl = files.length === 1 ? `/api/share/${shareSlug}/file` : null;

  console.log('🔍 UploadedFileViewer debug:', {
    uploadedFiles,
    files,
    isPdf,
    singleFileUrl,
    shouldShowIframe: isPdf && files.length === 1
  });

  const handleFileDownload = async (fileUrl: string, fileName: string) => {
    setIsDownloading(true);
    
    try {
      const response = await fetch(fileUrl, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBulkDownload = async () => {
    if (uploadedFiles.length === 1) {
      await handleFileDownload(uploadedFiles[0].url, uploadedFiles[0].name);
      return;
    }

    setIsBulkDownloading(true);
    
    try {
      const zip = new JSZip();
      
      for (const file of uploadedFiles) {
        const response = await fetch(file.url, { credentials: 'include' });
        const blob = await response.blob();
        zip.file(file.name, blob);
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${cimDocument.title || 'CIM_Documents'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Bulk download failed:', error);
    } finally {
      setIsBulkDownloading(false);
    }
  };

  // Auto-trigger download for non-PDF files
  useEffect(() => {
    if (!isPdf && singleFileUrl && files[0]) {
      handleFileDownload(singleFileUrl, files[0].name);
    }
  }, [isPdf, singleFileUrl]);

  if (isPdf && files.length === 1) {
    // For single PDF, show directly in iframe with download option
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{files[0].name}</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleFileDownload(singleFileUrl!, files[0].name)}
                disabled={isDownloading}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
            <div className="w-full" style={{ height: '80vh' }}>
              <iframe
                src={`${singleFileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full border rounded-lg"
                title="Document Viewer"
                onLoad={() => console.log('PDF iframe loaded successfully')}
                onError={() => console.error('PDF iframe failed to load')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact information */}
        {userProfile && (
          <ContactCard userProfile={userProfile} logoUrl={cimDocument.logoUrl} />
        )}
      </div>
    );
  }

  if (isPdf) {
    // For multiple PDFs, show list with viewer
    return (
      <div className="space-y-6">
        {/* Multiple files header with bulk download */}
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">CIM Documents ({uploadedFiles.length})</h2>
              </div>
              {uploadedFiles.length > 1 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBulkDownload}
                  disabled={isBulkDownloading}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {isBulkDownloading ? 'Creating Archive...' : 'Download All'}
                </Button>
              )}
            </div>

            {/* Files list */}
            <div className="space-y-3">
              {uploadedFiles.map((file, index) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {file.mimeType === 'application/pdf' ? 'PDF Document' : 'Document'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {file.mimeType === 'application/pdf' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFileForViewing(file.url)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFileDownload(file.url, file.name)}
                      disabled={isDownloading}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* PDF viewer */}
        {selectedFileForViewing && (
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Document Viewer</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedFileForViewing(null)}
                >
                  Close Viewer
                </Button>
              </div>
              <div className="w-full" style={{ height: '80vh' }}>
                <iframe
                  src={`${selectedFileForViewing}#toolbar=1&navpanes=1&scrollbar=1`}
                  className="w-full h-full border rounded-lg"
                  title="Document Viewer"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact information */}
        {userProfile && (
          <ContactCard userProfile={userProfile} logoUrl={cimDocument.logoUrl} />
        )}
      </div>
    );
  }

  // For non-PDF files, show multiple files interface with download options
  return (
    <div className="space-y-6">
      {/* Multiple files header with bulk download */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">CIM Documents ({uploadedFiles.length})</h2>
            </div>
            {uploadedFiles.length > 1 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleBulkDownload}
                disabled={isBulkDownloading}
              >
                <Archive className="h-4 w-4 mr-2" />
                {isBulkDownloading ? 'Creating Archive...' : 'Download All'}
              </Button>
            )}
          </div>

          {/* Files list */}
          <div className="space-y-3">
            {uploadedFiles.map((file, index) => (
              <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {file.mimeType === 'application/pdf' ? 'PDF Document' : 'Document'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFileDownload(file.url, file.name)}
                    disabled={isDownloading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>



      {/* Contact information */}
      {userProfile && (
        <ContactCard userProfile={userProfile} logoUrl={cimDocument.logoUrl} />
      )}
    </div>
  );
}

function ContactCard({ userProfile, logoUrl }: { userProfile: any; logoUrl?: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="h-5 w-5" />
          Contact Information
        </h3>
        
        <div className="flex items-start gap-6">
          {/* Profile Photo */}
          {userProfile.profilePhotoUrl && (
            <img 
              src={userProfile.profilePhotoUrl} 
              alt="Profile" 
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
            />
          )}
          
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {userProfile.fullName && (
                  <h4 className="font-semibold text-lg mb-2">{userProfile.fullName}</h4>
                )}
                {userProfile.name && !userProfile.fullName && (
                  <h4 className="font-semibold text-lg mb-2">{userProfile.name}</h4>
                )}
                {userProfile.title && (
                  <p className="text-gray-600 mb-1">{userProfile.title}</p>
                )}
                {userProfile.company && (
                  <p className="text-gray-600 mb-1">{userProfile.company}</p>
                )}
                {userProfile.businessName && !userProfile.company && (
                  <p className="text-gray-600 mb-1">{userProfile.businessName}</p>
                )}
                {userProfile.email && (
                  <p className="text-blue-600 mb-1">
                    <a href={`mailto:${userProfile.email}`} className="hover:underline">
                      {userProfile.email}
                    </a>
                  </p>
                )}
                {userProfile.phone && (
                  <p className="text-gray-600 mb-1">
                    <a href={`tel:${userProfile.phone}`} className="hover:underline">
                      {userProfile.phone}
                    </a>
                  </p>
                )}
                {userProfile.phoneNumber && !userProfile.phone && (
                  <p className="text-gray-600 mb-1">
                    <a href={`tel:${userProfile.phoneNumber}`} className="hover:underline">
                      {userProfile.phoneNumber}
                    </a>
                  </p>
                )}
              </div>
              
              {/* Business Logo */}
              {logoUrl && (
                <div className="flex justify-end">
                  <img 
                    src={logoUrl} 
                    alt="Company Logo" 
                    className="max-w-32 max-h-20 object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}