import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Archive, Eye, Maximize2, Minimize2, X } from "lucide-react";
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [fullscreenFileName, setFullscreenFileName] = useState<string>("");

  // Handle escape key to close fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setFullscreenUrl(null);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const openFullscreen = (url: string, fileName: string) => {
    setFullscreenUrl(url);
    setFullscreenFileName(fileName);
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    setFullscreenUrl(null);
    setFullscreenFileName("");
  };

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
        {/* Fullscreen Modal */}
        {isFullscreen && fullscreenUrl && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
            <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
              <h3 className="text-lg font-semibold truncate max-w-[60%]">{fullscreenFileName}</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={() => handleFileDownload(fullscreenUrl, fullscreenFileName)}
                  disabled={isDownloading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={closeFullscreen}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-2">
              <iframe
                src={`${fullscreenUrl}#toolbar=1&navpanes=1&scrollbar=1&zoom=page-fit`}
                className="w-full h-full bg-white rounded"
                title="Document Viewer - Fullscreen"
              />
            </div>
            <div className="p-2 text-center text-gray-400 text-sm">
              Press <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Esc</kbd> to exit fullscreen
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{files[0].name}</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openFullscreen(singleFileUrl!, files[0].name)}
                >
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Expand
                </Button>
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
            </div>
            <div className="w-full" style={{ height: '80vh' }}>
              <iframe
                src={`${singleFileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full border rounded-lg"
                title="Document Viewer"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isPdf) {
    // Find the name of the currently selected file for viewing
    const selectedFileName = uploadedFiles.find(f => f.url === selectedFileForViewing)?.name || 'Document';

    // For multiple PDFs, show list with viewer
    return (
      <div className="space-y-6">
        {/* Fullscreen Modal */}
        {isFullscreen && fullscreenUrl && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
            <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
              <h3 className="text-lg font-semibold truncate max-w-[60%]">{fullscreenFileName}</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={() => handleFileDownload(fullscreenUrl, fullscreenFileName)}
                  disabled={isDownloading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={closeFullscreen}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-2">
              <iframe
                src={`${fullscreenUrl}#toolbar=1&navpanes=1&scrollbar=1&zoom=page-fit`}
                className="w-full h-full bg-white rounded"
                title="Document Viewer - Fullscreen"
              />
            </div>
            <div className="p-2 text-center text-gray-400 text-sm">
              Press <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Esc</kbd> to exit fullscreen
            </div>
          </div>
        )}

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
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFileForViewing(file.url)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openFullscreen(file.url, file.name)}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </>
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openFullscreen(selectedFileForViewing, selectedFileName)}
                  >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Expand
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFileForViewing(null)}
                  >
                    Close Viewer
                  </Button>
                </div>
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
    </div>
  );
}

