import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Send,
  Copy,
  Clock,
  Users,
  Link2,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/layout/page-header";

interface EsignTemplate {
  id: number;
  name: string;
  description: string | null;
  totalPages: number;
  placeholderRecipients: any[];
  fields: any[];
  createdAt: string;
  updatedAt: string;
  powerFormEnabled: boolean;
  powerFormSlug: string | null;
  powerFormSettings: {
    multiSignerMode?: 'upfront' | 'sequential' | 'choice';
    customMessage?: string | null;
    maxCompletions?: number | null;
    expiresAt?: string | null;
  };
  powerFormCompletions: number;
}

export default function EsignTemplates() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTemplateId, setDeleteTemplateId] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<EsignTemplate[]>({
    queryKey: ["/api/esign/templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: number) => {
      await apiRequest("DELETE", `/api/esign/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/templates"] });
      toast({
        title: "Template deleted",
        description: "The template has been successfully deleted.",
      });
      setDeleteTemplateId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      return apiRequest("POST", `/api/esign/templates/${templateId}/duplicate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/templates"] });
      toast({
        title: "Template duplicated",
        description: "A copy of the template has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to duplicate template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const copyPowerFormUrl = (template: EsignTemplate) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/esign/form/${template.powerFormSlug}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(template.id);
    setTimeout(() => setCopiedUrl(null), 2000);
    toast({
      title: "Link copied",
      description: "PowerForm link copied to clipboard.",
    });
  };

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <main className="px-4 md:px-6 py-4 md:py-6">
        <PageHeader
          title="E-Signature Templates"
          description="Create reusable templates with pre-placed signature fields"
          icon={<FileText className="h-5 w-5" />}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-slate-700 border-slate-300"
                onClick={() => setLocation("/esign")}
              >
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/esign/templates/new")}
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Create Template</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </div>
          }
        />
        <Card className="bg-white shadow-lg overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Your Templates</CardTitle>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <FileText className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">No templates found</p>
                <p className="text-sm">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Create your first template to get started"}
                </p>
                {!searchQuery && (
                  <Button
                    className="mt-4"
                    onClick={() => setLocation("/esign/templates/new")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 md:p-6">
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => setLocation(`/esign/templates/${template.id}/edit`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                            {template.name}
                          </h3>
                          {template.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/esign/send?template=${template.id}`);
                            }}>
                              <Send className="h-4 w-4 mr-2" />
                              Use Template
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/esign/templates/${template.id}/edit`);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              duplicateMutation.mutate(template.id);
                            }}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            {template.powerFormSlug && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                copyPowerFormUrl(template);
                              }}>
                                <Link2 className="h-4 w-4 mr-2" />
                                Copy PowerForm Link
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTemplateId(template.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {template.totalPages} page{template.totalPages !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {template.placeholderRecipients.length} role{template.placeholderRecipients.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 mt-3">
                        {template.placeholderRecipients.slice(0, 4).map((recipient: any, idx: number) => (
                          <div
                            key={idx}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: recipient.color }}
                            title={recipient.label}
                          >
                            {recipient.label.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {template.placeholderRecipients.length > 4 && (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium">
                            +{template.placeholderRecipients.length - 4}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        Updated {new Date(template.updatedAt).toLocaleDateString()}
                      </div>

                      {/* PowerForm indicator */}
                      {template.powerFormSlug && (
                        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Link2 className="h-4 w-4 text-green-600" />
                              <span className="text-xs font-medium text-green-700">PowerForm Active</span>
                              {template.powerFormCompletions > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {template.powerFormCompletions} completed
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-green-700 hover:text-green-800 hover:bg-green-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyPowerFormUrl(template);
                              }}
                            >
                              {copiedUrl === template.id ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Quick action buttons */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                        <Button
                          size="sm"
                          className="flex-1 bg-slate-700 hover:bg-slate-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/esign/send?template=${template.id}`);
                          }}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Use
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/esign/templates/${template.id}/edit`);
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteTemplateId !== null} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTemplateId && deleteMutation.mutate(deleteTemplateId)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
