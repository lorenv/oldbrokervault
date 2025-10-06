import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, FileText, CheckCircle, Shield, UserCheck, Settings2, ExternalLink, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";

interface CimFileUploadProps {
  onSuccess?: (docId: number) => void;
}

export function CimFileUpload({ onSuccess }: CimFileUploadProps) {
  const { user } = useAuth();
  const [uploadedDocId, setUploadedDocId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  // NDA Protection state
  const [ndaSettings, setNdaSettings] = useState({
    ndaProtected: false,
    ndaTemplateId: null as number | null,
    ndaApprovalRequired: false
  });

  // Load NDA templates from database
  const { data: ndaTemplates = [], isLoading: ndaTemplatesLoading } = useQuery<any[]>({
    queryKey: ['/api/nda-templates'],
    enabled: !!user,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/nda-templates");
      if (!response.ok) throw new Error('Failed to fetch NDA templates');
      const data = await response.json();
      return data;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ title, files }: { title: string; files: File[] }) => {
      const formData = new FormData();
      formData.append('title', title);
      // Upload all selected files using the new multiple file format
      files.forEach((file, index) => {
        formData.append('cimFiles', file);
      });

      // Add NDA settings to the upload
      formData.append('ndaSettings', JSON.stringify(ndaSettings));

      const res = await fetch('/api/cim/upload-file', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!res.ok) {
        const errorText = await res.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || "Failed to upload CIM file");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setUploadedDocId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
      
      toast({
        title: "Upload successful",
        description: "Your CIM file has been uploaded and is ready to share."
      });
      
      if (onSuccess) {
        onSuccess(data.id);
      }
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your CIM file.",
        variant: "destructive"
      });
      return;
    }
    
    if (selectedFiles.length === 0) {
      toast({
        title: "Files required",
        description: "Please select CIM files to upload.",
        variant: "destructive"
      });
      return;
    }
    
    uploadMutation.mutate({ title: title.trim(), files: selectedFiles });
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF, DOCX, or TXT file.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB.",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedFiles([file]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  if (uploadedDocId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h3 className="text-lg font-semibold">File Uploaded Successfully!</h3>
            <p className="text-muted-foreground">
              Your CIM file has been uploaded and is now available in your documents.
              You can enable sharing and NDA protection from the documents page.
            </p>
            <Button onClick={() => window.location.href = '/documents'}>
              View Documents
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Explanatory Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Info className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upload Your Existing CIM Documents
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Upload one or more CIM documents to enhance them with powerful features. Add NDA protection to control access,
              require viewer approvals, track who views your documents with detailed analytics, manage sharing with secure links,
              and maintain complete control over your confidential information. You can upload multiple documents at once.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Document Title Section */}
        <div className="space-y-0">
          <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
            <FileText className="h-5 w-5" />
            <div>
              <h3 className="font-semibold">Document Information</h3>
              <p className="text-sm text-slate-200">Give your document a title</p>
            </div>
          </div>
          <div className="p-4 border border-t-0 rounded-b-lg bg-white">
            <Input
              id="title"
              placeholder="Enter a title for your CIM document"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        {/* File Upload Section */}
        <div className="space-y-0">
          <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
            <Upload className="h-5 w-5" />
            <div>
              <h3 className="font-semibold">Upload Files</h3>
              <p className="text-sm text-slate-200">Select one or more CIM documents to upload</p>
            </div>
          </div>
          <div className="p-4 border border-t-0 rounded-b-lg bg-white">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFiles.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <FileText className="w-10 h-10 mx-auto text-blue-600 mb-3" />
                    <p className="font-semibold text-gray-900">
                      {selectedFiles.length} document{selectedFiles.length > 1 ? 's' : ''} selected
                    </p>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newFiles = selectedFiles.filter((_, i) => i !== index);
                            setSelectedFiles(newFiles);
                          }}
                          className="ml-2 h-8 w-8 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFiles([])}
                    className="w-full mt-2"
                  >
                    Clear All Files
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-gray-700 font-medium mb-1">
                      Drag and drop your files here, or{" "}
                      <label htmlFor="file-input" className="text-blue-600 cursor-pointer hover:underline font-semibold">
                        browse files
                      </label>
                    </p>
                    <p className="text-sm text-gray-500">
                      Upload multiple documents at once • PDF, DOCX, TXT • Max 10MB per file
                    </p>
                  </div>
                </div>
              )}
              <input
                id="file-input"
                type="file"
                accept=".pdf,.docx,.txt"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const filesArray = Array.from(e.target.files);
                    setSelectedFiles(filesArray);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* NDA Protection Section */}
        <div className="space-y-0">
          <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
            <Shield className="h-5 w-5" />
            <div>
              <h3 className="font-semibold">NDA Protection</h3>
              <p className="text-sm text-slate-200">Configure confidentiality settings for your documents</p>
            </div>
          </div>
          <div className="p-4 border border-t-0 rounded-b-lg bg-white space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="nda-protected"
                checked={ndaSettings.ndaProtected}
                onCheckedChange={(checked) => {
                  setNdaSettings(prev => ({ ...prev, ndaProtected: checked }));
                  if (!checked) {
                    setNdaSettings(prev => ({ ...prev, ndaTemplateId: null, ndaApprovalRequired: false }));
                  }
                }}
              />
              <Label htmlFor="nda-protected" className="text-sm font-medium cursor-pointer">
                Enable NDA Protection
              </Label>
            </div>

            {ndaSettings.ndaProtected && (
              <div className="space-y-4 ml-6 border-l-2 border-gray-200 pl-4">
                <div className="space-y-2">
                  <Label className="text-sm">NDA Template</Label>
                  <Select
                    value={ndaSettings.ndaTemplateId?.toString() || ''}
                    onValueChange={(value) => {
                      setNdaSettings(prev => ({ ...prev, ndaTemplateId: value ? parseInt(value) : null }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an NDA template" />
                    </SelectTrigger>
                    <SelectContent>
                      {ndaTemplates.length > 0 ? (
                        ndaTemplates.map((template: any) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            {template.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          {ndaTemplatesLoading ? "Loading templates..." : "No NDA templates available"}
                        </SelectItem>
                      )}
                      <div className="border-t mt-2 pt-2">
                        <a
                          href="/account?tab=templates"
                          className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Settings2 className="h-4 w-4" />
                          <span>Manage NDA Templates</span>
                          <ExternalLink className="h-3 w-3 ml-auto" />
                        </a>
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="manual-approval"
                    checked={ndaSettings.ndaApprovalRequired}
                    onCheckedChange={(checked) => {
                      setNdaSettings(prev => ({ ...prev, ndaApprovalRequired: checked }));
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="manual-approval" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <UserCheck className="h-4 w-4" />
                      Require Manual Approval
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, you must manually approve each person before they can view the document
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={uploadMutation.isPending}
          className="w-full bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white h-12 text-base font-semibold shadow-lg"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing Upload...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 mr-2" />
              Complete Upload
            </>
          )}
        </Button>
      </form>
    </div>
  );
}