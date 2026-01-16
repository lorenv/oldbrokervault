import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { useLocation } from "wouter";
import {
  Mail,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Trash2,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EmailConnection {
  id: number;
  provider: 'gmail' | 'microsoft';
  providerAccountId: string;
  providerAccountName: string;
  status: 'active' | 'expired' | 'error' | 'disconnected';
  tokenExpiresAt: string | null;
  createdAt: string;
  lastSyncAt?: string;
}

interface ProviderConfig {
  name: string;
  icon: string;
  description: string;
  configured: boolean;
}

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);

  // Handle OAuth callback results (success or error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected) {
      const providerName = connected === 'microsoft' ? 'Microsoft 365 (Outlook)' : 'Gmail';
      toast({
        title: "Email Connected!",
        description: `Your ${providerName} account has been successfully connected.`,
      });
      // Refresh connections data
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/email-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      // Clear URL params
      window.history.replaceState({}, '', '/settings/email');
    } else if (error) {
      toast({
        title: "Connection Failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      // Clear URL params
      window.history.replaceState({}, '', '/settings/email');
    }
  }, [toast, queryClient]);

  // Fetch email connections
  const { data: connections = [], isLoading } = useQuery<EmailConnection[]>({
    queryKey: ["/api/integrations/email-connections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/connections");
      const data = await res.json();
      // Filter to only email providers
      return (data || []).filter((c: any) =>
        c.provider === 'gmail' || c.provider === 'microsoft'
      );
    },
  });

  // Fetch provider info
  const { data: providers = [] } = useQuery<ProviderConfig[]>({
    queryKey: ["/api/integrations/providers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/providers");
      const data = await res.json();
      // Filter to only email providers
      return (data || []).filter((p: any) =>
        p.id === 'gmail' || p.id === 'microsoft'
      ).map((p: any) => ({
        name: p.name,
        icon: p.icon,
        description: p.description,
        configured: p.status === 'available',
      }));
    },
  });

  // Connect to email provider - navigates directly to OAuth flow
  const handleConnect = (provider: 'gmail' | 'microsoft') => {
    // Navigate directly to the auth endpoint which handles the OAuth redirect
    window.location.href = `/api/integrations/auth/${provider}`;
  };

  // Disconnect email mutation
  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      await apiRequest("DELETE", `/api/integrations/connections/${connectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/email-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      toast({ title: "Email disconnected", description: "Your email account has been disconnected." });
      setDisconnectingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect failed",
        description: error.message || "Failed to disconnect email",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const res = await apiRequest("POST", `/api/integrations/connections/${connectionId}/test`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Connection verified", description: data.message || "Email connection is working." });
      } else {
        toast({
          title: "Connection issue",
          description: data.error || "There was a problem with your email connection.",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/email-connections"] });
    },
    onError: (error: any) => {
      toast({
        title: "Test failed",
        description: error.message || "Failed to test connection",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700"><Check className="h-3 w-3 mr-1" />Connected</Badge>;
      case 'expired':
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700"><X className="h-3 w-3 mr-1" />Disconnected</Badge>;
    }
  };

  const getProviderIcon = (provider: string, size: 'sm' | 'md' = 'md') => {
    const sizeClasses = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12';
    const imgSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';

    switch (provider) {
      case 'gmail':
        return (
          <div className={`${sizeClasses} rounded-lg bg-gray-50 flex items-center justify-center`}>
            <img src="/gmail.png" alt="Gmail" className={imgSize} />
          </div>
        );
      case 'microsoft':
        return (
          <div className={`${sizeClasses} rounded-lg bg-gray-50 flex items-center justify-center`}>
            <img src="/outlook.png" alt="Outlook" className={imgSize} />
          </div>
        );
      default:
        return (
          <div className={`${sizeClasses} rounded-lg bg-gray-50 flex items-center justify-center`}>
            <Mail className="h-6 w-6 text-gray-500" />
          </div>
        );
    }
  };

  const hasGmailConnection = connections.some(c => c.provider === 'gmail');
  const hasMicrosoftConnection = connections.some(c => c.provider === 'microsoft');
  const gmailConfigured = providers.find(p => p.name === 'Gmail')?.configured;
  const microsoftConfigured = providers.find(p => p.name === 'Microsoft 365')?.configured;

  return (
    <SettingsLayout
      title="Email Integration"
      description="Connect your email account to sync email activity with your CRM contacts"
    >
      <div className="max-w-4xl">

      {/* Connected Accounts */}
      {connections.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">Connected Accounts</h2>
          <div className="space-y-4">
            {connections.map((connection) => (
              <Card key={connection.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {getProviderIcon(connection.provider)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{connection.providerAccountName || connection.providerAccountId}</h3>
                        {getStatusBadge(connection.status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        {connection.provider === 'gmail' ? 'Gmail' : 'Microsoft 365'} - {connection.providerAccountId}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Connected {new Date(connection.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnectionMutation.mutate(connection.id)}
                        disabled={testConnectionMutation.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${testConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDisconnectingId(connection.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Providers */}
      <div>
        <h2 className="text-lg font-medium mb-4">
          {connections.length > 0 ? 'Add Another Account' : 'Connect Email Account'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gmail */}
          <Card className={!gmailConfigured && !hasGmailConnection ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {getProviderIcon('gmail', 'sm')}
                <div>
                  <CardTitle className="text-base">Gmail</CardTitle>
                  <CardDescription className="text-xs">Google Workspace</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Connect your Gmail account to automatically track email conversations with contacts.
              </p>
              {gmailConfigured || hasGmailConnection ? (
                <Button
                  onClick={() => handleConnect('gmail')}
                  disabled={hasGmailConnection}
                  className="w-full"
                >
                  {hasGmailConnection ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Connected
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Connect Gmail
                    </>
                  )}
                </Button>
              ) : (
                <div className="text-center py-2">
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Coming Soon
                  </Badge>
                  <p className="text-xs text-gray-500 mt-2">
                    Gmail OAuth credentials not configured
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Microsoft 365 */}
          <Card className={!microsoftConfigured && !hasMicrosoftConnection ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {getProviderIcon('microsoft', 'sm')}
                <div>
                  <CardTitle className="text-base">Microsoft 365</CardTitle>
                  <CardDescription className="text-xs">Outlook</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Connect your Outlook account to automatically track email conversations with contacts.
              </p>
              {microsoftConfigured || hasMicrosoftConnection ? (
                <Button
                  onClick={() => handleConnect('microsoft')}
                  disabled={hasMicrosoftConnection}
                  className="w-full"
                >
                  {hasMicrosoftConnection ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Connected
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Connect Outlook
                    </>
                  )}
                </Button>
              ) : (
                <div className="text-center py-2">
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Coming Soon
                  </Badge>
                  <p className="text-xs text-gray-500 mt-2">
                    Microsoft OAuth credentials not configured
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info Section */}
      <Card className="mt-8 bg-gray-50 border-gray-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Mail className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-gray-700">How Email Sync Works</h3>
              <p className="text-sm text-gray-600 mt-1">
                When you connect your email, we'll automatically track email conversations with contacts in your CRM.
                Email activity will appear in the contact's timeline, helping you keep track of all interactions.
              </p>
              <ul className="text-sm text-gray-600 mt-2 space-y-1">
                <li>• View sent and received emails in contact timelines</li>
                <li>• Track email open rates (when supported)</li>
                <li>• Send emails directly from CRM contact pages</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={!!disconnectingId} onOpenChange={() => setDisconnectingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Email Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop syncing email activity with your CRM contacts. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => disconnectingId && disconnectMutation.mutate(disconnectingId)}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </SettingsLayout>
  );
}
