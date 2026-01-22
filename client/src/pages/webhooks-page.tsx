import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Webhook,
  Plus,
  Settings,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  Send,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Zap,
  ExternalLink,
  Filter,
  Download,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WebhookData {
  id: number;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
  secretOnce?: string;
}

interface WebhookDelivery {
  id: number;
  webhookId: number;
  eventType: string;
  eventId: string;
  payload: Record<string, any>;
  status: string;
  statusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  createdAt: string;
  deliveredAt: string | null;
  durationMs: number | null;
}

interface EventCategories {
  [key: string]: {
    label: string;
    events: string[];
  };
}

const eventLabels: Record<string, string> = {
  'cim.created': 'CIM Created',
  'cim.updated': 'CIM Updated',
  'cim.published': 'CIM Published',
  'cim.viewed': 'CIM Viewed',
  'cim.downloaded': 'CIM Downloaded',
  'nda.sent': 'NDA Sent',
  'nda.signed': 'NDA Signed',
  'nda.declined': 'NDA Declined',
  'contact.created': 'Contact Created',
  'contact.updated': 'Contact Updated',
  'contact.deleted': 'Contact Deleted',
  'message.received': 'Message Received',
  'message.sent': 'Message Sent',
};

// ========== Incoming Webhook Types & Config ==========

interface IncomingWebhookData {
  id: number;
  name: string;
  token: string;
  actionType: string;
  fieldMappings: FieldMapping[];
  actionConfig: Record<string, any>;
  secret: string | null;
  isActive: boolean;
  totalReceived: number;
  successCount: number;
  errorCount: number;
  lastReceivedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  createdAt: string;
}

interface IncomingWebhookLog {
  id: number;
  webhookId: number;
  requestId: string;
  sourceIp: string | null;
  rawPayload: Record<string, any>;
  status: string;
  mappedData: Record<string, any> | null;
  createdEntityType: string | null;
  createdEntityId: number | null;
  errorMessage: string | null;
  processingTimeMs: number | null;
  receivedAt: string;
  processedAt: string | null;
}

interface FieldMapping {
  destField: string;
  type: 'field' | 'constant' | 'template';
  sourceField?: string;
  value?: string;
  template?: string;
}

interface DestinationField {
  name: string;
  label: string;
  required: boolean;
}

const INCOMING_WEBHOOK_ACTIONS = [
  { value: 'create_contact', label: 'Create Contact' },
  { value: 'create_deal', label: 'Create Deal' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'add_note', label: 'Add Note' },
  { value: 'create_company', label: 'Create Company' },
] as const;

const DESTINATION_FIELDS: Record<string, DestinationField[]> = {
  create_contact: [
    { name: 'email', label: 'Email', required: true },
    { name: 'firstName', label: 'First Name', required: false },
    { name: 'lastName', label: 'Last Name', required: false },
    { name: 'name', label: 'Full Name (if no first/last)', required: false },
    { name: 'phone', label: 'Phone', required: false },
    { name: 'title', label: 'Job Title', required: false },
    { name: 'notes', label: 'Notes', required: false },
  ],
  create_deal: [
    { name: 'name', label: 'Deal Name', required: true },
    { name: 'amount', label: 'Amount', required: false },
    { name: 'closeDate', label: 'Close Date', required: false },
    { name: 'description', label: 'Description', required: false },
  ],
  create_task: [
    { name: 'title', label: 'Task Title', required: true },
    { name: 'description', label: 'Description', required: false },
    { name: 'dueDate', label: 'Due Date', required: false },
    { name: 'priority', label: 'Priority (low/medium/high)', required: false },
  ],
  add_note: [
    { name: 'content', label: 'Note Content', required: true },
    { name: 'objectType', label: 'Attach To Type (contact/deal/company)', required: true },
    { name: 'objectId', label: 'Record ID', required: true },
  ],
  create_company: [
    { name: 'name', label: 'Company Name', required: true },
    { name: 'domain', label: 'Domain', required: false },
    { name: 'website', label: 'Website', required: false },
    { name: 'industry', label: 'Industry', required: false },
    { name: 'description', label: 'Description', required: false },
  ],
};

const getActionLabel = (actionType: string): string => {
  return INCOMING_WEBHOOK_ACTIONS.find(a => a.value === actionType)?.label || actionType;
};

