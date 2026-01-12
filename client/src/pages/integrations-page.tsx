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
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Zap,
  ExternalLink,
  Unplug,
  Play,
  History,
  Workflow,
  Globe,
  Settings,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";

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
  triggerEvent: string;
  destinationType: string;
  destinationConfig?: Record<string, any>;
  fieldMappings?: any[];
  behavior?: string;
  matchField?: string;
  includeFile?: boolean;
  conditions?: any[];
  isActive: boolean;
  lastTriggeredAt?: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns?: number;
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

// Provider icons - using logo images
const providerIcons: Record<string, React.ReactNode> = {
  hubspot: <img src="/hubspot.png" alt="HubSpot" className="h-8 w-8 object-contain" />,
  slack: <img src="/slack.png" alt="Slack" className="h-8 w-8 object-contain" />,
  zapier: <img src="/zapier-icon.svg" alt="Zapier" className="h-8 w-8 object-contain" />,
  make: <img src="/makeicon.png" alt="Make" className="h-8 w-8 object-contain" />,
  webhook: <Globe className="h-8 w-8 text-blue-600" />,
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAutomationId, setEditingAutomationId] = useState<number | null>(null);
  const [automationForm, setAutomationForm] = useState({
    name: '',
    connectionId: undefined as number | undefined,
    eventType: '',
    destinationType: '',
    webhookUrl: '',
    fieldMapping: {} as Record<string, string>,
    behavior: 'create' as 'create' | 'update' | 'upsert',
    includeFile: false,
    matchField: 'email',
  });
  const [hubspotProperties, setHubspotProperties] = useState<Array<{name: string; label: string; type: string; required?: boolean}>>([]);
  const [isLoadingHubspotProperties, setIsLoadingHubspotProperties] = useState(false);

  // Slack state
  const [slackChannels, setSlackChannels] = useState<Array<{id: string; name: string}>>([]);
  const [isLoadingSlackChannels, setIsLoadingSlackChannels] = useState(false);

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

  // Fetch automation runs (for specific automation detail view)
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

  // All runs pagination for Runs tab
  const [allRunsPage, setAllRunsPage] = useState(0);
  const [allRunsStatusFilter, setAllRunsStatusFilter] = useState<string>('all');

  // Fetch all runs across all automations
  const { data: allRunsData, isLoading: isLoadingAllRuns } = useQuery({
    queryKey: ['/api/integrations/runs', allRunsPage, allRunsStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(RUNS_PER_PAGE),
        offset: String(allRunsPage * RUNS_PER_PAGE),
      });
      if (allRunsStatusFilter !== 'all') {
        params.set('status', allRunsStatusFilter);
      }
      const res = await apiRequest('GET', `/api/integrations/runs?${params}`);
      return res.json();
    },
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
      // Transform to API format - fieldMappings must match the schema:
      // { type: 'field'|'constant'|'template', destField: string, sourceField?: string, template?: string }
      const fieldMappings = Object.entries(data.fieldMapping)
        .filter(([_, v]) => v && v !== '_none_')
        .map(([destField, sourceValue]) => {
          // Check if it's a template (contains {{ }})
          if (sourceValue.includes('{{') && sourceValue.includes('}}')) {
            return {
              type: 'template' as const,
              destField: destField,
              template: sourceValue,
            };
          }
          // Otherwise treat as a direct field reference
          return {
            type: 'field' as const,
            destField: destField,
            sourceField: sourceValue,
          };
        });

      // Build destination config based on provider type
      let destinationConfig: Record<string, any> = {};

      if (data.destinationType.startsWith('hubspot_')) {
        destinationConfig = {
          objectType: data.destinationType.replace('hubspot_', ''),
        };
      } else if (data.destinationType === 'slack_message') {
        destinationConfig = {
          channelId: data.fieldMapping.channelId,
          channelName: data.fieldMapping.channelName,
          messageTemplate: data.fieldMapping.messageFormat === 'custom'
            ? data.fieldMapping.messageTemplate
            : undefined,
        };
      } else {
        destinationConfig = {
          webhookUrl: data.webhookUrl || undefined,
        };
      }

      const apiPayload = {
        name: data.name,
        connectionId: data.connectionId || undefined,
        triggerEvent: data.eventType,
        destinationType: data.destinationType,
        destinationConfig,
        behavior: data.behavior,
        matchField: data.matchField || undefined,
        fieldMappings: fieldMappings,
        includeFile: data.includeFile,
        fileSource: data.includeFile ? 'signed_document' : undefined,
        isActive: true,
      };
      console.log('Creating automation with payload:', apiPayload);
      const res = await apiRequest('POST', '/api/integrations/automations', { body: apiPayload });
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
      console.log('Updating automation', id, 'with data:', data);
      const res = await apiRequest('PATCH', `/api/integrations/automations/${id}`, { body: data });
      const result = await res.json();
      console.log('Update result:', result);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/automations'] });
      // Update selectedAutomation with the fresh data from server
      if (result.automation && selectedAutomation?.id === result.automation.id) {
        setSelectedAutomation(result.automation);
      }
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
      includeFile: false,
      matchField: 'email',
    });
    setHubspotProperties([]);
    setIsEditMode(false);
    setEditingAutomationId(null);
  };

  // Open edit dialog with automation data
  const openEditAutomation = (automation: Automation) => {
    console.log('Opening edit for automation:', automation);

    // Convert fieldMappings array back to form format
    const fieldMapping: Record<string, string> = {};
    if (automation.fieldMappings) {
      (automation.fieldMappings as any[]).forEach((mapping: any) => {
        if (mapping.destField) {
          fieldMapping[mapping.destField] = mapping.template || mapping.sourceField || '';
        }
      });
    }
    console.log('Converted field mappings:', fieldMapping);

    const formData = {
      name: automation.name,
      connectionId: automation.connectionId || undefined,
      eventType: automation.triggerEvent,
      destinationType: automation.destinationType,
      webhookUrl: (automation.destinationConfig as any)?.webhookUrl || '',
      fieldMapping,
      behavior: (automation.behavior as 'create' | 'update' | 'upsert') || 'create',
      includeFile: automation.includeFile || false,
      matchField: automation.matchField || 'email',
    };
    console.log('Setting form data:', formData);
    setAutomationForm(formData);

    // Fetch HubSpot properties if applicable
    if (automation.destinationType.startsWith('hubspot_') && automation.connectionId) {
      const objectType = automation.destinationType.replace('hubspot_', '');
      console.log('Fetching HubSpot properties for:', objectType);
      fetchHubspotProperties(objectType, automation.connectionId);
    }

    setIsEditMode(true);
    setEditingAutomationId(automation.id);
    setIsAutomationDialogOpen(true);
    console.log('Dialog should now be open');
  };

  // Fetch HubSpot properties when destination type changes
  const fetchHubspotProperties = async (objectType: string, connectionId: number) => {
    setIsLoadingHubspotProperties(true);
    try {
      const res = await apiRequest('GET', `/api/integrations/hubspot/properties/${objectType}?connectionId=${connectionId}`);
      const data = await res.json();
      setHubspotProperties(data.properties || []);
    } catch (error) {
      console.error('Failed to fetch HubSpot properties:', error);
      // Fallback to default properties
      if (objectType === 'contact') {
        setHubspotProperties([
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'firstname', label: 'First Name', type: 'string' },
          { name: 'lastname', label: 'Last Name', type: 'string' },
          { name: 'phone', label: 'Phone', type: 'phone' },
          { name: 'company', label: 'Company', type: 'string' },
          { name: 'jobtitle', label: 'Job Title', type: 'string' },
        ]);
      } else if (objectType === 'deal') {
        setHubspotProperties([
          { name: 'dealname', label: 'Deal Name', type: 'string', required: true },
          { name: 'amount', label: 'Value', type: 'number' },
          { name: 'dealstage', label: 'Deal Stage', type: 'string' },
          { name: 'closedate', label: 'Close Date', type: 'date' },
        ]);
      } else if (objectType === 'company') {
        setHubspotProperties([
          { name: 'name', label: 'Company Name', type: 'string', required: true },
          { name: 'domain', label: 'Website Domain', type: 'string' },
          { name: 'industry', label: 'Industry', type: 'string' },
          { name: 'phone', label: 'Phone', type: 'phone' },
        ]);
      }
    } finally {
      setIsLoadingHubspotProperties(false);
    }
  };

  // Fetch Slack channels when Slack is selected
  const fetchSlackChannels = async (connectionId: number) => {
    setIsLoadingSlackChannels(true);
    try {
      const res = await apiRequest('GET', `/api/integrations/slack/channels?connectionId=${connectionId}`);
      const data = await res.json();
      setSlackChannels(data.channels || []);
    } catch (error) {
      console.error('Failed to fetch Slack channels:', error);
      setSlackChannels([]);
    } finally {
      setIsLoadingSlackChannels(false);
    }
  };

  // Available event data fields based on event type
  const getEventDataFields = (eventType: string): Array<{value: string; label: string}> => {
    const commonFields = [
      { value: '{{timestamp}}', label: 'Event Timestamp' },
    ];

    // All event data is nested under 'data.' in the event payload
    // Common CIM fields shared across document events
    const cimFields = [
      { value: '{{data.cim_id}}', label: 'Document ID' },
      { value: '{{data.title}}', label: 'Document Title' },
      { value: '{{data.created_at}}', label: 'Created At' },
    ];

    const eventFields: Record<string, Array<{value: string; label: string}>> = {
      'nda.signed': [
        { value: '{{data.signer.email}}', label: 'Signer Email' },
        { value: '{{data.signer.name}}', label: 'Signer Name' },
        { value: '{{data.signer_email}}', label: 'Signer Email (alt)' },
        { value: '{{data.signer_name}}', label: 'Signer Name (alt)' },
        { value: '{{data.document.title}}', label: 'Document Title' },
        { value: '{{data.cim_title}}', label: 'CIM Title' },
        { value: '{{data.signer_location}}', label: 'Signer Location' },
      ],
      'nda.sent': [
        { value: '{{data.recipient.email}}', label: 'Recipient Email' },
        { value: '{{data.recipient.name}}', label: 'Recipient Name' },
        { value: '{{data.document.title}}', label: 'Document Title' },
      ],
      'nda.declined': [
        { value: '{{data.recipient.email}}', label: 'Recipient Email' },
        { value: '{{data.recipient.name}}', label: 'Recipient Name' },
        { value: '{{data.document.title}}', label: 'Document Title' },
        { value: '{{data.decline_reason}}', label: 'Decline Reason' },
      ],
      'cim.created': cimFields,
      'cim.updated': cimFields,
      'cim.published': [
        ...cimFields,
        { value: '{{data.share_url}}', label: 'Share URL' },
      ],
      'cim.viewed': [
        { value: '{{data.viewer_email}}', label: 'Viewer Email' },
        { value: '{{data.viewer_name}}', label: 'Viewer Name' },
        { value: '{{data.title}}', label: 'Document Title' },
        { value: '{{data.cim_id}}', label: 'Document ID' },
      ],
      'cim.downloaded': [
        { value: '{{data.viewer_email}}', label: 'Viewer Email' },
        { value: '{{data.viewer_name}}', label: 'Viewer Name' },
        { value: '{{data.title}}', label: 'Document Title' },
        { value: '{{data.cim_id}}', label: 'Document ID' },
      ],
      'contact.created': [
        { value: '{{data.contact.email}}', label: 'Contact Email' },
        { value: '{{data.contact.name}}', label: 'Contact Name' },
        { value: '{{data.contact.company}}', label: 'Contact Company' },
        { value: '{{data.contact.phone}}', label: 'Contact Phone' },
        { value: '{{data.email}}', label: 'Email (alt)' },
        { value: '{{data.name}}', label: 'Name (alt)' },
      ],
      'contact.updated': [
        { value: '{{data.contact.email}}', label: 'Contact Email' },
        { value: '{{data.contact.name}}', label: 'Contact Name' },
        { value: '{{data.contact.company}}', label: 'Contact Company' },
        { value: '{{data.contact.phone}}', label: 'Contact Phone' },
      ],
      'contact.deleted': [
        { value: '{{data.contact.email}}', label: 'Contact Email' },
        { value: '{{data.contact.name}}', label: 'Contact Name' },
        { value: '{{data.contact_id}}', label: 'Contact ID' },
      ],
      'message.received': [
        { value: '{{data.sender_email}}', label: 'Sender Email' },
        { value: '{{data.sender_name}}', label: 'Sender Name' },
        { value: '{{data.content_preview}}', label: 'Message Preview' },
      ],
      'message.sent': [
        { value: '{{data.recipient_email}}', label: 'Recipient Email' },
        { value: '{{data.recipient_name}}', label: 'Recipient Name' },
        { value: '{{data.content_preview}}', label: 'Message Preview' },
      ],
      'esign.envelope_completed': [
        { value: '{{data.recipient.email}}', label: 'Last Signer Email' },
        { value: '{{data.recipient.name}}', label: 'Last Signer Name' },
        { value: '{{data.envelope.title}}', label: 'Document Title' },
        { value: '{{data.envelope.id}}', label: 'Envelope ID' },
        { value: '{{data.envelope.envelopeId}}', label: 'Envelope UUID' },
        { value: '{{data.envelope.completedAt}}', label: 'Completed At' },
        { value: '{{data.signers[0].email}}', label: 'First Signer Email' },
        { value: '{{data.signers[0].name}}', label: 'First Signer Name' },
      ],
    };

    return [...(eventFields[eventType] || []), ...commonFields];
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

  // Get provider name from external URL for display
  const getProviderFromUrl = (url: string): string => {
    if (url.includes('slack.com')) return 'Slack';
    if (url.includes('hubspot.com')) return 'HubSpot';
    if (url.includes('zapier.com')) return 'Zapier';
    if (url.includes('make.com') || url.includes('integromat.com')) return 'Make';
    return 'External';
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
                    When {eventLabels[selectedAutomation.triggerEvent] || selectedAutomation.triggerEvent} →
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
                    onClick={() => openEditAutomation(selectedAutomation)}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
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
                      className="p-3 bg-gray-50 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
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
                          {run.externalUrl && (
                            <a
                              href={run.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View in {getProviderFromUrl(run.externalUrl)}
                            </a>
                          )}
                        </div>
                      </div>
                      {run.errorMessage && (
                        <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
                          <span className="font-medium">Error:</span> {run.errorMessage}
                        </div>
                      )}
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

        {/* Edit Automation Dialog - also available in detail view */}
        <Dialog open={isAutomationDialogOpen} onOpenChange={(open) => {
          setIsAutomationDialogOpen(open);
          if (!open) resetAutomationForm();
        }}>
          <DialogContent className="max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Edit Automation' : 'Create Automation'}</DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Update your automation settings and field mappings.' : 'Set up an automated workflow that triggers when events happen.'}
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
                  className="mt-2"
                />
              </div>

              {/* Event Type - disabled in edit mode */}
              <div>
                <Label>Trigger Event</Label>
                <Select
                  value={automationForm.eventType}
                  onValueChange={(value) => setAutomationForm({ ...automationForm, eventType: value })}
                  disabled={isEditMode}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select when to trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(eventLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEditMode && (
                  <p className="text-xs text-gray-500 mt-1">Trigger event cannot be changed after creation</p>
                )}
              </div>

              {/* Destination Type - disabled in edit mode */}
              <div>
                <Label>Send to</Label>
                <Select
                  value={automationForm.destinationType}
                  onValueChange={(value) => {
                    const provider = providers.find(p => p.destinationTypes.includes(value));
                    const connection = provider ? connections.find(c => c.provider === provider.id) : undefined;

                    setAutomationForm({
                      ...automationForm,
                      destinationType: value,
                      connectionId: connection?.id,
                      fieldMapping: {},
                    });

                    if (value.startsWith('hubspot_') && connection?.id) {
                      const objectType = value.replace('hubspot_', '');
                      fetchHubspotProperties(objectType, connection.id);
                    } else {
                      setHubspotProperties([]);
                    }
                  }}
                  disabled={isEditMode}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(destinationTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEditMode && (
                  <p className="text-xs text-gray-500 mt-1">Destination cannot be changed after creation</p>
                )}
              </div>

              {/* Behavior */}
              {automationForm.destinationType?.startsWith('hubspot_') && (
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
                      <SelectItem value="upsert">Create or update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Visual Field Mapping for HubSpot */}
              {automationForm.destinationType?.startsWith('hubspot_') && hubspotProperties.length > 0 && (
                <div className="space-y-3">
                  <Label>Field Mapping</Label>
                  <p className="text-xs text-gray-500">
                    Map CIM Share event data to HubSpot fields. Required fields are marked with *.
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    {/* Column Headers */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b text-xs font-medium text-gray-600">
                      <div className="w-1/3">HubSpot Field</div>
                      <div className="flex-1">CIM Share Data</div>
                    </div>
                    <div className="space-y-2 max-h-[280px] overflow-y-auto p-3 bg-gray-50">
                      {hubspotProperties.slice(0, 15).map((prop) => (
                        <div key={prop.name} className="flex items-center gap-2">
                          <div className="w-1/3 text-sm">
                            {prop.label}
                            {prop.required && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          <Select
                            value={automationForm.fieldMapping[prop.name] || '_none_'}
                            onValueChange={(value) => {
                              const newMapping = { ...automationForm.fieldMapping };
                              if (value === '_none_') {
                                delete newMapping[prop.name];
                              } else {
                                newMapping[prop.name] = value;
                              }
                              setAutomationForm({
                                ...automationForm,
                                fieldMapping: newMapping,
                              });
                            }}
                          >
                            <SelectTrigger className="flex-1 h-8 text-sm">
                              <SelectValue placeholder="Select source field" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none_">Don't map</SelectItem>
                              {getEventDataFields(automationForm.eventType).map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Match Field for update/upsert */}
              {automationForm.destinationType?.startsWith('hubspot_') &&
               ['update', 'upsert'].includes(automationForm.behavior) && (
                <div>
                  <Label>Match Records By</Label>
                  <Select
                    value={automationForm.matchField}
                    onValueChange={(value) => setAutomationForm({ ...automationForm, matchField: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      {automationForm.destinationType === 'hubspot_deal' && (
                        <SelectItem value="dealname">Deal Name</SelectItem>
                      )}
                      {automationForm.destinationType === 'hubspot_company' && (
                        <>
                          <SelectItem value="name">Company Name</SelectItem>
                          <SelectItem value="domain">Domain</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    The field used to find existing records to update
                  </p>
                </div>
              )}

              {/* Include File Attachment */}
              {automationForm.destinationType?.startsWith('hubspot_') &&
               ['nda.signed', 'esign.envelope_completed'].includes(automationForm.eventType) && (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">Attach Signed Document</Label>
                    <p className="text-xs text-gray-500">
                      Upload the signed PDF to HubSpot and attach it to the record
                    </p>
                  </div>
                  <Switch
                    checked={automationForm.includeFile}
                    onCheckedChange={(checked) => setAutomationForm({ ...automationForm, includeFile: checked })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAutomationDialogOpen(false);
                resetAutomationForm();
              }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const cleanedFieldMapping = Object.fromEntries(
                    Object.entries(automationForm.fieldMapping).filter(([_, v]) => v && v !== '' && v !== '_none_')
                  );

                  if (isEditMode && editingAutomationId) {
                    const fieldMappings = Object.entries(cleanedFieldMapping)
                      .map(([destField, sourceValue]) => {
                        if (sourceValue.includes('{{') && sourceValue.includes('}}')) {
                          return { type: 'template' as const, destField, template: sourceValue };
                        }
                        return { type: 'field' as const, destField, sourceField: sourceValue };
                      });

                    updateAutomationMutation.mutate({
                      id: editingAutomationId,
                      data: {
                        name: automationForm.name,
                        behavior: automationForm.behavior,
                        matchField: automationForm.matchField,
                        fieldMappings: fieldMappings as any,
                        includeFile: automationForm.includeFile,
                        fileSource: automationForm.includeFile ? 'signed_document' : null,
                      },
                    });
                    setIsAutomationDialogOpen(false);
                    if (selectedAutomation && selectedAutomation.id === editingAutomationId) {
                      setSelectedAutomation({
                        ...selectedAutomation,
                        name: automationForm.name,
                        behavior: automationForm.behavior,
                        matchField: automationForm.matchField,
                        includeFile: automationForm.includeFile,
                        fieldMappings: fieldMappings,
                      });
                    }
                    resetAutomationForm();
                  }
                }}
                disabled={
                  !automationForm.name ||
                  updateAutomationMutation.isPending
                }
                className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
              >
                {updateAutomationMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main view with tabs
  return (
    <div className="container mx-auto px-4 md:px-6 py-4 md:py-6 overflow-x-hidden">
      <PageHeader
        title="Integrations"
        description="Connect external apps and automate workflows based on events"
        icon={<Workflow className="h-5 w-5" />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 w-full grid grid-cols-3 h-12 p-1 bg-gray-100 rounded-lg">
          <TabsTrigger
            value="connections"
            className="flex items-center justify-center gap-2 h-full text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"
          >
            <Unplug className="h-4 w-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger
            value="automations"
            className="flex items-center justify-center gap-2 h-full text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"
          >
            <Workflow className="h-4 w-4" />
            Automations
          </TabsTrigger>
          <TabsTrigger
            value="runs"
            className="flex items-center justify-center gap-2 h-full text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"
          >
            <History className="h-4 w-4" />
            Run History
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
                    const existingConnections = connections.filter(c => c.provider === provider.id);
                    const hasConnection = existingConnections.length > 0;
                    const isWebhookBased = provider.authType === 'webhook';
                    // OAuth providers only allow one connection, webhook providers allow multiple
                    const canAddMore = isWebhookBased || !hasConnection;

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
                            {isWebhookBased && existingConnections.length > 0 && (
                              <div className="text-xs text-blue-600 mt-1">
                                {existingConnections.length} connection{existingConnections.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasConnection && !isWebhookBased && (
                            <>
                              {getStatusBadge(existingConnections[0].status)}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedConnection(existingConnections[0])}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {canAddMore && (
                            <Button
                              size="sm"
                              onClick={() => handleConnectProvider(provider)}
                              className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
                            >
                              {hasConnection ? 'Add Another' : 'Connect'}
                            </Button>
                          )}
                        </div>
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
              <Button
                onClick={() => setIsAutomationDialogOpen(true)}
                className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
              >
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
                  <Button
                    onClick={() => setIsAutomationDialogOpen(true)}
                    className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
                  >
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
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div
                            className="flex items-center gap-4 flex-1 cursor-pointer"
                            onClick={() => {
                              setSelectedAutomation(automation);
                              setRunPage(0);
                            }}
                          >
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
                                {eventLabels[automation.triggerEvent] || automation.triggerEvent} →
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
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={automation.isActive}
                              onCheckedChange={(checked) => {
                                updateAutomationMutation.mutate({
                                  id: automation.id,
                                  data: { isActive: checked }
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditAutomation(automation);
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Automation</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{automation.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteAutomationMutation.mutate(automation.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <ChevronRight
                              className="h-5 w-5 text-gray-400 cursor-pointer"
                              onClick={() => {
                                setSelectedAutomation(automation);
                                setRunPage(0);
                              }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Runs Tab */}
        <TabsContent value="runs">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Run History</h2>
                <p className="text-sm text-gray-500">
                  View all automation runs across your integrations
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={allRunsStatusFilter} onValueChange={setAllRunsStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/integrations/runs'] })}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            {isLoadingAllRuns ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : !allRunsData?.runs?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No runs yet</h3>
                  <p className="text-gray-500">
                    When your automations are triggered, their runs will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {allRunsData.runs.map((run: any) => (
                  <Card key={run.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {run.status === 'success' ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          ) : run.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{run.automation?.name || 'Unknown Automation'}</span>
                              <Badge variant="outline" className="text-xs">
                                {run.eventType}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {run.createdAt
                                ? formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })
                                : 'Unknown time'}
                            </p>
                            {run.errorMessage && (
                              <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded">
                                {run.errorMessage}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {run.externalUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(run.externalUrl, '_blank')}
                              title={`View in ${getProviderFromUrl(run.externalUrl)}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {run.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryRunMutation.mutate(run.id)}
                              disabled={retryRunMutation.isPending}
                            >
                              <RefreshCw className={`h-4 w-4 mr-1 ${retryRunMutation.isPending ? 'animate-spin' : ''}`} />
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                      {run.durationMs && (
                        <p className="text-xs text-gray-400 mt-2">
                          Duration: {run.durationMs}ms
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllRunsPage(p => Math.max(0, p - 1))}
                    disabled={allRunsPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {allRunsPage + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllRunsPage(p => p + 1)}
                    disabled={!allRunsData?.runs?.length || allRunsData.runs.length < RUNS_PER_PAGE}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Connection Settings Dialog */}
      <Dialog open={!!selectedConnection} onOpenChange={() => setSelectedConnection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedConnection && providerIcons[selectedConnection.provider]}
              {selectedConnection?.providerAccountName || selectedConnection?.provider} Settings
            </DialogTitle>
            <DialogDescription>
              Manage your {selectedConnection?.provider} connection
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label className="text-sm text-gray-500">Status</Label>
              <div className="mt-1">
                {selectedConnection && getStatusBadge(selectedConnection.status)}
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-500">Account</Label>
              <div className="mt-1 font-medium">
                {selectedConnection?.providerAccountName || 'N/A'}
              </div>
            </div>
            {selectedConnection?.providerAccountId && (
              <div>
                <Label className="text-sm text-gray-500">Account ID</Label>
                <div className="mt-1 text-sm text-gray-600">
                  {selectedConnection.providerAccountId}
                </div>
              </div>
            )}
            <div>
              <Label className="text-sm text-gray-500">Connected</Label>
              <div className="mt-1 text-sm text-gray-600">
                {selectedConnection && formatDistanceToNow(new Date(selectedConnection.createdAt), { addSuffix: true })}
              </div>
            </div>
            {selectedConnection?.lastUsedAt && (
              <div>
                <Label className="text-sm text-gray-500">Last Used</Label>
                <div className="mt-1 text-sm text-gray-600">
                  {formatDistanceToNow(new Date(selectedConnection.lastUsedAt), { addSuffix: true })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Unplug className="h-4 w-4 mr-2" />
                  Disconnect
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
                    onClick={() => {
                      if (selectedConnection) {
                        deleteConnectionMutation.mutate(selectedConnection.id);
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={() => setSelectedConnection(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
            >
              {createConnectionMutation.isPending ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Automation Dialog */}
      <Dialog open={isAutomationDialogOpen} onOpenChange={(open) => {
        setIsAutomationDialogOpen(open);
        if (!open) resetAutomationForm();
      }}>
        <DialogContent className="max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Automation' : 'Create Automation'}</DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Update your automation settings and field mappings.' : 'Set up an automated workflow that triggers when events happen.'}
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
                    fieldMapping: {}, // Reset field mapping when destination changes
                  });

                  // Fetch HubSpot properties if applicable
                  if (value.startsWith('hubspot_') && connection?.id) {
                    const objectType = value.replace('hubspot_', '');
                    fetchHubspotProperties(objectType, connection.id);
                    setSlackChannels([]);
                  } else if (value === 'slack_message' && connection?.id) {
                    // Fetch Slack channels
                    fetchSlackChannels(connection.id);
                    setHubspotProperties([]);
                  } else {
                    setHubspotProperties([]);
                    setSlackChannels([]);
                  }
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

            {/* Visual Field Mapping for HubSpot */}
            {automationForm.destinationType?.startsWith('hubspot_') && hubspotProperties.length > 0 && (
              <div className="space-y-3">
                <Label>Field Mapping</Label>
                <p className="text-xs text-gray-500">
                  Map CIM Share event data to HubSpot fields. Required fields are marked with *.
                </p>
                <div className="border rounded-lg overflow-hidden">
                  {/* Column Headers */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b text-xs font-medium text-gray-600">
                    <div className="w-1/3">HubSpot Field</div>
                    <div className="flex-1">CIM Share Data</div>
                  </div>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto p-3 bg-gray-50">
                    {hubspotProperties.slice(0, 15).map((prop) => (
                      <div key={prop.name} className="flex items-center gap-2">
                        <div className="w-1/3 text-sm">
                          {prop.label}
                          {prop.required && <span className="text-red-500 ml-1">*</span>}
                        </div>
                        <Select
                          value={automationForm.fieldMapping[prop.name] || '_none_'}
                          onValueChange={(value) => {
                            const newMapping = { ...automationForm.fieldMapping };
                            if (value === '_none_') {
                              delete newMapping[prop.name];
                            } else {
                              newMapping[prop.name] = value;
                            }
                            setAutomationForm({
                              ...automationForm,
                              fieldMapping: newMapping,
                            });
                          }}
                        >
                          <SelectTrigger className="flex-1 h-8 text-sm">
                            <SelectValue placeholder="Select source field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">Don't map</SelectItem>
                            {getEventDataFields(automationForm.eventType).map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Match Field for update/upsert */}
            {automationForm.destinationType?.startsWith('hubspot_') &&
             ['update', 'upsert'].includes(automationForm.behavior) && (
              <div>
                <Label>Match Records By</Label>
                <Select
                  value={automationForm.matchField}
                  onValueChange={(value) => setAutomationForm({ ...automationForm, matchField: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    {automationForm.destinationType === 'hubspot_deal' && (
                      <SelectItem value="dealname">Deal Name</SelectItem>
                    )}
                    {automationForm.destinationType === 'hubspot_company' && (
                      <>
                        <SelectItem value="name">Company Name</SelectItem>
                        <SelectItem value="domain">Domain</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  The field used to find existing records to update
                </p>
              </div>
            )}

            {/* Include File Attachment */}
            {automationForm.destinationType?.startsWith('hubspot_') &&
             ['nda.signed', 'esign.envelope_completed'].includes(automationForm.eventType) && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Attach Signed Document</Label>
                  <p className="text-xs text-gray-500">
                    Upload the signed PDF to HubSpot and attach it to the record
                  </p>
                </div>
                <Switch
                  checked={automationForm.includeFile}
                  onCheckedChange={(checked) => setAutomationForm({ ...automationForm, includeFile: checked })}
                />
              </div>
            )}

            {/* Loading state for HubSpot properties */}
            {automationForm.destinationType?.startsWith('hubspot_') && isLoadingHubspotProperties && (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="h-5 w-5 animate-spin text-gray-400 mr-2" />
                <span className="text-sm text-gray-500">Loading HubSpot fields...</span>
              </div>
            )}

            {/* Slack Configuration */}
            {automationForm.destinationType === 'slack_message' && (
              <>
                {/* Loading state for Slack channels */}
                {isLoadingSlackChannels && (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw className="h-5 w-5 animate-spin text-gray-400 mr-2" />
                    <span className="text-sm text-gray-500">Loading Slack channels...</span>
                  </div>
                )}

                {/* Slack Channel Selector */}
                {!isLoadingSlackChannels && slackChannels.length > 0 && (
                  <div>
                    <Label>Slack Channel</Label>
                    <Select
                      value={automationForm.fieldMapping.channelId || ''}
                      onValueChange={(value) => {
                        const channel = slackChannels.find(c => c.id === value);
                        setAutomationForm({
                          ...automationForm,
                          fieldMapping: {
                            ...automationForm.fieldMapping,
                            channelId: value,
                            channelName: channel?.name || '',
                          },
                        });
                      }}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {slackChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select the channel where notifications will be posted
                    </p>
                  </div>
                )}

                {/* No channels message */}
                {!isLoadingSlackChannels && slackChannels.length === 0 && (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    No channels found. Make sure the Slack app has been added to at least one channel.
                  </div>
                )}

                {/* Message Format */}
                <div>
                  <Label>Message Format</Label>
                  <Select
                    value={automationForm.fieldMapping.messageFormat || 'rich'}
                    onValueChange={(value) => {
                      setAutomationForm({
                        ...automationForm,
                        fieldMapping: {
                          ...automationForm.fieldMapping,
                          messageFormat: value,
                        },
                      });
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rich">Rich Message (Recommended)</SelectItem>
                      <SelectItem value="custom">Custom Template</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Rich messages include formatted event data with headers and buttons
                  </p>
                </div>

                {/* Custom Message Template (only shown when custom is selected) */}
                {automationForm.fieldMapping.messageFormat === 'custom' && (
                  <div>
                    <Label>Custom Message Template</Label>
                    <Textarea
                      placeholder="New {{event}} from {{data.signer.name}} ({{data.signer.email}})"
                      value={automationForm.fieldMapping.messageTemplate || ''}
                      onChange={(e) => {
                        setAutomationForm({
                          ...automationForm,
                          fieldMapping: {
                            ...automationForm.fieldMapping,
                            messageTemplate: e.target.value,
                          },
                        });
                      }}
                      className="mt-2"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available variables: {getEventDataFields(automationForm.eventType).map(f => f.value).join(', ')}
                    </p>
                  </div>
                )}

                {/* Include fields in message */}
                <div className="space-y-3">
                  <Label>Include in Message</Label>
                  <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
                    {getEventDataFields(automationForm.eventType).slice(0, 8).map((field) => (
                      <div key={field.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`slack-field-${field.value}`}
                          checked={automationForm.fieldMapping[`include_${field.value}`] !== false}
                          onCheckedChange={(checked) => {
                            setAutomationForm({
                              ...automationForm,
                              fieldMapping: {
                                ...automationForm.fieldMapping,
                                [`include_${field.value}`]: checked,
                              },
                            });
                          }}
                        />
                        <label
                          htmlFor={`slack-field-${field.value}`}
                          className="text-sm cursor-pointer"
                        >
                          {field.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Select which event data to include in the Slack message
                  </p>
                </div>
              </>
            )}

            {/* Fallback JSON for webhook-based providers only (not HubSpot or Slack) */}
            {!automationForm.destinationType?.startsWith('hubspot_') &&
             automationForm.destinationType !== 'slack_message' &&
             automationForm.destinationType && (
              <div>
                <Label>Payload (JSON)</Label>
                <Textarea
                  placeholder='{"email": "{{signer.email}}", "name": "{{signer.name}}"}'
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
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAutomationDialogOpen(false);
              resetAutomationForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Clean up empty field mappings
                const cleanedFieldMapping = Object.fromEntries(
                  Object.entries(automationForm.fieldMapping).filter(([_, v]) => v && v !== '' && v !== '_none_')
                );

                if (isEditMode && editingAutomationId) {
                  // Transform for update
                  const fieldMappings = Object.entries(cleanedFieldMapping)
                    .map(([destField, sourceValue]) => {
                      if (sourceValue.includes('{{') && sourceValue.includes('}}')) {
                        return { type: 'template' as const, destField, template: sourceValue };
                      }
                      return { type: 'field' as const, destField, sourceField: sourceValue };
                    });

                  updateAutomationMutation.mutate({
                    id: editingAutomationId,
                    data: {
                      name: automationForm.name,
                      behavior: automationForm.behavior,
                      matchField: automationForm.matchField,
                      fieldMappings: fieldMappings as any,
                      includeFile: automationForm.includeFile,
                      fileSource: automationForm.includeFile ? 'signed_document' : null,
                    },
                  });
                  setIsAutomationDialogOpen(false);
                  // Refresh the selected automation before resetting form
                  if (selectedAutomation && selectedAutomation.id === editingAutomationId) {
                    setSelectedAutomation({
                      ...selectedAutomation,
                      name: automationForm.name,
                      behavior: automationForm.behavior,
                      matchField: automationForm.matchField,
                      includeFile: automationForm.includeFile,
                      fieldMappings: fieldMappings,
                    });
                  }
                  resetAutomationForm();
                } else {
                  createAutomationMutation.mutate({
                    ...automationForm,
                    fieldMapping: cleanedFieldMapping,
                  });
                }
              }}
              disabled={
                !automationForm.name ||
                !automationForm.eventType ||
                !automationForm.destinationType ||
                (automationForm.destinationType === 'slack_message' && !automationForm.fieldMapping.channelId) ||
                createAutomationMutation.isPending ||
                updateAutomationMutation.isPending
              }
              className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
            >
              {isEditMode
                ? (updateAutomationMutation.isPending ? 'Saving...' : 'Save Changes')
                : (createAutomationMutation.isPending ? 'Creating...' : 'Create Automation')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documentation link */}
      <div className="mt-6 text-center">
        <a
          href="https://cimshare.documentationai.com/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          Learn more about integrations
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
