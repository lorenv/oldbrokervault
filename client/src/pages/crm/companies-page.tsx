import { useState, useMemo, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  type CompanyFilters,
  DEFAULT_COMPANY_FILTERS,
} from "@/components/crm/companies-advanced-filters";
import { CompaniesFilterBuilderIntegration } from "@/components/crm/companies-filter-builder-integration";
import { Plus, Search, Building2, Globe, MapPin, Users, X, Briefcase, List, LayoutGrid } from "lucide-react";

export default function CompaniesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CompanyFilters>(DEFAULT_COMPANY_FILTERS);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", website: "", industry: "", city: "", state: "" });

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.industry) count++;
    if (filters.city) count++;
    if (filters.state) count++;
    if (filters.hasDeals !== null) count++;
    if (filters.hasContacts !== null) count++;
    if (filters.createdFrom) count++;
    if (filters.createdTo) count++;
    return count;
  }, [filters]);

  // Build query params
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.industry) params.set('industry', filters.industry);
    if (filters.city) params.set('city', filters.city);
    if (filters.state) params.set('state', filters.state);
    if (filters.hasDeals !== null) params.set('hasDeals', filters.hasDeals.toString());
    if (filters.hasContacts !== null) params.set('hasContacts', filters.hasContacts.toString());
    if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
    if (filters.createdTo) params.set('createdTo', filters.createdTo);
    return params.toString();
  }, [filters]);

  const updateFilter = useCallback(<K extends keyof CompanyFilters>(key: K, value: CompanyFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_COMPANY_FILTERS);
  }, []);

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

  const companies = (data as any)?.companies || [];

  return (
    <div className="p-4 md:p-6">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your company relationships</p>
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
            {/* View toggle */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2 rounded-r-none"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2 rounded-l-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
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
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        )
      ) : companies.length > 0 ? (
        viewMode === 'grid' ? (
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
        ) : (
          // List View
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase w-[30%]">Company</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase w-[20%]">Industry</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase w-[25%]">Location</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase w-[12.5%]">Contacts</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase w-[12.5%]">Deals</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company: any) => (
                  <tr key={company.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link href={`/companies/${company.id}`} className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-blue-600 hover:underline truncate block">
                            {company.name}
                          </span>
                          {company.website && (
                            <span className="text-xs text-gray-400 truncate block">
                              {company.website}
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      {company.industry ? (
                        <Badge variant="outline" className="text-xs">
                          {company.industry}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {company.city || company.state ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          {company.city}{company.state ? `, ${company.state}` : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {company._count?.contacts || 0}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {company._count?.deals || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  );
}
