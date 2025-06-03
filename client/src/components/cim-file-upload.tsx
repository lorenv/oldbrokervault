import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, FileText, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const uploadCimSchema = z.object({
  title: z.string().min(1, "Title is required"),
  cimFile: z.any().refine((files) => files?.length === 1, "Please select a file")
});

type UploadCimFormData = z.infer<typeof uploadCimSchema>;

interface CimFileUploadProps {
  onSuccess?: (docId: number) => void;
}

export function CimFileUpload({ onSuccess }: CimFileUploadProps) {
  const { toast } = useToast();
  const [uploadedDocId, setUploadedDocId] = useState<number | null>(null);

  const form = useForm<UploadCimFormData>({
    resolver: zodResolver(uploadCimSchema),
    defaultValues: {
      title: ""
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadCimFormData) => {
      console.log("=== FRONTEND UPLOAD DEBUG ===");
      console.log("Title:", data.title);
      console.log("File:", data.cimFile?.[0]);
      console.log("File name:", data.cimFile?.[0]?.name);
      console.log("File type:", data.cimFile?.[0]?.type);
      console.log("File size:", data.cimFile?.[0]?.size);
      
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('cimFile', data.cimFile[0]);

      console.log("FormData entries:");
      for (let pair of formData.entries()) {
        console.log(pair[0], pair[1]);
      }

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
        title: "CIM File Uploaded Successfully",
        description: `Your file "${data.title}" has been uploaded and is ready to share.`,
        duration: 5000
      });

      if (onSuccess) {
        onSuccess(data.id);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload CIM file",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: UploadCimFormData) => {
    uploadMutation.mutate(data);
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter a title for your CIM document" 
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cimFile"
              render={({ field: { onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>CIM File</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => onChange(e.target.files)}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground">
                    Supported formats: PDF, DOCX, TXT (Max 10MB)
                  </p>
                </FormItem>
              )}
            />

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
        </Form>
      </CardContent>
    </Card>
  );
}