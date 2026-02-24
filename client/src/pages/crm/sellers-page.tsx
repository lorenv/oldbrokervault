import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { TablePagination } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Users,
  Download,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react";

function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

export default function SellersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({ queryKey: ["/api/profile"], enabled: !!user });
  const brandColor = (profile as any)?.pdfPrimaryColor || (profile as any)?.brandColors?.[0];
  const needsDarkText = brandColor ? isLightColor(brandColor) : false;

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSeller, setNewSeller] = useState({ email: "", firstName: "", lastName: "", phone: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/crm/contacts", "seller", searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('contactType', 'seller');
      if (searchQuery) params.set('search', searchQuery);
      return apiRequest("GET", `/api/crm/contacts?${params.toString()}`).then(res => res.json());
    },
  });

  const allSellers = (data as any)?.contacts || [];

  const filteredSellers = useMemo(() => {
    let result = [...allSellers];
    result.sort((a: any, b: any) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [allSellers, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredSellers.length / pageSize));
  const paginatedSellers = filteredSellers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/crm/contacts", { body: data });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setIsCreateDialogOpen(false);
      setNewSeller({ email: "", firstName: "", lastName: "", phone: "" });
      toast({ title: "Seller created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/crm/contacts/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setSelectedContacts(new Set());
      toast({ title: "Deleted" });
    },
  });

  const handleCreate = () => {
    if (!newSeller.email) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      email: newSeller.email,
      firstName: newSeller.firstName || null,
      lastName: newSeller.lastName || null,
      phone: newSeller.phone || null,
      contactType: 'seller',
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const toggleAll = () => {
    if (selectedContacts.size === paginatedSellers.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(paginatedSellers.map((s: any) => s.id)));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExportCSV = () => {
    const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "Created"];
    const rows = filteredSellers.map((c: any) => [
      c.firstName || "", c.lastName || "", c.email || "", c.phone || "",
      c.company?.name || "", c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: string) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sellers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${!brandColor ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : ''}`}
            style={brandColor ? { backgroundColor: brandColor } : undefined}
          >
            <Users className={`h-5 w-5 ${brandColor && needsDarkText ? 'text-gray-900' : 'text-white'}`} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Sellers</h1>
            <p className="text-sm text-gray-500">{allSellers.length} seller contacts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" />Export
          </Button>
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Add Seller
          </Button>
        </div>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search sellers..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
        {selectedContacts.size > 0 && (
          <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(Array.from(selectedContacts))}>
            <Trash2 className="h-4 w-4 mr-1" />Delete ({selectedContacts.size})
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      ) : allSellers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No sellers yet</h3>
          <p className="text-gray-500 mb-4">Add seller contacts or set up a public intake form in settings.</p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Add Seller
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b bg-gray-50/50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="w-10 py-2 px-3">
                    <Checkbox checked={selectedContacts.size === paginatedSellers.length && paginatedSellers.length > 0} onCheckedChange={toggleAll} />
                  </th>
                  <th className="py-2 px-3 text-left cursor-pointer" style={{ width: '28%' }} onClick={() => handleSort('firstName')}>
                    <span className="flex items-center gap-1">Name <SortIcon field="firstName" /></span>
                  </th>
                  <th className="py-2 px-3 text-left cursor-pointer" style={{ width: '25%' }} onClick={() => handleSort('email')}>
                    <span className="flex items-center gap-1">Email <SortIcon field="email" /></span>
                  </th>
                  <th className="py-2 px-3 text-left" style={{ width: '15%' }}>Phone</th>
                  <th className="py-2 px-3 text-left" style={{ width: '18%' }}>Company</th>
                  <th className="py-2 px-3 text-left cursor-pointer" style={{ width: '14%' }} onClick={() => handleSort('createdAt')}>
                    <span className="flex items-center gap-1">Created <SortIcon field="createdAt" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedSellers.map((seller: any) => (
                  <tr key={seller.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="w-10 py-2 px-3">
                      <Checkbox checked={selectedContacts.has(seller.id)} onCheckedChange={() => toggleOne(seller.id)} />
                    </td>
                    <td className="py-2 px-3">
                      <Link href={`/sellers/${seller.id}`} className="font-medium text-gray-900 hover:text-blue-600 truncate block">
                        {seller.firstName} {seller.lastName}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-600 truncate">{seller.email || '-'}</td>
                    <td className="py-2 px-3 text-sm text-gray-600 truncate">{seller.phone || '-'}</td>
                    <td className="py-2 px-3 text-sm text-gray-600 truncate">{seller.company?.name || '-'}</td>
                    <td className="py-2 px-3 text-sm text-gray-600">{seller.createdAt ? new Date(seller.createdAt).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredSellers.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          />
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Seller Contact</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-700">First Name</Label>
                <Input value={newSeller.firstName} onChange={(e) => setNewSeller({ ...newSeller, firstName: e.target.value })} />
              </div>
              <div>
                <Label className="text-gray-700">Last Name</Label>
                <Input value={newSeller.lastName} onChange={(e) => setNewSeller({ ...newSeller, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-gray-700">Email *</Label>
              <Input type="email" value={newSeller.email} onChange={(e) => setNewSeller({ ...newSeller, email: e.target.value })} placeholder="seller@example.com" />
            </div>
            <div>
              <Label className="text-gray-700">Phone</Label>
              <Input value={newSeller.phone} onChange={(e) => setNewSeller({ ...newSeller, phone: e.target.value })} placeholder="(555) 123-4567" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Seller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
