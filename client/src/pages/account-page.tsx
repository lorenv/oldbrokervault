import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionCard } from "@/components/ui/subscription-card";
import { useAuth } from "@/hooks/use-auth";

export default function AccountPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Account Settings</h1>
        
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Username:</strong> {user?.username}</p>
                <p><strong>Account Type:</strong> {user?.isAdmin ? 'Administrator' : 'User'}</p>
                <p><strong>Member Since:</strong> {new Date(user?.lastUsageReset || '').toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          <SubscriptionCard 
            status={user?.subscriptionStatus} 
            endsAt={user?.subscriptionEndsAt}
            monthlyUsage={user?.monthlyUsage}
          />
        </div>
      </main>
    </div>
  );
}
