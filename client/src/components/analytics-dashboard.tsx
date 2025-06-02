import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BarChart3, TrendingUp, Eye, Edit, Share, Download, Calendar } from "lucide-react";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

interface AnalyticsProps {
  documentId?: number;
  isDocumentLevel?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function AnalyticsDashboard({ documentId, isDocumentLevel = false }: AnalyticsProps) {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const endpoint = isDocumentLevel 
    ? `/api/cim/${documentId}/analytics`
    : "/api/analytics/dashboard";

  const { data: analytics, isLoading } = useQuery({
    queryKey: [endpoint, dateRange],
    enabled: !!user && (user.subscriptionStatus !== 'free' || user.isAdmin),
  });

  const isPremium = user && (user.subscriptionStatus !== 'free' || user.isAdmin);

  if (!isPremium) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Premium Feature</h3>
            <p className="text-muted-foreground mb-4">
              Advanced analytics and usage insights are available with a premium subscription.
            </p>
            <Button variant="outline">
              Upgrade to Premium
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'view': return <Eye className="h-4 w-4" />;
      case 'edit': return <Edit className="h-4 w-4" />;
      case 'share': return <Share className="h-4 w-4" />;
      case 'export': return <Download className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'view': return 'bg-blue-500';
      case 'edit': return 'bg-green-500';
      case 'share': return 'bg-purple-500';
      case 'export': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {isDocumentLevel ? "Document Analytics" : "Usage Analytics"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
              />
            </div>
            {dateRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateRange(undefined)}
              >
                Clear Filter
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded" />
                ))}
              </div>
              <div className="h-64 bg-muted animate-pulse rounded" />
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {isDocumentLevel ? (
                <>
                  {/* Document Analytics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Actions</p>
                            <p className="text-2xl font-bold">{analytics.totalActions || 0}</p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Most Common Action</p>
                            <p className="text-lg font-semibold">
                              {analytics.actionStats?.[0]?.action || 'None'}
                            </p>
                          </div>
                          {analytics.actionStats?.[0] && getActionIcon(analytics.actionStats[0].action)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Last Activity</p>
                            <p className="text-sm font-medium">
                              {analytics.actionStats?.[0]?.lastActivity 
                                ? new Date(analytics.actionStats[0].lastActivity).toLocaleDateString()
                                : 'Never'
                              }
                            </p>
                          </div>
                          <Calendar className="h-8 w-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Action Distribution Chart */}
                  {analytics.actionStats?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Action Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={analytics.actionStats}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="action" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="count" fill="#8884d8" />
                            </BarChart>
                          </ResponsiveContainer>

                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={analytics.actionStats}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="count"
                                label={({ action, count }) => `${action}: ${count}`}
                              >
                                {analytics.actionStats.map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recent Activity */}
                  {analytics.recentActivity?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64">
                          <div className="space-y-3">
                            {analytics.recentActivity.map((activity: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-3 border rounded">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded ${getActionColor(activity.action)}`}>
                                    {getActionIcon(activity.action)}
                                  </div>
                                  <div>
                                    <p className="font-medium capitalize">{activity.action}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {new Date(activity.timestamp).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="secondary">
                                  {activity.action}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <>
                  {/* User Dashboard Analytics */}
                  <div className="grid grid-cols-1 gap-4">
                    {analytics.map((item: any, index: number) => (
                      <Card key={index}>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium">{item.documentTitle}</h3>
                              <p className="text-sm text-muted-foreground">
                                {item.actions} total actions
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Last activity: {new Date(item.lastActivity).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="secondary">
                              {item.actions} actions
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Analytics Data</h3>
              <p className="text-muted-foreground">
                Analytics data will appear here as you use your documents.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}