import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Send, Mail, MessageSquare, Clock, CheckCircle, AlertCircle, Archive, ArchiveRestore } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: number;
  threadId: number;
  senderType: 'owner' | 'inquirer';
  senderEmail: string;
  content: string;
  messageType: 'initial_inquiry' | 'app_message' | 'email_reply';
  sendgridMessageId?: string;
  isRead: boolean;
  createdAt: string;
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
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch threads with enhanced data
  const { data: threads, isLoading } = useQuery({
    queryKey: ['/api/messages/threads', showArchived],
    queryFn: async () => {
      const res = await fetch(`/api/messages/threads?archived=${showArchived}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch threads');
      return res.json() as Promise<MessageThread[]>;
    },
    refetchInterval: 5000, // Poll for real-time updates
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
    refetchInterval: 3000, // Poll for new email replies
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
    refetchInterval: 5000,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ threadId, content }: { threadId: number; content: string }) =>
      apiRequest('POST', `/api/messages/threads/${threadId}/reply`, { content }),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads', selectedThread?.id, 'messages'] });
      toast({ title: 'Message sent successfully' });
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

  const handleSendMessage = () => {
    if (!selectedThread || !newMessage.trim()) return;
    sendMessageMutation.mutate({ threadId: selectedThread.id, content: newMessage });
  };

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
    <div className="flex h-[800px] bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Thread List */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Messages</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2"
            >
              {showArchived ? (
                <>
                  <ArchiveRestore className="h-4 w-4" />
                  Active
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Archived
                </>
              )}
            </Button>
          </div>
          
          {/* Enhanced email sync indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">
            <Mail className="h-4 w-4" />
            <span>Email replies sync automatically</span>
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
                      <div className="flex-1">
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
                      <div className="flex flex-col items-end gap-1">
                        {thread.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {thread.unreadCount}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    
                    {thread.lastMessage && (
                      <div className="flex items-start gap-2 mt-2">
                        {getMessageIcon(thread.lastMessage)}
                        <p className="text-sm text-gray-600 line-clamp-2 flex-1">
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
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{selectedThread.subject}</h3>
                  <p className="text-sm text-gray-600">
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
                  className="flex items-center gap-2"
                >
                  {showArchived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4" />
                      Reactivate
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" />
                      Archive
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
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
                          className={`max-w-[70%] rounded-lg p-3 ${
                            message.senderType === 'owner'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {getMessageIcon(message)}
                            <span className="text-xs opacity-75">
                              {message.senderType === 'owner' ? 'You' : message.senderEmail}
                            </span>
                            {message.messageType === 'email_reply' && (
                              <Badge variant="secondary" className="text-xs">
                                Email Reply
                              </Badge>
                            )}
                            {sync && (
                              <div className="flex items-center gap-1">
                                {getSyncStatusIcon(sync.status)}
                                <span className="text-xs opacity-75 capitalize">
                                  {sync.status}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <div className="text-xs opacity-75 mt-2">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Reply Box */}
            {!showArchived && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="space-y-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your reply... (will be sent via email)"
                    className="min-h-[80px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleSendMessage();
                      }
                    }}
                  />
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>Reply will be sent via email to {selectedThread.inquirerEmail}</span>
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {sendMessageMutation.isPending ? 'Sending...' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to view messages
          </div>
        )}
      </div>
    </div>
  );
}