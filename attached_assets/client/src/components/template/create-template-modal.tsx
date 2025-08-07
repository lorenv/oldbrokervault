import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LayoutTemplate, FileText, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTemplateModal({ open, onOpenChange }: CreateTemplateModalProps) {
  const [templateData, setTemplateData] = useState({
    title: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("Please select a file");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", templateData.title);
      formData.append("description", templateData.description || "");

      const response = await fetch("/api/templates", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create template");
      }

      return response.json();
    },
    onSuccess: (response) => {
      toast({
        title: "Template created",
        description: `Template "${templateData.title}" has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      handleClose();
      
      // Stay on templates page
      setLocation("/templates");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.type.includes('pdf') && !file.type.includes('word') && !file.type.includes('document')) {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF or Word document.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    
    // Auto-fill title from filename if empty
    if (!templateData.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setTemplateData(prev => ({ ...prev, title: nameWithoutExt }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateData.title.trim()) {
      toast({
        title: "Missing template title",
        description: "Please enter a title for your template.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to create a template.",
        variant: "destructive",
      });
      return;
    }
    createTemplateMutation.mutate();
  };

  const handleClose = () => {
    onOpenChange(false);
    setTemplateData({ title: "", description: "" });
    setSelectedFile(null);
    setIsDragOver(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <LayoutTemplate className="h-5 w-5 mr-2" />
            Create Template
          </DialogTitle>
          <DialogDescription>
            Upload a document to create a reusable e-signature template
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Area */}
          <div>
            <Label>Document Upload *</Label>
            <div
              className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver 
                  ? 'border-blue-500 bg-blue-50' 
                  : selectedFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-slate-300 hover:border-slate-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {selectedFile ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    <FileText className="h-12 w-12 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">{selectedFile.name}</p>
                    <p className="text-sm text-green-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <Upload className="h-12 w-12 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-600 mb-2">
                      Drag and drop your document here, or
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose File
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Supported: PDF, DOC, DOCX (Max 50MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Template Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="templateTitle">Template Title *</Label>
              <Input
                id="templateTitle"
                value={templateData.title}
                onChange={(e) => setTemplateData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter template title"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="templateDescription">Description (Optional)</Label>
              <Textarea
                id="templateDescription"
                value={templateData.description}
                onChange={(e) => setTemplateData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe when to use this template"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createTemplateMutation.isPending || !selectedFile || !templateData.title.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createTemplateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Template...
                </>
              ) : (
                "Create Template"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}