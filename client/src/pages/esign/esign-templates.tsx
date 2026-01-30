import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ExternalLink,
  Check,
  Loader2,
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
  const [powerFormTemplate, setPowerFormTemplate] = useState<EsignTemplate | null>(null);
  const [powerFormSlug, setPowerFormSlug] = useState("");
  const [powerFormMode, setPowerFormMode] = useState<'upfront' | 'sequential' | 'choice'>('choice');
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

  const powerFormMutation = useMutation({
    mutationFn: async ({ templateId, enabled, slug, settings }: {
      templateId: number;
      enabled: boolean;
      slug?: string;
      settings?: { multiSignerMode: string };
    }) => {
      return apiRequest("POST", `/api/esign/templates/${templateId}/powerform`, {
        enabled,
        slug,
        settings,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/esign/templates"] });
      if (data.powerFormUrl) {
        toast({
          title: "PowerForm enabled",
          description: "Your shareable link is ready to use.",
        });
      } else {
        toast({
          title: "PowerForm disabled",
          description: "The shareable link has been deactivated.",
        });
      }
      setPowerFormTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update PowerForm settings.",
        variant: "destructive",
      });
    },
  });

  const openPowerFormDialog = (template: EsignTemplate) => {
    setPowerFormTemplate(template);
    setPowerFormSlug(template.powerFormSlug || template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40));
    setPowerFormMode((template.powerFormSettings?.multiSignerMode as any) || 'choice');
  };

  const handlePowerFormSave = () => {
    if (!powerFormTemplate) return;
    powerFormMutation.mutate({
      templateId: powerFormTemplate.id,
      enabled: true,
      slug: powerFormSlug,
      settings: { multiSignerMode: powerFormMode },
    });
  };

  const handlePowerFormDisable = (templateId: number) => {
    powerFormMutation.mutate({
      templateId,
      enabled: false,
    });
  };

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
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
        <div className="px-4 py-6 md:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2 flex items-center gap-2 md:gap-3">
                <FileText className="h-6 w-6 md:h-8 md:w-8" />
                <span className="hidden sm:inline">E-Signature Templates</span>
                <span className="sm:hidden">Templates</span>
              </h1>
              <p className="text-slate-200 text-sm md:text-base">
                Create reusable templates with pre-placed signature fields
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => setLocation("/esign")}
              >
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <Button
                size="sm"
                className="bg-slate-700 hover:bg-slate-800 text-white"
                onClick={() => setLocation("/esign/templates/new")}
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Create Template</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="px-4 md:px-6 py-4 md:py-6">
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
                            {template.powerFormEnabled ? (
                              <>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  copyPowerFormUrl(template);
                                }}>
                                  <Link2 className="h-4 w-4 mr-2" />
                                  Copy PowerForm Link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  openPowerFormDialog(template);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit PowerForm
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handlePowerFormDisable(template.id);
                                }}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Disable PowerForm
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                openPowerFormDialog(template);
                              }}>
                                <Link2 className="h-4 w-4 mr-2" />
                                Create PowerForm Link
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
                      {template.powerFormEnabled && (
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

      {/* PowerForm Configuration Dialog */}
      <Dialog open={powerFormTemplate !== null} onOpenChange={() => setPowerFormTemplate(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-600" />
              {powerFormTemplate?.powerFormEnabled ? 'Edit PowerForm' : 'Create PowerForm'}
            </DialogTitle>
            <DialogDescription>
              Create a shareable link that anyone can use to fill out and sign this template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* URL Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={powerFormSlug}
                onChange={(e) => setPowerFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="my-form"
              />
              <p className="text-xs text-gray-500">
                Only lowercase letters, numbers, and hyphens. Link will be: /esign/form/{powerFormSlug || 'your-slug'}
              </p>
            </div>

            {/* Multi-signer mode (only show if template has multiple signers) */}
            {powerFormTemplate && powerFormTemplate.placeholderRecipients.filter((r: any) => r.role === 'signer').length > 1 && (
              <div className="space-y-2">
                <Label>Multiple Signers</Label>
                <Select value={powerFormMode} onValueChange={(v) => setPowerFormMode(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="choice">
                      Let first signer choose
                    </SelectItem>
                    <SelectItem value="upfront">
                      Collect all signers upfront
                    </SelectItem>
                    <SelectItem value="sequential">
                      Sequential handoff
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {powerFormMode === 'choice' && "First signer decides how to handle other signers."}
                  {powerFormMode === 'upfront' && "First signer provides info for all signers at once."}
                  {powerFormMode === 'sequential' && "Each signer passes the link to the next."}
                </p>
              </div>
            )}

            {/* Preview URL */}
            {powerFormSlug && (
              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-xs text-gray-500 mb-1">Your PowerForm link:</p>
                <p className="text-sm font-medium text-blue-600 break-all">
                  {window.location.origin}/esign/form/{powerFormSlug}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPowerFormTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={handlePowerFormSave}
              disabled={!powerFormSlug || powerFormMutation.isPending}
            >
              {powerFormMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  {powerFormTemplate?.powerFormEnabled ? 'Update PowerForm' : 'Create PowerForm'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
