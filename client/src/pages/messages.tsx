import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  MessageCircle, 
  Send, 
  Clock, 
  User, 
  FileText,
  Archive,
  RotateCcw
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
// import { format, formatDistanceToNow } from "date-fns";

interface Message {
  id: number;
  threadId: number;
  senderType: "owner" | "inquirer";
  senderEmail: string;
  content: string;
  messageType: string;
  isRead: boolean;
  createdAt: string;
}

interface MessageThread {
  id: number;
  userId: number;
  cimDocumentId: number;
  inquirerEmail: string;
  inquirerName: string;
  subject: string;
  status: "active" | "archived";
  threadEmailAddress: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessage?: Message;
  cimTitle?: string;
}

export default function Messages() {
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const queryClient = useQueryClient();

  // Fetch message threads
  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ["/api/messages/threads"],
  });

  // Fetch messages for selected thread
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/messages/threads", selectedThread, "messages"],
    enabled: !!selectedThread,
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ["/api/messages/unread-count"],
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (data: { threadId: number; content: string }) => {
      const response = await fetch(`/api/messages/threads/${data.threadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: data.content }),
      });
      return response.json();
    },
    onSuccess: () => {
      setReplyContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/messages/threads", selectedThread, "messages"] 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (threadId: number) => {
      const response = await fetch(`/api/messages/threads/${threadId}/archive`, {
        method: "PATCH",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      if (selectedThread) {
        setSelectedThread(null);
      }
    },
  });

  // Reactivate mutation
  const reactivateMutation = useMutation({
    mutationFn: async (threadId: number) => {
      const response = await fetch(`/api/messages/threads/${threadId}/reactivate`, {
        method: "PATCH",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
    },
  });

  const handleReply = () => {
    if (!selectedThread || !replyContent.trim()) return;
    
    replyMutation.mutate({
      threadId: selectedThread,
      content: replyContent.trim(),
    });
  };

  const handleArchive = (threadId: number) => {
    archiveMutation.mutate(threadId);
  };

  const handleReactivate = (threadId: number) => {
    reactivateMutation.mutate(threadId);
  };

  // Filter threads based on status
  const filteredThreads = (threads as MessageThread[]).filter((thread: MessageThread) => 
    showArchived ? thread.status === "archived" : thread.status === "active"
  );

  const selectedThreadData = (threads as MessageThread[]).find((thread: MessageThread) => thread.id === selectedThread);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50">
      {/* Mobile/Tablet Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
          {(unreadData as any)?.count > 0 && (
            <Badge variant="destructive">
              {(unreadData as any).count}
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={!showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(false)}
            className="flex items-center gap-1 text-xs px-3 py-1.5"
          >
            <MessageCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Active</span>
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5"
          >
            <Archive className="h-3 w-3" />
            <span className="hidden sm:inline">Archived</span>
          </Button>
        </div>
      </div>

      {/* Sidebar - Thread List */}
      <div className={`${selectedThread ? 'hidden lg:flex' : 'flex'} w-full lg:w-1/3 bg-white border-r border-gray-200 flex-col`}>
        {/* Desktop Header */}
        <div className="hidden lg:block p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            {(unreadData as any)?.count > 0 && (
              <Badge variant="destructive" className="ml-2">
                {(unreadData as any).count}
              </Badge>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={!showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(false)}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Active
            </Button>
            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(true)}
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {threadsLoading ? (
            <div className="p-4 text-center text-gray-500">Loading threads...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {showArchived ? "No archived messages" : "No active messages"}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredThreads.map((thread: MessageThread) => (
                <div
                  key={thread.id}
                  className={`p-3 sm:p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedThread === thread.id ? "bg-blue-50 border-r-2 border-blue-500" : ""
                  }`}
                  onClick={() => setSelectedThread(thread.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate text-sm sm:text-base">{thread.inquirerName}</p>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{thread.inquirerEmail}</p>
                      </div>
                    </div>
                    {thread.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-xs flex-shrink-0">
                        {thread.unreadCount}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="mb-2">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                      {thread.subject}
                    </p>
                    {thread.cimTitle && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                        <FileText className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{thread.cimTitle}</span>
                      </p>
                    )}
                  </div>
                  
                  {thread.lastMessage && (
                    <p className="text-sm text-gray-600 truncate mb-2">
                      {thread.lastMessage.content}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(thread.lastMessageAt).toLocaleDateString()}
                    </span>
                    {thread.status === "archived" && (
                      <Badge variant="secondary" className="text-xs">
                        Archived
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Content - Messages */}
      <div className={`${selectedThread ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="p-3 sm:p-4 bg-white border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {/* Mobile back button */}
                  <div className="lg:hidden mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedThread(null)}
                      className="p-1 h-auto"
                    >
                      ← Back to Messages
                    </Button>
                  </div>
                  
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                    {selectedThreadData?.subject}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {selectedThreadData?.inquirerName} ({selectedThreadData?.inquirerEmail})
                  </p>
                  {selectedThreadData?.cimTitle && (
                    <p className="text-xs sm:text-sm text-gray-500 flex items-center gap-1 truncate mt-1">
                      <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">{selectedThreadData.cimTitle}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-1 sm:gap-2 ml-2">
                  {selectedThreadData?.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchive(selectedThread)}
                      disabled={archiveMutation.isPending}
                      className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3"
                    >
                      <Archive className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Archive</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReactivate(selectedThread)}
                      disabled={reactivateMutation.isPending}
                      className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3"
                    >
                      <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Reactivate</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-2 sm:p-4">
              {messagesLoading ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {(messages as Message[]).map((message: Message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.senderType === "owner" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-2 sm:p-3 ${
                          message.senderType === "owner"
                            ? "bg-blue-600 text-white"
                            : "bg-white border border-gray-200"
                        }`}
                      >
                        <div className="mb-1 sm:mb-2">
                          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm opacity-75">
                            {message.senderType === "owner" ? (
                              <span>You</span>
                            ) : (
                              <span className="truncate">{selectedThreadData?.inquirerName}</span>
                            )}
                            <span>•</span>
                            <span className="hidden sm:inline">{new Date(message.createdAt).toLocaleString()}</span>
                            <span className="sm:hidden">{new Date(message.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap text-sm sm:text-base break-words">{message.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Reply Box */}
            {selectedThreadData?.status === "active" && (
              <div className="p-3 sm:p-4 bg-white border-t border-gray-200">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="flex-1 min-h-[60px] sm:min-h-[80px] text-sm sm:text-base"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.metaKey) {
                        handleReply();
                      }
                    }}
                  />
                  <Button
                    onClick={handleReply}
                    disabled={!replyContent.trim() || replyMutation.isPending}
                    className="w-full sm:w-auto flex items-center justify-center gap-2"
                    size="sm"
                  >
                    <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="text-sm">Send</span>
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  <span className="hidden sm:inline">Press ⌘+Enter to send • </span>Reply will be sent via email
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500">
                Choose a thread from the sidebar to view messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}