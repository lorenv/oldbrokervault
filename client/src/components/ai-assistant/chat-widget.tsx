import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Sparkles,
  Loader2,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface TokenUsage {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch chat history
  const { data: historyData, isLoading: historyLoading } = useQuery<{ messages: ChatMessage[] }>({
    queryKey: ["/api/ai-assistant/history"],
    enabled: isOpen,
  });

  // Fetch token usage
  const { data: usageData } = useQuery<TokenUsage>({
    queryKey: ["/api/ai-assistant/usage"],
    enabled: isOpen,
  });

  const messages = historyData?.messages || [];

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await apiRequest("POST", "/api/ai-assistant/chat", {
        body: { message: userMessage },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/usage"] });
    },
  });

  // Clear history mutation
  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/ai-assistant/history");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/history"] });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sendMessageMutation.isPending, isAtBottom]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle scroll to detect if user is at bottom
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  const handleSend = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message.trim());
    setMessage("");
    setIsAtBottom(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format message content with basic markdown
  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split("\n")
      .map((line, i) => {
        // Bold text
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Bullet points
        if (line.startsWith("- ")) {
          return `<li key="${i}" class="ml-4">${line.substring(2)}</li>`;
        }
        return line;
      })
      .join("<br/>");
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center",
          "w-14 h-14 rounded-full shadow-lg transition-all duration-200",
          "bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700",
          "text-white",
          isOpen && "scale-0 opacity-0"
        )}
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-h-[80vh]",
          "bg-white rounded-2xl shadow-2xl border border-gray-200",
          "flex flex-col overflow-hidden transition-all duration-300",
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <div>
              <h3 className="font-semibold text-sm">AI Assistant</h3>
              <p className="text-xs text-violet-200">Ask me about your CRM</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={() => clearHistoryMutation.mutate()}
                disabled={clearHistoryMutation.isPending}
                title="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Token Usage Bar */}
        {usageData && (
          <div className="px-4 py-2 bg-gray-50 border-b">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Monthly usage</span>
              <span>{usageData.percentUsed}% used</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  usageData.percentUsed > 90
                    ? "bg-red-500"
                    : usageData.percentUsed > 70
                    ? "bg-amber-500"
                    : "bg-violet-500"
                )}
                style={{ width: `${Math.min(usageData.percentUsed, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {historyLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-violet-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">How can I help?</h4>
              <p className="text-sm text-gray-600 mb-4">
                Ask me about your deals, contacts, pipeline, or tasks.
              </p>
              <div className="space-y-2 w-full">
                {[
                  "What's my pipeline value?",
                  "Which deals need attention?",
                  "Show me overdue tasks",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setMessage(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div
                        className="prose prose-sm max-w-none [&>ul]:list-disc [&>ul]:pl-4"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatMessage(msg.content)) }}
                      />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {sendMessageMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                      <span className="text-sm text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              {sendMessageMutation.isError && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    <AlertCircle className="h-4 w-4" />
                    Failed to send message. Please try again.
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Scroll to bottom button */}
        {!isAtBottom && messages.length > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white shadow-md rounded-full p-2 hover:bg-gray-50 transition-colors"
          >
            <ChevronDown className="h-4 w-4 text-gray-600" />
          </button>
        )}

        {/* Input */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your CRM..."
              className="flex-1 bg-gray-50 border-gray-200 focus:bg-white"
              disabled={sendMessageMutation.isPending}
              maxLength={2000}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sendMessageMutation.isPending}
              size="sm"
              className="h-10 w-10 p-0 bg-violet-600 hover:bg-violet-700"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
