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

export default function WebhooksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Pagination and filtering state for deliveries
  const [deliveryPage, setDeliveryPage] = useState(0);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('all');
  const [deliveryEventFilter, setDeliveryEventFilter] = useState<string>('all');
  const DELIVERIES_PER_PAGE = 20;

  // Form state for creating/editing webhooks
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

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

  // Main webhooks list view
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Webhook className="h-8 w-8 text-blue-600" />
            Webhooks
          </h1>
          <p className="text-gray-600 mt-1">
            Send real-time events to external services like Zapier, HubSpot, or your own systems
          </p>
        </div>
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

      {/* Documentation Link */}
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
    </div>
  );
}
