import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { BrandedButton } from '@/components/ui/branded-button';
import { useBrandColor } from '@/hooks/use-brand-color';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Send, Mail, MessageSquare, Clock, CheckCircle, AlertCircle, Archive, ArchiveRestore, MessageCircle, Filter, X, Paperclip, FileText, Download, User, Copy, ChevronDown, ClipboardList, Plus, Pencil, Trash2, ExternalLink, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Template interface
interface MessageTemplate {
  id: string;
  label: string;
  content: string;
}

// Default templates
const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'schedule-call',
    label: 'Schedule a call',
    content: 'Let me schedule a call to discuss. What times work for you?'
  },
  {
    id: 'circle-back',
    label: 'Circle back',
    content: 'I will circle back with answers!'
  }
];

// LocalStorage key for templates
const TEMPLATES_STORAGE_KEY = 'message-center-templates';

// Load templates from localStorage or use defaults
function loadTemplates(): MessageTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
  }
  return DEFAULT_TEMPLATES;
}

// Save templates to localStorage
function saveTemplates(templates: MessageTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
  }
}

interface Message {
  id: number;
  threadId: number;
  senderType: 'owner' | 'inquirer';
  senderEmail: string;
  content: string;
  richContent?: any; // TipTap JSON content
  messageType: 'initial_inquiry' | 'app_message' | 'email_reply';
  sendgridMessageId?: string;
  isRead: boolean;
  createdAt: string;
  attachments?: MessageAttachment[];
  attachmentPaths?: string[];
}

interface MessageAttachment {
  id: number;
  messageId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

interface MessageThread {
  id: number;
  userId: number;
  cimDocumentId: number;
  inquirerName: string;
  inquirerEmail: string;
  subject: string;
  status: 'active' | 'archived';
  threadEmailAddress: string;
  unreadCount: number;
  lastMessage?: Message;
  cimTitle: string | null;
  shareSlug: string | null;
  createdAt: string;
  lastMessageAt: string;
}

interface EmailSyncStatus {
  id: number;
  threadId: number;
  messageId?: number;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
  errorMessage?: string;
  syncAt: string;
}

// Helper function to clean HTML tags from plain text content
function cleanHtmlTags(content: string, preserveNewlines: boolean = true, filterQuotedLines: boolean = true): string {
  if (!content) return '';

  let cleaned = content
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  if (preserveNewlines) {
    // Clean up extra spaces on each line but preserve newlines
    let lines = cleaned.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim());

    // Filter out quoted lines (starting with >) if requested
    if (filterQuotedLines) {
      lines = lines.filter(line => !line.startsWith('>'));
    }

    cleaned = lines
      .join('\n')
      // Collapse multiple blank lines into one
      .replace(/\n{3,}/g, '\n\n');
  } else {
    // Collapse all whitespace into single spaces (for previews)
    cleaned = cleaned.replace(/\s+/g, ' ');
  }

  return cleaned.trim();
}

