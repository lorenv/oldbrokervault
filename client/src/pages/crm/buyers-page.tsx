import { useState, useEffect, useMemo, useCallback } from "react";
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
import { InlineEdit, InlineEditEmail } from "@/components/ui/inline-edit";
import { TablePagination } from "@/components/ui/pagination";
import {
  Plus,
  Search,
  User,
  Users,
  Mail,
  Building2,
  Phone,
  Download,
  Upload,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Trash2,
  Pencil,
  Briefcase,
  Shield,
  DollarSign,
  FileText,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

const BUYER_COLUMNS = [
  { id: 'name', label: 'Name', visible: true, order: 0 },
  { id: 'email', label: 'Email', visible: true, order: 1 },
  { id: 'company', label: 'Company', visible: true, order: 2 },
  { id: 'buyerType', label: 'Buyer Type', visible: true, order: 3 },
  { id: 'ndaCount', label: 'NDAs', visible: true, order: 4 },
  { id: 'financialCapability', label: 'Financial Capability', visible: true, order: 5 },
  { id: 'qualificationScore', label: 'Score', visible: true, order: 6 },
  { id: 'lastActivity', label: 'Last Activity', visible: true, order: 7 },
];

export default function BuyersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });
  const brandColor = (profile as any)?.pdfPrimaryColor || (profile as any)?.brandColors?.[0];
  const needsDarkText = brandColor ? isLightColor(brandColor) : false;

  const [searchQuery, setSearchQuery] = useState("");
  const [buyerTypeFilter, setBuyerTypeFilter] = useState("");
  const [financialCapFilter, setFinancialCapFilter] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({ email: "", firstName: "", lastName: "", phone: "", companyId: "", buyerType: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch buyers
  const { data, isLoading } = useQuery({
    queryKey: ["/api/crm/contacts", "buyer", searchQuery, sortField, sortDirection],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('contactType', 'buyer');
      if (searchQuery) params.set('search', searchQuery);
      params.set('sortField', sortField);
      params.set('sortOrder', sortDirection);
      return apiRequest("GET", `/api/crm/contacts?${params.toString()}`).then(res => res.json());
    },
  });

  const { data: companiesData } = useQuery({
    queryKey: ["/api/crm/companies"],
    queryFn: () => apiRequest("GET", "/api/crm/companies").then(res => res.json()),
  });
  const companies = (companiesData as any)?.companies || [];

  const createContactMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/crm/contacts", { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      setIsCreateDialogOpen(false);
      setNewContact({ email: "", firstName: "", lastName: "", phone: "", companyId: "", buyerType: "" });
      toast({ title: "Buyer created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create buyer", variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: Record<string, any> }) =>
      apiRequest("PATCH", `/api/crm/contacts/${contactId}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update buyer.", variant: "destructive" });
    },
  });

  const handleContactUpdate = useCallback(async (contactId: number, field: string, value: string | number | null) => {
    await updateContactMutation.mutateAsync({ contactId, data: { [field]: value } });
  }, [updateContactMutation]);

  const allContacts = (data as any)?.contacts || [];

  // Client-side filtering for buyer-specific fields
  const filteredContacts = useMemo(() => {
    let result = allContacts;
    if (buyerTypeFilter) {
      result = result.filter((c: any) => c.buyerType === buyerTypeFilter);
    }
    if (financialCapFilter) {
      result = result.filter((c: any) => c.financialCapability === financialCapFilter);
    }
    return result;
  }, [allContacts, buyerTypeFilter, financialCapFilter]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, buyerTypeFilter, financialCapFilter]);

  const totalItems = filteredContacts.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const contacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContacts.slice(start, start + pageSize);
  }, [filteredContacts, currentPage, pageSize]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 text-blue-600" />
      : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  const getBuyerTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      strategic: 'bg-blue-100 text-blue-700',
      financial: 'bg-green-100 text-green-700',
      individual: 'bg-orange-100 text-orange-700',
      search_fund: 'bg-purple-100 text-purple-700',
      family_office: 'bg-indigo-100 text-indigo-700',
      other: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      strategic: 'Strategic',
      financial: 'Financial',
      individual: 'Individual',
      search_fund: 'Search Fund',
      family_office: 'Family Office',
      other: 'Other',
    };
    return (
      <Badge className={`${colors[type] || colors.other} text-xs`}>
        {labels[type] || type}
      </Badge>
    );
  };

  const getFinancialCapBadge = (cap: string) => {
    const colors: Record<string, string> = {
      unverified: 'bg-gray-100 text-gray-600',
      self_reported: 'bg-yellow-100 text-yellow-700',
      proof_of_funds: 'bg-green-100 text-green-700',
      pre_approved: 'bg-emerald-100 text-emerald-700',
    };
    const labels: Record<string, string> = {
      unverified: 'Unverified',
      self_reported: 'Self-Reported',
      proof_of_funds: 'Proof of Funds',
      pre_approved: 'Pre-Approved',
    };
    return (
      <Badge className={`${colors[cap] || colors.unverified} text-xs`}>
        {labels[cap] || cap}
      </Badge>
    );
  };

  // Selection handlers
  const toggleSelectContact = (contactId: number) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((c: any) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    try {
      await Promise.all(Array.from(selectedContacts).map(id => apiRequest("DELETE", `/api/crm/contacts/${id}`)));
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"], refetchType: 'all' });
      toast({ title: `${selectedContacts.size} buyer(s) deleted` });
      setSelectedContacts(new Set());
    } catch {
      toast({ title: "Error", description: "Failed to delete some buyers", variant: "destructive" });
    }
  };

  const handleExport = () => {
    if (filteredContacts.length === 0) return;
    const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "Buyer Type", "Financial Capability", "Est. Budget", "Score", "Created"];
    const rows = filteredContacts.map((c: any) => [
      c.firstName || "", c.lastName || "", c.email || "", c.phone || "",
      c.company?.name || "", c.buyerType || "", c.financialCapability || "",
      c.estimatedBudget || "", c.qualificationScore ?? "", c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
    ]);
    const csvContent = [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `buyers-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: `Exported ${filteredContacts.length} buyers` });
  };

  const renderCell = (contact: any, columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <Link href={`/buyers/${contact.id}`} className="flex items-center gap-2 group">
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt={`${contact.firstName} ${contact.lastName}`} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-medium flex-shrink-0">
                {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">
              {contact.firstName} {contact.lastName}
            </span>
          </Link>
        );
      case 'email':
        return (
          <InlineEditEmail value={contact.email} onSave={(val) => handleContactUpdate(contact.id, 'email', val || null)} emptyText="Add email" />
        );
      case 'company':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select value={contact.companyId?.toString() || "none"} onValueChange={async (val) => {
              await handleContactUpdate(contact.id, 'companyId', val === "none" ? null : parseInt(val));
            }}>
              <SelectTrigger className="h-7 text-sm border-0 bg-transparent hover:bg-gray-100 px-2 -mx-2 min-w-[120px]">
                <SelectValue>{contact.company?.name || <span className="text-gray-400 italic">Add company</span>}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none"><span className="text-gray-400">No company</span></SelectItem>
                {companies.map((company: any) => (
                  <SelectItem key={company.id} value={company.id.toString()}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'buyerType':
        return contact.buyerType ? getBuyerTypeBadge(contact.buyerType) : <span className="text-sm text-gray-500">-</span>;
      case 'ndaCount':
        const ndaCount = contact.ndaCount || 0;
        if (ndaCount === 0) return <span className="text-sm text-gray-500">-</span>;
        return (
          <Link href={`/buyers/${contact.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
            <FileText className="h-3.5 w-3.5" />
            {ndaCount}
          </Link>
        );
      case 'financialCapability':
        return contact.financialCapability ? getFinancialCapBadge(contact.financialCapability) : <span className="text-sm text-gray-500">-</span>;
      case 'qualificationScore':
        if (contact.qualificationScore == null) return <span className="text-sm text-gray-500">-</span>;
        const score = contact.qualificationScore;
        const scoreColor = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';
        const barColor = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[60px]">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
            </div>
            <span className={`text-xs font-medium ${scoreColor}`}>{score}</span>
          </div>
        );
      case 'lastActivity':
        if (!contact.lastActivityDate) return <span className="text-sm text-gray-500">Never</span>;
        const activityDate = new Date(contact.lastActivityDate);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        let timeAgo = '';
        let colorClass = 'text-green-600';
        if (diffDays === 0) { timeAgo = 'Today'; }
        else if (diffDays === 1) { timeAgo = 'Yesterday'; }
        else if (diffDays < 7) { timeAgo = `${diffDays}d ago`; }
        else if (diffDays < 30) { timeAgo = `${Math.floor(diffDays / 7)}w ago`; colorClass = 'text-yellow-600'; }
        else if (diffDays < 90) { timeAgo = `${Math.floor(diffDays / 30)}mo ago`; colorClass = 'text-orange-500'; }
        else { timeAgo = activityDate.toLocaleDateString(); colorClass = 'text-red-500'; }
        return (
          <span className={`text-sm flex items-center gap-1 ${colorClass}`}>
            <Clock className="h-3 w-3" />{timeAgo}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 p-2 md:p-2.5 rounded-lg md:rounded-xl shadow-md"
            style={{
              background: brandColor
                ? `linear-gradient(to bottom right, ${brandColor}, ${brandColor}dd)`
                : 'linear-gradient(to bottom right, #059669, #047857)'
            }}
          >
            <Users className={`h-5 w-5 ${needsDarkText ? 'text-slate-800' : 'text-white'}`} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Buyers</h1>
            <p className="text-sm text-gray-500">{totalItems} buyer{totalItems !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search buyers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full sm:w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Select value={buyerTypeFilter || "all"} onValueChange={(val) => setBuyerTypeFilter(val === "all" ? "" : val)}>
              <SelectTrigger className="w-[140px] h-8">
                <Briefcase className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="strategic">Strategic</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="search_fund">Search Fund</SelectItem>
                <SelectItem value="family_office">Family Office</SelectItem>
              </SelectContent>
            </Select>
            <Select value={financialCapFilter || "all"} onValueChange={(val) => setFinancialCapFilter(val === "all" ? "" : val)}>
              <SelectTrigger className="w-[160px] h-8">
                <Shield className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                <SelectValue placeholder="All Capability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Capability</SelectItem>
                <SelectItem value="pre_approved">Pre-Approved</SelectItem>
                <SelectItem value="proof_of_funds">Proof of Funds</SelectItem>
                <SelectItem value="self_reported">Self-Reported</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredContacts.length === 0} title="Export to CSV">
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} className="h-8">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Buyer</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Active filters */}
      {(buyerTypeFilter || financialCapFilter) && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-gray-500">Active filters:</span>
          {buyerTypeFilter && (
            <Badge variant="secondary" className="gap-1">
              Type: {buyerTypeFilter.replace(/_/g, ' ')}
              <button onClick={() => setBuyerTypeFilter("")} className="ml-1 hover:text-red-600"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {financialCapFilter && (
            <Badge variant="secondary" className="gap-1">
              Capability: {financialCapFilter.replace(/_/g, ' ')}
              <button onClick={() => setFinancialCapFilter("")} className="ml-1 hover:text-red-600"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setBuyerTypeFilter(""); setFinancialCapFilter(""); }} className="h-6 text-xs">Clear all</Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : contacts.length > 0 ? (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {contacts.map((contact: any) => (
              <Link key={contact.id} href={`/buyers/${contact.id}`}>
                <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    {contact.avatarUrl ? (
                      <img src={contact.avatarUrl} alt={`${contact.firstName} ${contact.lastName}`} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-medium">
                        {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{contact.firstName} {contact.lastName}</h3>
                      <p className="text-sm text-gray-500 truncate">{contact.email}</p>
                    </div>
                    {contact.buyerType && getBuyerTypeBadge(contact.buyerType)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                    {contact.company?.name && (
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{contact.company.name}</span>
                    )}
                    {contact.estimatedBudget && (
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{contact.estimatedBudget}</span>
                    )}
                    {contact.ndaCount > 0 && (
                      <span className="flex items-center gap-1 text-blue-600 font-medium">
                        <FileText className="h-3 w-3" />{contact.ndaCount} NDA{contact.ndaCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {contact.qualificationScore != null && (
                      <span className={`flex items-center gap-1 font-medium ${contact.qualificationScore >= 70 ? 'text-green-600' : contact.qualificationScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        Score: {contact.qualificationScore}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Bulk Actions Bar */}
          {selectedContacts.size > 0 && (
            <div className="hidden md:flex bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-900">{selectedContacts.size} buyer{selectedContacts.size !== 1 ? 's' : ''} selected</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleBulkDelete}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedContacts(new Set())} className="h-8">
                <X className="h-3.5 w-3.5 mr-1" />Clear
              </Button>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="py-2 px-3 w-10">
                      <Checkbox
                        checked={contacts.length > 0 && selectedContacts.size === contacts.length}
                        onCheckedChange={toggleSelectAll}
                        className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                      />
                    </th>
                    {BUYER_COLUMNS.map((column) => (
                      <th
                        key={column.id}
                        className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                        style={{
                          width: column.id === 'name' ? '20%' :
                                 column.id === 'email' ? '18%' :
                                 column.id === 'company' ? '14%' :
                                 column.id === 'buyerType' ? '12%' :
                                 column.id === 'ndaCount' ? '7%' :
                                 column.id === 'financialCapability' ? '13%' :
                                 column.id === 'qualificationScore' ? '8%' :
                                 '8%'
                        }}
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
                  {contacts.map((contact: any) => (
                    <tr key={contact.id} className={`border-b hover:bg-gray-50/50 ${selectedContacts.has(contact.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="py-2 px-3 w-10">
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => toggleSelectContact(contact.id)}
                          className="border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400"
                        />
                      </td>
                      {BUYER_COLUMNS.map((column) => (
                        <td key={column.id} className="py-2 px-3">{renderCell(contact, column.id)}</td>
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
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No buyers yet</h3>
          <p className="text-gray-500 mt-1">Get started by adding your first buyer contact.</p>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />Add Buyer
          </Button>
        </div>
      )}

      {/* Create Buyer Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Buyer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={newContact.firstName} onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={newContact.lastName} onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={newContact.companyId || "none"} onValueChange={(val) => setNewContact({ ...newContact, companyId: val === "none" ? "" : val })}>
                <SelectTrigger><SelectValue placeholder="Select a company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No company</SelectItem>
                  {companies.map((company: any) => (
                    <SelectItem key={company.id} value={company.id.toString()}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buyer Type</Label>
              <Select value={newContact.buyerType || "none"} onValueChange={(val) => setNewContact({ ...newContact, buyerType: val === "none" ? "" : val })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="strategic">Strategic</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="search_fund">Search Fund</SelectItem>
                  <SelectItem value="family_office">Family Office</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                createContactMutation.mutate({
                  ...newContact,
                  contactType: 'buyer',
                  companyId: newContact.companyId ? parseInt(newContact.companyId) : null,
                  buyerType: newContact.buyerType || null,
                });
              }}
              disabled={!newContact.email.trim() || createContactMutation.isPending}
            >
              {createContactMutation.isPending ? "Creating..." : "Create Buyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
