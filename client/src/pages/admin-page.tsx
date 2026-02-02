import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Redirect } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subscriptionPlans } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Activity, Users } from "lucide-react";

// Health check types
interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  latencyMs?: number;
  details?: Record<string, any>;
  timestamp: string;
}

interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export default function AdminPage() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [isRunningCheck, setIsRunningCheck] = useState(false);

  // Redirect non-admin users (ProtectedRoute already checks this, but extra safety)
  if (user && !user.isAdmin) {
    return <Redirect to="/" />;
  }

  const { data: users } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  // Health check query - runs every 4 hours, emails admin on errors
  const { data: healthReport, refetch: refetchHealth, isLoading: isLoadingHealth } = useQuery<HealthReport>({
    queryKey: ["/api/monitoring/health/comprehensive"],
    refetchInterval: 4 * 60 * 60 * 1000, // Refresh every 4 hours
    staleTime: 60 * 60 * 1000, // Consider stale after 1 hour
  });

  // Manual health check trigger
  const runHealthCheck = async () => {
    setIsRunningCheck(true);
    try {
      await refetchHealth();
    } finally {
      setIsRunningCheck(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>;
      case 'unhealthy':
        return <Badge className="bg-red-100 text-red-800">Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({
      userId,
      status,
      months,
    }: {
      userId: number;
      status: string;
      months: number;
    }) => {
      await apiRequest("POST", "/api/admin/subscription", {
        body: {
          userId,
          status,
          months,
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="px-4 md:px-6 py-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
      </header>

      <main className="px-4 md:px-6 py-4 md:py-6">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Health
            </TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Monthly Usage</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.username}</TableCell>
                        <TableCell>
                          <Badge variant={u.subscriptionStatus === "premium" ? "default" : "secondary"}>
                            {u.subscriptionStatus.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.monthlyUsage} / {subscriptionPlans[u.subscriptionStatus as keyof typeof subscriptionPlans]?.limit ?? '?'} CIMs
                        </TableCell>
                        <TableCell>
                          {u.subscriptionEndsAt
                            ? new Date(u.subscriptionEndsAt).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                onClick={() => setSelectedUser(u.id)}
                              >
                                Update Subscription
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update Subscription</DialogTitle>
                                <DialogDescription>
                                  Update subscription status and duration for {u.username}
                                </DialogDescription>
                              </DialogHeader>

                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const formData = new FormData(e.currentTarget);
                                  updateSubscriptionMutation.mutate({
                                    userId: selectedUser!,
                                    status: formData.get("status") as string,
                                    months: Number(formData.get("months")),
                                  });
                                }}
                                className="space-y-4"
                              >
                                <Select name="status" defaultValue="free">
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select plan" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="free">Free - 1 CIM/month</SelectItem>
                                    <SelectItem value="standard">Pro - 10 CIMs/month ($500)</SelectItem>
                                    <SelectItem value="premium">Premium - 100 CIMs/month ($4,000)</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Input
                                  type="number"
                                  name="months"
                                  placeholder="Number of months"
                                  min="1"
                                  defaultValue="1"
                                />

                                <Button type="submit" className="w-full">
                                  Update
                                </Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Health Tab */}
          <TabsContent value="health" className="space-y-6">
            {/* Overall Status Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    System Health Overview
                    {healthReport && getStatusIcon(healthReport.overall)}
                  </CardTitle>
                  <CardDescription>
                    {healthReport?.timestamp
                      ? `Last checked: ${new Date(healthReport.timestamp).toLocaleString()}`
                      : 'Loading...'}
                  </CardDescription>
                </div>
                <Button
                  onClick={runHealthCheck}
                  disabled={isRunningCheck || isLoadingHealth}
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRunningCheck ? 'animate-spin' : ''}`} />
                  {isRunningCheck ? 'Checking...' : 'Run Health Check'}
                </Button>
              </CardHeader>
              <CardContent>
                {healthReport?.summary && (
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{healthReport.summary.total}</div>
                      <div className="text-sm text-muted-foreground">Total Checks</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{healthReport.summary.healthy}</div>
                      <div className="text-sm text-green-600">Healthy</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{healthReport.summary.degraded}</div>
                      <div className="text-sm text-yellow-600">Degraded</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{healthReport.summary.unhealthy}</div>
                      <div className="text-sm text-red-600">Unhealthy</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Individual Service Checks */}
            <Card>
              <CardHeader>
                <CardTitle>Service Status</CardTitle>
                <CardDescription>
                  Detailed health status for each service and API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthReport?.checks?.map((check, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(check.status)}
                            {check.name}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(check.status)}</TableCell>
                        <TableCell>
                          {check.latencyMs ? `${check.latencyMs}ms` : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={check.message}>
                          {check.message}
                        </TableCell>
                        <TableCell>
                          {check.details && Object.keys(check.details).length > 0 && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">View</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>{check.name} Details</DialogTitle>
                                </DialogHeader>
                                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-96">
                                  {JSON.stringify(check.details, null, 2)}
                                </pre>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!healthReport?.checks && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {isLoadingHealth ? 'Loading health checks...' : 'No health data available. Click "Run Health Check" to start.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Info about Anthropic monitoring */}
            <Card>
              <CardHeader>
                <CardTitle>AI Model Monitoring</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>The health check system monitors AI model availability:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>OpenAI:</strong> Checks GPT-4o availability for CIM generation</li>
                  <li><strong>Anthropic Claude:</strong> Checks claude-sonnet-4-20250514 with fallback to claude-3-5-sonnet-20241022</li>
                  <li><strong>Perplexity:</strong> Checks sonar model for research queries</li>
                </ul>
                <p className="mt-3">If a primary model becomes unavailable, the system automatically falls back to the backup model.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}