export function EnhancedMessageCenter() {
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [richContent, setRichContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState(''); // CC recipients (comma-separated)
  const [showCcField, setShowCcField] = useState(false);
  const [editorKey, setEditorKey] = useState(0); // Key to force RichTextEditor reset
  const { brandColor, needsDarkText } = useBrandColor();

  // Template management state
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => loadTemplates());
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateLabel, setTemplateLabel] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCimFilter, setSelectedCimFilter] = useState<string>('all');
  const [selectedThreads, setSelectedThreads] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch CIM documents with messages for filtering
  const { data: cimDocuments } = useQuery({
    queryKey: ['/api/messages/cim-documents'],
    queryFn: async () => {
      const res = await fetch('/api/messages/cim-documents', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch CIM documents');
      return res.json() as Promise<{ id: number; title: string; messageCount: number }[]>;
    },
  });

  // Fetch threads with enhanced data
  const { data: threads, isLoading } = useQuery({
    queryKey: ['/api/messages/threads', showArchived, selectedCimFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        archived: showArchived.toString(),
        ...(selectedCimFilter !== 'all' ? { cimDocumentId: selectedCimFilter } : {})
      });
      const res = await fetch(`/api/messages/threads?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch threads');
      return res.json() as Promise<MessageThread[]>;
    },
    refetchInterval: 30000, // Poll less frequently - cache handles freshness
  });

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!threads) return [];
    if (!searchQuery.trim()) return threads;

    const query = searchQuery.toLowerCase().trim();
    return threads.filter(thread => {
      // Search in name
      if (thread.inquirerName?.toLowerCase().includes(query)) return true;
      // Search in email
      if (thread.inquirerEmail?.toLowerCase().includes(query)) return true;
      // Search in subject
      if (thread.subject?.toLowerCase().includes(query)) return true;
      // Search in CIM title
      if (thread.cimTitle?.toLowerCase().includes(query)) return true;
      // Search in last message content
      if (thread.lastMessage?.content?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [threads, searchQuery]);

  // Fetch messages for selected thread
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/messages/threads', selectedThread?.id, 'messages'],
    queryFn: async () => {
      if (!selectedThread) return [];
      const res = await fetch(`/api/messages/threads/${selectedThread.id}/messages`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json() as Promise<Message[]>;
    },
    enabled: !!selectedThread,
    refetchInterval: 20000, // Reduced polling - cache improves performance
  });

  // Fetch email sync status for selected thread
  const { data: syncStatus } = useQuery({
    queryKey: ['/api/messages/sync-status', selectedThread?.id],
    queryFn: async () => {
      if (!selectedThread) return [];
      const res = await fetch(`/api/messages/sync-status/${selectedThread.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch sync status');
      return res.json() as Promise<EmailSyncStatus[]>;
    },
    enabled: !!selectedThread,
    refetchInterval: 30000, // Reduced polling frequency
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, content, richContent, attachmentPaths, ccEmails }: {
      threadId: number;
      content: string;
      richContent?: string;
      attachmentPaths?: string[];
      ccEmails?: string;
    }) => {
      const response = await fetch(`/api/messages/threads/${threadId}/reply`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          richContent,
          attachmentPaths,
          ccEmails
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      setRichContent('');
      setAttachments([]);
      setAttachmentUrls([]);
      setCcEmails('');
      setShowCcField(false);
      setEditorKey(prev => prev + 1); // Force RichTextEditor to reset
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads', selectedThread?.id, 'messages'] });
      toast({ title: 'Message sent successfully' });
      
      // Scroll to bottom within the messages container only
      setTimeout(() => {
        if (messagesEndRef.current) {
          const scrollArea = messagesEndRef.current.closest('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (scrollArea) {
            scrollArea.scrollTo({
              top: scrollArea.scrollHeight,
              behavior: 'smooth'
            });
          } else {
            // Fallback: scroll within parent container
            messagesEndRef.current.scrollIntoView({ 
              behavior: 'smooth',
              block: 'nearest',
              inline: 'nearest'
            });
          }
        }
      }, 100);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send message', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Archive/unarchive mutations
  const archiveMutation = useMutation({
    mutationFn: ({ threadId, archive }: { threadId: number; archive: boolean }) =>
      apiRequest('PATCH', `/api/messages/threads/${threadId}/${archive ? 'archive' : 'reactivate'}`),
    onSuccess: (_, variables) => {
      // Invalidate all thread queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
      toast({ title: variables.archive ? 'Thread archived' : 'Thread reactivated' });
      setSelectedThread(null);
    },
  });

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation({
    mutationFn: async ({ threadIds, archive }: { threadIds: number[]; archive: boolean }) => {
      const promises = threadIds.map(threadId =>
        apiRequest('PATCH', `/api/messages/threads/${threadId}/${archive ? 'archive' : 'reactivate'}`)
      );
      return Promise.all(promises);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
      toast({ 
        title: `${variables.threadIds.length} thread${variables.threadIds.length > 1 ? 's' : ''} ${variables.archive ? 'archived' : 'reactivated'}` 
      });
      setSelectedThreads(new Set());
      setIsMultiSelectMode(false);
      setSelectedThread(null);
    },
  });

  // Multi-select helper functions
  const toggleThreadSelection = (threadId: number) => {
    setSelectedThreads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  };

  const selectAllThreads = () => {
    if (threads) {
      setSelectedThreads(new Set(threads.map(t => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedThreads(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBulkArchive = (archive: boolean) => {
    if (selectedThreads.size > 0) {
      bulkArchiveMutation.mutate({
        threadIds: Array.from(selectedThreads),
        archive
      });
    }
  };

  // Mark messages as read when thread is selected
  useEffect(() => {
    if (selectedThread && selectedThread.unreadCount > 0) {
      // Messages are automatically marked as read when fetched in the API
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
    }
  }, [selectedThread, queryClient]);

  // Clear selection when switching between archived/active or changing filters
  useEffect(() => {
    clearSelection();
  }, [showArchived, selectedCimFilter]);

  const handleSendMessage = async () => {
    if (!selectedThread || (!newMessage.trim() && !richContent.trim())) return;
    
    let uploadedFiles: string[] = [];
    
    // Upload files to object storage if any
    if (attachments.length > 0) {
      try {
        for (const file of attachments) {
          const formData = new FormData();
          formData.append('file', file);
          
          const uploadResponse = await fetch('/api/messages/upload-attachment', {
            method: 'POST',
            credentials: 'include',
            body: formData
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }
          
          const result = await uploadResponse.json();
          uploadedFiles.push(result.filePath);
        }
      } catch (error) {
        toast({
          title: 'Upload Failed',
          description: error instanceof Error ? error.message : 'Failed to upload files',
          variant: 'destructive'
        });
        return;
      }
    }
    
    sendMessageMutation.mutate({
      threadId: selectedThread.id,
      content: newMessage || richContent,
      richContent: richContent || undefined,
      attachmentPaths: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      ccEmails: ccEmails.trim() || undefined
    });
    
    // Form will be cleared in the mutation's onSuccess callback
  };

  // Auto-scroll when new messages arrive - scroll within the messages container only
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          // Scroll within the container, not the entire page
          const scrollArea = messagesEndRef.current.closest('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (scrollArea) {
            scrollArea.scrollTo({
              top: scrollArea.scrollHeight,
              behavior: 'smooth'
            });
          } else {
            // Fallback: scroll within parent container
            messagesEndRef.current.scrollIntoView({ 
              behavior: 'smooth',
              block: 'nearest',
              inline: 'nearest'
            });
          }
        }
      }, 100);
    }
  }, [messages]);

  const getMessageIcon = (message: Message) => {
    if (message.messageType === 'email_reply') {
      return <Mail className="h-4 w-4 text-blue-600" />;
    }
    return <MessageSquare className="h-4 w-4 text-green-600" />;
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
      case 'bounced':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'sent':
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const latestSyncForMessage = (messageId: number) => {
    return syncStatus?.find((sync: EmailSyncStatus) => sync.messageId === messageId);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-180px)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Thread List */}
      <div className={`${selectedThread ? 'hidden lg:flex' : 'flex'} w-full lg:w-[340px] xl:w-[380px] border-b lg:border-b-0 lg:border-r border-slate-200 flex-col bg-slate-50`}>
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button
                variant={isMultiSelectMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                className="flex items-center gap-1.5 text-sm text-slate-700 border-slate-300"
              >
                <CheckCircle className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {isMultiSelectMode ? 'Cancel' : 'Select'}
                </span>
              </Button>
              <Button
                variant={showArchived ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-1.5 text-sm text-slate-700 border-slate-300"
              >
                {showArchived ? (
                  <>
                    <ArchiveRestore className="h-4 w-4" />
                    <span>Active</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    <span>Archived</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Multi-select toolbar */}
          {isMultiSelectMode && (
            <div className="flex flex-col sm:flex-row gap-2 p-3 mt-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm font-medium text-blue-700">
                  {selectedThreads.size} selected
                </span>
                {threads && selectedThreads.size < threads.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllThreads}
                    className="text-blue-600 hover:text-blue-700 h-auto p-1 text-sm"
                  >
                    Select All ({threads.length})
                  </Button>
                )}
                {selectedThreads.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-blue-600 hover:text-blue-700 h-auto p-1 text-sm"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {selectedThreads.size > 0 && (
                <Button
                  size="sm"
                  onClick={() => handleBulkArchive(!showArchived)}
                  disabled={bulkArchiveMutation.isPending}
                  className="flex items-center gap-1 text-sm"
                >
                  {showArchived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4" />
                      <span>Reactivate</span>
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" />
                      <span>Archive</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Search and Filter Section */}
        <div className="p-3 space-y-3 border-b border-slate-200 bg-white">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* CIM Document Filter */}
          <div className="flex gap-2 items-center">
            <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <Select value={selectedCimFilter} onValueChange={setSelectedCimFilter}>
              <SelectTrigger className="flex-1 bg-slate-50 border-slate-200 text-slate-700">
                <SelectValue placeholder="All CIM documents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All CIMs ({threads?.length || 0})</SelectItem>
                {cimDocuments?.map((cim) => (
                  <SelectItem key={cim.id} value={cim.id.toString()}>
                    {cim.title} ({cim.messageCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCimFilter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCimFilter('all')}
                className="px-2 text-slate-500 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredThreads.length === 0 ? (
            <div className="p-6 text-center">
              <MessageCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                {searchQuery ? 'No messages match your search' : showArchived ? 'No archived messages' : 'No messages yet'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={`mb-1.5 p-3 rounded-lg cursor-pointer transition-all border ${
                    selectedThreads.has(thread.id)
                      ? 'bg-green-50 border-green-300 shadow-sm'
                      : selectedThread?.id === thread.id
                      ? 'bg-white border-blue-300 shadow-sm'
                      : 'bg-white border-transparent hover:border-slate-200 hover:shadow-sm'
                  }`}
                  onClick={(e) => {
                    if (isMultiSelectMode) {
                      e.preventDefault();
                      toggleThreadSelection(thread.id);
                    } else {
                      setSelectedThread(thread);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Multi-select checkbox */}
                    {isMultiSelectMode && (
                      <div
                        className="flex-shrink-0 mt-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleThreadSelection(thread.id);
                        }}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedThreads.has(thread.id)
                            ? 'bg-green-500 border-green-500'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}>
                          {selectedThreads.has(thread.id) && (
                            <CheckCircle className="h-3 w-3 text-white" />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-slate-800 truncate">
                            {thread.inquirerName}
                          </h3>
                          <p className="text-xs text-slate-500 truncate">
                            {thread.cimTitle || thread.subject}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {thread.unreadCount > 0 && (
                            <Badge
                              className="text-xs px-1.5 py-0"
                              style={brandColor ? {
                                backgroundColor: brandColor,
                                color: needsDarkText ? '#1e293b' : '#ffffff'
                              } : { backgroundColor: '#2563eb', color: '#ffffff' }}
                            >
                              {thread.unreadCount}
                            </Badge>
                          )}
                          <span className="text-xs text-slate-400">
                            {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {thread.lastMessage && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1.5">
                          {cleanHtmlTags(thread.lastMessage.content, false)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message Details */}
      <div className={`${selectedThread ? 'flex' : 'hidden lg:flex'} flex-1 flex-col bg-slate-50`}>
        {selectedThread ? (
          <>
            {/* Header with Contact Info */}
            <div className="p-4 border-b border-slate-200 bg-white">
              {/* Mobile back button */}
              <div className="lg:hidden mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedThread(null)}
                  className="p-0 h-auto text-sm text-slate-600 hover:text-slate-800"
                >
                  ← Back
                </Button>
              </div>

              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                      {selectedThread.inquirerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-800 truncate">{selectedThread.inquirerName}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="truncate">{selectedThread.inquirerEmail}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-slate-400 hover:text-slate-600"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedThread.inquirerEmail);
                            toast({ title: 'Email copied' });
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {selectedThread.cimTitle && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-400">CIM:</span>
                      {selectedThread.shareSlug ? (
                        <a
                          href={`/share/${selectedThread.shareSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-medium"
                        >
                          {selectedThread.cimTitle}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600 font-medium truncate">{selectedThread.cimTitle}</span>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => archiveMutation.mutate({
                    threadId: selectedThread.id,
                    archive: !showArchived
                  })}
                  disabled={archiveMutation.isPending}
                  className="flex items-center gap-1.5 text-sm text-slate-600 border-slate-300"
                >
                  {showArchived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4" />
                      <span className="hidden sm:inline">Reactivate</span>
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" />
                      <span className="hidden sm:inline">Archive</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages?.map((message) => {
                    const sync = latestSyncForMessage(message.id);
                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.senderType === 'owner' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] md:max-w-[70%] rounded-lg p-2 md:p-3 break-words ${
                            message.senderType === 'owner'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                          style={message.senderType === 'owner' ? {
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: '#ffffff',
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                          } : {}}
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <div className="flex-shrink-0">
                              {getMessageIcon(message)}
                            </div>
                            <span className={`text-xs truncate ${
                              message.senderType === 'owner' 
                                ? 'text-blue-100 font-medium' 
                                : 'text-gray-600 opacity-75'
                            }`}>
                              {message.senderType === 'owner' ? 'You' : message.senderEmail}
                            </span>
                            {message.messageType === 'email_reply' && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                Email Reply
                              </Badge>
                            )}
                            {sync && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {getSyncStatusIcon(sync.status)}
                                <span className={`text-xs capitalize ${
                                  message.senderType === 'owner' 
                                    ? 'text-blue-100 font-medium' 
                                    : 'text-gray-600 opacity-75'
                                }`}>
                                  {sync.status}
                                </span>
                              </div>
                            )}
                          </div>
                          {message.richContent ? (
                            <div 
                              className={`prose prose-sm max-w-none break-words overflow-wrap-anywhere [&>p]:mb-2 [&>p:last-child]:mb-0 [&>p:first-child]:mt-0 ${
                                message.senderType === 'owner' ? 'text-white' : ''
                              }`}
                              dangerouslySetInnerHTML={{ 
                                __html: message.richContent
                                  // Clean up TipTap's extra paragraph wrapping
                                  .replace(/^<p[^>]*>([\s\S]*)<\/p>$/, '$1')  // Remove wrapping p tags if it's the only content
                                  .replace(/<p[^>]*>\s*<\/p>/g, '')       // Remove empty p tags
                                  .replace(/<p[^>]*>/g, '')               // Remove opening p tags
                                  .replace(/<\/p>/g, '<br>')             // Convert closing p tags to breaks
                                  .replace(/(<br>\s*){2,}/g, '<br><br>') // Normalize multiple breaks
                                  .replace(/^<br>+/, '')                 // Remove leading breaks
                                  .replace(/<br>+$/, '')                 // Remove trailing breaks
                              }}
                            />
                          ) : (
                            <p className={`whitespace-pre-wrap break-words overflow-wrap-anywhere ${
                              message.senderType === 'owner' ? 'text-white' : ''
                            }`}>{cleanHtmlTags(message.content)}</p>
                          )}
                          
                          {/* Show attachments - check both attachments and attachmentPaths */}
                          {((message.attachments && message.attachments.length > 0) || 
                            (message.attachmentPaths && message.attachmentPaths.length > 0)) && (
                            <div className="mt-3 space-y-2">
                              <div className="text-xs opacity-75">Attachments:</div>
                              
                              {/* Proper attachment objects */}
                              {message.attachments?.map((attachment) => (
                                <div key={attachment.id} className="flex items-center gap-2 p-2 bg-white/10 rounded">
                                  <FileText className="h-4 w-4" />
                                  <span className="text-xs truncate flex-1">{attachment.fileName}</span>
                                  <span className="text-xs opacity-75">
                                    {(attachment.fileSize / 1024).toFixed(1)}KB
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(`/api/messages/download-attachment/${attachment.id}`, '_blank')}
                                    className="h-6 w-6 p-0 hover:bg-white/20"
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              
                              {/* Simple attachment paths (for backward compatibility) */}
                              {message.attachmentPaths?.map((attachmentPath, idx) => (
                                <div key={`path-${idx}`} className="flex items-center gap-2 p-2 bg-white/10 rounded">
                                  <FileText className="h-4 w-4" />
                                  <span className="text-xs truncate flex-1">{attachmentPath}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      toast({ title: `Attachment: ${attachmentPath}` });
                                    }}
                                    className="h-6 w-6 p-0 hover:bg-white/20"
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className={`text-xs mt-2 ${
                            message.senderType === 'owner' 
                              ? 'text-blue-100 font-medium' 
                              : 'text-gray-500 opacity-75'
                          }`}>
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Reply Box with Rich Text Editor */}
            {!showArchived && (
              <div className="p-4 border-t border-slate-200 bg-white">
                <div className="space-y-3">
                  {/* Templates and CC Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Templates Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-slate-600 border-slate-300">
                          <ClipboardList className="h-4 w-4" />
                          <span className="hidden sm:inline">Templates</span>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64">
                        {templates.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-gray-500">No templates yet</div>
                        ) : (
                          templates.map((template) => (
                            <div key={template.id} className="flex items-center group">
                              <DropdownMenuItem
                                className="flex-1"
                                onClick={() => {
                                  setRichContent(template.content);
                                  setEditorKey(prev => prev + 1);
                                }}
                              >
                                {template.label}
                              </DropdownMenuItem>
                              <div className="flex items-center gap-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTemplate(template);
                                    setTemplateLabel(template.label);
                                    setTemplateContent(template.content);
                                    setTemplateDialogOpen(true);
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  <Pencil className="h-3 w-3 text-gray-500" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newTemplates = templates.filter(t => t.id !== template.id);
                                    setTemplates(newTemplates);
                                    saveTemplates(newTemplates);
                                    toast({ title: 'Template deleted' });
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingTemplate(null);
                            setTemplateLabel('');
                            setTemplateContent('');
                            setTemplateDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Template
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* CC Toggle Button */}
                    <Button
                      variant={showCcField ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setShowCcField(!showCcField)}
                      className="flex items-center gap-1.5 text-slate-600 border-slate-300"
                    >
                      <Mail className="h-4 w-4" />
                      <span>CC</span>
                    </Button>
                  </div>

                  {/* CC Field */}
                  {showCcField && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 flex-shrink-0">CC:</span>
                      <Input
                        type="text"
                        placeholder="email1@example.com, email2@example.com"
                        value={ccEmails}
                        onChange={(e) => setCcEmails(e.target.value)}
                        className="flex-1 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCcEmails('');
                          setShowCcField(false);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  <RichTextEditor
                    key={`${selectedThread?.id}-${editorKey}`} // Force re-render when thread changes or message is sent
                    content={richContent}
                    onChange={setRichContent}
                    placeholder="Type your reply with rich formatting... (will be sent via email)"
                    className="min-h-[120px]"
                  />
                  
                  {/* Show attached files */}
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Attachments ({attachments.length}):</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attachments.map((file, index) => (
                          <div key={`file-${index}`} className="flex items-center gap-2 p-2 bg-white rounded border">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm truncate flex-1">{file.name}</span>
                            <span className="text-xs text-gray-500">
                              {(file.size / 1024).toFixed(1)}KB
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const newAttachments = [...attachments];
                                newAttachments.splice(index, 1);
                                setAttachments(newAttachments);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}

                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="*/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            setAttachments(prev => [...prev, ...files]);
                            toast({ title: `${files.length} file(s) attached` });
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-slate-600 border-slate-300"
                      >
                        <Paperclip className="h-4 w-4 mr-1.5" />
                        Attach
                      </Button>
                      <span className="text-xs text-slate-400 hidden sm:inline">
                        Sent via email
                      </span>
                    </div>

                    <BrandedButton
                      onClick={handleSendMessage}
                      disabled={(!newMessage.trim() && !richContent.trim()) || sendMessageMutation.isPending}
                      className="flex items-center gap-2 w-full sm:w-auto"
                    >
                      <Send className="h-4 w-4" />
                      {sendMessageMutation.isPending ? 'Sending...' : 'Send Reply'}
                    </BrandedButton>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">Select a conversation</p>
              <p className="text-slate-400 text-sm mt-1">Choose a message thread to view</p>
            </div>
          </div>
        )}
      </div>

      {/* Template Create/Edit Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-label">Template Name</Label>
              <Input
                id="template-label"
                placeholder="e.g., Schedule a call"
                value={templateLabel}
                onChange={(e) => setTemplateLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-content">Message Content</Label>
              <Textarea
                id="template-content"
                placeholder="Enter the template message..."
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTemplateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!templateLabel.trim() || !templateContent.trim()) {
                  toast({ title: 'Please fill in both fields', variant: 'destructive' });
                  return;
                }

                let newTemplates: MessageTemplate[];
                if (editingTemplate) {
                  // Update existing template
                  newTemplates = templates.map(t =>
                    t.id === editingTemplate.id
                      ? { ...t, label: templateLabel.trim(), content: templateContent.trim() }
                      : t
                  );
                  toast({ title: 'Template updated' });
                } else {
                  // Create new template
                  const newTemplate: MessageTemplate = {
                    id: `template-${Date.now()}`,
                    label: templateLabel.trim(),
                    content: templateContent.trim()
                  };
                  newTemplates = [...templates, newTemplate];
                  toast({ title: 'Template created' });
                }

                setTemplates(newTemplates);
                saveTemplates(newTemplates);
                setTemplateDialogOpen(false);
                setEditingTemplate(null);
                setTemplateLabel('');
                setTemplateContent('');
              }}
            >
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}