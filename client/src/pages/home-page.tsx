import { useAuth } from "@/hooks/use-auth";
import { CimGenerator } from "@/components/cim-generator";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionCard } from "@/components/ui/subscription-card";

export default function HomePage() {
  const { user } = useAuth();
  const { data: documents } = useQuery({
    queryKey: ["/api/cim"],
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <CimGenerator />
          </div>

          <div className="space-y-6">
            <SubscriptionCard 
              status={user?.subscriptionStatus} 
              endsAt={user?.subscriptionEndsAt} 
              monthlyUsage={user?.monthlyUsage}
            />

            <Card>
              <CardHeader>
                <CardTitle>Recent Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {documents?.map((doc) => (
                    <div key={doc.id} className="p-3 bg-muted rounded-lg">
                      <h3 className="font-medium">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}