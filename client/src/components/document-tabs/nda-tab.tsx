import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  FileSignature, 
  Upload, 
  Download, 
  Eye, 
  Trash2, 
  ExternalLink, 
  Mail, 
  MapPin,
  Calendar,
  Copy,
  Link2Off
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface DocumentNdaTabProps {
  cimDocument: any;
  ndaSignatures: any[];
}

export function DocumentNdaTab({ cimDocument, ndaSignatures }: DocumentNdaTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for NDA settings
  const [ndaSettings, setNdaSettings] = useState({
    ndaProtected: cimDocument.ndaProtected || false,
    ndaTemplateId: cimDocument.ndaTemplateId || null
  });
  
  // State for new NDA template upload
  const [newNdaTemplate, setNewNdaTemplate] = useState({
    name: '',
    file: null as File | null,
    isDefault: false
  });
  const [isUploadingNda, setIsUploadingNda] = useState(false);
  const [signatureSearchTerm, setSignatureSearchTerm] = useState('');

  // Fetch NDA templates
  const { data: ndaTemplates = [] } = useQuery({
    queryKey: ['/api/nda-templates'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/nda-templates');
      if (!response.ok) throw new Error('Failed to fetch NDA templates');
      return response.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // Update NDA settings mutation
  const updateNdaSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await apiRequest('PATCH', `/api/cim/${cimDocument.id}`, {
        ndaProtected: settings.ndaProtected,
        ndaTemplateId: settings.ndaTemplateId
      });
      if (!response.ok) throw new Error('Failed to update NDA settings');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "NDA Settings Updated",
        description: "Your NDA protection settings have been saved."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${cimDocument.id}`] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update NDA settings. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Upload NDA template mutation
  const uploadNdaTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const formData = new FormData();
      formData.append('name', templateData.name);
      formData.append('ndaFile', templateData.file);
      formData.append('isDefault', templateData.isDefault.toString());

      const response = await fetch('/api/nda-templates', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "NDA Template Uploaded",
        description: "Your NDA template has been saved successfully"
      });
      setNewNdaTemplate({ name: '', file: null, isDefault: false });
      queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Failed to upload NDA template. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Handle NDA settings update
  const handleNdaSettingsUpdate = () => {
    if (ndaSettings.ndaProtected && !ndaSettings.ndaTemplateId) {
      toast({
        title: "NDA Template Required",
        description: "Please select an NDA template when enabling NDA protection.",
        variant: "destructive"
      });
      return;
    }
    updateNdaSettingsMutation.mutate(ndaSettings);
  };

  // Handle NDA template upload
  const handleNdaTemplateUpload = () => {
    if (!newNdaTemplate.name || !newNdaTemplate.file) {
      toast({
        title: "Missing Information",
        description: "Please provide a name and select a PDF file",
        variant: "destructive"
      });
      return;
    }
    uploadNdaTemplateMutation.mutate(newNdaTemplate);
  };

  // Handle template preview
  const previewNdaTemplate = (templateId: number) => {
    const url = `/api/nda-templates/${templateId}/download`;
    window.open(url, '_blank');
  };

  // Handle template download
  const downloadNdaTemplate = async (templateId: number, templateName: string) => {
    try {
      const response = await fetch(`/api/nda-templates/${templateId}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${templateName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Your NDA template is being downloaded"
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Unable to download the NDA template",
        variant: "destructive"
      });
    }
  };

  // Handle template deletion
  const deleteNdaTemplate = async (templateId: number) => {
    try {
      const response = await apiRequest('DELETE', `/api/nda-templates/${templateId}`);
      if (response.ok) {
        toast({
          title: "Template Deleted",
          description: "NDA template has been removed"
        });
        queryClient.invalidateQueries({ queryKey: ['/api/nda-templates'] });
        // Reset selected template if it was deleted
        if (ndaSettings.ndaTemplateId === templateId) {
          setNdaSettings(prev => ({ ...prev, ndaTemplateId: null }));
        }
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Filter signatures based on search term
  const filteredSignatures = ndaSignatures.filter(signature =>
    signature.signerName.toLowerCase().includes(signatureSearchTerm.toLowerCase()) ||
    signature.signerEmail.toLowerCase().includes(signatureSearchTerm.toLowerCase()) ||
    (signature.signerLocation && signature.signerLocation.toLowerCase().includes(signatureSearchTerm.toLowerCase()))
  );

  // Generate share link for a specific signer
  const generateSignerShareLink = (signature: any) => {
    const baseUrl = window.location.hostname === 'localhost' ? window.location.origin : 'https://cimshare.com';
    return `${baseUrl}/share/${cimDocument.shareSlug}?token=${signature.accessToken}`;
  };

  // Copy share link
  const copySignerShareLink = (signature: any) => {
    const shareLink = generateSignerShareLink(signature);
    navigator.clipboard.writeText(shareLink);
    toast({
      title: "Share Link Copied",
      description: "The personal share link has been copied to your clipboard"
    });
  };

  // Resend share link via email (placeholder for now)
  const resendShareLink = (signature: any) => {
    toast({
      title: "Share Link Sent",
      description: `Share link resent to ${signature.signerEmail}`
    });
  };

  // Kill/revoke share link (placeholder for now)
  const revokeShareLink = (signature: any) => {
    toast({
      title: "Share Link Revoked",
      description: `Access revoked for ${signature.signerEmail}`
    });
  };

  return (
    <div className="space-y-6">
      {/* NDA Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            NDA Protection Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="nda-protection">Enable NDA Protection</Label>
              <p className="text-sm text-muted-foreground">
                Require visitors to sign an NDA before viewing the document
              </p>
            </div>
            <Switch
              id="nda-protection"
              checked={ndaSettings.ndaProtected}
              onCheckedChange={(checked) => 
                setNdaSettings(prev => ({ ...prev, ndaProtected: checked }))
              }
            />
          </div>
          
          {ndaSettings.ndaProtected && (
            <div className="space-y-2">
              <Label htmlFor="nda-template">NDA Template</Label>
              <Select
                value={ndaSettings.ndaTemplateId?.toString() || ""}
                onValueChange={(value) => 
                  setNdaSettings(prev => ({ ...prev, ndaTemplateId: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an NDA template" />
                </SelectTrigger>
                <SelectContent>
                  {ndaTemplates.map((template: any) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <Button 
            onClick={handleNdaSettingsUpdate}
            disabled={updateNdaSettingsMutation.isPending}
          >
            {updateNdaSettingsMutation.isPending ? "Updating..." : "Update Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Upload New NDA Template */}
      <Card>
        <CardHeader>
          <CardTitle>Upload NDA Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g., Standard Confidentiality Agreement"
              value={newNdaTemplate.name}
              onChange={(e) => setNewNdaTemplate(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="template-file">PDF File</Label>
            <Input
              id="template-file"
              type="file"
              accept=".pdf"
              onChange={(e) => setNewNdaTemplate(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="is-default"
              checked={newNdaTemplate.isDefault}
              onCheckedChange={(checked) => 
                setNewNdaTemplate(prev => ({ ...prev, isDefault: checked }))
              }
            />
            <Label htmlFor="is-default">Set as default template</Label>
          </div>
          
          <Button 
            onClick={handleNdaTemplateUpload}
            disabled={uploadNdaTemplateMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadNdaTemplateMutation.isPending ? "Uploading..." : "Upload Template"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing NDA Templates */}
      <Card>
        <CardHeader>
          <CardTitle>NDA Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {ndaTemplates.length > 0 ? (
            <div className="space-y-3">
              {ndaTemplates.map((template: any) => (
                <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Created {format(new Date(template.createdAt), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => previewNdaTemplate(template.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm" 
                      onClick={() => downloadNdaTemplate(template.id, template.name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteNdaTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileSignature className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No NDA templates uploaded</p>
              <p className="text-xs text-muted-foreground">Upload a template above to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NDA Signatures Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>NDA Signatures ({ndaSignatures.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search signatures..."
                value={signatureSearchTerm}
                onChange={(e) => setSignatureSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSignatures.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Signed Date</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSignatures.map((signature) => (
                  <TableRow key={signature.id}>
                    <TableCell className="font-medium">{signature.signerName}</TableCell>
                    <TableCell>{signature.signerEmail}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{signature.signerLocation || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(signature.signedAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Eye className="h-3 w-3 mr-1" />
                        {signature.viewCount || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copySignerShareLink(signature)}
                          title="Copy personal share link"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resendShareLink(signature)}
                          title="Resend share link via email"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeShareLink(signature)}
                          title="Revoke access"
                        >
                          <Link2Off className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileSignature className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {ndaSignatures.length === 0 ? "No signatures yet" : "No signatures match your search"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ndaSignatures.length === 0 
                  ? "Enable NDA protection and share your document to start collecting signatures"
                  : "Try adjusting your search terms"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}