import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { CreateTemplateModal } from "@/components/template/create-template-modal";
import type { Template } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Type for template list view (excludes heavy fields like fileContent and imageUrls)
type TemplateListItem = Omit<Template, 'fileContent' | 'imageUrls'>;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  LayoutTemplate, 
  Search, 
  Star,
  Copy,
  Trash2,
  FileText
} from "lucide-react";

// Template skeleton loader component
function TemplateCardSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-28 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Templates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const templatesPerPage = 12; // Show 12 templates per page for optimal performance
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingTemplateId, setLoadingTemplateId] = useState<number | null>(null);

  const { data: templates = [], isLoading, error } = useQuery<TemplateListItem[]>({
    queryKey: ["/api/templates"],
    staleTime: 5 * 60 * 1000, // 5 minutes - cache templates to avoid unnecessary refetches
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
  });

  // Mutation for using a template (creates a document from template)
  const useTemplateMutation = useMutation({
    mutationFn: async ({ templateId, title }: { templateId: number; title: string }) => {
      setLoadingTemplateId(templateId);
      const response = await apiRequest(`/api/templates/${templateId}/use`, "POST", { title });
      return response.json();
    },
    onSuccess: (response) => {
      setLoadingTemplateId(null);
      toast({
        title: "Document created",
        description: "Template has been used to create a new document",
      });
      // Navigate to the new document for editing
      setLocation(`/document/${response.id}`);
    },
    onError: (error) => {
      setLoadingTemplateId(null);
      console.error("Use template error:", error);
      toast({
        title: "Error",
        description: "Failed to create document from template",
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting a template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      return await apiRequest(`/api/templates/${templateId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Template deleted",
        description: "Template has been successfully deleted",
      });
      // Force refetch of templates list
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.refetchQueries({ queryKey: ["/api/templates"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset to first page when search changes
  if (searchQuery && currentPage > 1) {
    setCurrentPage(1);
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredTemplates.length / templatesPerPage);
  const startIndex = (currentPage - 1) * templatesPerPage;
  const paginatedTemplates = filteredTemplates.slice(startIndex, startIndex + templatesPerPage);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handler functions
  const handleTemplateCardClick = (templateId: number) => {
    // Navigate to template editor to add/edit fields
    setLocation(`/templates/${templateId}/edit`);
  };

  const handleUseTemplate = (e: React.MouseEvent, templateId: number, templateTitle: string) => {
    e.stopPropagation(); // Prevent card click
    const title = `${templateTitle} (Copy)`;
    useTemplateMutation.mutate({ templateId, title });
  };

  const handleDeleteTemplate = (templateId: number) => {
    deleteTemplateMutation.mutate(templateId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-6 h-auto md:h-[89px] flex items-center justify-center">
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full max-w-7xl gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Templates</h1>
            <p className="text-sm text-slate-500 mt-1 hidden sm:block">
              Save time with reusable document templates
            </p>
          </div>
          <div className="shrink-0">
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>
      </header>

        {/* Search */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex justify-center">
          <div className="relative w-full max-w-7xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 max-w-md w-full"
            />
          </div>
        </div>

        {/* Templates List */}
        <main className="flex-1 overflow-auto p-4 md:p-8 flex justify-center">
          <div className="w-full max-w-7xl">
          {isLoading ? (
            <div className="space-y-3">
              {/* Show skeleton cards while loading */}
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="h-5 bg-slate-200 rounded w-1/3 mb-2"></div>
                        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="h-8 w-8 bg-slate-200 rounded"></div>
                        <div className="h-8 w-8 bg-slate-200 rounded"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <LayoutTemplate className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                Failed to load templates
              </h3>
              <p className="text-slate-600 mb-6">
                There was an error loading your templates. Please try refreshing the page.
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Refresh Page
              </Button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <LayoutTemplate className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {searchQuery ? "No templates found" : "No templates yet"}
              </h3>
              <p className="text-slate-600 mb-6">
                {searchQuery 
                  ? "Try adjusting your search terms" 
                  : "Create your first template to save time on repetitive documents"}
              </p>
              {!searchQuery && (
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Templates Count */}
              <div className="mb-6">
                <p className="text-sm text-slate-500">
                  Showing {Math.min(startIndex + 1, filteredTemplates.length)} - {Math.min(startIndex + templatesPerPage, filteredTemplates.length)} of {filteredTemplates.length} templates
                </p>
              </div>

              <div className="space-y-3">
                {paginatedTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow cursor-pointer border-slate-200 hover:border-slate-300" onClick={() => handleTemplateCardClick(template.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 hover:text-blue-600 transition-colors text-lg line-clamp-1">
                              {template.title}
                            </h3>
                            <p className="text-sm text-slate-600 line-clamp-1 mt-1">
                              {template.description}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Badge variant="secondary" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-slate-500">
                            <span>{formatDate(template.createdAt)}</span>
                            <span className="flex items-center">
                              <FileText className="h-4 w-4 mr-1" />
                              Used {template.usageCount || 0} times
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUseTemplate(e as any, template.id, template.title);
                              }}
                              disabled={loadingTemplateId === template.id}
                              title="Use template"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                            >
                              {loadingTemplateId === template.id ? (
                                <>
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2"></div>
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Use
                                </>
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={(e) => e.stopPropagation()}
                                  title="Delete template"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Template</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this template? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTemplate(template.id);
                                    }}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={page === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
          </div>
        </main>

        {/* Create Template Modal */}
        <CreateTemplateModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
        />
    </div>
  );
}