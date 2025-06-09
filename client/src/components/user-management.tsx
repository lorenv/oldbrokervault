import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Shield, Crown, Calendar, Mail, Settings } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function UserManagement() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  // Fetch all users
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, status, months }: { userId: number; status: string; months: number }) => {
      const response = await apiRequest("POST", "/api/admin/subscription", { userId, status, months });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Subscription Updated",
        description: "User subscription has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSubscriptionDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Grant admin mutation
  const grantAdminMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/admin/grant-admin", { email });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Admin Access Granted",
        description: "User has been granted admin privileges.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setAdminDialogOpen(false);
      setAdminEmail("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Grant Admin",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getSubscriptionBadge = (status: string) => {
    switch (status) {
      case "premium":
        return <Badge className="bg-purple-500 text-white">Premium</Badge>;
      case "standard":
        return <Badge className="bg-blue-500 text-white">Standard</Badge>;
      case "free":
        return <Badge variant="secondary">Free</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleUpdateSubscription = (status: string, months: number) => {
    if (selectedUser) {
      updateSubscriptionMutation.mutate({
        userId: selectedUser.id,
        status,
        months,
      });
    }
  };

  const handleGrantAdmin = () => {
    if (adminEmail.trim()) {
      grantAdminMutation.mutate(adminEmail.trim());
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Manage user accounts, subscriptions, and permissions
            </p>
            <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Crown className="h-4 w-4 mr-2" />
                  Grant Admin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Grant Admin Access</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">User Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="Enter user email address"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleGrantAdmin}
                    disabled={grantAdminMutation.isPending || !adminEmail.trim()}
                    className="w-full"
                  >
                    {grantAdminMutation.isPending ? "Granting..." : "Grant Admin Access"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getSubscriptionBadge(user.subscriptionStatus)}
                        {user.subscriptionEndsAt && (
                          <span className="text-xs text-muted-foreground">
                            Expires: {format(new Date(user.subscriptionEndsAt), "MMM dd, yyyy")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Badge variant="destructive">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="outline">User</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {user.createdAt ? format(new Date(user.createdAt), "MMM dd, yyyy") : "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog 
                        open={subscriptionDialogOpen && selectedUser?.id === user.id} 
                        onOpenChange={(open) => {
                          setSubscriptionDialogOpen(open);
                          if (!open) setSelectedUser(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Manage
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Manage User: {user.email}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Update Subscription</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => handleUpdateSubscription("free", 0)}
                                  disabled={updateSubscriptionMutation.isPending}
                                >
                                  Set to Free
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleUpdateSubscription("standard", 1)}
                                  disabled={updateSubscriptionMutation.isPending}
                                >
                                  Standard (1 month)
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleUpdateSubscription("premium", 1)}
                                  disabled={updateSubscriptionMutation.isPending}
                                >
                                  Premium (1 month)
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleUpdateSubscription("premium", 12)}
                                  disabled={updateSubscriptionMutation.isPending}
                                >
                                  Premium (1 year)
                                </Button>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Current: {getSubscriptionBadge(user.subscriptionStatus)}
                              {user.subscriptionEndsAt && (
                                <span className="block">
                                  Expires: {format(new Date(user.subscriptionEndsAt), "MMM dd, yyyy")}
                                </span>
                              )}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {users?.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Users Found</h3>
              <p className="text-muted-foreground">
                No users have registered yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}