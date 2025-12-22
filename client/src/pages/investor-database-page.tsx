import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { BrandedButton } from "@/components/ui/branded-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { InvestorHeatMap } from "@/components/investor-heat-map";
import { ContactDetailModal } from "@/components/contact-detail-modal";
import { PageHeader } from "@/components/layout/page-header";
import {
  Search,
  Download,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Edit,
  Calendar,
  Users,
  FileText,
  Copy,
  Clock,
  RefreshCw,
  Tag,
  Plus,
  X,
  Eye,
  HelpCircle,
  MapPin,
  Check,
  ChevronsUpDown,
  Trash2,
  Mail,
  MoreHorizontal,
  LayoutGrid,
  List,
  AlertCircle,
  ExternalLink,
  Merge,
  GripVertical,
  Settings,
  ChevronLeft
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { InvestorContact } from "@shared/schema";

// CIM Multi-Select Component
function CimMultiSelect({
  value,
  onChange,
  cimDocuments
}: {
  value: string;
  onChange: (value: string) => void;
  cimDocuments: any[]
}) {
  const [cimSearch, setCimSearch] = useState('');
  const [open, setOpen] = useState(false);
  const selectedIds = value ? value.split(',').filter(Boolean) : [];
  const filteredDocs = cimDocuments?.filter((doc: any) =>
    doc.title.toLowerCase().includes(cimSearch.toLowerCase())
  ) || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="flex-1 justify-between h-9 font-normal"
        >
          {selectedIds.length > 0 ? (
            <span className="truncate">
              {selectedIds.length === 1
                ? cimDocuments?.find((doc: any) => doc.id.toString() === selectedIds[0])?.title || 'Select CIM...'
                : `${selectedIds.length} CIMs selected`}
            </span>
          ) : (
            <span className="text-muted-foreground">Select CIM...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-2" align="start">
        <div className="space-y-2">
          <Input
            placeholder="Search CIM documents..."
            value={cimSearch}
            onChange={(e) => setCimSearch(e.target.value)}
            className="h-8"
          />
          <ScrollArea className="h-[200px]">
            <div className="space-y-1">
              {filteredDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No CIM found</p>
              ) : (
                filteredDocs.map((doc: any) => {
                  const isSelected = selectedIds.includes(doc.id.toString());
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent"
                      onClick={() => {
                        const newSelectedIds = isSelected
                          ? selectedIds.filter(id => id !== doc.id.toString())
                          : [...selectedIds, doc.id.toString()];
                        onChange(newSelectedIds.join(','));
                      }}
                    >
                      <Checkbox checked={isSelected} />
                      <span className="text-sm truncate flex-1">{doc.title}</span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          {selectedIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onChange('')}
            >
              Clear selection
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DocumentInfo {
  documentId: number;
  documentTitle: string;
  signedAt: string;
  signerName: string;
  cimDocumentId: number;
  signatureId: number;
}

interface EnrichedContact extends InvestorContact {
  totalNdaSignatures: number;
  documents: DocumentInfo[];
  lastNdaSigned: number | null;
  company?: string;
  inferredCompany?: string;
}

const statusOptions = [
  { value: 'new', label: 'New', color: 'bg-blue-200' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-200' },
  { value: 'interested', label: 'Interested', color: 'bg-green-200' },
  { value: 'under_review', label: 'Under Review', color: 'bg-purple-200' },
  { value: 'declined', label: 'Declined', color: 'bg-red-200' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-300' }
];

// Predefined colorful tag options
const tagColors = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 
  'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
];

// Filter fields will be defined inside the component

const operatorsByType = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'greater_equal', label: 'Greater than or equal' },
    { value: 'less_equal', label: 'Less than or equal' }
  ],
  date: [
    { value: 'is', label: 'Is' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'within_last', label: 'Within last' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  select: [
    { value: 'is', label: 'Is' },
    { value: 'is_not', label: 'Is not' }
  ],
  boolean: [
    { value: 'is', label: 'Is' }
  ]
};

interface FilterRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicOperator?: 'AND' | 'OR';
}

export default function InvestorDatabasePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearch();

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cimFilter, setCimFilter] = useState<string[]>([]); // Multi-select CIM filter
  const [cimFilterSearch, setCimFilterSearch] = useState('');
  const [cimFilterOpen, setCimFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('lastSeenAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [advancedFilters, setAdvancedFilters] = useState<FilterRule[]>([{
    id: 'default',
    field: 'status',
    operator: 'equals',
    value: '',
    logicOperator: undefined
  }]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Selection state
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [viewingContact, setViewingContact] = useState<EnrichedContact | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  
  // Advanced filtering state
  const [filters, setFilters] = useState<Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
  }>>([]);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  
  // Edit dialog state
  const [editingContact, setEditingContact] = useState<EnrichedContact | null>(null);
  const [editForm, setEditForm] = useState({
    notes: '',
    tags: [] as string[],
    status: 'new',
    lastContactDate: '',
    nextFollowUpDate: ''
  });
  
  // Tag management state
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Collapsible state for heat map
  const [isHeatMapOpen, setIsHeatMapOpen] = useState(true);

  // Column visibility state (persisted to localStorage)
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('investor-database-columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {
      name: true,
      email: true,
      company: true,
      status: true,
      followUp: true,
      notes: true,
      tags: true,
      ndas: true
    };
  });

  // Column definitions for customization
  const columnDefinitions = [
    { id: 'name', label: 'Name', sortable: true, sortKey: 'name', required: true },
    { id: 'email', label: 'Email', sortable: true, sortKey: 'email' },
    { id: 'company', label: 'Company', sortable: false },
    { id: 'status', label: 'Status', sortable: true, sortKey: 'status' },
    { id: 'followUp', label: 'Follow-up', sortable: true, sortKey: 'nextFollowUpDate' },
    { id: 'notes', label: 'Notes', sortable: false },
    { id: 'tags', label: 'Tags', sortable: false },
    { id: 'ndas', label: 'NDAs', sortable: true, sortKey: 'totalNdaSignatures' }
  ];

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('investor-database-columns', JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const toggleColumnVisibility = (columnId: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };

  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length;

  // Manual add contact state
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [addContactForm, setAddContactForm] = useState({
    name: '',
    email: '',
    notes: '',
    tags: [] as string[],
    status: 'new',
    location: '',
    nextFollowUpDate: ''
  });

  // Bulk action state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');

  // Fetch custom tags
  const { data: customTags = [] } = useQuery<Array<{id: number, name: string, color: string}>>({
    queryKey: ['/api/custom-tags'],
    queryFn: async () => {
      const response = await fetch('/api/custom-tags', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch custom tags');
      return response.json();
    }
  });

  // Function to apply advanced filters
  const applyAdvancedFilters = (contacts: EnrichedContact[]): EnrichedContact[] => {
    if (advancedFilters.length === 0) return contacts;

    return contacts.filter(contact => {
      let result = true;
      let hasOrCondition = false;
      let orResult = false;

      for (const filter of advancedFilters) {
        if (!filter.value && !['is_empty', 'is_not_empty'].includes(filter.operator)) {
          continue;
        }

        const fieldValue = getFieldValue(contact, filter.field);
        const filterResult = evaluateFilter(fieldValue, filter.operator, filter.value);

        if (filter.logicOperator === 'OR') {
          hasOrCondition = true;
          orResult = orResult || filterResult;
        } else {
          // AND condition (default)
          if (hasOrCondition) {
            result = result && orResult;
            hasOrCondition = false;
            orResult = false;
          }
          result = result && filterResult;
        }
      }

      if (hasOrCondition) {
        result = result && orResult;
      }

      return result;
    });
  };

  const getFieldValue = (contact: EnrichedContact, field: string): any => {
    switch (field) {
      case 'name': return contact.name || '';
      case 'email': return contact.email || '';
      case 'company': return contact.company || '';
      case 'inferred_company': return contact.inferredCompany || '';
      case 'status': return contact.status || '';
      case 'location': return contact.location || '';
      case 'total_nda_signatures': return contact.totalNdaSignatures || 0;
      case 'last_nda_signed': return contact.lastNdaSigned || null;
      case 'first_seen': return contact.firstSeenAt || null;
      case 'last_activity': return contact.lastSeenAt || null;
      case 'next_follow_up_date': return contact.nextFollowUpDate || null;
      case 'cim_document': {
        // Return array of CIM document IDs for this contact
        return contact.documents?.map(doc => doc.cimDocumentId.toString()) || [];
      }
      default: return '';
    }
  };

  const evaluateFilter = (value: any, operator: string, filterValue: string): boolean => {
    // Handle array values (e.g., CIM document IDs)
    if (Array.isArray(value)) {
      const filterIds = filterValue.split(',').filter(Boolean);
      if (filterIds.length === 0) return true;

      switch (operator) {
        case 'is':
        case 'contains':
          // Check if any of the contact's values match any of the filter values
          return value.some(v => filterIds.includes(v));
        case 'is_not':
        case 'not_contains':
          // Check that none of the contact's values match the filter values
          return !value.some(v => filterIds.includes(v));
        case 'is_empty':
          return value.length === 0;
        case 'is_not_empty':
          return value.length > 0;
        default:
          return true;
      }
    }

    const strValue = String(value || '').toLowerCase();
    const filterStr = filterValue.toLowerCase();

    switch (operator) {
      case 'contains': return strValue.includes(filterStr);
      case 'not_contains': return !strValue.includes(filterStr);
      case 'equals': return strValue === filterStr;
      case 'is': return strValue === filterStr;
      case 'not_equals': return strValue !== filterStr;
      case 'is_not': return strValue !== filterStr;
      case 'starts_with': return strValue.startsWith(filterStr);
      case 'ends_with': return strValue.endsWith(filterStr);
      case 'is_empty': return !value || value === '';
      case 'is_not_empty': return value && value !== '';
      case 'greater_than': {
        if (value instanceof Date || (typeof value === 'string' && value.includes('-'))) {
          return new Date(value) > new Date(filterValue);
        }
        return Number(value) > Number(filterValue);
      }
      case 'less_than': {
        if (value instanceof Date || (typeof value === 'string' && value.includes('-'))) {
          return new Date(value) < new Date(filterValue);
        }
        return Number(value) < Number(filterValue);
      }
      case 'greater_equal': {
        if (value instanceof Date || (typeof value === 'string' && value.includes('-'))) {
          return new Date(value) >= new Date(filterValue);
        }
        return Number(value) >= Number(filterValue);
      }
      case 'less_equal': {
        if (value instanceof Date || (typeof value === 'string' && value.includes('-'))) {
          return new Date(value) <= new Date(filterValue);
        }
        return Number(value) <= Number(filterValue);
      }
      default: return true;
    }
  };

  // Helper function to infer company from email
  const inferCompanyFromEmail = (email: string): string => {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return 'Unknown';
    
    // Common personal email domains
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'];
    if (personalDomains.includes(domain)) {
      return 'Personal Email';
    }
    
    // Extract company name from domain
    const parts = domain.split('.');
    if (parts.length >= 2) {
      let companyPart = parts[parts.length - 2];
      
      // Handle common domain patterns
      if (companyPart === 'co' && parts.length >= 3) {
        companyPart = parts[parts.length - 3];
      }
      
      // Capitalize first letter
      return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
    }
    
    return domain;
  };

  // Fetch CIM documents for filtering
  const { data: cimDocuments = [] } = useQuery({
    queryKey: ['/api/investor-contacts/cim-documents'],
    queryFn: async () => {
      const response = await fetch('/api/investor-contacts/cim-documents', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch CIM documents');
      return response.json();
    }
  });

  // Filter fields configuration
  const filterFields = [
    { value: 'name', label: 'Name', type: 'text' },
    { value: 'email', label: 'Email', type: 'text' },
    { value: 'inferred_company', label: 'Inferred Company', type: 'text' },
    { value: 'location', label: 'Location', type: 'text' },
    { value: 'status', label: 'Status', type: 'select', options: statusOptions },
    { value: 'tags', label: 'Tags', type: 'text' },
    { value: 'cim_document', label: 'CIM', type: 'select', options: cimDocuments?.map((doc: any) => ({ value: doc.id.toString(), label: doc.title })) || [] },
    { value: 'total_nda_signatures', label: 'NDA Count', type: 'number' },
    { value: 'last_activity', label: 'Last Activity', type: 'date' },
    { value: 'first_seen', label: 'First Seen', type: 'date' },
    { value: 'next_follow_up_date', label: 'Next Follow-up Date', type: 'date' }
  ];

  // Fetch contacts with pagination - optimized for performance
  const { data: contactsResponse, isLoading, refetch } = useQuery({
    queryKey: ['/api/investor-contacts', currentPage, pageSize, searchTerm, statusFilter, cimFilter, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        sortBy,
        sortOrder,
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (cimFilter.length > 0) params.append('cimDocumentIds', cimFilter.join(','));
      
      const response = await fetch(`/api/investor-contacts?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }
      return response.json();
    },
    // Performance optimizations
    staleTime: 60000, // Keep data fresh for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
    retry: 2 // Retry failed requests only twice
  });

  const allContacts = contactsResponse?.contacts?.map((contact: any) => ({
    ...contact,
    inferredCompany: inferCompanyFromEmail(contact.email) || 'Unknown'
  })) || [];
  
  const pagination = contactsResponse?.pagination;

  // Filter and sort contacts on frontend
  const filteredAndSortedContacts = useMemo(() => {
    let filtered = allContacts.filter(contact => {
      const matchesSearch = !searchTerm || 
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });

    // Apply advanced filters
    filtered = applyAdvancedFilters(filtered);

    // Sort contacts
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'email':
          aValue = a.email?.toLowerCase() || '';
          bValue = b.email?.toLowerCase() || '';
          break;
        case 'totalNdaSignatures':
          aValue = a.totalNdaSignatures || 0;
          bValue = b.totalNdaSignatures || 0;
          break;
        case 'status':
          // Sort by status order in statusOptions
          const statusOrder = ['new', 'contacted', 'interested', 'under_review', 'declined', 'closed'];
          aValue = statusOrder.indexOf(a.status) ?? 99;
          bValue = statusOrder.indexOf(b.status) ?? 99;
          break;
        case 'nextFollowUpDate':
          // Sort null dates to end
          aValue = a.nextFollowUpDate ? new Date(a.nextFollowUpDate).getTime() : (sortOrder === 'asc' ? Infinity : -Infinity);
          bValue = b.nextFollowUpDate ? new Date(b.nextFollowUpDate).getTime() : (sortOrder === 'asc' ? Infinity : -Infinity);
          break;
        case 'lastSeenAt':
        default:
          aValue = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          bValue = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [allContacts, searchTerm, sortBy, sortOrder, advancedFilters]);

  // Use filtered contacts as the main contacts array
  const contacts = filteredAndSortedContacts;

  // Check for contact query parameter and open modal
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const contactEmail = params.get('contact');

    if (contactEmail && contacts.length > 0) {
      // Find the contact by email
      const contact = contacts.find((c: EnrichedContact) =>
        c.email.toLowerCase() === contactEmail.toLowerCase()
      );

      if (contact) {
        // Open the contact modal
        setViewingContact(contact);
        setIsContactModalOpen(true);

        // Clear the query parameter after opening
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('contact');
        const newSearch = newParams.toString();
        window.history.replaceState({}, '', newSearch ? `?${newSearch}` : window.location.pathname);
      }
    }
  }, [searchParams, contacts]);

  // Sync contacts from signatures
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/investor-contacts/sync-from-signatures', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to sync contacts');
      }
      return response.json() as Promise<{ synced: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor-contacts'] });
      toast({
        title: "Sync Complete",
        description: `${data.synced} new contacts synchronized from NDA signatures.`
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed", 
        description: "Failed to sync contacts from signatures.",
        variant: "destructive"
      });
    }
  });



  // Update contact mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      // Process nextFollowUpDate to ensure proper format
      const processedData = {
        ...data,
        nextFollowUpDate: data.nextFollowUpDate ?
          (data.nextFollowUpDate instanceof Date ? data.nextFollowUpDate.toISOString() : data.nextFollowUpDate)
          : null
      };

      const response = await fetch(`/api/investor-contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedData),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to update contact');
      }
      return response.json();
    },
    onSuccess: (updatedContact) => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor-contacts'] });
      setEditingContact(null);
      // Update the viewing contact with the latest data including enriched fields
      if (viewingContact && updatedContact.id === viewingContact.id) {
        setViewingContact({
          ...viewingContact,
          ...updatedContact,
          // Preserve enriched fields that aren't returned from the update
          totalNdaSignatures: viewingContact.totalNdaSignatures,
          documents: viewingContact.documents,
          lastNdaSigned: viewingContact.lastNdaSigned
        });
      }
      toast({
        title: "Contact Updated",
        description: "Contact information has been updated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update contact information.",
        variant: "destructive"
      });
    }
  });

  // Add contact mutation
  const addContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/investor-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add contact');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor-contacts'] });
      setShowAddContactDialog(false);
      setAddContactForm({
        name: '',
        email: '',
        notes: '',
        tags: [],
        status: 'new',
        location: '',
        nextFollowUpDate: ''
      });
      toast({
        title: "Contact Added",
        description: "New contact has been added successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Contact",
        description: error.message || "An error occurred while adding the contact.",
        variant: "destructive"
      });
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const response = await fetch('/api/investor-contacts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds }),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to delete contacts');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor-contacts'] });
      setSelectedContacts([]);
      setSelectAll(false);
      setShowDeleteDialog(false);
      toast({
        title: "Contacts Deleted",
        description: `${data.deleted} contact(s) have been deleted.`
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete selected contacts.",
        variant: "destructive"
      });
    }
  });

  // Bulk update status mutation
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ contactIds, status }: { contactIds: number[]; status: string }) => {
      const response = await fetch('/api/investor-contacts/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds, updates: { status } }),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to update contacts');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor-contacts'] });
      toast({
        title: "Status Updated",
        description: `${data.updated} contact(s) have been updated.`
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update contact status.",
        variant: "destructive"
      });
    }
  });

  // Bulk add tag mutation
  const bulkAddTagMutation = useMutation({
    mutationFn: async ({ contactIds, tag }: { contactIds: number[]; tag: string }) => {
      const response = await fetch('/api/investor-contacts/bulk-add-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds, tag }),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to add tag');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor-contacts'] });
      setShowBulkTagDialog(false);
      setBulkTagInput('');
      toast({
        title: "Tag Added",
        description: `Tag added to ${data.updated} contact(s).`
      });
    },
    onError: () => {
      toast({
        title: "Failed to Add Tag",
        description: "Failed to add tag to selected contacts.",
        variant: "destructive"
      });
    }
  });

  // Copy emails handler
  const handleCopyEmails = () => {
    const selectedEmails = contacts
      .filter(c => selectedContacts.includes(c.id))
      .map(c => c.email)
      .join(', ');

    navigator.clipboard.writeText(selectedEmails);
    toast({
      title: "Emails Copied",
      description: `${selectedContacts.length} email address(es) copied to clipboard.`
    });
  };

  // Handle select all functionality
  useEffect(() => {
    if (selectAll) {
      setSelectedContacts(contacts.map(c => c.id));
    }
  }, [selectAll, contacts]);

  // Update selectAll state based on individual selections
  useEffect(() => {
    if (contacts.length > 0) {
      const allSelected = contacts.every(contact => selectedContacts.includes(contact.id));
      const noneSelected = selectedContacts.length === 0;
      
      if (allSelected && !selectAll) {
        setSelectAll(true);
      } else if (!allSelected && selectAll) {
        setSelectAll(false);
      }
    }
  }, [selectedContacts, contacts, selectAll]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleEdit = (contact: EnrichedContact) => {
    setEditingContact(contact);
    setEditForm({
      notes: contact.notes || '',
      tags: contact.tags || [],
      status: contact.status,
      lastContactDate: contact.lastContactDate ? new Date(contact.lastContactDate).toISOString().split('T')[0] : '',
      nextFollowUpDate: contact.nextFollowUpDate ? new Date(contact.nextFollowUpDate).toISOString().split('T')[0] : ''
    });
  };

  const handleSaveEdit = () => {
    if (!editingContact) return;
    
    updateMutation.mutate({
      id: editingContact.id,
      data: {
        ...editForm,
        lastContactDate: editForm.lastContactDate ? new Date(editForm.lastContactDate + 'T00:00:00') : null,
        nextFollowUpDate: editForm.nextFollowUpDate ? new Date(editForm.nextFollowUpDate + 'T00:00:00') : null
      }
    });
  };

  // Tag management functions
  const addTagToContact = (contactId: number, tagName: string) => {
    if (!tagName.trim()) return;
    
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || contact.tags.includes(tagName)) return;
    
    const updatedTags = [...contact.tags, tagName];
    
    // Update local state immediately
    if (viewingContact && viewingContact.id === contactId) {
      setViewingContact({...viewingContact, tags: updatedTags});
    }
    
    // Update in database
    updateMutation.mutate({
      id: contactId,
      data: { tags: updatedTags }
    });
  };

  const removeTagFromContact = (contactId: number, tagName: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const updatedTags = contact.tags.filter(tag => tag !== tagName);
    
    // Update local state immediately
    if (viewingContact && viewingContact.id === contactId) {
      setViewingContact({...viewingContact, tags: updatedTags});
    }
    
    // Update in database
    updateMutation.mutate({
      id: contactId,
      data: { tags: updatedTags }
    });
  };

  // Create custom tag
  const createTagMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const response = await fetch('/api/custom-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, color })
      });
      if (!response.ok) {
        throw new Error('Failed to create tag');
      }
      return response.json();
    },
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-tags'] });
      setNewTagName('');
      setShowAddTag(false);
      toast({
        title: "Tag Created",
        description: `Custom tag "${newTag.name}" has been created.`
      });
    }
  });

  // Delete custom tag
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const response = await fetch(`/api/custom-tags/${tagId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to delete tag');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-tags'] });
      toast({
        title: "Tag Deleted",
        description: "Custom tag has been deleted."
      });
    }
  });

  const addCustomTag = (tagName: string) => {
    if (!tagName.trim()) return;
    
    const randomColor = tagColors[Math.floor(Math.random() * tagColors.length)];
    createTagMutation.mutate({ name: tagName.trim(), color: randomColor });
  };

  const removeCustomTag = (tagId: number) => {
    deleteTagMutation.mutate(tagId);
  };

  const handleExport = () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select contacts to export",
        variant: "destructive"
      });
      return;
    }

    const exportUrl = `/api/investor-contacts/export?contactIds=${selectedContacts.join(',')}`;
    
    window.open(exportUrl, '_blank');
    toast({
      title: "Export Started",
      description: `Exporting ${selectedContacts.length} selected contacts to CSV`
    });
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const addFilterRule = () => {
    const newRule: FilterRule = {
      id: Date.now().toString(),
      field: 'name',
      operator: 'contains',
      value: '',
      logicOperator: advancedFilters.length > 0 ? 'AND' : undefined
    };
    setAdvancedFilters([...advancedFilters, newRule]);
  };

  const updateFilterRule = (id: string, updates: Partial<FilterRule>) => {
    setAdvancedFilters(filters => 
      filters.map(filter => 
        filter.id === id ? { ...filter, ...updates } : filter
      )
    );
  };

  const removeFilterRule = (id: string) => {
    setAdvancedFilters(filters => filters.filter(filter => filter.id !== id));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = statusOptions.find(s => s.value === status);
    return (
      <Badge variant="secondary" className={`${statusConfig?.color} text-gray-800`}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getTagColor = (tagName: string) => {
    const customTag = customTags.find(tag => tag.name === tagName);
    if (customTag) return customTag.color;

    // Generate consistent color for unknown tags
    const hash = tagName.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return tagColors[hash % tagColors.length];
  };

  // Get row color based on follow-up date
  const getFollowUpRowStyle = (followUpDate: Date | string | null) => {
    if (!followUpDate) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followUp = new Date(followUpDate);
    followUp.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((followUp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'bg-red-50 border-l-4 border-l-red-400'; // Overdue
    if (diffDays === 0) return 'bg-orange-50 border-l-4 border-l-orange-400'; // Due today
    if (diffDays <= 7) return 'bg-yellow-50 border-l-4 border-l-yellow-400'; // Due this week
    return '';
  };

  // Highlight search term in text
  const highlightSearchTerm = (text: string, term: string) => {
    if (!term || !text) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark> : part
    );
  };

  // Compose email handler
  const handleComposeEmail = () => {
    const selectedEmails = contacts
      .filter(c => selectedContacts.includes(c.id))
      .map(c => c.email)
      .join(',');

    window.location.href = `mailto:${selectedEmails}`;
  };

  // Detect potential duplicate contacts
  const getDuplicateContacts = useMemo(() => {
    const emailMap = new Map<string, number[]>();
    contacts.forEach(contact => {
      const email = contact.email.toLowerCase();
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push(contact.id);
    });

    const duplicates: number[] = [];
    emailMap.forEach((ids) => {
      if (ids.length > 1) {
        duplicates.push(...ids);
      }
    });
    return duplicates;
  }, [contacts]);



  return (
    <TooltipProvider>
      <div className="px-4 md:px-6 py-4 md:py-6 overflow-x-hidden">
        <PageHeader
          title="CRM"
          description="Manage and track your investor contacts across all documents"
          icon={<Users className="h-5 w-5" />}
        />

        <div className="space-y-6">
      {/* Collapsible Heat Map */}
      <Collapsible open={isHeatMapOpen} onOpenChange={setIsHeatMapOpen}>
        <Card className="border-0 shadow-lg bg-white/95 backdrop-blur-sm">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b cursor-pointer hover:bg-gradient-to-r hover:from-indigo-100 hover:to-blue-100 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-indigo-600" />
                  <span>Investor Geographic Distribution</span>
                </div>
                {isHeatMapOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <InvestorHeatMap contacts={contacts} />
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Stats Cards with gradient backgrounds - compact version */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <CardContent className="relative p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700 mb-0.5">Total Contacts</p>
              <div className="text-2xl font-bold text-blue-900">{contacts.length}</div>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
          <CardContent className="relative p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-700 mb-0.5">Total Signatures</p>
              <div className="text-2xl font-bold text-green-900">
                {contacts.reduce((sum, c) => sum + c.totalNdaSignatures, 0)}
              </div>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-4 w-4 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-orange-50 to-white cursor-pointer hover:shadow-lg transition-all"
          onClick={() => {
            const needsFollowUpContacts = contacts.filter(c =>
              c.nextFollowUpDate && new Date(c.nextFollowUpDate) <= new Date()
            );

            if (needsFollowUpContacts.length > 0) {
              setSearchTerm('');
              setStatusFilter('all');
              setCimFilter([]);
              setAdvancedFilters([{
                id: Date.now().toString(),
                field: 'next_follow_up_date',
                operator: 'less_equal',
                value: new Date().toISOString().split('T')[0],
                logicOperator: 'AND'
              }]);
            }
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent" />
          <CardContent className="relative p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-orange-700 mb-0.5">Needs Follow-up</p>
              <div className="text-2xl font-bold text-orange-900">
                {contacts.filter(c => c.nextFollowUpDate && new Date(c.nextFollowUpDate) <= new Date()).length}
              </div>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <Calendar className="h-4 w-4 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search, Filters & View Toggle - Professional B2B Style */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          {/* Main Filter Row */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 bg-gray-50 border-gray-200 focus:bg-white"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 bg-gray-50 border-gray-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${status.color}`} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* CIM Filter - Multi-select with search */}
            <Popover open={cimFilterOpen} onOpenChange={setCimFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[180px] h-9 justify-between bg-gray-50 border-gray-200 font-normal"
                >
                  {cimFilter.length === 0 ? (
                    <span className="text-gray-500">All CIMs</span>
                  ) : cimFilter.length === 1 ? (
                    <span className="truncate">
                      {cimDocuments?.find((d: any) => d.id.toString() === cimFilter[0])?.title || '1 CIM'}
                    </span>
                  ) : (
                    <span>{cimFilter.length} CIMs</span>
                  )}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-2" align="start">
                <div className="space-y-2">
                  <Input
                    placeholder="Search CIM documents..."
                    value={cimFilterSearch}
                    onChange={(e) => setCimFilterSearch(e.target.value)}
                    className="h-8"
                  />
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {cimDocuments?.filter((doc: any) =>
                        doc.title.toLowerCase().includes(cimFilterSearch.toLowerCase())
                      ).map((doc: any) => {
                        const isSelected = cimFilter.includes(doc.id.toString());
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              setCimFilter(prev =>
                                isSelected
                                  ? prev.filter(id => id !== doc.id.toString())
                                  : [...prev, doc.id.toString()]
                              );
                            }}
                          >
                            <Checkbox checked={isSelected} />
                            <span className="text-sm truncate flex-1">{doc.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  {cimFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setCimFilter([])}
                    >
                      Clear selection
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* View Toggle */}
            <div className="flex items-center border border-gray-200 rounded-md bg-gray-50 p-0.5">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode('kanban')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>

            {/* Advanced Filter Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-gray-50 border-gray-200"
              onClick={addFilterRule}
            >
              <Filter className="h-4 w-4 mr-1" />
              Add Filter
            </Button>
          </div>

          {/* Active Filters Chips */}
          {(searchTerm || statusFilter !== 'all' || cimFilter.length > 0 || advancedFilters.some(f => f.value)) && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">Active filters:</span>

              {searchTerm && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Search: "{searchTerm}"
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-gray-300"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}

              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Status: {statusOptions.find(s => s.value === statusFilter)?.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-gray-300"
                    onClick={() => setStatusFilter('all')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}

              {cimFilter.length > 0 && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  CIM: {cimFilter.length} selected
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-gray-300"
                    onClick={() => setCimFilter([])}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}

              {advancedFilters.filter(f => f.value).map(filter => (
                <Badge key={filter.id} variant="secondary" className="gap-1 pr-1">
                  {filterFields.find(f => f.value === filter.field)?.label}: {filter.value.substring(0, 15)}{filter.value.length > 15 ? '...' : ''}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-gray-300"
                    onClick={() => removeFilterRule(filter.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-gray-500"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setCimFilter([]);
                  setAdvancedFilters([]);
                }}
              >
                Clear all
              </Button>
            </div>
          )}

          {/* Advanced Filters Section */}
          {advancedFilters.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Advanced Filters</span>
              </div>
              <div className="space-y-2">
                {advancedFilters.map((filter, index) => (
                  <div key={filter.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md border border-gray-200">
                      {index > 0 && (
                        <Select 
                          value={filter.logicOperator || 'AND'} 
                          onValueChange={(value) => updateFilterRule(filter.id, { logicOperator: value as 'AND' | 'OR' })}
                        >
                          <SelectTrigger className="w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      
                      <Select
                        value={filter.field}
                        onValueChange={(value) => {
                          const newField = filterFields.find(f => f.value === value);
                          const defaultOperator = operatorsByType[newField?.type as keyof typeof operatorsByType]?.[0]?.value || 'contains';
                          updateFilterRule(filter.id, { field: value, operator: defaultOperator });
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {filterFields.map(field => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select 
                        value={filter.operator} 
                        onValueChange={(value) => updateFilterRule(filter.id, { operator: value })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const field = filterFields.find(f => f.value === filter.field);
                            const operators = operatorsByType[field?.type as keyof typeof operatorsByType] || operatorsByType.text;
                            return operators.map(op => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      
                      {!['is_empty', 'is_not_empty'].includes(filter.operator) && (
                        filter.field === 'cim_document' ? (
                          // Multi-select for CIM documents with search
                          <CimMultiSelect
                            value={filter.value}
                            onChange={(value) => updateFilterRule(filter.id, { value })}
                            cimDocuments={cimDocuments || []}
                          />
                        ) : filter.field === 'status' ? (
                          // Single select for status
                          <Select
                            value={filter.value}
                            onValueChange={(value) => updateFilterRule(filter.id, { value })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select status..." />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map(status => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="Value..."
                            value={filter.value}
                            onChange={(e) => updateFilterRule(filter.id, { value: e.target.value })}
                            className="flex-1"
                          />
                        )
                      )}
                      
                    <Button
                      onClick={() => removeFilterRule(filter.id)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Remove filter"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card className="border-0 shadow-lg bg-white/95 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              <span>Contacts</span>
              <Badge className="bg-indigo-100 text-indigo-700 ml-2">{contacts.length}</Badge>
            </CardTitle>
            <div className="flex gap-2 flex-wrap items-center">
              {/* Column Visibility Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Settings className="h-4 w-4 mr-2" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columnDefinitions.map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={columnVisibility[col.id] !== false}
                      onCheckedChange={() => toggleColumnVisibility(col.id)}
                      disabled={col.required}
                    >
                      {col.label}
                      {col.required && <span className="text-xs text-gray-400 ml-1">(required)</span>}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setColumnVisibility({
                      name: true,
                      email: true,
                      company: true,
                      status: true,
                      followUp: true,
                      notes: true,
                      tags: true,
                      ndas: true
                    })}
                  >
                    Reset to default
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <BrandedButton
                onClick={() => setShowAddContactDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </BrandedButton>

              {/* Bulk Actions - only show when contacts are selected */}
              {selectedContacts.length > 0 && (
                <>
                  <Button
                    onClick={handleCopyEmails}
                    variant="outline"
                    size="default"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Emails
                  </Button>

                  <Button
                    onClick={handleComposeEmail}
                    variant="outline"
                    size="default"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Compose Email
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <MoreHorizontal className="h-4 w-4 mr-2" />
                        Actions ({selectedContacts.length})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export to CSV
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Edit className="h-4 w-4 mr-2" />
                          Update Status
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {statusOptions.map(status => (
                            <DropdownMenuItem
                              key={status.value}
                              onClick={() => bulkUpdateStatusMutation.mutate({
                                contactIds: selectedContacts,
                                status: status.value
                              })}
                            >
                              <div className={`w-2 h-2 rounded-full ${status.color} mr-2`} />
                              {status.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Tag className="h-4 w-4 mr-2" />
                          Add Tag
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {customTags.map(tag => (
                            <DropdownMenuItem
                              key={tag.id}
                              onClick={() => bulkAddTagMutation.mutate({
                                contactIds: selectedContacts,
                                tag: tag.name
                              })}
                            >
                              <div className={`w-2 h-2 rounded-full ${tag.color} mr-2`} />
                              {tag.name}
                            </DropdownMenuItem>
                          ))}
                          {customTags.length > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuItem onClick={() => setShowBulkTagDialog(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Tag...
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium text-gray-700">No contacts found</p>
              {(searchTerm || statusFilter !== 'all' || cimFilter.length > 0 || advancedFilters.some(f => f.value)) ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-500">No contacts match your current filters.</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setCimFilter([]);
                      setAdvancedFilters([]);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-gray-500">Get started by adding contacts manually or syncing from NDA signatures.</p>
                  <div className="flex justify-center gap-3">
                    <BrandedButton onClick={() => setShowAddContactDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Contact
                    </BrandedButton>
                    <Button variant="outline" onClick={() => refetch()}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync from NDAs
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <>
            <div className="overflow-x-auto w-full max-h-[600px] overflow-y-auto">
            <Table className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={(checked) => {
                        setSelectAll(checked === true);
                        if (!checked) {
                          setSelectedContacts([]);
                        }
                      }}
                    />
                  </TableHead>
                  {columnVisibility.name !== false && (
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100 transition-colors w-[15%]"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Name
                        {getSortIcon('name')}
                      </div>
                    </TableHead>
                  )}
                  {columnVisibility.email !== false && (
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100 transition-colors w-[18%]"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center gap-2">
                        Email
                        {getSortIcon('email')}
                      </div>
                    </TableHead>
                  )}
                  {columnVisibility.company !== false && (
                    <TableHead className="w-[12%]">Company</TableHead>
                  )}
                  {columnVisibility.status !== false && (
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100 transition-colors w-[10%]"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </TableHead>
                  )}
                  {columnVisibility.followUp !== false && (
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100 transition-colors w-[10%]"
                      onClick={() => handleSort('nextFollowUpDate')}
                    >
                      <div className="flex items-center gap-2">
                        Follow-up
                        {getSortIcon('nextFollowUpDate')}
                      </div>
                    </TableHead>
                  )}
                  {columnVisibility.notes !== false && (
                    <TableHead className="w-[15%]">Notes</TableHead>
                  )}
                  {columnVisibility.tags !== false && (
                    <TableHead className="w-[12%]">Tags</TableHead>
                  )}
                  {columnVisibility.ndas !== false && (
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100 transition-colors w-[6%] text-center"
                      onClick={() => handleSort('totalNdaSignatures')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        NDAs
                        {getSortIcon('totalNdaSignatures')}
                      </div>
                    </TableHead>
                  )}
                  <TableHead className="w-[50px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((contact, index) => {
                  const followUpStyle = getFollowUpRowStyle(contact.nextFollowUpDate);
                  const isDuplicate = getDuplicateContacts.includes(contact.id);

                  return (
                    <TableRow
                      key={contact.id}
                      className={`cursor-pointer transition-colors group ${followUpStyle || (index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')} ${selectedContacts.includes(contact.id) ? "ring-2 ring-indigo-500 bg-indigo-50/30" : ""} hover:bg-indigo-50/50`}
                      onClick={() => {
                        setViewingContact(contact);
                        setIsContactModalOpen(true);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()} className="w-[50px]">
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedContacts([...selectedContacts, contact.id]);
                            } else {
                              setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                            }
                          }}
                        />
                      </TableCell>
                      {columnVisibility.name !== false && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{highlightSearchTerm(contact.name, searchTerm)}</span>
                            {isDuplicate && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>Potential duplicate contact</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {columnVisibility.email !== false && (
                        <TableCell>
                          <span className="text-sm truncate block">{highlightSearchTerm(contact.email, searchTerm)}</span>
                        </TableCell>
                      )}
                      {columnVisibility.company !== false && (
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate block">
                            {contact.company || contact.inferredCompany || '—'}
                          </span>
                        </TableCell>
                      )}
                      {columnVisibility.status !== false && (
                        <TableCell>{getStatusBadge(contact.status)}</TableCell>
                      )}
                      {columnVisibility.followUp !== false && (
                        <TableCell>
                          {contact.nextFollowUpDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="text-sm">
                                {new Date(contact.nextFollowUpDate).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </TableCell>
                      )}
                      {columnVisibility.notes !== false && (
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground truncate block max-w-[200px] cursor-default">
                                {contact.notes ? (contact.notes.length > 40 ? contact.notes.substring(0, 40) + '...' : contact.notes) : '—'}
                              </span>
                            </TooltipTrigger>
                            {contact.notes && contact.notes.length > 40 && (
                              <TooltipContent className="max-w-[300px]">
                                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TableCell>
                      )}
                      {columnVisibility.tags !== false && (
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {contact.tags.slice(0, 2).map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {contact.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{contact.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {columnVisibility.ndas !== false && (
                        <TableCell className="text-center">{contact.totalNdaSignatures}</TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()} className="w-[50px]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setViewingContact(contact);
                              setIsContactModalOpen(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              navigator.clipboard.writeText(contact.email);
                              toast({ title: "Email copied" });
                            }}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              window.location.href = `mailto:${contact.email}`;
                            }}>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Edit className="h-4 w-4 mr-2" />
                                Change Status
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {statusOptions.map(status => (
                                  <DropdownMenuItem
                                    key={status.value}
                                    onClick={() => bulkUpdateStatusMutation.mutate({
                                      contactIds: [contact.id],
                                      status: status.value
                                    })}
                                  >
                                    <div className={`w-2 h-2 rounded-full ${status.color} mr-2`} />
                                    {status.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedContacts([contact.id]);
                                setShowDeleteDialog(true);
                              }}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Contact
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Showing</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>
                  {Math.min((currentPage - 1) * pageSize + 1, contacts.length)}-{Math.min(currentPage * pageSize, contacts.length)} of {contacts.length} contacts
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600 px-2">
                  Page {currentPage} of {Math.ceil(contacts.length / pageSize) || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(contacts.length / pageSize), p + 1))}
                  disabled={currentPage >= Math.ceil(contacts.length / pageSize)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
            </>
          ) : (
            /* Kanban View */
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {statusOptions.map(status => {
                  const statusContacts = contacts.filter(c => c.status === status.value);
                  return (
                    <div key={status.value} className="bg-gray-50 rounded-lg p-3 min-h-[400px]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${status.color}`} />
                          <span className="font-medium text-sm">{status.label}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {statusContacts.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {statusContacts.map(contact => {
                          const followUpStyle = getFollowUpRowStyle(contact.nextFollowUpDate);
                          return (
                            <div
                              key={contact.id}
                              className={`bg-white rounded-md border p-3 cursor-pointer hover:shadow-md transition-shadow ${followUpStyle}`}
                              onClick={() => {
                                setViewingContact(contact);
                                setIsContactModalOpen(true);
                              }}
                            >
                              <div className="font-medium text-sm truncate">{contact.name}</div>
                              <div className="text-xs text-gray-500 truncate">{contact.email}</div>
                              {contact.company && (
                                <div className="text-xs text-gray-400 truncate mt-1">{contact.company}</div>
                              )}
                              {contact.nextFollowUpDate && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(contact.nextFollowUpDate).toLocaleDateString()}
                                </div>
                              )}
                              {contact.tags.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                  {contact.tags.slice(0, 2).map((tag, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs px-1 py-0">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {statusContacts.length === 0 && (
                          <div className="text-center py-8 text-gray-400 text-sm">
                            No contacts
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update contact information and manage follow-ups
            </DialogDescription>
          </DialogHeader>
          
          {editingContact && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={editingContact.name} disabled />
              </div>
              
              <div>
                <Label>Email</Label>
                <Input value={editingContact.email} disabled />
              </div>
              
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({...editForm, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={editForm.tags.join(', ')}
                  onChange={(e) => setEditForm({
                    ...editForm, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                  placeholder="e.g., Hot Lead, Strategic Partner"
                />
              </div>
              
              <div>
                <Label>Last Contact Date</Label>
                <Input
                  type="date"
                  value={editForm.lastContactDate}
                  onChange={(e) => setEditForm({...editForm, lastContactDate: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Next Follow-up Date</Label>
                <Input
                  type="date"
                  value={editForm.nextFollowUpDate}
                  onChange={(e) => setEditForm({...editForm, nextFollowUpDate: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                  placeholder="Add notes about this contact..."
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContact(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Modal - using shared component */}
      <ContactDetailModal
        contact={viewingContact}
        open={isContactModalOpen}
        onOpenChange={(open) => {
          setIsContactModalOpen(open);
          if (!open) setViewingContact(null);
        }}
      />

      {/* Tag Management Modal */}
      <Dialog open={showTagManager} onOpenChange={setShowTagManager}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Manage Custom Tags
            </DialogTitle>
            <DialogDescription>
              Create and manage custom tags for organizing your contacts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add New Tag */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter new tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCustomTag(newTagName)}
              />
              <Button onClick={() => addCustomTag(newTagName)} disabled={!newTagName}>
                <Plus className="h-4 w-4 mr-2" />
                Add Tag
              </Button>
            </div>

            {/* Existing Tags */}
            <div>
              <Label className="text-sm font-medium">Your Custom Tags</Label>
              <div className="flex gap-2 flex-wrap mt-2">
                {customTags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-1">
                    <Badge className={`${tag.color} text-white`}>
                      {tag.name}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomTag(tag.id)}
                      className="h-6 w-6 p-0 hover:bg-red-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              {customTags.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">No custom tags created yet</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagManager(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact Manually</DialogTitle>
            <DialogDescription>
              Add a new contact to your investor database
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                placeholder="Enter contact name..."
                value={addContactForm.name}
                onChange={(e) => setAddContactForm({...addContactForm, name: e.target.value})}
              />
            </div>

            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="Enter email address..."
                value={addContactForm.email}
                onChange={(e) => setAddContactForm({...addContactForm, email: e.target.value})}
              />
            </div>

            <div>
              <Label>Location</Label>
              <Input
                placeholder="e.g., New York, NY"
                value={addContactForm.location}
                onChange={(e) => setAddContactForm({...addContactForm, location: e.target.value})}
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select value={addContactForm.status} onValueChange={(value) => setAddContactForm({...addContactForm, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                placeholder="e.g., Hot Lead, Strategic Partner"
                value={addContactForm.tags.join(', ')}
                onChange={(e) => setAddContactForm({
                  ...addContactForm,
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                })}
              />
            </div>

            <div>
              <Label>Next Follow-up Date</Label>
              <Input
                type="date"
                value={addContactForm.nextFollowUpDate}
                onChange={(e) => setAddContactForm({...addContactForm, nextFollowUpDate: e.target.value})}
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Add notes about this contact..."
                value={addContactForm.notes}
                onChange={(e) => setAddContactForm({...addContactForm, notes: e.target.value})}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContactDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!addContactForm.name || !addContactForm.email) {
                  toast({
                    title: "Missing Required Fields",
                    description: "Please enter both name and email.",
                    variant: "destructive"
                  });
                  return;
                }

                addContactMutation.mutate({
                  name: addContactForm.name,
                  email: addContactForm.email,
                  location: addContactForm.location || undefined,
                  status: addContactForm.status,
                  tags: addContactForm.tags,
                  notes: addContactForm.notes || undefined,
                  nextFollowUpDate: addContactForm.nextFollowUpDate ? new Date(addContactForm.nextFollowUpDate + 'T00:00:00') : undefined
                });
              }}
              disabled={addContactMutation.isPending || !addContactForm.name || !addContactForm.email}
            >
              {addContactMutation.isPending ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedContacts.length} Contact(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected contacts
              and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedContacts)}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Add Tag Dialog */}
      <Dialog open={showBulkTagDialog} onOpenChange={setShowBulkTagDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Tag to {selectedContacts.length} Contact(s)</DialogTitle>
            <DialogDescription>
              Create a new tag and apply it to all selected contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tag Name</Label>
              <Input
                placeholder="Enter tag name..."
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && bulkTagInput.trim()) {
                    bulkAddTagMutation.mutate({
                      contactIds: selectedContacts,
                      tag: bulkTagInput.trim()
                    });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkTagDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (bulkTagInput.trim()) {
                  bulkAddTagMutation.mutate({
                    contactIds: selectedContacts,
                    tag: bulkTagInput.trim()
                  });
                }
              }}
              disabled={!bulkTagInput.trim() || bulkAddTagMutation.isPending}
            >
              {bulkAddTagMutation.isPending ? 'Adding...' : 'Add Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
}