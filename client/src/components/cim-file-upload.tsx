import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, FileText, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface CimFileUploadProps {
  onSuccess?: (docId: number) => void;
}

export function CimFileUpload({ onSuccess }: CimFileUploadProps) {
  const [uploadedDocId, setUploadedDocId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async ({ title, files }: { title: string; files: File[] }) => {
      console.log("=== FRONTEND UPLOAD DEBUG ===");
      console.log("Title:", title);
      console.log("Files:", files);
      console.log("File count:", files.length);
      
      const formData = new FormData();
      formData.append('title', title);
      files.forEach((file, index) => {
        formData.append(`cimFile${index}`, file);
      });

      console.log("FormData created with title and file");

      const res = await fetch('/api/cim/upload-file', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      console.log("Response status:", res.status);
      console.log("Response ok:", res.ok);

      if (!res.ok) {
        const errorText = await res.text();
        console.log("Error response:", errorText);
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
    
    setSelectedFile(file);
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
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              placeholder="Enter a title for your CIM document"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cimFile">CIM File</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? "border-primary bg-primary/10" 
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-primary" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Drag and drop your CIM file here, or{" "}
                    <label htmlFor="file-input" className="text-primary cursor-pointer hover:underline">
                      browse files
                    </label>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supported formats: PDF, DOCX, TXT (Max 10MB)
                  </p>
                </div>
              )}
              <input
                id="file-input"
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={uploadMutation.isPending}
            className="w-full"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Upload CIM File
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}