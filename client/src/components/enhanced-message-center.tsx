import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Send, Mail, MessageSquare, Clock, CheckCircle, AlertCircle, Archive, ArchiveRestore, MessageCircle, Filter, X, Paperclip, FileText, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { RichTextEditor } from '@/components/RichTextEditor';

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

export function EnhancedMessageCenter() {
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [richContent, setRichContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCimFilter, setSelectedCimFilter] = useState<string>('all');
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
    mutationFn: async ({ threadId, content, richContent, attachmentPaths }: { 
      threadId: number; 
      content: string; 
      richContent?: string;
      attachmentPaths?: string[];
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
          attachmentPaths
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
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads', selectedThread?.id, 'messages'] });
      toast({ title: 'Message sent successfully' });
      
      // Scroll to bottom after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
      toast({ title: showArchived ? 'Thread reactivated' : 'Thread archived' });
      setSelectedThread(null);
    },
  });

  // Mark messages as read when thread is selected
  useEffect(() => {
    if (selectedThread && selectedThread.unreadCount > 0) {
      // Messages are automatically marked as read when fetched in the API
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
    }
  }, [selectedThread, queryClient]);

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
      attachmentPaths: uploadedFiles.length > 0 ? uploadedFiles : undefined
    });
    
    // Clear form and attachments after sending
    setNewMessage('');
    setRichContent('');
    setAttachments([]);
  };

  // Auto-scroll when new messages arrive - scroll within the messages container
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest'
        });
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
    <div className="flex flex-col lg:flex-row min-h-[500px] lg:h-[800px] bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Thread List */}
      <div className={`${selectedThread ? 'hidden lg:flex' : 'flex'} w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-gray-200 flex-col`}>
        <div className="p-3 md:p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <h2 className="text-lg md:text-xl font-semibold">Messages</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-1 md:gap-2 w-full sm:w-auto justify-center text-sm"
            >
              {showArchived ? (
                <>
                  <ArchiveRestore className="h-3 w-3 md:h-4 md:w-4" />
                  <span>Show Active</span>
                </>
              ) : (
                <>
                  <Archive className="h-3 w-3 md:h-4 md:w-4" />
                  <span>Show Archived</span>
                </>
              )}
            </Button>
          </div>

          {/* CIM Document Filter */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter by CIM Document</span>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={selectedCimFilter} onValueChange={setSelectedCimFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All CIM documents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CIM documents ({threads?.length || 0})</SelectItem>
                  {cimDocuments?.map((cim) => (
                    <SelectItem key={cim.id} value={cim.id.toString()}>
                      {cim.title} ({cim.messageCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCimFilter !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCimFilter('all')}
                  className="px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Enhanced email sync indicator */}
          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 bg-blue-50 p-2 rounded">
            <Mail className="h-3 w-3 md:h-4 md:w-4" />
            <span className="text-xs md:text-sm">Email replies sync automatically</span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {threads?.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {showArchived ? 'No archived messages' : 'No messages yet'}
            </div>
          ) : (
            <div className="p-2">
              {threads?.map((thread) => (
                <Card
                  key={thread.id}
                  className={`mb-2 cursor-pointer transition-colors ${
                    selectedThread?.id === thread.id
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedThread(thread)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="font-semibold text-sm truncate">
                          {thread.subject}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">
                          {thread.inquirerName} ({thread.inquirerEmail})
                        </p>
                        {thread.cimTitle && (
                          <p className="text-xs text-gray-500 truncate">
                            Re: {thread.cimTitle}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {thread.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {thread.unreadCount}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    
                    {thread.lastMessage && (
                      <div className="flex items-start gap-2 mt-2">
                        <div className="flex-shrink-0">
                          {getMessageIcon(thread.lastMessage)}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 flex-1 min-w-0 break-words">
                          {thread.lastMessage.content}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message Details */}
      <div className={`${selectedThread ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  {/* Mobile back button */}
                  <div className="lg:hidden mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedThread(null)}
                      className="p-1 h-auto text-sm"
                    >
                      ← Back to Messages
                    </Button>
                  </div>
                  
                  <h3 className="text-base md:text-lg font-semibold truncate">{selectedThread.subject}</h3>
                  <p className="text-xs md:text-sm text-gray-600 truncate">
                    Conversation with {selectedThread.inquirerName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Email: {selectedThread.threadEmailAddress}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => archiveMutation.mutate({ 
                    threadId: selectedThread.id, 
                    archive: !showArchived 
                  })}
                  disabled={archiveMutation.isPending}
                  className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3"
                >
                  {showArchived ? (
                    <>
                      <ArchiveRestore className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="hidden sm:inline">Reactivate</span>
                    </>
                  ) : (
                    <>
                      <Archive className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="hidden sm:inline">Archive</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-2 md:p-4">
              {messagesLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
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
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <div className="flex-shrink-0">
                              {getMessageIcon(message)}
                            </div>
                            <span className="text-xs opacity-75 truncate">
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
                                <span className="text-xs opacity-75 capitalize">
                                  {sync.status}
                                </span>
                              </div>
                            )}
                          </div>
                          {message.richContent ? (
                            <div 
                              className="prose prose-sm max-w-none break-words overflow-wrap-anywhere [&>p]:mb-2 [&>p:last-child]:mb-0 [&>p:first-child]:mt-0"
                              dangerouslySetInnerHTML={{ 
                                __html: message.richContent
                                  // Clean up TipTap's extra paragraph wrapping
                                  .replace(/^<p[^>]*>(.*)<\/p>$/s, '$1')  // Remove wrapping p tags if it's the only content
                                  .replace(/<p[^>]*>\s*<\/p>/g, '')       // Remove empty p tags
                                  .replace(/<p[^>]*>/g, '')               // Remove opening p tags
                                  .replace(/<\/p>/g, '<br>')             // Convert closing p tags to breaks
                                  .replace(/(<br>\s*){2,}/g, '<br><br>') // Normalize multiple breaks
                                  .replace(/^<br>+/, '')                 // Remove leading breaks
                                  .replace(/<br>+$/, '')                 // Remove trailing breaks
                              }}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
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
                                    onClick={() => window.open(attachment.filePath, '_blank')}
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
                          <div className="text-xs opacity-75 mt-2">
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
              <div className="p-3 md:p-4 border-t border-gray-200 bg-gray-50">
                <div className="space-y-3">
                  <RichTextEditor
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
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs sm:text-sm text-gray-500 flex items-center gap-1 sm:gap-2">
                        <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="truncate">Reply will be sent via email</span>
                      </div>
                      
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
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 px-2"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button
                      onClick={handleSendMessage}
                      disabled={(!newMessage.trim() && !richContent.trim()) || sendMessageMutation.isPending}
                      className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto text-sm"
                    >
                      <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                      {sendMessageMutation.isPending ? 'Sending...' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm md:text-base">Select a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}