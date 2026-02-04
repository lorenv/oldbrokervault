import { useState, useRef, useEffect, useMemo } from "react";
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
  Minus,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";
import { useBrandColor } from "@/hooks/use-brand-color";

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

// Default fallback colors (violet/indigo)
const DEFAULT_PRIMARY = "#7c3aed"; // violet-600
const DEFAULT_SECONDARY = "#4f46e5"; // indigo-600

// Helper to darken/lighten a hex color
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Get organization's brand color
  const { brandColor, needsDarkText } = useBrandColor();

  // Generate color styles based on brand color or fallback
  const colorStyles = useMemo(() => {
    const primary = brandColor || DEFAULT_PRIMARY;
    const secondary = brandColor ? adjustColor(brandColor, -15) : DEFAULT_SECONDARY;
    const textColor = brandColor && needsDarkText ? "#1e293b" : "#ffffff";
    const subtleTextColor = brandColor && needsDarkText ? "#475569" : "rgba(255,255,255,0.7)";

    return {
      // Gradient background for header, button, minimized bar
      gradientStyle: {
        background: `linear-gradient(to right, ${primary}, ${secondary})`,
        color: textColor,
      },
      // Solid background for user messages and send button
      solidStyle: {
        backgroundColor: primary,
        color: textColor,
      },
      // Hover state
      hoverStyle: {
        backgroundColor: adjustColor(primary, -10),
      },
      // Light background for empty state icon
      lightBgStyle: {
        backgroundColor: `${primary}20`,
      },
      // Icon color
      iconColor: primary,
      textColor,
      subtleTextColor,
    };
  }, [brandColor, needsDarkText]);

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

  // Track pending user message while waiting for response
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      setPendingMessage(userMessage);
      setErrorMessage(null);
      const response = await apiRequest("POST", "/api/ai-assistant/chat", {
        body: { message: userMessage },
      });
      return response.json();
    },
    onSuccess: (data) => {
      setPendingMessage(null);
      // Check if the response contains an error
      if (data.error) {
        if (data.error === "openai_not_configured") {
          setErrorMessage("AI assistant is not configured. Please contact support to enable this feature.");
        } else if (data.error === "token_limit_reached") {
          setErrorMessage(data.response);
        } else {
          setErrorMessage(data.response || "An error occurred");
        }
      } else {
        setErrorMessage(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/usage"] });
    },
    onError: () => {
      setPendingMessage(null);
      setErrorMessage("Failed to send message. Please try again.");
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

  // Clear pending message when new messages arrive in history
  useEffect(() => {
    if (messages.length > 0 && pendingMessage) {
      // Check if the pending message now exists in history
      const pendingExists = messages.some(
        m => m.role === "user" && m.content === pendingMessage
      );
      if (pendingExists) {
        setPendingMessage(null);
      }
    }
  }, [messages, pendingMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sendMessageMutation.isPending, isAtBottom, pendingMessage]);

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
      {/* Chat Button - hidden when chat is open */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center",
          "w-14 h-14 rounded-full shadow-lg transition-all duration-200 hover:opacity-90",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
        style={colorStyles.gradientStyle}
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed z-50 bg-white shadow-2xl border border-gray-200",
          "flex flex-col overflow-hidden transition-all duration-300",
          // Fullscreen mode
          isFullscreen
            ? "inset-4 rounded-2xl"
            : "bottom-6 right-6 w-[400px] h-[600px] max-h-[80vh] rounded-2xl",
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={colorStyles.gradientStyle}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <div>
              <h3 className="font-semibold text-sm">AI Assistant</h3>
              <p className="text-xs" style={{ color: colorStyles.subtleTextColor }}>Ask me about your CRM</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 w-8 p-0 hover:bg-white/20", needsDarkText ? "text-slate-800" : "text-white")}
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
              className={cn("h-8 w-8 p-0 hover:bg-white/20", needsDarkText ? "text-slate-800" : "text-white")}
              onClick={() => {
                setIsOpen(false);
                setIsFullscreen(false);
              }}
              title="Minimize"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-8 w-8 p-0 hover:bg-white/20", needsDarkText ? "text-slate-800" : "text-white")}
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Shrink" : "Expand"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-8 w-8 p-0 hover:bg-white/20", needsDarkText ? "text-slate-800" : "text-white")}
              onClick={() => {
                setIsOpen(false);
                setIsFullscreen(false);
              }}
              title="Close"
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
                  usageData.percentUsed > 90 && "bg-red-500",
                  usageData.percentUsed > 70 && usageData.percentUsed <= 90 && "bg-amber-500"
                )}
                style={{
                  width: `${Math.min(usageData.percentUsed, 100)}%`,
                  backgroundColor: usageData.percentUsed <= 70 ? colorStyles.iconColor : undefined,
                }}
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
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: colorStyles.iconColor }} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={colorStyles.lightBgStyle}
              >
                <MessageSquare className="h-8 w-8" style={{ color: colorStyles.iconColor }} />
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
                        ? "rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    )}
                    style={msg.role === "user" ? colorStyles.solidStyle : undefined}
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
              {/* Show pending message while waiting for response */}
              {pendingMessage && (
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm rounded-br-md"
                    style={colorStyles.solidStyle}
                  >
                    {pendingMessage}
                  </div>
                </div>
              )}
              {sendMessageMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: colorStyles.iconColor }} />
                      <span className="text-sm text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              {(sendMessageMutation.isError || errorMessage) && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 max-w-[90%]">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{errorMessage || "Failed to send message. Please try again."}</span>
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
              className="h-10 w-10 p-0 hover:opacity-90 disabled:opacity-50"
              style={colorStyles.solidStyle}
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
