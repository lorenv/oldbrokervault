import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCompanyFilters } from "@/hooks/use-company-filters";
import { CompaniesFilterBuilderIntegration } from "@/components/crm/companies-filter-builder-integration";
import { CompaniesColumnConfig } from "@/components/crm/companies-column-config";
import { TablePagination } from "@/components/ui/pagination";
import {
  Plus,
  Search,
  Building2,
  Globe,
  MapPin,
  Users,
  X,
  Briefcase,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Trash2,
  Pencil,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function CompaniesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", website: "", industry: "", city: "", state: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditProperty, setBulkEditProperty] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState<string>("");

  // Use the company filters hook
  const {
    filters,
    updateFilter,
    clearFilters,
    activeFilterCount,
    sorting,
    toggleSort,
    columns,
    visibleColumns,
    toggleColumnVisibility,
    reorderColumns,
    buildQueryParams,
  } = useCompanyFilters();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/crm/companies", buildQueryParams()],
    queryFn: () => apiRequest("GET", `/api/crm/companies?${buildQueryParams()}`).then(res => res.json()),
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data: any) => {
      // Clean up empty strings to null for optional fields
      const cleanedData = {
        ...data,
        website: data.website?.trim() || null,
        industry: data.industry?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
      };
      return apiRequest("POST", "/api/crm/companies", {
        body: cleanedData,
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      setIsCreateDialogOpen(false);
      setNewCompany({ name: "", website: "", industry: "", city: "", state: "" });
      toast({ title: "Company created" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive"
      });
    },
  });

  const allCompanies = (data as any)?.companies || [];

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.industry, filters.city, filters.state]);

  // Pagination calculations
  const totalItems = allCompanies.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const companies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allCompanies.slice(start, start + pageSize);
  }, [allCompanies, currentPage, pageSize]);

  // Get sort icon for column
  const getSortIcon = (field: string) => {
    if (sorting.field !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    return sorting.direction === 'asc'
      ? <ArrowUp className="h-3 w-3 text-blue-600" />
      : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  // Export companies to CSV
  const handleExport = () => {
    if (allCompanies.length === 0) {
      toast({ title: "No companies to export", variant: "destructive" });
      return;
    }

    const headers = ["Name", "Industry", "Website", "City", "State", "Contacts", "Deals", "Created"];
    const rows = allCompanies.map((c: any) => [
      c.name || "",
      c.industry || "",
      c.website || "",
      c.city || "",
      c.state || "",
      c._count?.contacts || 0,
      c._count?.deals || 0,
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `companies-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: `Exported ${allCompanies.length} companies` });
  };

  // Selection handlers
  const toggleSelectCompany = (companyId: number) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(companies.map((c: any) => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedCompanies(new Set());
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedCompanies.size === 0) return;
    const promises = Array.from(selectedCompanies).map(id =>
      apiRequest("DELETE", `/api/crm/companies/${id}`)
    );
    try {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      toast({ title: `${selectedCompanies.size} company(ies) deleted` });
      clearSelection();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete some companies", variant: "destructive" });
    }
  };

  const handleBulkEdit = async () => {
    if (selectedCompanies.size === 0 || !bulkEditProperty || !bulkEditValue) return;

    const updateData: Record<string, any> = {};
    if (bulkEditProperty === 'industry') {
      updateData.industry = bulkEditValue;
    }

    const promises = Array.from(selectedCompanies).map(id =>
      apiRequest("PATCH", `/api/crm/companies/${id}`, { body: updateData })
    );

    try {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      toast({ title: `${selectedCompanies.size} company(ies) updated` });
      clearSelection();
      setIsBulkEditOpen(false);
      setBulkEditProperty("");
      setBulkEditValue("");
    } catch (error) {
      toast({ title: "Error", description: "Failed to update some companies", variant: "destructive" });
    }
  };

  const handleBulkExport = () => {
    const selectedCompaniesList = allCompanies.filter((c: any) => selectedCompanies.has(c.id));
    if (selectedCompaniesList.length === 0) return;

    const headers = ["Name", "Industry", "Website", "City", "State", "Contacts", "Deals", "Created"];
    const rows = selectedCompaniesList.map((c: any) => [
      c.name || "",
      c.industry || "",
      c.website || "",
      c.city || "",
      c.state || "",
      c._count?.contacts || 0,
      c._count?.deals || 0,
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `companies-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: `Exported ${selectedCompaniesList.length} company(ies)` });
  };

  // Render cell content based on column
  const renderCell = (company: any, columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <Link href={`/companies/${company.id}`} className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-3.5 w-3.5 text-gray-600" />
            </div>
            <div className="min-w-0">
              <span className="font-medium text-gray-900 group-hover:text-blue-600 truncate block">
                {company.name}
              </span>
            </div>
          </Link>
        );
      case 'industry':
        return company.industry ? (
          <Badge variant="outline" className="text-xs">
            {company.industry}
          </Badge>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'website':
        return company.website ? (
          <a
            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-blue-600 truncate block"
            onClick={(e) => e.stopPropagation()}
          >
            {company.website.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'location':
        return company.city || company.state ? (
          <span className="flex items-center gap-1 text-sm text-gray-600">
            <MapPin className="h-3 w-3 text-gray-400" />
            {company.city}{company.state ? `, ${company.state}` : ""}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'contacts':
        return (
          <span className="text-sm text-gray-600">
            {company._count?.contacts || 0}
          </span>
        );
      case 'deals':
        return (
          <span className="text-sm text-gray-600">
            {company._count?.deals || 0}
          </span>
        );
      case 'createdAt':
        return (
          <span className="text-sm text-gray-500">
            {company.createdAt ? new Date(company.createdAt).toLocaleDateString() : '-'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Companies</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search companies..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <CompaniesFilterBuilderIntegration
              filters={filters}
              updateFilter={updateFilter}
              clearFilters={clearFilters}
              activeFilterCount={activeFilterCount}
            />
            <CompaniesColumnConfig
              columns={columns}
              onToggleVisibility={toggleColumnVisibility}
              onReorder={reorderColumns}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={companies.length === 0}
              title="Export to CSV"
              className="h-8"
            >
              <Download className="h-4 w-4" />
            </Button>
            {/* View toggle */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2 rounded-r-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2 rounded-l-none"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto h-8">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Company</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-gray-500">Active filters:</span>
          {filters.industry && (
            <Badge variant="secondary" className="gap-1">
              Industry: {filters.industry}
              <button onClick={() => updateFilter('industry', '')} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.city && (
            <Badge variant="secondary" className="gap-1">
              City: {filters.city}
              <button onClick={() => updateFilter('city', '')} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.state && (
            <Badge variant="secondary" className="gap-1">
              State: {filters.state}
              <button onClick={() => updateFilter('state', '')} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.hasDeals && (
            <Badge variant="secondary" className="gap-1">
              Has Deals
              <button onClick={() => updateFilter('hasDeals', null)} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.hasContacts && (
            <Badge variant="secondary" className="gap-1">
              Has Contacts
              <button onClick={() => updateFilter('hasContacts', null)} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
            Clear all
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : companies.length > 0 ? (
        viewMode === 'list' ? (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {companies.map((company: any) => (
                <Link key={company.id} href={`/companies/${company.id}`}>
                  <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{company.name}</h3>
                        {company.industry && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {company.industry}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                      {company.website && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {company.website.replace(/^https?:\/\//, '')}
                        </span>
                      )}
                      {(company.city || company.state) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {company.city}{company.state ? `, ${company.state}` : ""}
                        </span>
                      )}
                      {company._count?.contacts > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {company._count.contacts} contacts
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Bulk Actions Bar */}
            {selectedCompanies.size > 0 && (
              <div className="hidden md:flex bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedCompanies.size} company(ies) selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setIsBulkEditOpen(true)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={handleBulkExport}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8">
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block w-full bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="py-2 px-3 w-10">
                        <Checkbox
                          checked={companies.length > 0 && selectedCompanies.size === companies.length}
                          onCheckedChange={toggleSelectAll}
                          className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                        />
                      </th>
                      {visibleColumns.map((column) => (
                        <th
                          key={column.id}
                          className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                          style={column.id === 'name' ? { width: '100%' } : { whiteSpace: 'nowrap' }}
                          onClick={() => toggleSort(column.id)}
                        >
                          <div className="flex items-center gap-1">
                            {column.label}
                            {getSortIcon(column.id)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company: any) => (
                      <tr key={company.id} className={`border-b hover:bg-gray-50/50 ${selectedCompanies.has(company.id) ? 'bg-blue-50/50' : ''}`}>
                        <td className="py-2 px-3 w-10">
                          <Checkbox
                            checked={selectedCompanies.has(company.id)}
                            onCheckedChange={() => toggleSelectCompany(company.id)}
                            className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                          />
                        </td>
                        {visibleColumns.map((column) => (
                          <td
                            key={column.id}
                            className="py-2 px-3"
                            style={column.id === 'name' ? { width: '100%' } : { whiteSpace: 'nowrap' }}
                          >
                            {renderCell(company, column.id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </>
        ) : (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((company: any) => (
              <Link key={company.id} href={`/companies/${company.id}`}>
                <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{company.name}</h3>
                      {company.industry && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {company.industry}
                        </Badge>
                      )}
                      {company.website && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                          <Globe className="h-3 w-3" />
                          <span className="truncate">{company.website}</span>
                        </div>
                      )}
                      {(company.city || company.state) && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <MapPin className="h-3 w-3" />
                          <span>{company.city}{company.state ? `, ${company.state}` : ""}</span>
                        </div>
                      )}
                      {(company._count?.contacts > 0 || company._count?.deals > 0) && (
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                          {company._count?.contacts > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {company._count.contacts} contacts
                            </span>
                          )}
                          {company._count?.deals > 0 && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {company._count.deals} deals
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No companies yet</h3>
          <p className="text-gray-500 mt-1">Get started by adding your first company.</p>
          <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                placeholder="e.g., Acme Corporation"
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={newCompany.website}
                onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input
                value={newCompany.industry}
                onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                placeholder="e.g., Technology"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={newCompany.city}
                  onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })}
                  placeholder="e.g., San Francisco"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={newCompany.state}
                  onChange={(e) => setNewCompany({ ...newCompany, state: e.target.value })}
                  placeholder="e.g., CA"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCompanyMutation.mutate(newCompany)}
              disabled={!newCompany.name.trim() || createCompanyMutation.isPending}
            >
              {createCompanyMutation.isPending ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={isBulkEditOpen} onOpenChange={(open) => {
        setIsBulkEditOpen(open);
        if (!open) {
          setBulkEditProperty("");
          setBulkEditValue("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {selectedCompanies.size} Company(ies)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Property to Edit</Label>
              <Select value={bulkEditProperty} onValueChange={(val) => {
                setBulkEditProperty(val);
                setBulkEditValue("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="industry">Industry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkEditProperty && (
              <div className="space-y-2">
                <Label>New Value</Label>
                {bulkEditProperty === 'industry' && (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Retail">Retail</SelectItem>
                      <SelectItem value="Real Estate">Real Estate</SelectItem>
                      <SelectItem value="Professional Services">Professional Services</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkEdit} disabled={!bulkEditProperty || !bulkEditValue}>
              Update {selectedCompanies.size} Company(ies)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
