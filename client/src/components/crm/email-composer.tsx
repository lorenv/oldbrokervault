import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Send,
  AlertCircle,
  Loader2,
  Paperclip,
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  LinkIcon,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Trash2,
  Save,
} from "lucide-react";

interface EmailMessage {
  id: string;
  threadId?: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  provider: "gmail" | "microsoft";
}

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  category?: string;
}

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: number;
  contactEmail?: string;
  dealId?: number;
  replyTo?: EmailMessage | null;
  onSuccess?: () => void;
}

export function EmailComposer({
  open,
  onOpenChange,
  contactId,
  contactEmail,
  dealId,
  replyTo,
  onSuccess,
}: EmailComposerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  // Template management
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Rich text editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline",
        },
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-3 py-2 text-gray-900",
      },
    },
  });

  // Fetch connection info
  const { data: connectionInfo, isLoading: isLoadingConnection } = useQuery({
    queryKey: ["/api/crm/emails/connection/info"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/emails/connection/info");
      return res.json();
    },
    enabled: open,
  });

  // Fetch email templates
  const { data: templates } = useQuery({
    queryKey: ["/api/crm/email-templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/email-templates");
      return res.json();
    },
    enabled: open,
  });

  const isConnected = connectionInfo?.connected;
  const fromEmail = connectionInfo?.email || connectionInfo?.accountName;

  // Reset form when dialog opens or replyTo changes
  useEffect(() => {
    if (open && editor) {
      if (replyTo) {
        // Reply mode
        setTo(replyTo.from);
        setSubject(
          replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`
        );
        // Build quoted reply
        const quotedDate = new Date(replyTo.date).toLocaleString();
        const quotedFrom = replyTo.fromName || replyTo.from;
        const quotedBody = replyTo.body || replyTo.snippet;
        editor.commands.setContent(
          `<p></p><br/><hr/><p>On ${quotedDate}, ${quotedFrom} wrote:</p><blockquote>${quotedBody}</blockquote>`
        );
      } else {
        // New email mode
        setTo(contactEmail || "");
        setSubject("");
        editor.commands.setContent("");
      }
      setCc("");
      setBcc("");
      setShowCcBcc(false);
      setAttachments([]);
    }
  }, [open, replyTo, contactEmail, editor]);

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      const body = editor?.getHTML() || "";

      if (replyTo) {
        // Reply to existing email
        return apiRequest("POST", "/api/crm/emails/reply", {
          body: {
            emailId: replyTo.id,
            provider: replyTo.provider,
            body,
            isHtml: true,
            contactId,
            dealId,
          },
        }).then((res) => res.json());
      } else {
        // New email
        return apiRequest("POST", "/api/crm/emails/send", {
          body: {
            to,
            subject,
            body,
            isHtml: true,
            cc: cc || undefined,
            bcc: bcc || undefined,
            contactId,
            dealId,
          },
        }).then((res) => res.json());
      }
    },
    onSuccess: (data) => {
      if (data.error) {
        toast({
          title: "Failed to send email",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Email sent",
        description: replyTo ? "Your reply has been sent." : "Your email has been sent.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const templateData = {
        name: templateName,
        subject: subject,
        body: editor?.getHTML() || "",
        category: templateCategory || undefined,
      };

      if (editingTemplate) {
        return apiRequest("PATCH", `/api/crm/email-templates/${editingTemplate.id}`, {
          body: templateData,
        }).then((res) => res.json());
      } else {
        return apiRequest("POST", "/api/crm/email-templates", {
          body: templateData,
        }).then((res) => res.json());
      }
    },
    onSuccess: () => {
      toast({
        title: editingTemplate ? "Template updated" : "Template saved",
        description: `"${templateName}" has been saved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email-templates"] });
      setShowTemplateDialog(false);
      setTemplateName("");
      setTemplateCategory("");
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      return apiRequest("DELETE", `/api/crm/email-templates/${templateId}`).then((res) =>
        res.json()
      );
    },
    onSuccess: () => {
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email-templates"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!to.trim()) {
      toast({
        title: "Missing recipient",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim() && !replyTo) {
      toast({
        title: "Missing subject",
        description: "Please enter a subject line.",
        variant: "destructive",
      });
      return;
    }

    const body = editor?.getHTML() || "";
    if (!body.trim() || body === "<p></p>") {
      toast({
        title: "Missing message",
        description: "Please enter a message.",
        variant: "destructive",
      });
      return;
    }

    sendMutation.mutate();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 25 * 1024 * 1024; // 25MB

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 25MB limit.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setAttachments((prev) => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const applyTemplate = (template: EmailTemplate) => {
    setSubject(template.subject);
    editor?.commands.setContent(template.body);
    // Track template usage
    apiRequest("POST", `/api/crm/email-templates/${template.id}/use`).catch(() => {});
  };

  const openSaveTemplateDialog = () => {
    setTemplateName("");
    setTemplateCategory("");
    setEditingTemplate(null);
    setShowTemplateDialog(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  };

  const templateList = (templates as EmailTemplate[]) || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{replyTo ? "Reply to Email" : "Compose Email"}</DialogTitle>
            <DialogDescription className="sr-only">
              Compose and send an email message
            </DialogDescription>
          </DialogHeader>

          {isLoadingConnection ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !isConnected ? (
            <div className="text-center py-8">
              <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900 mb-2">Email not connected</h3>
              <p className="text-sm text-gray-500 mb-4">
                Connect your Gmail or Outlook account to send emails.
              </p>
              <Button variant="outline" asChild>
                <a href="/settings/email">Connect Email</a>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="space-y-3 flex-1 overflow-y-auto px-1 -mx-1 pb-1">
                {/* From field (readonly) */}
                <div className="flex items-center gap-3">
                  <Label htmlFor="from" className="w-16 text-right text-gray-500">
                    From
                  </Label>
                  <Input
                    id="from"
                    value={fromEmail || (isLoadingConnection ? "Loading..." : "Not available")}
                    disabled
                    className="flex-1 bg-gray-50 text-gray-700"
                  />
                </div>

                {/* To field */}
                <div className="flex items-center gap-3">
                  <Label htmlFor="to" className="w-16 text-right text-gray-500">
                    To
                  </Label>
                  <Input
                    id="to"
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="recipient@example.com"
                    disabled={!!replyTo}
                    className={`flex-1 ${replyTo ? "bg-gray-50" : ""}`}
                  />
                  {!showCcBcc && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCcBcc(true)}
                      className="text-gray-500"
                    >
                      Cc/Bcc
                    </Button>
                  )}
                </div>

                {/* CC/BCC fields */}
                <Collapsible open={showCcBcc} onOpenChange={setShowCcBcc}>
                  <CollapsibleContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Label htmlFor="cc" className="w-16 text-right text-gray-500">
                        Cc
                      </Label>
                      <Input
                        id="cc"
                        type="text"
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        placeholder="cc@example.com"
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="bcc" className="w-16 text-right text-gray-500">
                        Bcc
                      </Label>
                      <Input
                        id="bcc"
                        type="text"
                        value={bcc}
                        onChange={(e) => setBcc(e.target.value)}
                        placeholder="bcc@example.com"
                        className="flex-1"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Subject field */}
                <div className="flex items-center gap-3">
                  <Label htmlFor="subject" className="w-16 text-right text-gray-500">
                    Subject
                  </Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                    disabled={!!replyTo}
                    className={`flex-1 ${replyTo ? "bg-gray-50" : ""}`}
                  />
                </div>

                {/* Rich text editor toolbar */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap">
                    <Button
                      type="button"
                      variant={editor?.isActive("bold") ? "default" : "ghost"}
                      size="sm"
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className="h-8 w-8 p-0"
                      title="Bold"
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={editor?.isActive("italic") ? "default" : "ghost"}
                      size="sm"
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      className="h-8 w-8 p-0"
                      title="Italic"
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-6 bg-gray-300 mx-1" />
                    <Button
                      type="button"
                      variant={editor?.isActive("bulletList") ? "default" : "ghost"}
                      size="sm"
                      onClick={() => editor?.chain().focus().toggleBulletList().run()}
                      className="h-8 w-8 p-0"
                      title="Bullet List"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={editor?.isActive("orderedList") ? "default" : "ghost"}
                      size="sm"
                      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                      className="h-8 w-8 p-0"
                      title="Numbered List"
                    >
                      <ListOrdered className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-6 bg-gray-300 mx-1" />
                    <Button
                      type="button"
                      variant={editor?.isActive("link") ? "default" : "ghost"}
                      size="sm"
                      onClick={addLink}
                      className="h-8 w-8 p-0"
                      title="Add Link"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>

                    <div className="flex-1" />

                    {/* Templates dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="gap-1">
                          <FileText className="h-4 w-4" />
                          Templates
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        {templateList.length > 0 ? (
                          <>
                            {templateList.map((template) => (
                              <DropdownMenuItem
                                key={template.id}
                                onClick={() => applyTemplate(template)}
                                className="flex items-center justify-between"
                              >
                                <span className="truncate">{template.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 ml-2 text-gray-400 hover:text-red-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTemplateMutation.mutate(template.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                          </>
                        ) : (
                          <div className="px-2 py-3 text-sm text-gray-500 text-center">
                            No templates yet
                          </div>
                        )}
                        <DropdownMenuItem onClick={openSaveTemplateDialog}>
                          <Plus className="h-4 w-4 mr-2" />
                          Save as Template
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Editor content */}
                  <EditorContent editor={editor} className="min-h-[200px] max-h-[300px] overflow-y-auto" />
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="max-w-[150px] truncate">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({formatFileSize(file.size)})
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 ml-1 hover:bg-gray-300 rounded-full"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t mt-4 flex-row justify-between sm:justify-between">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.zip"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={sendMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sendMutation.isPending}>
                    {sendMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        {replyTo ? "Send Reply" : "Send"}
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Save as Template"}
            </DialogTitle>
            <DialogDescription>
              Save this email as a reusable template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Follow-up Email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateCategory">Category (optional)</Label>
              <Input
                id="templateCategory"
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                placeholder="e.g., Sales, Follow-up"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveTemplateMutation.mutate()}
              disabled={!templateName.trim() || saveTemplateMutation.isPending}
            >
              {saveTemplateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
