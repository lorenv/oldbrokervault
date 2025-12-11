import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
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
  Link2,
  Unplug,
  Play,
  Pause,
  History,
  Workflow,
  Globe,
  MessageSquare,
  Building2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// Types
interface Connection {
  id: number;
  provider: string;
  providerAccountId?: string;
  providerAccountName?: string;
  webhookUrl?: string;
  status: string;
  lastUsedAt?: string;
  createdAt: string;
}

interface Automation {
  id: number;
  name: string;
  connectionId?: number;
  eventType: string;
  destinationType: string;
  fieldMapping: Record<string, any>;
  conditions?: any[];
  isActive: boolean;
  lastTriggeredAt?: string;
  totalRuns: number;
  successfulRuns: number;
  createdAt: string;
}

interface AutomationRun {
  id: number;
  automationId: number;
  eventType: string;
  eventId: string;
  status: string;
  errorMessage?: string;
  attemptCount: number;
  executedAt?: string;
  durationMs?: number;
  createdAt: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  authType: 'oauth' | 'webhook' | 'api_key';
  destinationTypes: string[];
  status: string;
}

interface EventCategory {
  label: string;
  events: string[];
}

// Provider icons
const providerIcons: Record<string, React.ReactNode> = {
  hubspot: <Building2 className="h-5 w-5 text-orange-500" />,
  slack: <MessageSquare className="h-5 w-5 text-purple-500" />,
  zapier: <Zap className="h-5 w-5 text-orange-600" />,
  make: <Workflow className="h-5 w-5 text-violet-600" />,
  webhook: <Globe className="h-5 w-5 text-blue-600" />,
};

const destinationTypeLabels: Record<string, string> = {
  hubspot_contact: 'HubSpot Contact',
  hubspot_deal: 'HubSpot Deal',
  hubspot_company: 'HubSpot Company',
  hubspot_note: 'HubSpot Note',
  slack_message: 'Slack Message',
  zapier_webhook: 'Zapier Webhook',
  make_webhook: 'Make Webhook',
  custom_webhook: 'Custom Webhook',
};

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
  'dataroom.file_uploaded': 'File Uploaded',
  'dataroom.file_viewed': 'File Viewed',
  'dataroom.access_granted': 'Access Granted',
  'esign.envelope_completed': 'E-Signature Completed',
};

