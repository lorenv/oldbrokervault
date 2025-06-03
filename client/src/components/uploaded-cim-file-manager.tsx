import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Trash2, Download, Plus, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface UploadedCimFileManagerProps {
  docId: number;
  cimTitle: string;
}

export function UploadedCimFileManager({ docId, cimTitle }: UploadedCimFileManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Fetch uploaded files
  const { data: uploadedFiles = [], isLoading } = useQuery({
    queryKey: [`/api/cim/${docId}/uploaded-files`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/cim/${docId}/uploaded-files`);
      return Array.isArray(response) ? response : [];
    },
  });

  // Upload new files mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('cimFiles', file);
      });

      const response = await fetch(`/api/cim/${docId}/upload-more-files`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload files');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/uploaded-files`] });
      setSelectedFiles([]);
      toast({
        title: "Files Uploaded",
        description: "Your files have been successfully uploaded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => apiRequest("DELETE", `/api/cim/${docId}/uploaded-files/${fileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}/uploaded-files`] });
      toast({
        title: "File Deleted",
        description: "The file has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Could not delete the file. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const handleDownload = (file: any) => {
    const downloadUrl = `/api/cim/${docId}/download/${file.id}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-gray-500">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{cimTitle}</h2>
        <p className="text-gray-600">Manage your uploaded CIM documents</p>
      </div>

      {/* Upload Section */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/50 pb-6 pt-8 px-8">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-800">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Plus className="h-5 w-5 text-blue-600" />
            </div>
            Upload Additional Files
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Support for PDF, Word, and other document formats
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white/90 hover:bg-blue-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose Files
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
            />
          </div>

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Selected Files:</h4>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSelectedFile(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {uploadMutation.isPending ? "Uploading..." : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Files */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-md rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/50 pb-6 pt-8 px-8">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-800">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            Current Files ({Array.isArray(uploadedFiles) ? uploadedFiles.length : 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          {!Array.isArray(uploadedFiles) || uploadedFiles.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(uploadedFiles) && uploadedFiles.map((file: any) => (
                <div key={file.id} className="flex items-center justify-between p-6 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl hover:bg-white/90 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-slate-900">{file.fileName}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                        <span>{formatFileSize(file.fileSize)}</span>
                        <span>•</span>
                        <span>{file.mimeType.split('/').pop()?.toUpperCase()}</span>
                        <span>•</span>
                        <span>Uploaded {formatDistanceToNow(new Date(file.uploadedAt))} ago</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file)}
                      className="bg-white/90 hover:bg-blue-50 border-blue-200 text-blue-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(file.id)}
                      disabled={deleteMutation.isPending}
                      className="bg-white/90 hover:bg-red-50 border-red-200 text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}