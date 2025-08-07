import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, FileText, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Document } from "@shared/schema";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: (document: Document) => void;
}

type ProcessingStage = 'uploading' | 'processing' | 'converting' | 'generating_images' | 'complete';

export function UploadModal({ open, onOpenChange, onUploadSuccess }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      setProcessingStage('uploading');
      setProgress(10);

      const formData = new FormData();
      formData.append("document", file);
      formData.append("title", title);

      // Simulate progress updates for better UX
      const progressTimer = setInterval(() => {
        setProgress(prev => {
          if (prev < 80) return prev + 10;
          return prev;
        });
      }, 1000);

      try {
        // Determine file type for progress messaging
        const isWordDoc = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc');
        
        if (isWordDoc) {
          setProcessingStage('converting');
        } else {
          setProcessingStage('processing');
        }

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        clearInterval(progressTimer);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Upload failed");
        }

        setProcessingStage('generating_images');
        setProgress(90);

        const result = await response.json();
        
        setProcessingStage('complete');
        setProgress(100);

        return result;
      } catch (error) {
        clearInterval(progressTimer);
        throw error;
      }
    },
    onSuccess: (document: Document) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      
      setTimeout(() => {
        resetForm();
        toast({
          title: "Document processed successfully",
          description: "Your document is ready for signature preparation",
        });
        
        if (onUploadSuccess) {
          onUploadSuccess(document);
        } else {
          onOpenChange(false);
        }
      }, 1000);
    },
    onError: (error: Error) => {
      setProcessingStage(null);
      setProgress(0);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTitle("");
    setSelectedFile(null);
    setDragActive(false);
    setProcessingStage(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF, DOC, or DOCX file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !title.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a file and enter a title",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ file: selectedFile, title: title.trim() });
  };

  const handleClose = () => {
    if (!uploadMutation.isPending) {
      onOpenChange(false);
      resetForm();
    }
  };

  const getProcessingMessage = () => {
    switch (processingStage) {
      case 'uploading':
        return 'Uploading document...';
      case 'converting':
        return 'Converting Word document to PDF...';
      case 'processing':
        return 'Processing document...';
      case 'generating_images':
        return 'Generating page images...';
      case 'complete':
        return 'Processing complete!';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a PDF or Word document to prepare for electronic signature
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Title Input */}
          <div>
            <Label htmlFor="documentTitle">Document Title</Label>
            <Input
              id="documentTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title"
              disabled={uploadMutation.isPending}
            />
          </div>

          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-blue-500 bg-blue-50"
                : selectedFile
                ? "border-green-500 bg-green-50"
                : "border-slate-300 hover:border-slate-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <FileText className="h-8 w-8 text-green-600 mx-auto" />
                <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                <p className="text-xs text-green-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  disabled={uploadMutation.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <CloudUpload className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-slate-600">Drop your file here or</p>
                <Button
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className="text-blue-600 hover:text-blue-700"
                >
                  browse files
                </Button>
                <p className="text-xs text-slate-500">Supports PDF, DOC, DOCX (Max 10MB)</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Processing Progress */}
          {processingStage && (
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border">
              <div className="flex items-center space-x-2">
                {processingStage === 'complete' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                )}
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {getProcessingMessage()}
                </span>
              </div>
              <Progress value={progress} className="w-full" />
              {processingStage === 'converting' && (
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Word documents require conversion to PDF format for processing...
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={handleUpload}
              disabled={uploadMutation.isPending || !selectedFile || !title.trim()}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