export default function WebhooksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Direction tab state
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing');

  // Outgoing webhook state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Pagination and filtering state for deliveries
  const [deliveryPage, setDeliveryPage] = useState(0);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('all');
  const [deliveryEventFilter, setDeliveryEventFilter] = useState<string>('all');
  const DELIVERIES_PER_PAGE = 20;

  // Form state for creating/editing outgoing webhooks
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

  // ========== Incoming Webhook State ==========
  const [isIncomingCreateOpen, setIsIncomingCreateOpen] = useState(false);
  const [selectedIncomingWebhook, setSelectedIncomingWebhook] = useState<IncomingWebhookData | null>(null);
  const [incomingCreateStep, setIncomingCreateStep] = useState(1);
  const [incomingFormData, setIncomingFormData] = useState({
    name: '',
    actionType: '' as string,
    fieldMappings: [] as FieldMapping[],
  });
  const [createdIncomingWebhook, setCreatedIncomingWebhook] = useState<IncomingWebhookData | null>(null);

  // Incoming webhook log pagination
  const [incomingLogPage, setIncomingLogPage] = useState(0);
  const [incomingLogStatusFilter, setIncomingLogStatusFilter] = useState<string>('all');
  const LOGS_PER_PAGE = 20;

  // Fetch webhooks
  const { data: webhooks = [], isLoading } = useQuery<WebhookData[]>({
    queryKey: ['/api/webhooks'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/webhooks');
      return res.json();
    },
  });

  // Fetch event types
  const { data: eventCategories } = useQuery<EventCategories>({
    queryKey: ['/api/webhooks/event-types'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/webhooks/event-types');
      return res.json();
    },
  });

  // Fetch webhook details
  const { data: webhookDetails } = useQuery({
    queryKey: ['/api/webhooks', selectedWebhook?.id],
    queryFn: async () => {
      if (!selectedWebhook) return null;
      const res = await apiRequest('GET', `/api/webhooks/${selectedWebhook.id}`);
      return res.json();
    },
    enabled: !!selectedWebhook,
  });

  // Fetch paginated deliveries with filtering
  const { data: deliveriesData, isLoading: isLoadingDeliveries } = useQuery({
    queryKey: ['/api/webhooks', selectedWebhook?.id, 'deliveries', deliveryPage, deliveryStatusFilter, deliveryEventFilter],
    queryFn: async () => {
      if (!selectedWebhook) return null;
      const params = new URLSearchParams({
        limit: String(DELIVERIES_PER_PAGE),
        offset: String(deliveryPage * DELIVERIES_PER_PAGE),
      });
      if (deliveryStatusFilter !== 'all') {
        params.append('status', deliveryStatusFilter);
      }
      if (deliveryEventFilter !== 'all') {
        params.append('eventType', deliveryEventFilter);
      }
      const res = await apiRequest('GET', `/api/webhooks/${selectedWebhook.id}/deliveries?${params}`);
      return res.json();
    },
    enabled: !!selectedWebhook,
  });

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/webhooks', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      setIsCreateOpen(false);
      setNewSecret(data.secretOnce);
      setFormData({ name: '', url: '', events: [] });
      toast({
        title: "Webhook created",
        description: "Your webhook has been created successfully. Save the signing secret - it won't be shown again!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create webhook",
        variant: "destructive",
      });
    },
  });

  // Update webhook mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<WebhookData> }) => {
      const res = await apiRequest('PATCH', `/api/webhooks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      toast({
        title: "Webhook updated",
        description: "Your webhook has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update webhook",
        variant: "destructive",
      });
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      setSelectedWebhook(null);
      toast({
        title: "Webhook deleted",
        description: "Your webhook has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete webhook",
        variant: "destructive",
      });
    },
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: async ({ id, eventType }: { id: number; eventType: string }) => {
      const res = await apiRequest('POST', `/api/webhooks/${id}/test`, { eventType });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      if (data.success) {
        toast({
          title: "Test successful",
          description: `Webhook responded with status ${data.statusCode}`,
        });
      } else {
        toast({
          title: "Test failed",
          description: data.error || "Webhook test failed",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to test webhook",
        variant: "destructive",
      });
    },
  });

  // Regenerate secret mutation
  const regenerateSecretMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/webhooks/${id}/regenerate-secret`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      setNewSecret(data.secretOnce);
      toast({
        title: "Secret regenerated",
        description: "Save the new signing secret - it won't be shown again!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate secret",
        variant: "destructive",
      });
    },
  });

  // Retry delivery mutation
  const retryMutation = useMutation({
    mutationFn: async (deliveryId: number) => {
      const res = await apiRequest('POST', `/api/webhooks/deliveries/${deliveryId}/retry`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      if (data.success) {
        toast({
          title: "Retry successful",
          description: "The webhook was delivered successfully.",
        });
      } else {
        toast({
          title: "Retry failed",
          description: data.error || "Delivery retry failed",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to retry delivery",
        variant: "destructive",
      });
    },
  });

  // ========== Incoming Webhook Queries & Mutations ==========

  // Fetch incoming webhooks
  const { data: incomingWebhooks = [], isLoading: isLoadingIncoming } = useQuery<IncomingWebhookData[]>({
    queryKey: ['/api/incoming-webhooks'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/incoming-webhooks');
      return res.json();
    },
    enabled: direction === 'incoming',
  });

  // Fetch incoming webhook details with logs
  const { data: incomingWebhookDetails } = useQuery({
    queryKey: ['/api/incoming-webhooks', selectedIncomingWebhook?.id],
    queryFn: async () => {
      if (!selectedIncomingWebhook) return null;
      const res = await apiRequest('GET', `/api/incoming-webhooks/${selectedIncomingWebhook.id}`);
      return res.json();
    },
    enabled: !!selectedIncomingWebhook,
  });

  // Fetch paginated logs for incoming webhook
  const { data: incomingLogsData, isLoading: isLoadingIncomingLogs } = useQuery({
    queryKey: ['/api/incoming-webhooks', selectedIncomingWebhook?.id, 'logs', incomingLogPage, incomingLogStatusFilter],
    queryFn: async () => {
      if (!selectedIncomingWebhook) return null;
      const params = new URLSearchParams({
        limit: String(LOGS_PER_PAGE),
        offset: String(incomingLogPage * LOGS_PER_PAGE),
      });
      if (incomingLogStatusFilter !== 'all') {
        params.append('status', incomingLogStatusFilter);
      }
      const res = await apiRequest('GET', `/api/incoming-webhooks/${selectedIncomingWebhook.id}/logs?${params}`);
      return res.json();
    },
    enabled: !!selectedIncomingWebhook,
  });

  // Create incoming webhook mutation
  const createIncomingMutation = useMutation({
    mutationFn: async (data: typeof incomingFormData) => {
      const res = await apiRequest('POST', '/api/incoming-webhooks', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/incoming-webhooks'] });
      setCreatedIncomingWebhook(data);
      setIncomingCreateStep(3); // Move to success step
      toast({
        title: "Incoming webhook created",
        description: "Your webhook URL has been generated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create incoming webhook",
        variant: "destructive",
      });
    },
  });

  // Update incoming webhook mutation
  const updateIncomingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<IncomingWebhookData> }) => {
      const res = await apiRequest('PATCH', `/api/incoming-webhooks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/incoming-webhooks'] });
      toast({
        title: "Webhook updated",
        description: "Your incoming webhook has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update incoming webhook",
        variant: "destructive",
      });
    },
  });

  // Delete incoming webhook mutation
  const deleteIncomingMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/incoming-webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/incoming-webhooks'] });
      setSelectedIncomingWebhook(null);
      toast({
        title: "Webhook deleted",
        description: "Your incoming webhook has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete incoming webhook",
        variant: "destructive",
      });
    },
  });

  // Regenerate incoming webhook token mutation
  const regenerateIncomingTokenMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/incoming-webhooks/${id}/regenerate-token`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/incoming-webhooks'] });
      setSelectedIncomingWebhook(data);
      toast({
        title: "Token regenerated",
        description: "A new webhook URL has been generated. Update your external service with the new URL.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate token",
        variant: "destructive",
      });
    },
  });

  // Get webhook URL
  const getWebhookUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/webhooks/incoming/${token}`;
  };

  // Reset incoming webhook form
  const resetIncomingForm = () => {
    setIncomingFormData({ name: '', actionType: '', fieldMappings: [] });
    setIncomingCreateStep(1);
    setCreatedIncomingWebhook(null);
  };

  // Initialize field mappings when action type changes
  const initializeFieldMappings = (actionType: string) => {
    const fields = DESTINATION_FIELDS[actionType] || [];
    const mappings: FieldMapping[] = fields.map(field => ({
      destField: field.name,
      type: 'field' as const,
      sourceField: '',
    }));
    setIncomingFormData(prev => ({
      ...prev,
      actionType,
      fieldMappings: mappings,
    }));
  };

  // Update field mapping
  const updateFieldMapping = (index: number, updates: Partial<FieldMapping>) => {
    setIncomingFormData(prev => {
      const newMappings = [...prev.fieldMappings];
      newMappings[index] = { ...newMappings[index], ...updates };
      return { ...prev, fieldMappings: newMappings };
    });
  };

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }));
  };

  const getStatusBadge = (webhook: WebhookData) => {
    if (!webhook.isActive) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    if (webhook.consecutiveFailures >= 5) {
      return <Badge variant="destructive">Failing</Badge>;
    }
    if (webhook.consecutiveFailures > 0) {
      return <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>;
    }
    if (webhook.lastSuccessAt) {
      return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const getDeliveryStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'retrying':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  if (!user) {
    return null;
  }

  // Webhook detail view
  if (selectedWebhook) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => setSelectedWebhook(null)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Webhooks
        </Button>

        <div className="space-y-6">
          {/* Webhook Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selectedWebhook.name}
                    {getStatusBadge(selectedWebhook)}
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs break-all">
                    {selectedWebhook.url}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Switch
                    checked={selectedWebhook.isActive}
                    onCheckedChange={(checked) => {
                      updateMutation.mutate({
                        id: selectedWebhook.id,
                        data: { isActive: checked }
                      });
                      setSelectedWebhook({ ...selectedWebhook, isActive: checked });
                    }}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this webhook? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(selectedWebhook.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Signing Secret */}
              <div>
                <Label className="text-sm text-gray-500">Signing Secret</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono">
                    {showSecret ? selectedWebhook.secret : '••••••••••••••••••••'}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateSecretMutation.mutate(selectedWebhook.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Subscribed Events */}
              <div>
                <Label className="text-sm text-gray-500">Subscribed Events</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedWebhook.events.map(event => (
                    <Badge key={event} variant="outline">
                      {eventLabels[event] || event}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Test Webhook */}
              <div className="flex items-center gap-4 pt-4 border-t">
                <Select
                  onValueChange={(eventType) => {
                    testMutation.mutate({ id: selectedWebhook.id, eventType });
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Send test event" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedWebhook.events.map(event => (
                      <SelectItem key={event} value={event}>
                        {eventLabels[event] || event}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-500">
                  Select an event type to send a test payload
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Logs with Pagination & Filtering */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Delivery Logs</CardTitle>
                  <CardDescription>
                    History of webhook delivery attempts
                    {deliveriesData?.pagination && (
                      <span className="ml-2">({deliveriesData.pagination.total} total)</span>
                    )}
                  </CardDescription>
                </div>
              </div>
              {/* Filters */}
              <div className="flex gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select
                    value={deliveryStatusFilter}
                    onValueChange={(value) => {
                      setDeliveryStatusFilter(value);
                      setDeliveryPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[130px] h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="retrying">Retrying</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select
                  value={deliveryEventFilter}
                  onValueChange={(value) => {
                    setDeliveryEventFilter(value);
                    setDeliveryPage(0);
                  }}
                >
                  <SelectTrigger className="w-[160px] h-8">
                    <SelectValue placeholder="Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {selectedWebhook?.events.map(event => (
                      <SelectItem key={event} value={event}>
                        {eventLabels[event] || event}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(deliveryStatusFilter !== 'all' || deliveryEventFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setDeliveryStatusFilter('all');
                      setDeliveryEventFilter('all');
                      setDeliveryPage(0);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingDeliveries ? (
                <div className="text-center py-8 text-gray-500">Loading deliveries...</div>
              ) : deliveriesData?.deliveries?.length > 0 ? (
                <div className="space-y-3">
                  {deliveriesData.deliveries.map((delivery: WebhookDelivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getDeliveryStatusIcon(delivery.status)}
                        <div>
                          <div className="font-medium text-sm">
                            {eventLabels[delivery.eventType] || delivery.eventType}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true })}
                            {delivery.statusCode && ` • ${delivery.statusCode}`}
                            {delivery.durationMs && ` • ${delivery.durationMs}ms`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {delivery.status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryMutation.mutate(delivery.id)}
                            disabled={retryMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                        {delivery.errorMessage && (
                          <span className="text-xs text-red-600 max-w-[200px] truncate">
                            {delivery.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pagination Controls */}
                  {deliveriesData.pagination && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <div className="text-sm text-gray-500">
                        Showing {deliveriesData.pagination.offset + 1}-
                        {Math.min(deliveriesData.pagination.offset + deliveriesData.deliveries.length, deliveriesData.pagination.total)} of {deliveriesData.pagination.total}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeliveryPage(p => Math.max(0, p - 1))}
                          disabled={deliveryPage === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeliveryPage(p => p + 1)}
                          disabled={!deliveriesData.pagination.hasMore}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {deliveryStatusFilter !== 'all' || deliveryEventFilter !== 'all'
                    ? 'No deliveries match your filters.'
                    : 'No deliveries yet. Events will appear here when triggered.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Incoming webhook detail view
  if (selectedIncomingWebhook) {
    const webhookUrl = getWebhookUrl(selectedIncomingWebhook.token);
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => {
            setSelectedIncomingWebhook(null);
            setIncomingLogPage(0);
            setIncomingLogStatusFilter('all');
          }}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Webhooks
        </Button>

        <div className="space-y-6">
          {/* Incoming Webhook Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selectedIncomingWebhook.name}
                    <Badge className="bg-blue-100 text-blue-800">
                      {getActionLabel(selectedIncomingWebhook.actionType)}
                    </Badge>
                    {!selectedIncomingWebhook.isActive && (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1 text-gray-600">
                    Received: {selectedIncomingWebhook.totalReceived} |
                    Success: {selectedIncomingWebhook.successCount} |
                    Errors: {selectedIncomingWebhook.errorCount}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Switch
                    checked={selectedIncomingWebhook.isActive}
                    onCheckedChange={(checked) => {
                      updateIncomingMutation.mutate({
                        id: selectedIncomingWebhook.id,
                        data: { isActive: checked }
                      });
                      setSelectedIncomingWebhook({ ...selectedIncomingWebhook, isActive: checked });
                    }}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Incoming Webhook</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure? This will also delete all delivery logs. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteIncomingMutation.mutate(selectedIncomingWebhook.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Webhook URL */}
              <div>
                <Label className="text-sm text-gray-600">Webhook URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono break-all text-gray-800">
                    {webhookUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateIncomingTokenMutation.mutate(selectedIncomingWebhook.id)}
                    title="Regenerate URL"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Field Mappings */}
              <div>
                <Label className="text-sm text-gray-600">Field Mappings</Label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-700 font-medium">Destination Field</th>
                        <th className="px-3 py-2 text-left text-gray-700 font-medium">Mapping Type</th>
                        <th className="px-3 py-2 text-left text-gray-700 font-medium">Source/Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(selectedIncomingWebhook.fieldMappings || []).map((mapping: FieldMapping, idx: number) => (
                        <tr key={idx} className="text-gray-800">
                          <td className="px-3 py-2 font-medium">{mapping.destField}</td>
                          <td className="px-3 py-2">{mapping.type}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {mapping.type === 'field' && mapping.sourceField}
                            {mapping.type === 'constant' && mapping.value}
                            {mapping.type === 'template' && mapping.template}
                          </td>
                        </tr>
                      ))}
                      {(!selectedIncomingWebhook.fieldMappings || selectedIncomingWebhook.fieldMappings.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                            No field mappings configured
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Test cURL command */}
              <div className="pt-4 border-t">
                <Label className="text-sm text-gray-600">Test with cURL</Label>
                <div className="mt-2 bg-gray-900 rounded-lg p-3 overflow-x-auto">
                  <code className="text-green-400 text-xs whitespace-pre">
{`curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -d '{"email": "test@example.com", "name": "Test User"}'`}
                  </code>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => copyToClipboard(
                    `curl -X POST '${webhookUrl}' -H 'Content-Type: application/json' -d '{"email": "test@example.com", "name": "Test User"}'`,
                    'cURL command'
                  )}
                >
                  <Copy className="h-3 w-3 mr-2" />
                  Copy cURL
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Logs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Delivery Logs</CardTitle>
                  <CardDescription>
                    History of received payloads and processing results
                    {incomingLogsData?.pagination && (
                      <span className="ml-2">({incomingLogsData.pagination.total} total)</span>
                    )}
                  </CardDescription>
                </div>
              </div>
              {/* Filters */}
              <div className="flex gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select
                    value={incomingLogStatusFilter}
                    onValueChange={(value) => {
                      setIncomingLogStatusFilter(value);
                      setIncomingLogPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[130px] h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {incomingLogStatusFilter !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setIncomingLogStatusFilter('all');
                      setIncomingLogPage(0);
                    }}
                  >
                    Clear filter
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingIncomingLogs ? (
                <div className="text-center py-8 text-gray-500">Loading logs...</div>
              ) : incomingLogsData?.logs?.length > 0 ? (
                <div className="space-y-3">
                  {incomingLogsData.logs.map((log: IncomingWebhookLog) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getDeliveryStatusIcon(log.status)}
                        <div>
                          <div className="font-medium text-sm text-gray-800">
                            {log.status === 'success' && log.createdEntityType
                              ? `Created ${log.createdEntityType} #${log.createdEntityId}`
                              : log.status === 'failed'
                              ? 'Processing failed'
                              : 'Processing...'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(log.receivedAt), { addSuffix: true })}
                            {log.processingTimeMs && ` • ${log.processingTimeMs}ms`}
                            {log.sourceIp && ` • ${log.sourceIp}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.errorMessage && (
                          <span className="text-xs text-red-600 max-w-[200px] truncate">
                            {log.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pagination Controls */}
                  {incomingLogsData.pagination && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <div className="text-sm text-gray-500">
                        Showing {incomingLogsData.pagination.offset + 1}-
                        {Math.min(incomingLogsData.pagination.offset + incomingLogsData.logs.length, incomingLogsData.pagination.total)} of {incomingLogsData.pagination.total}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIncomingLogPage(p => Math.max(0, p - 1))}
                          disabled={incomingLogPage === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIncomingLogPage(p => p + 1)}
                          disabled={!incomingLogsData.pagination.hasMore}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {incomingLogStatusFilter !== 'all'
                    ? 'No logs match your filter.'
                    : 'No deliveries yet. Logs will appear here when payloads are received.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main webhooks list view
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Webhook className="h-8 w-8 text-blue-600" />
            Webhooks
          </h1>
          <p className="text-gray-600 mt-1">
            Connect external services with outgoing events or receive data with incoming webhooks
          </p>
        </div>
      </div>

      {/* Direction Tabs */}
      <Tabs value={direction} onValueChange={(v) => setDirection(v as 'outgoing' | 'incoming')} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="outgoing" className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            Outgoing
          </TabsTrigger>
          <TabsTrigger value="incoming" className="flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            Incoming
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Outgoing Webhooks Tab Content */}
      {direction === 'outgoing' && (
        <>
          <div className="flex justify-end mb-4">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Configure a new webhook endpoint to receive events.{' '}
                <a
                  href="https://cimshare.documentationai.com/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  View documentation
                </a>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Name</Label>
                <Input
                  placeholder="e.g., HubSpot Sync"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Endpoint URL</Label>
                <Input
                  placeholder="https://hooks.example.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Must use HTTPS</p>
              </div>
              <div>
                <Label>Events to send</Label>
                <div className="mt-2 max-h-[400px] overflow-y-auto border rounded-lg p-3">
                  {eventCategories && (() => {
                    const entries = Object.entries(eventCategories);
                    const leftColumns = entries.slice(0, 3);
                    const rightColumns = entries.slice(3);

                    const renderCategory = ([key, category]: [string, { label: string; events: string[] }]) => (
                      <div key={key} className="mb-4">
                        <div className="font-medium text-sm text-gray-700 mb-2">
                          {category.label}
                        </div>
                        <div className="space-y-2 pl-2">
                          {category.events.map((event: string) => (
                            <label
                              key={event}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={formData.events.includes(event)}
                                onCheckedChange={() => toggleEvent(event)}
                              />
                              <span className="text-sm">
                                {eventLabels[event] || event}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          {leftColumns.map(renderCategory)}
                        </div>
                        <div>
                          {rightColumns.map(renderCategory)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || !formData.url || formData.events.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* New Secret Dialog */}
      <Dialog open={!!newSecret} onOpenChange={() => setNewSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Save Your Signing Secret
            </DialogTitle>
            <DialogDescription>
              This secret is used to verify webhook payloads. Copy it now - it won't be shown again!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono break-all">
                {newSecret}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(newSecret!, 'Signing secret')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewSecret(null)}>
              I've saved the secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhooks List */}
      {isLoading ? (
        <div className="text-center py-12">Loading webhooks...</div>
      ) : webhooks.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Webhook className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No webhooks configured</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Webhooks let you send real-time data to other apps like Zapier, HubSpot, or your own systems.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card
              key={webhook.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedWebhook(webhook);
                setDeliveryPage(0);
                setDeliveryStatusFilter('all');
                setDeliveryEventFilter('all');
              }}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      !webhook.isActive ? 'bg-gray-400' :
                      webhook.consecutiveFailures >= 5 ? 'bg-red-500' :
                      webhook.consecutiveFailures > 0 ? 'bg-yellow-500' :
                      webhook.lastSuccessAt ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {webhook.name}
                        {!webhook.isActive && (
                          <Badge variant="secondary" className="text-xs">Disabled</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 font-mono truncate max-w-md">
                        {webhook.url}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
                        {webhook.lastTriggeredAt && (
                          <> • Last triggered {formatDistanceToNow(new Date(webhook.lastTriggeredAt), { addSuffix: true })}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

          {/* Documentation Link - Outgoing */}
          <Card className="mt-8 bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <Zap className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900">Integration Guide</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Learn how to verify webhook signatures and handle events in your application.
                  </p>
                  <a
                    href="https://cimshare.documentationai.com/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
                  >
                    View Documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Incoming Webhooks Tab Content */}
      {direction === 'incoming' && (
        <>
          <div className="flex justify-end mb-4">
            <Dialog
              open={isIncomingCreateOpen}
              onOpenChange={(open) => {
                setIsIncomingCreateOpen(open);
                if (!open) resetIncomingForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Incoming Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Step 1: Basic Info */}
                {incomingCreateStep === 1 && (
                  <>
                    <DialogHeader>
                      <DialogTitle>Create Incoming Webhook - Step 1</DialogTitle>
                      <DialogDescription>
                        Name your webhook and choose what action to take when data is received.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label className="text-gray-700">Webhook Name</Label>
                        <Input
                          placeholder="e.g., Typeform Leads"
                          value={incomingFormData.name}
                          onChange={(e) => setIncomingFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-700">Action Type</Label>
                        <Select
                          value={incomingFormData.actionType}
                          onValueChange={(value) => initializeFieldMappings(value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select an action..." />
                          </SelectTrigger>
                          <SelectContent>
                            {INCOMING_WEBHOOK_ACTIONS.map(action => (
                              <SelectItem key={action.value} value={action.value}>
                                {action.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 mt-1">
                          Choose what entity to create when data is received
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsIncomingCreateOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => setIncomingCreateStep(2)}
                        disabled={!incomingFormData.name || !incomingFormData.actionType}
                      >
                        Next: Configure Mappings
                      </Button>
                    </DialogFooter>
                  </>
                )}

                {/* Step 2: Field Mapping */}
                {incomingCreateStep === 2 && (
                  <>
                    <DialogHeader>
                      <DialogTitle>Create Incoming Webhook - Step 2</DialogTitle>
                      <DialogDescription>
                        Map incoming payload fields to destination fields. Use dot notation for nested fields (e.g., form_response.email).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-gray-700 font-medium w-1/3">Destination Field</th>
                              <th className="px-3 py-2 text-left text-gray-700 font-medium w-1/4">Mapping Type</th>
                              <th className="px-3 py-2 text-left text-gray-700 font-medium">Source/Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {incomingFormData.fieldMappings.map((mapping, idx) => {
                              const fieldDef = DESTINATION_FIELDS[incomingFormData.actionType]?.find(f => f.name === mapping.destField);
                              return (
                                <tr key={idx}>
                                  <td className="px-3 py-2">
                                    <span className="text-gray-800 font-medium">{fieldDef?.label || mapping.destField}</span>
                                    {fieldDef?.required && <span className="text-red-500 ml-1">*</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Select
                                      value={mapping.type}
                                      onValueChange={(value) => updateFieldMapping(idx, { type: value as any, sourceField: '', value: '', template: '' })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="field">From Payload</SelectItem>
                                        <SelectItem value="constant">Constant</SelectItem>
                                        <SelectItem value="template">Template</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-3 py-2">
                                    {mapping.type === 'field' && (
                                      <Input
                                        className="h-8"
                                        placeholder="e.g., data.email"
                                        value={mapping.sourceField || ''}
                                        onChange={(e) => updateFieldMapping(idx, { sourceField: e.target.value })}
                                      />
                                    )}
                                    {mapping.type === 'constant' && (
                                      <Input
                                        className="h-8"
                                        placeholder="Constant value"
                                        value={mapping.value || ''}
                                        onChange={(e) => updateFieldMapping(idx, { value: e.target.value })}
                                      />
                                    )}
                                    {mapping.type === 'template' && (
                                      <Input
                                        className="h-8"
                                        placeholder="{{first}} {{last}}"
                                        value={mapping.template || ''}
                                        onChange={(e) => updateFieldMapping(idx, { template: e.target.value })}
                                      />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-500">
                        Fields marked with <span className="text-red-500">*</span> are required.
                        Use <code className="bg-gray-100 px-1 rounded">{'{{field}}'}</code> syntax in templates.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIncomingCreateStep(1)}>
                        Back
                      </Button>
                      <Button
                        onClick={() => createIncomingMutation.mutate(incomingFormData)}
                        disabled={createIncomingMutation.isPending}
                      >
                        {createIncomingMutation.isPending ? 'Creating...' : 'Create Webhook'}
                      </Button>
                    </DialogFooter>
                  </>
                )}

                {/* Step 3: Success */}
                {incomingCreateStep === 3 && createdIncomingWebhook && (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Webhook Created Successfully
                      </DialogTitle>
                      <DialogDescription>
                        Copy the webhook URL below and configure it in your external service.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label className="text-gray-700">Webhook URL</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono break-all text-gray-800">
                            {getWebhookUrl(createdIncomingWebhook.token)}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(getWebhookUrl(createdIncomingWebhook.token), 'Webhook URL')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div className="text-sm text-yellow-800">
                            <p className="font-medium">Important</p>
                            <p className="mt-1">
                              This URL is unique to this webhook. Anyone with this URL can send data to your system.
                              Keep it secure and only share it with trusted services.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-700">Test with cURL</Label>
                        <div className="mt-1 bg-gray-900 rounded-lg p-3 overflow-x-auto">
                          <code className="text-green-400 text-xs whitespace-pre">
{`curl -X POST '${getWebhookUrl(createdIncomingWebhook.token)}' \\
  -H 'Content-Type: application/json' \\
  -d '{"email": "test@example.com", "name": "Test User"}'`}
                          </code>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => {
                        setIsIncomingCreateOpen(false);
                        resetIncomingForm();
                      }}>
                        Done
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* Incoming Webhooks List */}
          {isLoadingIncoming ? (
            <div className="text-center py-12 text-gray-500">Loading incoming webhooks...</div>
          ) : incomingWebhooks.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <ArrowDownToLine className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-800 mb-2">No incoming webhooks configured</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Incoming webhooks let external services like Typeform, Calendly, or custom apps send data to your CRM.
                </p>
                <Button onClick={() => setIsIncomingCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Incoming Webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {incomingWebhooks.map((webhook) => (
                <Card
                  key={webhook.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedIncomingWebhook(webhook);
                    setIncomingLogPage(0);
                    setIncomingLogStatusFilter('all');
                  }}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${
                          !webhook.isActive ? 'bg-gray-400' :
                          webhook.errorCount > 0 && webhook.errorCount > webhook.successCount ? 'bg-red-500' :
                          webhook.successCount > 0 ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <div>
                          <div className="font-medium text-gray-800 flex items-center gap-2">
                            {webhook.name}
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                              {getActionLabel(webhook.actionType)}
                            </Badge>
                            {!webhook.isActive && (
                              <Badge variant="secondary" className="text-xs">Disabled</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {webhook.totalReceived} received • {webhook.successCount} success • {webhook.errorCount} errors
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {webhook.lastReceivedAt ? (
                              <>Last received {formatDistanceToNow(new Date(webhook.lastReceivedAt), { addSuffix: true })}</>
                            ) : (
                              'No data received yet'
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Documentation Link - Incoming */}
          <Card className="mt-8 bg-green-50 border-green-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <Download className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900">Incoming Webhooks Guide</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Connect external services like Typeform, Calendly, or Zapier to automatically create contacts, deals, and more.
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    <strong>Supported formats:</strong> JSON payloads with Content-Type: application/json
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
