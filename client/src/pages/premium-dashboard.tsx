import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumSearch } from "@/components/premium-search";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { Badge } from "@/components/ui/badge";
import { Search, BarChart3, Crown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function PremiumDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("search");

  const isPremium = user && (user.subscriptionStatus !== 'free' || user.isAdmin);

  if (!isPremium) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Crown className="h-16 w-16 text-yellow-500" />
              </div>
              <CardTitle className="text-2xl">Premium Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-muted-foreground mb-6">
                  Unlock powerful features to enhance your CIM document workflow
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6 text-center">
                    <Search className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Advanced Search</h3>
                    <p className="text-sm text-muted-foreground">
                      Search across all your documents with advanced filtering and relevance scoring
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 text-center">
                    <BarChart3 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Analytics Dashboard</h3>
                    <p className="text-sm text-muted-foreground">
                      Track document usage, collaboration patterns, and performance metrics
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 text-center">
                    <TrendingUp className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Version History</h3>
                    <p className="text-sm text-muted-foreground">
                      Track all changes and restore previous versions of your documents
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center">
                <Link href="/pricing">
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600">
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Premium
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Premium Dashboard</h1>
            <p className="text-muted-foreground">
              Advanced features for enhanced document management
            </p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Premium User
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Advanced Search
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search">
            <PremiumSearch />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}