import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AdminPage() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  // Redirect non-admin users
  if (user && !user.isAdmin) {
    return <Redirect to="/" />;
  }

  const { data: users } = useQuery({
    queryKey: ["/api/admin/users"],
  });

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
        userId,
        status,
        months,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
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
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <Badge variant={user.subscriptionStatus === "premium" ? "default" : "secondary"}>
                        {user.subscriptionStatus.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.monthlyUsage} / {subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans].limit} CIMs
                    </TableCell>
                    <TableCell>
                      {user.subscriptionEndsAt
                        ? new Date(user.subscriptionEndsAt).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedUser(user.id)}
                          >
                            Update Subscription
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Subscription</DialogTitle>
                            <DialogDescription>
                              Update subscription status and duration for {user.username}
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
                                <SelectItem value="standard">Standard - 10 CIMs/month ($500)</SelectItem>
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
      </main>
    </div>
  );
}