import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, FileText, Copy, Plus, X, Tag, Download } from "lucide-react";
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

interface ContactDetailModalProps {
  contact: EnrichedContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: 'new', label: 'New', color: 'bg-blue-200' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-200' },
  { value: 'interested', label: 'Interested', color: 'bg-green-200' },
  { value: 'under_review', label: 'Under Review', color: 'bg-purple-200' },
  { value: 'declined', label: 'Declined', color: 'bg-red-200' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-300' }
];

const tagColors = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500',
  'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
];

export function ContactDetailModal({ contact, open, onOpenChange }: ContactDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewingContact, setViewingContact] = useState<EnrichedContact | null>(contact);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Update local state when contact prop changes
  useEffect(() => {
    setViewingContact(contact);
  }, [contact]);

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

  // Update contact mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
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
      if (viewingContact && updatedContact.id === viewingContact.id) {
        setViewingContact({
          ...viewingContact,
          ...updatedContact,
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
      setNewTagInput('');
      setShowAddTag(false);
      toast({
        title: "Tag Created",
        description: `Custom tag "${newTag.name}" has been created.`
      });
    }
  });

  const addTagToContact = (contactId: number, tagName: string) => {
    if (!tagName.trim() || !viewingContact) return;

    if (viewingContact.tags.includes(tagName)) return;

    const updatedTags = [...viewingContact.tags, tagName];
    setViewingContact({...viewingContact, tags: updatedTags});

    updateMutation.mutate({
      id: contactId,
      data: { tags: updatedTags }
    });
  };

  const removeTagFromContact = (contactId: number, tagName: string) => {
    if (!viewingContact) return;

    const updatedTags = viewingContact.tags.filter(tag => tag !== tagName);
    setViewingContact({...viewingContact, tags: updatedTags});

    updateMutation.mutate({
      id: contactId,
      data: { tags: updatedTags }
    });
  };

  const addCustomTag = (tagName: string) => {
    if (!tagName.trim()) return;

    const randomColor = tagColors[Math.floor(Math.random() * tagColors.length)];
    createTagMutation.mutate({ name: tagName.trim(), color: randomColor });
  };

  const getTagColor = (tagName: string) => {
    const customTag = customTags.find(tag => tag.name === tagName);
    if (customTag) return customTag.color;

    const hash = tagName.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return tagColors[hash % tagColors.length];
  };

  if (!viewingContact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contact Details
          </DialogTitle>
          <DialogDescription>
            View detailed information and document history for this contact
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Main Contact Information Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                    <p className="text-lg font-semibold mt-1">{viewingContact.name}</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono text-sm flex-1">{viewingContact.email}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(viewingContact.email);
                          toast({
                            title: "Email copied",
                            description: "Email address copied to clipboard"
                          });
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Company</Label>
                    <p className="text-sm mt-1">
                      {(() => {
                        const domain = viewingContact.email.split('@')[1];
                        const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'hey.com'];
                        return personalDomains.includes(domain.toLowerCase()) ? 'Personal Email' : domain;
                      })()}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Activity Timeline</Label>
                    <div className="space-y-1 mt-1">
                      <p className="text-xs text-muted-foreground">
                        First seen: {viewingContact.firstSeenAt ? new Date(viewingContact.firstSeenAt).toLocaleDateString() : 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last activity: {viewingContact.lastSeenAt ? new Date(viewingContact.lastSeenAt).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                    <p className="text-sm mt-1">
                      {viewingContact.location || 'Unknown'}
                      {viewingContact.isPotentialVpn && (
                        <span className="text-amber-600 ml-2">• Privacy tool detected</span>
                      )}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <Select
                      value={viewingContact.status}
                      onValueChange={(value) => {
                        setViewingContact({...viewingContact, status: value});
                      }}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${status.color}`}></div>
                              {status.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Next Follow-up Date</Label>
                    <Input
                      type="date"
                      value={viewingContact.nextFollowUpDate ? new Date(viewingContact.nextFollowUpDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const selectedDate = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
                        setViewingContact({
                          ...viewingContact,
                          nextFollowUpDate: selectedDate
                        });
                      }}
                      className="mt-1"
                    />
                    {viewingContact.nextFollowUpDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Scheduled for {new Date(viewingContact.nextFollowUpDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-muted-foreground">Tags</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddTag(!showAddTag)}
                        className="h-6 px-2 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Tag
                      </Button>
                    </div>

                    {showAddTag && (
                      <div className="space-y-2 mt-2">
                        {customTags.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Choose from existing tags:</Label>
                            <div className="flex gap-1 flex-wrap mt-1">
                              {customTags.filter(tag => !viewingContact.tags.includes(tag.name)).map((tag) => (
                                <Button
                                  key={tag.id}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTagToContact(viewingContact.id, tag.name)}
                                  className="h-6 px-2 text-xs"
                                >
                                  <div className={`w-2 h-2 rounded-full ${tag.color} mr-1`}></div>
                                  {tag.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <Label className="text-xs text-muted-foreground">Or create a new tag:</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              placeholder="Enter new tag name..."
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  if (customTags.find(tag => tag.name === newTagInput)) {
                                    addTagToContact(viewingContact.id, newTagInput);
                                  } else {
                                    addCustomTag(newTagInput);
                                    addTagToContact(viewingContact.id, newTagInput);
                                  }
                                  setNewTagInput('');
                                  setShowAddTag(false);
                                }
                              }}
                              className="text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                if (customTags.find(tag => tag.name === newTagInput)) {
                                  addTagToContact(viewingContact.id, newTagInput);
                                } else {
                                  addCustomTag(newTagInput);
                                  addTagToContact(viewingContact.id, newTagInput);
                                }
                                setNewTagInput('');
                                setShowAddTag(false);
                              }}
                              disabled={!newTagInput}
                              className="h-8"
                            >
                              Add
                            </Button>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAddTag(false)}
                          className="h-6 px-2 text-xs text-muted-foreground"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}

                    <div className="flex gap-1 flex-wrap mt-1">
                      {viewingContact.tags.map((tag, index) => (
                        <div key={index} className="flex items-center">
                          <Badge className={`${getTagColor(tag)} text-white pr-1`}>
                            {tag}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTagFromContact(viewingContact.id, tag)}
                              className="h-4 w-4 p-0 ml-1 hover:bg-white/20"
                            >
                              <X className="h-2 w-2" />
                            </Button>
                          </Badge>
                        </div>
                      ))}
                      {viewingContact.tags.length === 0 && (
                        <p className="text-xs text-muted-foreground">No tags assigned</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes about this contact..."
                value={viewingContact.notes || ''}
                onChange={(e) => setViewingContact({...viewingContact, notes: e.target.value})}
                className="min-h-[100px]"
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Document History Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{viewingContact.totalNdaSignatures} NDA signatures</span>
                  </div>
                </div>

            {viewingContact.documents && viewingContact.documents.length > 0 && (
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const docId = doc.cimDocumentId || doc.documentId;
                                const sigId = doc.signatureId;

                                if (!docId || !sigId) {
                                  throw new Error(`Missing document ID (${docId}) or signature ID (${sigId})`);
                                }

                                const response = await fetch(`/api/cim/${docId}/nda-signatures/${sigId}/download`, {
                                  method: 'GET',
                                  credentials: 'include'
                                });

                                if (response.ok) {
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `nda-${doc.signerName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);

                                  toast({
                                    title: "Download Started",
                                    description: `Signed NDA for ${doc.signerName} is being downloaded.`
                                  });
                                } else {
                                  throw new Error('Failed to download NDA');
                                }
                              } catch (error) {
                                toast({
                                  title: "Download Failed",
                                  description: error instanceof Error ? error.message : "Failed to download the signed NDA. Please try again.",
                                  variant: "destructive"
                                });
                              }
                            }}
                            title="Download signed NDA"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!viewingContact.documents || viewingContact.documents.length === 0) && (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No documents associated yet</p>
              </div>
            )}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              updateMutation.mutate({
                id: viewingContact.id,
                data: {
                  status: viewingContact.status,
                  notes: viewingContact.notes || '',
                  tags: viewingContact.tags || [],
                  nextFollowUpDate: viewingContact.nextFollowUpDate ? new Date(viewingContact.nextFollowUpDate) : null
                }
              });
            }}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
