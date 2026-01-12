import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CimDocument } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandedButton } from "@/components/ui/branded-button";
import { FileText, Download, Lock, Copy, Globe, Search, Trash2, FileDown, Clock, Share2, Mail, Loader2, PenTool, Eye, ChevronLeft, ChevronRight, Plus, Copy as DuplicateIcon, Link as LinkIcon, MoreVertical, Edit, LayoutGrid, List, Shield, Users, Calendar, X, ArrowUpDown, ArrowUp, ArrowDown, Filter, FolderOpen, Kanban, FileQuestion } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useBrandColor } from "@/hooks/use-brand-color";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { getBaseUrlWithSubdomain } from "@/lib/url-utils";
import { EmailShareDialog } from "@/components/email-share-dialog";
import { PageHeader } from "@/components/layout/page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from 'date-fns'; // Import format function

// Define interface for CIM documents with analysis
interface CimDocumentWithAnalysis extends CimDocument {
  shareViewCount: number;
  hasNdaSignatures?: boolean;
  ndaSignatureCount?: number; // Assuming ndaSignatureCount is a property from the backend
  pendingNdaCount?: number; // Number of NDA signatures pending approval
  dealId?: number | null;
  dealName?: string | null;
}

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [emailShareDialog, setEmailShareDialog] = useState<{
    open: boolean;
    documentId?: number;
    documentTitle?: string;
    shareToken?: string;
  }>({ open: false });
  const [exportingDocId, setExportingDocId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    return (localStorage.getItem('documentsViewMode') as 'card' | 'list') || 'card';
  });

  // Filter and sort state
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'signatures'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { brandColor } = useBrandColor();
  const queryClient = useQueryClient();

  // Fetch user limits for duplicate validation
  const { data: userLimits } = useQuery<{
    canCreateDocument: boolean;
    canRegenerate: boolean;
    documentsCreated: number;
    documentLimit: number;
    regenerationsUsed: number;
    regenerationLimit: number;
    subscriptionStatus: string;
  }>({
    queryKey: ["/api/user/limits"],
    staleTime: 1000 * 30, // 30 seconds
  });

  // Fetch deals for filter dropdown
  const { data: dealsData } = useQuery<any[]>({
    queryKey: ["/api/crm/deals"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Debounce search query
  const debouncedSearchQuery = useMemo(() => {
    const timer = setTimeout(() => searchQuery, 300);
    return searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [activeFilters]);

  // Reset to page 1 when sorting changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [sortBy, sortOrder]);

  // Reset to page 1 when deal filter changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [selectedDealId]);

  // Fetch documents with pagination
  const { data: paginatedData, isLoading: documentsLoading } = useQuery<{
    documents: CimDocumentWithAnalysis[];
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ["/api/cim", currentPage, debouncedSearchQuery, activeFilters, selectedDealId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "12"
      });
      if (debouncedSearchQuery) {
        params.append("search", debouncedSearchQuery);
      }
      if (activeFilters.length > 0) {
        params.append("filters", activeFilters.join(','));
      }
      if (selectedDealId) {
        params.append("dealId", selectedDealId.toString());
      }
      const response = await fetch(`/api/cim?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  const rawDocuments = paginatedData?.documents || [];

  // Apply client-side sorting only (filters are now handled by backend)
  const documents = useMemo(() => {
    let sorted = [...rawDocuments];

    // Apply sorting
    sorted.sort((a, b) => {
      let compareValue = 0;

      if (sortBy === 'date') {
        compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'views') {
        compareValue = (a.shareViewCount || 0) - (b.shareViewCount || 0);
      } else if (sortBy === 'signatures') {
        compareValue = (a.ndaSignatureCount || 0) - (b.ndaSignatureCount || 0);
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [rawDocuments, sortBy, sortOrder]);

  const totalDocuments = paginatedData?.total || 0;
  const hasMore = paginatedData?.hasMore || false;
  const totalPages = Math.ceil(totalDocuments / 12);

  // Filter options
  const filterOptions = [
    { id: 'has-published-teaser', label: 'Published Teaser', icon: Globe, color: 'emerald' },
    { id: 'nda-protected', label: 'NDA Protected', icon: Shield, color: 'purple' },
    { id: 'has-signatures', label: 'Has Signatures', icon: Users, color: 'blue' },
    { id: 'created-this-week', label: 'Created This Week', icon: Calendar, color: 'green' },
    { id: 'has-views', label: 'Has Views', icon: Eye, color: 'orange' },
    { id: 'orphan', label: 'No Deal', icon: FileQuestion, color: 'slate' },
  ];

  const toggleFilter = (filterId: string) => {
    setActiveFilters(prev =>
      prev.includes(filterId)
        ? prev.filter(f => f !== filterId)
        : [...prev, filterId]
    );
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
    setSelectedDealId(null);
  };

  const toggleSort = (newSortBy: 'date' | 'views' | 'signatures') => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cim/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      setConfirmDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    }
  });

  // Duplicate document mutation
  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      // First check user limits
      if (!userLimits?.canCreateDocument) {
        throw new Error(`Cannot create new document - you've reached your limit of ${userLimits?.documentLimit || 1} documents for your ${userLimits?.subscriptionStatus || 'free'} subscription.`);
      }

      const response = await apiRequest("POST", `/api/cim/${id}/duplicate`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate document');
      }
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/limits"] });
      toast({
        title: "Document Duplicated",
        description: `"${result.title}" has been duplicated successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Duplication Failed",
        description: error instanceof Error ? error.message : "Failed to duplicate document",
        variant: "destructive",
      });
    }
  });

  // Handle PDF export
  const handleExport = async (docId: number, format: 'pdf' | 'word') => {
    setExportingDocId(docId);

    // Show immediate loading toast
    toast({
      title: "Export Starting",
      description: `Generating ${format.toUpperCase()} document...`
    });

    try {
      const response = await fetch(`/api/cim/export/${format}/${docId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`${format.toUpperCase()} export failed`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CIM.${format === 'pdf' ? 'pdf' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Complete",
        description: `Your CIM has been downloaded as a ${format.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: `Failed to export ${format.toUpperCase()}. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setExportingDocId(null);
    }
  };

  const toggleViewMode = (mode: 'card' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('documentsViewMode', mode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-x-hidden">
      <main className="container mx-auto px-4 md:px-6 py-4 md:py-6">
        <PageHeader
          title="My CIMs"
          description="Manage and share your CIM documents"
          icon={<FolderOpen className="h-5 w-5" />}
          actions={
            <Link href="/dashboard?mode=cim">
              <Button variant="outline" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create New CIM</span>
              </Button>
            </Link>
          }
        />

        <div className="flex flex-col gap-4 mb-6">
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
              <Input
                placeholder="Search documents..."
                className="pl-9 w-full text-sm sm:text-base border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1 self-end sm:self-auto">
              <Button
                variant={viewMode === 'card' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => toggleViewMode('card')}
                title="Card View"
                className={viewMode === 'card' ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => toggleViewMode('list')}
                title="List View"
                className={viewMode === 'list' ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filter Chips and Sorting */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Filter className="h-4 w-4" />
                <span className="font-medium">Filters:</span>
              </div>
              {filterOptions.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilters.includes(filter.id);
                const colorClasses = {
                  emerald: isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50',
                  purple: isActive ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50',
                  blue: isActive ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50',
                  green: isActive ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-green-600 border-green-200 hover:bg-green-50',
                  orange: isActive ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50',
                  slate: isActive ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                };

                return (
                  <button
                    key={filter.id}
                    onClick={() => toggleFilter(filter.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${colorClasses[filter.color as keyof typeof colorClasses]} ${isActive ? 'shadow-sm' : ''}`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{filter.label}</span>
                    {isActive && <X className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
              {/* Deal filter dropdown */}
              {dealsData && dealsData.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                        selectedDealId
                          ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
                          : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                      }`}
                    >
                      <Kanban className="h-3 w-3" />
                      <span>{selectedDealId ? dealsData.find((d: any) => d.id === selectedDealId)?.name || 'Deal' : 'By Deal'}</span>
                      {selectedDealId && <X className="h-3 w-3 ml-0.5" onClick={(e) => { e.stopPropagation(); setSelectedDealId(null); }} />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                    {dealsData.map((deal: any) => (
                      <DropdownMenuItem
                        key={deal.id}
                        onClick={() => setSelectedDealId(deal.id)}
                        className={selectedDealId === deal.id ? 'bg-indigo-50' : ''}
                      >
                        <Kanban className="mr-2 h-4 w-4" />
                        {deal.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {(activeFilters.length > 0 || selectedDealId) && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">Sort:</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSort('date')}
                  className={`text-xs ${sortBy === 'date' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'text-gray-600'}`}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Date
                  {sortBy === 'date' && (
                    sortOrder === 'desc' ? <ArrowDown className="h-3 w-3 ml-1" /> : <ArrowUp className="h-3 w-3 ml-1" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSort('views')}
                  className={`text-xs ${sortBy === 'views' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'text-gray-600'}`}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Views
                  {sortBy === 'views' && (
                    sortOrder === 'desc' ? <ArrowDown className="h-3 w-3 ml-1" /> : <ArrowUp className="h-3 w-3 ml-1" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSort('signatures')}
                  className={`text-xs ${sortBy === 'signatures' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'text-gray-600'}`}
                >
                  <Users className="h-3 w-3 mr-1" />
                  Signatures
                  {sortBy === 'signatures' && (
                    sortOrder === 'desc' ? <ArrowDown className="h-3 w-3 ml-1" /> : <ArrowUp className="h-3 w-3 ml-1" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Animation */}
        {documentsLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative h-8 w-8 mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <div className="absolute inset-0 h-8 w-8 animate-ping text-blue-400 opacity-75">
                <Loader2 className="h-8 w-8" />
              </div>
            </div>
            <p className="text-gray-600">Loading your CIM documents...</p>
          </div>
        )}

        {/* Documents Display - Card or List View */}
        {!documentsLoading && viewMode === 'card' && (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {documents?.map((doc) => (
              <Card key={doc.id} className="group relative hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 border border-gray-100 shadow-lg bg-white overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: brandColor ? `linear-gradient(to right, ${brandColor}, ${brandColor}aa)` : 'linear-gradient(to right, #3b82f6, #6366f1, #8b5cf6)' }}
                ></div>
                <Link href={`/documents/${doc.id}?tab=analytics`} className="block">
                  <div className="cursor-pointer">
                    <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                      <div className="flex justify-between items-start gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {doc.logoUrl && (
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md border-2 border-white flex items-center justify-center overflow-hidden ring-2 ring-gray-100">
                                  <img
                                    src={doc.logoUrl}
                                    alt="Company logo"
                                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                            <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 truncate">
                              {doc.title}
                            </CardTitle>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 flex-shrink-0 text-blue-500" />
                              <span className="hidden sm:inline">{new Date(doc.createdAt).toLocaleDateString()}</span>
                              <span className="sm:hidden">{new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3 flex-shrink-0 text-green-500" />
                              <span>{doc.shareViewCount || 0} view{(doc.shareViewCount || 0) !== 1 ? 's' : ''}</span>
                            </div>
                            {doc.ndaSignatureCount && doc.ndaSignatureCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3 flex-shrink-0 text-orange-500" />
                                <span>{doc.ndaSignatureCount} signature{doc.ndaSignatureCount !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 p-3 sm:p-6 sm:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        {/* Shared document badge, NDA Protected badge and Pending Approvals */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {(doc as any).isSharedWithUser && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200 shadow-sm">
                              <Users className="h-3 w-3 flex-shrink-0" />
                              <span>Shared with you</span>
                            </div>
                          )}
                          {doc.ndaProtected && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200 shadow-sm">
                              <Shield className="h-3 w-3 flex-shrink-0" />
                              <span>NDA Protected</span>
                            </div>
                          )}
                          {doc.pendingNdaCount && doc.pendingNdaCount > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium border border-orange-200 shadow-sm">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span>{doc.pendingNdaCount} pending</span>
                            </div>
                          )}
                          {doc.dealName && (
                            <Link href={`/deals/${doc.dealId}`} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-200 shadow-sm hover:bg-indigo-100 transition-colors">
                                <Kanban className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate max-w-[100px]">{doc.dealName}</span>
                              </div>
                            </Link>
                          )}
                        </div>

                        {/* Action buttons - horizontal layout */}
                        <div className="flex items-center gap-1">
                          {/* Quick action buttons - hidden on mobile/tablet, visible on desktop */}
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hidden lg:flex h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = `/documents/${doc.id}?tab=edit`;
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="bg-slate-800 text-white px-3 py-1.5 text-sm font-medium">
                                Edit CIM
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hidden lg:flex h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(`/share/${doc.shareSlug}`, '_blank');
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="bg-slate-800 text-white px-3 py-1.5 text-sm font-medium">
                                Preview CIM
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hidden lg:flex h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (doc.shareSlug) {
                                      navigator.clipboard.writeText(`${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${doc.shareSlug}`);
                                      toast({
                                        title: "Share link copied",
                                        description: "The share link has been copied to your clipboard"
                                      });
                                    } else {
                                      toast({
                                        title: "No Share Link Available",
                                        description: "This document doesn't have sharing enabled",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                >
                                  <LinkIcon className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="bg-slate-800 text-white px-3 py-1.5 text-sm font-medium">
                                Copy Share Link
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* More options dropdown - always visible */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open(`/share/${doc.shareSlug}`, '_blank');
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview CIM
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (doc.shareSlug) {
                            navigator.clipboard.writeText(`${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${doc.shareSlug}`);
                            toast({
                              title: "Share link copied",
                              description: "The share link has been copied to your clipboard"
                            });
                          } else {
                            toast({
                              title: "No Share Link Available",
                              description: "This document doesn't have sharing enabled",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.href = `/documents/${doc.id}?tab=edit`;
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit CIM
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.href = `/documents/${doc.id}?tab=share`;
                        }}
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Share Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!doc.shareSlug) {
                            toast({
                              title: "Sharing Not Enabled",
                              description: "Please enable sharing for this document first",
                              variant: "destructive"
                            });
                            return;
                          }
                          setEmailShareDialog({
                            open: true,
                            documentId: doc.id,
                            documentTitle: doc.title,
                            shareToken: doc.shareSlug
                          });
                        }}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Share via Email
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          duplicateMutation.mutate(doc.id);
                        }}
                        disabled={duplicateMutation.isPending || !userLimits?.canCreateDocument}
                      >
                        {duplicateMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <DuplicateIcon className="mr-2 h-4 w-4" />
                        )}
                        {duplicateMutation.isPending ? "Duplicating..." : "Duplicate Document"}
                      </DropdownMenuItem>

                      {/* Show additional options only for generated CIMs, not uploaded files */}
                      {!doc.isUploadedFile && user?.subscriptionStatus !== "free" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleExport(doc.id, 'pdf');
                            }}
                            disabled={exportingDocId === doc.id}
                          >
                            {exportingDocId === doc.id ? (
                              <Loader2 className="mr-2 h-4 w-4 text-red-600 animate-spin" />
                            ) : (
                              <FileDown className="mr-2 h-4 w-4 text-red-600" />
                            )}
                            {exportingDocId === doc.id ? "Generating PDF..." : "Export to PDF"}
                          </DropdownMenuItem>
                        </>
                      )}

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmDelete(doc.id);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}

        {/* Documents Display - List View */}
        {!documentsLoading && viewMode === 'list' && (
          <div className="space-y-2">
            {documents?.map((doc) => (
              <div key={doc.id} className="relative">
                <Link href={`/documents/${doc.id}?tab=analytics`}>
                  <div className="group cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200 border border-gray-200 hover:border-blue-300 rounded-lg p-3 sm:p-4 bg-white shadow-md hover:shadow-xl">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left side - Logo and Title */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {doc.logoUrl && (
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md border-2 border-white flex items-center justify-center overflow-hidden ring-2 ring-gray-100">
                              <img
                                src={doc.logoUrl}
                                alt="Company logo"
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                            {doc.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-blue-500" />
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3 text-green-500" />
                              {doc.shareViewCount || 0} views
                            </span>
                            {doc.ndaSignatureCount && doc.ndaSignatureCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-orange-500" />
                                {doc.ndaSignatureCount} signatures
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side - Status and Actions */}
                      <div className="flex items-center gap-3">
                        {/* Shared with you badge */}
                        {(doc as any).isSharedWithUser && (
                          <div className="hidden sm:flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200 shadow-sm">
                            <Users className="h-3 w-3" />
                            <span>Shared with you</span>
                          </div>
                        )}
                        {/* NDA Protected badge */}
                        {doc.ndaProtected && (
                          <div className="hidden sm:flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200 shadow-sm">
                            <Shield className="h-3 w-3" />
                            <span>NDA Protected</span>
                          </div>
                        )}
                        {/* Pending NDA Approvals badge */}
                        {doc.pendingNdaCount && doc.pendingNdaCount > 0 && (
                          <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium border border-orange-200 shadow-sm">
                            <Clock className="h-3 w-3" />
                            <span>{doc.pendingNdaCount} pending</span>
                          </div>
                        )}
                        {/* Deal badge */}
                        {doc.dealName && (
                          <Link href={`/deals/${doc.dealId}`} onClick={(e) => e.stopPropagation()}>
                            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-200 shadow-sm hover:bg-indigo-100 transition-colors">
                              <Kanban className="h-3 w-3" />
                              <span className="truncate max-w-[100px]">{doc.dealName}</span>
                            </div>
                          </Link>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hidden lg:flex h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = `/documents/${doc.id}?tab=edit`;
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="bg-slate-800 text-white px-3 py-1.5 text-sm font-medium">
                                Edit CIM
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hidden lg:flex h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(`/share/${doc.shareSlug}`, '_blank');
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="bg-slate-800 text-white px-3 py-1.5 text-sm font-medium">
                                Preview CIM
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hidden lg:flex h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (doc.shareSlug) {
                                      navigator.clipboard.writeText(`${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${doc.shareSlug}`);
                                      toast({
                                        title: "Share link copied",
                                        description: "The share link has been copied to your clipboard"
                                      });
                                    } else {
                                      toast({
                                        title: "No Share Link Available",
                                        description: "This document doesn't have sharing enabled",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                >
                                  <LinkIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="bg-slate-800 text-white px-3 py-1.5 text-sm font-medium">
                                Copy Share Link
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* More options dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  window.open(`/share/${doc.shareSlug}`, '_blank');
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Preview CIM
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (doc.shareSlug) {
                                    navigator.clipboard.writeText(`${window.location.hostname === "localhost" ? window.location.origin : "https://cimshare.com"}/share/${doc.shareSlug}`);
                                    toast({
                                      title: "Share link copied",
                                      description: "The share link has been copied to your clipboard"
                                    });
                                  } else {
                                    toast({
                                      title: "No Share Link Available",
                                      description: "This document doesn't have sharing enabled",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                <LinkIcon className="mr-2 h-4 w-4" />
                                Copy Share Link
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  window.location.href = `/documents/${doc.id}?tab=edit`;
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit CIM
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  window.location.href = `/documents/${doc.id}?tab=share`;
                                }}
                              >
                                <Share2 className="mr-2 h-4 w-4" />
                                Share Settings
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!doc.shareSlug) {
                                    toast({
                                      title: "Sharing Not Enabled",
                                      description: "Please enable sharing for this document first",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  setEmailShareDialog({
                                    open: true,
                                    documentId: doc.id,
                                    documentTitle: doc.title,
                                    shareToken: doc.shareSlug
                                  });
                                }}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Share via Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  duplicateMutation.mutate(doc.id);
                                }}
                                disabled={duplicateMutation.isPending || !userLimits?.canCreateDocument}
                              >
                                {duplicateMutation.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <DuplicateIcon className="mr-2 h-4 w-4" />
                                )}
                                {duplicateMutation.isPending ? "Duplicating..." : "Duplicate Document"}
                              </DropdownMenuItem>
                              {!doc.isUploadedFile && user?.subscriptionStatus !== "free" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleExport(doc.id, 'pdf');
                                    }}
                                    disabled={exportingDocId === doc.id}
                                  >
                                    {exportingDocId === doc.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 text-red-600 animate-spin" />
                                    ) : (
                                      <FileDown className="mr-2 h-4 w-4 text-red-600" />
                                    )}
                                    {exportingDocId === doc.id ? "Generating PDF..." : "Export to PDF"}
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmDelete(doc.id);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Empty States */}
        {!documentsLoading && documents?.length === 0 && totalDocuments !== 0 && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg border border-gray-100">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No documents match your search</p>
              <p className="text-sm text-gray-500 mt-2">Try a different search term</p>
            </div>
          </div>
        )}

        {!documentsLoading && totalDocuments === 0 && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg border border-blue-200">
              <FileText className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <p className="text-gray-800 font-semibold text-lg mb-2">No CIM documents yet</p>
              <p className="text-gray-600 mb-6">Get started by creating your first CIM</p>
              <Link href="/dashboard?mode=cim">
                <BrandedButton>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First CIM
                </BrandedButton>
              </Link>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>
                Showing {((currentPage - 1) * 12) + 1} to {Math.min(currentPage * 12, totalDocuments)} of {totalDocuments} documents
              </span>
              {debouncedSearchQuery && (
                <span>
                  (filtered by "{debouncedSearchQuery}")
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || documentsLoading}
                className="text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={documentsLoading}
                      className={currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700 shadow-md" : "text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all duration-200"}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || documentsLoading}
                className="text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all duration-200"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this CIM document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Share Dialog */}
      <EmailShareDialog
        open={emailShareDialog.open}
        onOpenChange={(open) => setEmailShareDialog(prev => ({ ...prev, open }))}
        documentTitle={emailShareDialog.documentTitle || ''}
        shareUrl={emailShareDialog.shareToken ? `${getBaseUrlWithSubdomain(user?.customSubdomain)}/share/${emailShareDialog.shareToken}` : ''}
        senderName={user?.name || undefined}
      />
    </div>
  );
}