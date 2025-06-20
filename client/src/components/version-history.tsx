import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw, User, Calendar, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentVersion {
  id: number;
  version: number;
  changes: any;
  changedBy: number;
  changeDescription?: string;
  createdAt: string;
}

interface VersionHistoryProps {
  documentId: number;
}

export function VersionHistory({ documentId }: VersionHistoryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: [`/api/cim/${documentId}/versions`],
    enabled: !!user && (user.subscriptionStatus !== 'free' || user.isAdmin),
  });

  const restoreMutation = useMutation({
    mutationFn: (targetVersion: number) => 
      apiRequest("POST", `/api/cim/${documentId}/restore/${targetVersion}`),
    onSuccess: () => {
      toast({
        title: "Version Restored",
        description: "Document has been restored to the selected version."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${documentId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${documentId}/versions`] });
      setRestoreVersion(null);
    },
    onError: (error: any) => {
      toast({
        title: "Restore Failed",
        description: error.response?.data?.error || "Failed to restore version",
        variant: "destructive"
      });
    }
  });

  // Version history is now available to all users

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Version History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4 border rounded">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/4" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
                <div className="h-8 bg-muted rounded w-20" />
              </div>
            ))}
          </div>
        ) : versions?.length ? (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {versions.map((version: DocumentVersion) => (
                <div key={version.id} className="flex items-center justify-between p-4 border rounded hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={version.version === 1 ? "default" : "secondary"}>
                        Version {version.version}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(version.createdAt).toLocaleString()}
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-1">
                      {version.changeDescription || 'Document updated'}
                    </p>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      Modified by user {version.changedBy}
                    </div>
                  </div>

                  {version.version > 1 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setRestoreVersion(version.version)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restore Version {version.version}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will create a new version with the content from version {version.version}. 
                            Your current changes will be preserved in the version history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setRestoreVersion(null)}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => restoreMutation.mutate(version.version)}
                            disabled={restoreMutation.isPending}
                          >
                            {restoreMutation.isPending ? "Restoring..." : "Restore Version"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Version History</h3>
            <p className="text-muted-foreground">
              Version history will appear here as you make changes to your document.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}