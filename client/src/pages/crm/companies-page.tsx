import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, Building2, Globe, MapPin, Users } from "lucide-react";

export default function CompaniesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", website: "", industry: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/crm/companies", searchQuery],
    queryFn: () => apiRequest("GET", `/api/crm/companies?search=${searchQuery}`).then(res => res.json()),
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/crm/companies", {
        body: data,
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      setIsCreateDialogOpen(false);
      setNewCompany({ name: "", website: "", industry: "" });
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Company</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : companies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company: any) => (
            <Link key={company.id} href={`/companies/${company.id}`}>
              <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{company.name}</h3>
                    {company.industry && (
                      <p className="text-sm text-gray-500">{company.industry}</p>
                    )}
                    {company.website && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <Globe className="h-3 w-3" />
                        <span className="truncate">{company.website}</span>
                      </div>
                    )}
                    {company.city && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <MapPin className="h-3 w-3" />
                        <span>{company.city}{company.state ? `, ${company.state}` : ""}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
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
