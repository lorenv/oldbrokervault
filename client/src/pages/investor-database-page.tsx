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
  Edit, 
  Calendar,
  Users,
  FileText,
  Clock,
  RefreshCw,
  Tag
} from "lucide-react";
import type { InvestorContact } from "@shared/schema";

interface EnrichedContact extends InvestorContact {
  totalNdaSignatures: number;
  documents: number[];
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
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {syncMutation.isPending ? 'Syncing...' : 'Sync from NDAs'}
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
                  <TableRow key={contact.id}>
                    <TableCell>
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
                    <TableCell className="font-medium">{contact.name}</TableCell>
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
                    <TableCell>
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
    </div>
  );
}