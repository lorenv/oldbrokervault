import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
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
  MapPin
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { InvestorContact } from "@shared/schema";

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
  const [cimFilter, setCimFilter] = useState('all');
  const [sortBy, setSortBy] = useState('lastSeenAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
        // Get the CIM document titles for this contact
        const documentTitles = contact.documents?.map(doc => doc.documentTitle).join(', ') || '';
        return documentTitles;
      }
      default: return '';
    }
  };

  const evaluateFilter = (value: any, operator: string, filterValue: string): boolean => {
    const strValue = String(value || '').toLowerCase();
    const filterStr = filterValue.toLowerCase();

    switch (operator) {
      case 'contains': return strValue.includes(filterStr);
      case 'not_contains': return !strValue.includes(filterStr);
      case 'equals': return strValue === filterStr;
      case 'not_equals': return strValue !== filterStr;
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
      if (cimFilter !== 'all') params.append('cimDocumentId', cimFilter);
      
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
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'email':
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 'totalNdaSignatures':
          aValue = a.totalNdaSignatures || 0;
          bValue = b.totalNdaSignatures || 0;
          break;
        case 'lastSeenAt':
        default:
          aValue = a.lastSeenAt || 0;
          bValue = b.lastSeenAt || 0;
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



  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 border-b border-slate-200 shadow-lg">
          <div className="container mx-auto px-4 py-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <Users className="h-8 w-8" />
                Investor Database
              </h1>
              <p className="text-slate-200">
                Manage and track your investor contacts across all documents
              </p>
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8 space-y-6">
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

      {/* Stats Cards with gradient backgrounds */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Total Contacts</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-blue-900">{contacts.length}</div>
            <p className="text-xs text-blue-600 mt-1">Active investor relationships</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-green-50 to-white">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Total Signatures</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-green-900">
              {contacts.reduce((sum, c) => sum + c.totalNdaSignatures, 0)}
            </div>
            <p className="text-xs text-green-600 mt-1">Documents signed</p>
          </CardContent>
        </Card>
        
        <Card
          className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-50 to-white cursor-pointer hover:shadow-xl transition-all transform hover:scale-105"
          onClick={() => {
            // Filter to show only contacts that need follow-up
            const needsFollowUpContacts = contacts.filter(c => 
              c.nextFollowUpDate && new Date(c.nextFollowUpDate) <= new Date()
            );
            
            if (needsFollowUpContacts.length > 0) {
              // Set a filter to show only follow-up contacts
              setSearchTerm('');
              setStatusFilter('all');
              setCimFilter('all');
              
              // Use advanced filters to show only follow-up contacts
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
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Needs Follow-up</CardTitle>
            <div className="p-2 bg-orange-100 rounded-lg">
              <Calendar className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-orange-900">
              {contacts.filter(c => c.nextFollowUpDate && new Date(c.nextFollowUpDate) <= new Date()).length}
            </div>
            <p className="text-xs text-orange-600 mt-1">Click to filter • Due today</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="border-0 shadow-lg bg-white/95 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5 text-indigo-600" />
            <span>Search & Filter</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-48">
              <Select value={cimFilter} onValueChange={setCimFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by CIM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CIM Documents</SelectItem>
                  {cimDocuments?.map((doc: any) => (
                    <SelectItem key={doc.id} value={doc.id.toString()}>
                      {doc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filters */}
            <div className="mt-4 p-4 border-2 border-dashed border-indigo-200 rounded-lg bg-gradient-to-r from-indigo-50/50 to-blue-50/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Advanced Filters
                </h3>
                <Button onClick={addFilterRule} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Filter
                </Button>
              </div>
              
              {advancedFilters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No filters applied. Click "Add Filter" to get started.</p>
              ) : (
                <div className="space-y-2">
                  {advancedFilters.map((filter, index) => (
                    <div key={filter.id} className="flex items-center gap-2 p-2 bg-background rounded border">
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
                        <Input
                          placeholder="Value..."
                          value={filter.value}
                          onChange={(e) => updateFilterRule(filter.id, { value: e.target.value })}
                          className="flex-1"
                        />
                      )}
                      
                      <Button
                        onClick={() => removeFilterRule(filter.id)}
                        size="sm"
                        variant="ghost"
                        className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 h-8 w-8 p-0 rounded font-bold"
                        title="Remove filter"
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            <div className="flex gap-2">
              <Button
                onClick={() => setShowAddContactDialog(true)}
                variant="default"
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleExport}
                    disabled={isLoading || selectedContacts.length === 0}
                    variant={selectedContacts.length > 0 ? "default" : "outline"}
                    className={selectedContacts.length > 0 ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Selected ({selectedContacts.length})
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export selected contacts to CSV format</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contacts found</p>
              <p className="text-sm">Try syncing from your NDA signatures or adjust your filters</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50">
                  <TableHead className="w-12">
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
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-2">
                      Email
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('totalNdaSignatures')}
                  >
                    <div className="flex items-center gap-2">
                      NDAs
                      {getSortIcon('totalNdaSignatures')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('lastSeenAt')}
                  >
                    <div className="flex items-center gap-2">
                      Last Seen
                      {getSortIcon('lastSeenAt')}
                    </div>
                  </TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact, index) => (
                  <TableRow
                    key={contact.id}
                    className={`cursor-pointer hover:bg-indigo-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} ${selectedContacts.includes(contact.id) ? "ring-2 ring-indigo-500 bg-indigo-50/30" : ""}`}
                    onClick={() => {
                      setViewingContact(contact);
                      setIsContactModalOpen(true);
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                    <TableCell>
                      <span className="font-medium">{contact.name}</span>
                    </TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {contact.location || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(contact.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {contact.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
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
                    <TableCell>{contact.totalNdaSignatures}</TableCell>
                    <TableCell>
                      {contact.lastSeenAt ? new Date(contact.lastSeenAt).toLocaleDateString() : 'Never'}
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        </main>
      </div>
    </TooltipProvider>
  );
}