import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import { useToast } from "@/hooks/use-toast";
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
  Clock,
  RefreshCw,
  Tag,
  Plus,
  X,
  Eye
} from "lucide-react";
import type { InvestorContact } from "@shared/schema";

interface DocumentInfo {
  documentId: number;
  documentTitle: string;
  signedAt: string;
  signerName: string;
}

interface EnrichedContact extends InvestorContact {
  totalNdaSignatures: number;
  documents: DocumentInfo[];
  lastNdaSigned: number | null;
}

const statusOptions = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { value: 'interested', label: 'Interested', color: 'bg-green-500' },
  { value: 'under_review', label: 'Under Review', color: 'bg-purple-500' },
  { value: 'declined', label: 'Declined', color: 'bg-red-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' }
];

const filterFields = [
  { value: 'name', label: 'Name', type: 'text' },
  { value: 'email', label: 'Email', type: 'text' },
  { value: 'status', label: 'Status', type: 'select', options: statusOptions },
  { value: 'tags', label: 'Tags', type: 'text' },
  { value: 'totalNdaSignatures', label: 'NDA Count', type: 'number' },
  { value: 'lastSeenAt', label: 'Last Activity', type: 'date' },
  { value: 'firstSeenAt', label: 'First Seen', type: 'date' },
  { value: 'location', label: 'Location', type: 'text' },
  { value: 'isPotentialVpn', label: 'Privacy Tool Usage', type: 'boolean' }
];

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
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('lastSeenAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Selection state
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [viewingContact, setViewingContact] = useState<EnrichedContact | null>(null);
  
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
  
  // Fetch contacts
  const { data: contacts = [], isLoading, refetch } = useQuery<EnrichedContact[]>({
    queryKey: ['/api/investor-contacts', { search: searchTerm, status: statusFilter, sortBy, sortOrder }],
    queryFn: async () => {
      const response = await fetch(`/api/investor-contacts?search=${encodeURIComponent(searchTerm)}&status=${statusFilter}&sortBy=${sortBy}&sortOrder=${sortOrder}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }
      return response.json() as Promise<EnrichedContact[]>;
    }
  });

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
      const response = await fetch(`/api/investor-contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to update contact');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor-contacts'] });
      setEditingContact(null);
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

  // Handle selection
  useEffect(() => {
    if (selectAll) {
      setSelectedContacts(contacts.map(c => c.id));
    } else {
      setSelectedContacts([]);
    }
  }, [selectAll, contacts]);

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
        lastContactDate: editForm.lastContactDate ? new Date(editForm.lastContactDate) : null,
        nextFollowUpDate: editForm.nextFollowUpDate ? new Date(editForm.nextFollowUpDate) : null
      }
    });
  };

  const handleExport = () => {
    const exportUrl = selectedContacts.length > 0 
      ? `/api/investor-contacts/export?contactIds=${selectedContacts.join(',')}`
      : '/api/investor-contacts/export';
    
    window.open(exportUrl, '_blank');
    toast({
      title: "Export Started",
      description: "Your CSV export will download shortly."
    });
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = statusOptions.find(s => s.value === status);
    return (
      <Badge variant="secondary" className={`${statusConfig?.color} text-white`}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Investor Database</h1>
          <p className="text-muted-foreground">
            Manage and track your investor contacts across all documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => syncMutation.mutate()} 
            disabled={syncMutation.isPending}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {syncMutation.isPending ? 'Refreshing...' : 'Refresh Data'}
          </Button>
          <Button onClick={handleExport} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Export ({selectedContacts.length > 0 ? selectedContacts.length : contacts.length})
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Signatures</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contacts.reduce((sum, c) => sum + c.totalNdaSignatures, 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Prospects</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contacts.filter(c => ['interested', 'under_review'].includes(c.status)).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Follow-up</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contacts.filter(c => c.nextFollowUpDate && new Date(c.nextFollowUpDate) <= new Date()).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Contacts ({contacts.length})</CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectAll}
                onCheckedChange={(checked) => setSelectAll(checked === true)}
              />
              <Label>Select All</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={(checked) => setSelectAll(checked === true)}
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow 
                    key={contact.id}
                    className={`cursor-pointer hover:bg-muted/50 ${selectedContacts.includes(contact.id) ? "bg-muted/50" : ""}`}
                    onClick={() => setViewingContact(contact)}
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(contact)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
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

      {/* Contact Detail Modal */}
      <Dialog open={!!viewingContact} onOpenChange={() => setViewingContact(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contact Details
            </DialogTitle>
            <DialogDescription>
              View detailed information and document history for this contact
            </DialogDescription>
          </DialogHeader>
          
          {viewingContact && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="text-lg font-semibold">{viewingContact.name}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2">
                    <p className="font-mono flex-1">{viewingContact.email}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(viewingContact.email);
                        toast({
                          title: "Email copied",
                          description: "Email address has been copied to clipboard"
                        });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                  <p className="text-sm">
                    {viewingContact.location || 'Unknown'}
                    {viewingContact.isPotentialVpn && (
                      <span className="text-amber-600 ml-2">• Likely using privacy tool</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(viewingContact.status)}
                  </div>
                </div>
                
                {viewingContact.tags.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Tags</Label>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {viewingContact.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">First Seen</Label>
                  <p>{viewingContact.firstSeenAt ? new Date(viewingContact.firstSeenAt).toLocaleDateString() : 'Unknown'}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Activity</Label>
                  <p>{viewingContact.lastSeenAt ? new Date(viewingContact.lastSeenAt).toLocaleDateString() : 'Never'}</p>
                </div>
                
                {viewingContact.lastContactDate && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Last Contacted</Label>
                    <p>{new Date(viewingContact.lastContactDate).toLocaleDateString()}</p>
                  </div>
                )}
                
                {viewingContact.nextFollowUpDate && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Next Follow-up</Label>
                    <p>{new Date(viewingContact.nextFollowUpDate).toLocaleDateString()}</p>
                  </div>
                )}
                
                {viewingContact.notes && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
                    <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">{viewingContact.notes}</p>
                  </div>
                )}
              </div>

              {/* Action Items & Document History */}
              <div className="space-y-4">
                {/* Quick Actions */}
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Quick Actions</Label>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Next Follow-up</Label>
                        <Input
                          type="date"
                          value={viewingContact.nextFollowUpDate ? new Date(viewingContact.nextFollowUpDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            // Update contact follow-up date
                            // This will trigger an API call to update the contact
                          }}
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Set Status</Label>
                        <Select 
                          value={viewingContact.status} 
                          onValueChange={(value) => {
                            // Update contact status
                            // This will trigger an API call to update the contact
                          }}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quick Note</Label>
                      <Textarea
                        placeholder="Add a quick note..."
                        rows={2}
                        className="text-xs"
                        onBlur={(e) => {
                          if (e.target.value.trim()) {
                            // Append to existing notes
                            const timestamp = new Date().toLocaleDateString();
                            const newNote = `[${timestamp}] ${e.target.value.trim()}`;
                            // This will trigger an API call to update the contact notes
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Document Activity</Label>
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">{viewingContact.totalNdaSignatures} NDA signatures</span>
                    </div>
                  </div>
                </div>
                
                {viewingContact.documents.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Associated Documents</Label>
                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                      {viewingContact.documents.map((doc, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-background">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{doc.documentTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                Signed by {doc.signerName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(doc.signedAt).toLocaleDateString()} at {new Date(doc.signedAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {viewingContact.documents.length === 0 && (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No documents associated yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingContact(null)}>
              Close
            </Button>
            {viewingContact && (
              <Button onClick={() => {
                handleEdit(viewingContact);
                setViewingContact(null);
              }}>
                Edit Contact
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}