export default function IntegrationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState("connections");

  // Connection state
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");

  // Automation state
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [isAutomationDialogOpen, setIsAutomationDialogOpen] = useState(false);
  const [automationForm, setAutomationForm] = useState({
    name: '',
    connectionId: undefined as number | undefined,
    eventType: '',
    destinationType: '',
    webhookUrl: '',
    fieldMapping: {} as Record<string, string>,
    behavior: 'create' as 'create' | 'update' | 'upsert',
  });

  // Run history pagination
  const [runPage, setRunPage] = useState(0);
  const RUNS_PER_PAGE = 20;

  // Fetch providers
  const { data: providers = [] } = useQuery<ProviderInfo[]>({
    queryKey: ['/api/integrations/providers'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/providers');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch connections
  const { data: connections = [], isLoading: isLoadingConnections } = useQuery<Connection[]>({
    queryKey: ['/api/integrations/connections'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/connections');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch automations
  const { data: automations = [], isLoading: isLoadingAutomations } = useQuery<Automation[]>({
    queryKey: ['/api/integrations/automations'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/automations');
      const data = await res.json();
      return Array.isArray(data?.automations) ? data.automations : [];
    },
  });

  // Fetch event types
  const { data: eventCategories } = useQuery<Record<string, EventCategory>>({
    queryKey: ['/api/webhooks/event-types'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/webhooks/event-types');
      return res.json();
    },
  });

  // Fetch automation runs
  const { data: runsData, isLoading: isLoadingRuns } = useQuery({
    queryKey: ['/api/integrations/automations', selectedAutomation?.id, 'runs', runPage],
    queryFn: async () => {
      if (!selectedAutomation) return null;
      const params = new URLSearchParams({
        limit: String(RUNS_PER_PAGE),
        offset: String(runPage * RUNS_PER_PAGE),
      });
      const res = await apiRequest('GET', `/api/integrations/automations/${selectedAutomation.id}/runs?${params}`);
      return res.json();
    },
    enabled: !!selectedAutomation,
  });

  // Create connection mutation (for webhook-based providers)
  const createConnectionMutation = useMutation({
    mutationFn: async (data: { provider: string; webhookUrl?: string }) => {
      const res = await apiRequest('POST', '/api/integrations/connections', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/connections'] });
      setIsConnectDialogOpen(false);
      setSelectedProvider(null);
      setWebhookUrlInput("");
      toast({
        title: "Connection created",
        description: "Your integration connection has been set up.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create connection",
        variant: "destructive",
      });
    },
  });

  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/integrations/connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/connections'] });
      setSelectedConnection(null);
      toast({
        title: "Connection removed",
        description: "The integration has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove connection",
        variant: "destructive",
      });
    },
  });

  // Create automation mutation
  const createAutomationMutation = useMutation({
    mutationFn: async (data: typeof automationForm) => {
      const res = await apiRequest('POST', '/api/integrations/automations', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/automations'] });
      setIsAutomationDialogOpen(false);
      resetAutomationForm();
      toast({
        title: "Automation created",
        description: "Your automation is now active and will trigger on matching events.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create automation",
        variant: "destructive",
      });
    },
  });

  // Update automation mutation
  const updateAutomationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Automation> }) => {
      const res = await apiRequest('PATCH', `/api/integrations/automations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/automations'] });
      toast({
        title: "Automation updated",
        description: "Your automation has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update automation",
        variant: "destructive",
      });
    },
  });

  // Delete automation mutation
  const deleteAutomationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/integrations/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/automations'] });
      setSelectedAutomation(null);
      toast({
        title: "Automation deleted",
        description: "The automation has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete automation",
        variant: "destructive",
      });
    },
  });

  // Test automation mutation
  const testAutomationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/integrations/automations/${id}/test`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/automations'] });
      if (data.success) {
        toast({
          title: "Test successful",
          description: "The automation executed successfully with sample data.",
        });
      } else {
        toast({
          title: "Test failed",
          description: data.error || "Automation test failed",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to test automation",
        variant: "destructive",
      });
    },
  });

  // Retry run mutation
  const retryRunMutation = useMutation({
    mutationFn: async (runId: number) => {
      const res = await apiRequest('POST', `/api/integrations/runs/${runId}/retry`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/automations'] });
      if (data.success) {
        toast({
          title: "Retry successful",
          description: "The automation run completed successfully.",
        });
      } else {
        toast({
          title: "Retry failed",
          description: data.error || "Retry failed",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to retry run",
        variant: "destructive",
      });
    },
  });

  const resetAutomationForm = () => {
    setAutomationForm({
      name: '',
      connectionId: undefined,
      eventType: '',
      destinationType: '',
      webhookUrl: '',
      fieldMapping: {},
      behavior: 'create',
    });
  };

  const handleConnectProvider = (provider: ProviderInfo) => {
    if (provider.authType === 'oauth') {
      // Redirect to OAuth flow
      window.location.href = `/api/integrations/auth/${provider.id}`;
    } else {
      // Show webhook URL input dialog
      setSelectedProvider(provider);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'expired':
        return <Badge className="bg-yellow-100 text-yellow-800">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRunStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'retrying':
        return <RefreshCw className="h-4 w-4 text-yellow-600" />;
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

  // Automation detail view
  if (selectedAutomation) {
    const connection = connections.find(c => c.id === selectedAutomation.connectionId);

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => {
            setSelectedAutomation(null);
            setRunPage(0);
          }}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Automations
        </Button>

        <div className="space-y-6">
          {/* Automation Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selectedAutomation.name}
                    {selectedAutomation.isActive ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Paused</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    When {eventLabels[selectedAutomation.eventType] || selectedAutomation.eventType} →
                    Send to {destinationTypeLabels[selectedAutomation.destinationType] || selectedAutomation.destinationType}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Switch
                    checked={selectedAutomation.isActive}
                    onCheckedChange={(checked) => {
                      updateAutomationMutation.mutate({
                        id: selectedAutomation.id,
                        data: { isActive: checked }
                      });
                      setSelectedAutomation({ ...selectedAutomation, isActive: checked });
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testAutomationMutation.mutate(selectedAutomation.id)}
                    disabled={testAutomationMutation.isPending}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Test
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Automation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this automation? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAutomationMutation.mutate(selectedAutomation.id)}
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
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-500">Total Runs</div>
                  <div className="text-2xl font-bold">{selectedAutomation.totalRuns}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-500">Successful</div>
                  <div className="text-2xl font-bold text-green-600">{selectedAutomation.successfulRuns}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-500">Success Rate</div>
                  <div className="text-2xl font-bold">
                    {selectedAutomation.totalRuns > 0
                      ? Math.round((selectedAutomation.successfulRuns / selectedAutomation.totalRuns) * 100)
                      : 0}%
                  </div>
                </div>
              </div>

              {/* Connection Info */}
              {connection && (
                <div>
                  <Label className="text-sm text-gray-500">Connection</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {providerIcons[connection.provider]}
                    <span className="font-medium">
                      {connection.providerAccountName || connection.provider}
                    </span>
                    {getStatusBadge(connection.status)}
                  </div>
                </div>
              )}

              {/* Field Mapping Preview */}
              {selectedAutomation.fieldMapping && Object.keys(selectedAutomation.fieldMapping).length > 0 && (
                <div>
                  <Label className="text-sm text-gray-500">Field Mapping</Label>
                  <div className="mt-2 bg-gray-50 rounded-lg p-3 text-sm font-mono">
                    {Object.entries(selectedAutomation.fieldMapping).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-gray-500">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Run History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Run History
              </CardTitle>
              <CardDescription>
                Recent automation executions
                {runsData?.pagination && (
                  <span className="ml-2">({runsData.pagination.total} total)</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRuns ? (
                <div className="text-center py-8 text-gray-500">Loading runs...</div>
              ) : runsData?.runs?.length > 0 ? (
                <div className="space-y-3">
                  {runsData.runs.map((run: AutomationRun) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getRunStatusIcon(run.status)}
                        <div>
                          <div className="font-medium text-sm">
                            {eventLabels[run.eventType] || run.eventType}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                            {run.durationMs && ` • ${run.durationMs}ms`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {run.status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryRunMutation.mutate(run.id)}
                            disabled={retryRunMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                        {run.errorMessage && (
                          <span className="text-xs text-red-600 max-w-[200px] truncate">
                            {run.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {runsData.pagination && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <div className="text-sm text-gray-500">
                        Showing {runsData.pagination.offset + 1}-
                        {Math.min(runsData.pagination.offset + runsData.runs.length, runsData.pagination.total)} of {runsData.pagination.total}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRunPage(p => Math.max(0, p - 1))}
                          disabled={runPage === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRunPage(p => p + 1)}
                          disabled={!runsData.pagination.hasMore}
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
                  No runs yet. The automation will execute when matching events occur.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main view with tabs
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Link2 className="h-8 w-8 text-blue-600" />
          Integrations
        </h1>
        <p className="text-gray-600 mt-1">
          Connect external apps and automate workflows based on events
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="connections" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="automations" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Automations
          </TabsTrigger>
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections">
          <div className="space-y-6">
            {/* Available Providers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Available Integrations</CardTitle>
                <CardDescription>
                  Connect your favorite apps to sync data automatically
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {providers.map((provider) => {
                    const existingConnection = connections.find(c => c.provider === provider.id);

                    return (
                      <div
                        key={provider.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {providerIcons[provider.id] || <Globe className="h-5 w-5" />}
                          <div>
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-sm text-gray-500">{provider.description}</div>
                          </div>
                        </div>
                        {existingConnection ? (
                          <div className="flex items-center gap-2">
                            {getStatusBadge(existingConnection.status)}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedConnection(existingConnection)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConnectProvider(provider)}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Connected Accounts */}
            {connections.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Connected Accounts</CardTitle>
                  <CardDescription>
                    Manage your active integrations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {connections.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {providerIcons[connection.provider] || <Globe className="h-5 w-5" />}
                          <div>
                            <div className="font-medium">
                              {connection.providerAccountName || connection.provider}
                            </div>
                            <div className="text-xs text-gray-500">
                              Connected {formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })}
                              {connection.lastUsedAt && (
                                <> • Last used {formatDistanceToNow(new Date(connection.lastUsedAt), { addSuffix: true })}</>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(connection.status)}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Unplug className="h-4 w-4 text-gray-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Disconnect Integration</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to disconnect this integration? Any automations using this connection will stop working.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteConnectionMutation.mutate(connection.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Disconnect
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Automations Tab */}
        <TabsContent value="automations">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Your Automations</h2>
                <p className="text-sm text-gray-500">
                  Create workflows that trigger when events happen
                </p>
              </div>
              <Button onClick={() => setIsAutomationDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Automation
              </Button>
            </div>

            {isLoadingAutomations ? (
              <div className="text-center py-12">Loading automations...</div>
            ) : automations.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Workflow className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No automations yet</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Automations let you send data to connected apps when events happen in your account.
                  </p>
                  <Button onClick={() => setIsAutomationDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Automation
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {automations.map((automation) => {
                  const connection = connections.find(c => c.id === automation.connectionId);

                  return (
                    <Card
                      key={automation.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedAutomation(automation);
                        setRunPage(0);
                      }}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-2 h-2 rounded-full ${
                              automation.isActive ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {automation.name}
                                {!automation.isActive && (
                                  <Badge variant="secondary" className="text-xs">Paused</Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                {eventLabels[automation.eventType] || automation.eventType} →
                                {' '}{destinationTypeLabels[automation.destinationType] || automation.destinationType}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {automation.totalRuns} run{automation.totalRuns !== 1 ? 's' : ''}
                                {automation.lastTriggeredAt && (
                                  <> • Last triggered {formatDistanceToNow(new Date(automation.lastTriggeredAt), { addSuffix: true })}</>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Webhook URL Dialog for webhook-based providers */}
      <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProvider && providerIcons[selectedProvider.id]}
              Connect {selectedProvider?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your {selectedProvider?.name} webhook URL to connect.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Webhook URL</Label>
            <Input
              placeholder="https://hooks.example.com/webhook/..."
              value={webhookUrlInput}
              onChange={(e) => setWebhookUrlInput(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-2">
              {selectedProvider?.id === 'zapier' && "Copy the webhook URL from your Zapier trigger"}
              {selectedProvider?.id === 'make' && "Copy the webhook URL from your Make scenario"}
              {selectedProvider?.id === 'webhook' && "Enter any HTTPS URL to receive webhook events"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProvider(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedProvider) {
                  createConnectionMutation.mutate({
                    provider: selectedProvider.id,
                    webhookUrl: webhookUrlInput,
                  });
                }
              }}
              disabled={!webhookUrlInput || createConnectionMutation.isPending}
            >
              {createConnectionMutation.isPending ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Automation Dialog */}
      <Dialog open={isAutomationDialogOpen} onOpenChange={setIsAutomationDialogOpen}>
        <DialogContent className="max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Automation</DialogTitle>
            <DialogDescription>
              Set up an automated workflow that triggers when events happen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <Label>Automation Name</Label>
              <Input
                placeholder="e.g., Sync NDA signers to HubSpot"
                value={automationForm.name}
                onChange={(e) => setAutomationForm({ ...automationForm, name: e.target.value })}
              />
            </div>

            {/* When this happens (Event Type) */}
            <div>
              <Label>When this happens</Label>
              <Select
                value={automationForm.eventType}
                onValueChange={(value) => setAutomationForm({ ...automationForm, eventType: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {eventCategories && Object.entries(eventCategories).map(([key, category]) => (
                    <div key={key}>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500">{category.label}</div>
                      {category.events.map((event) => (
                        <SelectItem key={event} value={event}>
                          {eventLabels[event] || event}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Send to (Destination Type) */}
            <div>
              <Label>Send to</Label>
              <Select
                value={automationForm.destinationType}
                onValueChange={(value) => {
                  // Find connection for this destination type
                  const provider = providers.find(p => p.destinationTypes.includes(value));
                  const connection = provider ? connections.find(c => c.provider === provider.id) : undefined;

                  setAutomationForm({
                    ...automationForm,
                    destinationType: value,
                    connectionId: connection?.id,
                  });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a destination" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => {
                    const hasConnection = connections.some(c => c.provider === provider.id);
                    const isWebhookBased = provider.authType === 'webhook';

                    return provider.destinationTypes.map((destType) => (
                      <SelectItem
                        key={destType}
                        value={destType}
                        disabled={!hasConnection && !isWebhookBased}
                      >
                        <div className="flex items-center gap-2">
                          {providerIcons[provider.id]}
                          {destinationTypeLabels[destType] || destType}
                          {!hasConnection && !isWebhookBased && (
                            <span className="text-xs text-gray-400">(not connected)</span>
                          )}
                        </div>
                      </SelectItem>
                    ));
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Webhook URL (for webhook-based destinations without a connection) */}
            {automationForm.destinationType &&
             ['zapier_webhook', 'make_webhook', 'custom_webhook'].includes(automationForm.destinationType) &&
             !automationForm.connectionId && (
              <div>
                <Label>Webhook URL</Label>
                <Input
                  placeholder="https://hooks.example.com/webhook/..."
                  value={automationForm.webhookUrl}
                  onChange={(e) => setAutomationForm({ ...automationForm, webhookUrl: e.target.value })}
                  className="mt-2"
                />
              </div>
            )}

            {/* Behavior (for CRM destinations) */}
            {automationForm.destinationType &&
             ['hubspot_contact', 'hubspot_deal', 'hubspot_company'].includes(automationForm.destinationType) && (
              <div>
                <Label>Behavior</Label>
                <Select
                  value={automationForm.behavior}
                  onValueChange={(value: 'create' | 'update' | 'upsert') =>
                    setAutomationForm({ ...automationForm, behavior: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">Create new record</SelectItem>
                    <SelectItem value="update">Update existing record</SelectItem>
                    <SelectItem value="upsert">Create or update (upsert)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Basic Field Mapping */}
            <div>
              <Label>Field Mapping (JSON)</Label>
              <Textarea
                placeholder='{"email": "{{signer.email}}", "firstname": "{{signer.name}}"}'
                value={JSON.stringify(automationForm.fieldMapping, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setAutomationForm({ ...automationForm, fieldMapping: parsed });
                  } catch {
                    // Keep invalid JSON for user to fix
                  }
                }}
                className="mt-2 font-mono text-sm"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {"{{field.path}}"} to reference event data. E.g., {"{{signer.email}}"}, {"{{document.title}}"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAutomationDialogOpen(false);
              resetAutomationForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => createAutomationMutation.mutate(automationForm)}
              disabled={
                !automationForm.name ||
                !automationForm.eventType ||
                !automationForm.destinationType ||
                createAutomationMutation.isPending
              }
            >
              {createAutomationMutation.isPending ? 'Creating...' : 'Create Automation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Integration Guide */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            <Zap className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">Getting Started</h3>
              <p className="text-sm text-blue-700 mt-1">
                Connect an app, then create an automation to send data when events happen.
                Start with HubSpot to sync your NDA signers as contacts.
              </p>
              <a
                href="https://cimshare.documentationai.com/integrations"
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
