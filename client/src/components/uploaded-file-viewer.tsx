import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, User, Phone, Mail, Building, Archive, Eye } from "lucide-react";
import JSZip from 'jszip';

interface UploadedFileViewerProps {
  cimDocument: any;
  shareSlug: string;
  userProfile: any;
}

export function UploadedFileViewer({ cimDocument, shareSlug, userProfile }: UploadedFileViewerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [showDownloadMessage, setShowDownloadMessage] = useState(false);
  const [selectedFileForViewing, setSelectedFileForViewing] = useState<string | null>(null);

  // For now, simulate multiple files - in future this will come from the database
  const uploadedFiles = [
    {
      id: 1,
      name: cimDocument.uploadedFileName,
      mimeType: cimDocument.uploadedFileMimeType,
      size: cimDocument.uploadedFileSize,
      url: `/api/share/${shareSlug}/file`
    }
  ];

  const isPdf = cimDocument.uploadedFileMimeType === 'application/pdf';
  const defaultFileUrl = `/api/share/${shareSlug}/file`;

  const handleFileDownload = async (fileUrl: string, fileName: string) => {
    setIsDownloading(true);
    setShowDownloadMessage(true);
    
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
      setTimeout(() => setShowDownloadMessage(false), 3000);
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
    if (!isPdf) {
      handleFileDownload(defaultFileUrl, cimDocument.uploadedFileName);
    }
  }, [isPdf]);

  if (isPdf) {
    return (
      <div className="space-y-6">
        {/* PDF viewer with controls */}
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">{cimDocument.uploadedFileName}</h2>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleFileDownload(defaultFileUrl, cimDocument.uploadedFileName)}
                  disabled={isDownloading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.print()}
                >
                  Print
                </Button>
              </div>
            </div>
            
            {/* PDF embed */}
            <div className="w-full" style={{ height: '80vh' }}>
              <iframe
                src={`${defaultFileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full border rounded-lg"
                title={cimDocument.uploadedFileName}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact information */}
        {userProfile && (
          <ContactCard userProfile={userProfile} />
        )}
      </div>
    );
  }

  // For non-PDF files, show download message
  return (
    <div className="space-y-6">
      {showDownloadMessage && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Download className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold">CIM Document Downloading</h2>
              <p className="text-muted-foreground">
                Your confidential information memorandum "{cimDocument.uploadedFileName}" is being downloaded.
              </p>
              {isDownloading && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  <span className="text-sm text-muted-foreground">Preparing download...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Always show contact information for non-PDF files */}
      {userProfile && (
        <ContactCard userProfile={userProfile} />
      )}

      {/* Fallback download button */}
      {!showDownloadMessage && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="space-y-4">
              <FileText className="h-12 w-12 text-gray-400 mx-auto" />
              <h3 className="text-lg font-semibold">Document Ready</h3>
              <p className="text-muted-foreground">
                Click below to download your CIM document.
              </p>
              <Button onClick={handleDownload} disabled={isDownloading}>
                <Download className="h-4 w-4 mr-2" />
                Download CIM
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContactCard({ userProfile }: { userProfile: any }) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="h-5 w-5" />
          Contact Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userProfile.name && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-gray-500" />
              <div>
                <p className="font-medium">{userProfile.name}</p>
                {userProfile.title && (
                  <p className="text-sm text-muted-foreground">{userProfile.title}</p>
                )}
              </div>
            </div>
          )}
          
          {userProfile.email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-500" />
              <a 
                href={`mailto:${userProfile.email}`}
                className="text-blue-600 hover:underline"
              >
                {userProfile.email}
              </a>
            </div>
          )}
          
          {userProfile.phoneNumber && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-500" />
              <a 
                href={`tel:${userProfile.phoneNumber}`}
                className="text-blue-600 hover:underline"
              >
                {userProfile.phoneNumber}
              </a>
            </div>
          )}
          
          {userProfile.businessName && (
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 text-gray-500" />
              <p className="font-medium">{userProfile.businessName}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}