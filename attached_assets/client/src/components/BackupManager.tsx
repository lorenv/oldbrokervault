import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Download, Trash2, Database, Shield, Clock, HardDrive } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

interface Backup {
  filename: string;
  size: number;
  created: string;
  sizeFormatted: string;
}

interface BackupStats {
  totalBackups: number;
  totalSizeFormatted: string;
  oldestBackup: string | null;
  newestBackup: string | null;
}

interface BackupStatus {
  schedulerRunning: boolean;
  stats: BackupStats;
}

export default function BackupManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteBackup, setDeleteBackup] = useState<string | null>(null);
  const [restoreBackup, setRestoreBackup] = useState<string | null>(null);

  // Fetch backup list and status
  const { data: backupData, isLoading } = useQuery({
    queryKey: ['/api/backup/list'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: statusData } = useQuery({
    queryKey: ['/api/backup/status'],
    refetchInterval: 30000,
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: () => apiRequest('/api/backup/create', 'POST'),
    onSuccess: () => {
      toast({ title: 'Backup created successfully', description: 'Database backup has been saved.' });
      queryClient.invalidateQueries({ queryKey: ['/api/backup/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backup/status'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create backup', description: error.message, variant: 'destructive' });
    },
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: (filename: string) => apiRequest(`/api/backup/${filename}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Backup deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/backup/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backup/status'] });
      setDeleteBackup(null);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete backup', description: error.message, variant: 'destructive' });
    },
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: (filename: string) => apiRequest('/api/backup/restore', 'POST', { filename }),
    onSuccess: () => {
      toast({ title: 'Database restored successfully', description: 'Your database has been restored from the backup.' });
      setRestoreBackup(null);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to restore backup', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Backups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading backup information...
          </div>
        </CardContent>
      </Card>
    );
  }

  const backups: Backup[] = backupData?.backups || [];
  const stats: BackupStats = backupData?.stats || { totalBackups: 0, totalSizeFormatted: '0 Bytes', oldestBackup: null, newestBackup: null };
  const status: BackupStatus = statusData || { schedulerRunning: false, stats };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Backups
          </CardTitle>
          <CardDescription>
            Manage your database backups to protect against data loss
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Backup Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Shield className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium">Scheduler Status</p>
                <Badge variant={status.schedulerRunning ? "default" : "destructive"}>
                  {status.schedulerRunning ? "Running" : "Stopped"}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Clock className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Backups</p>
                <p className="text-2xl font-bold">{stats.totalBackups}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <HardDrive className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Total Size</p>
                <p className="text-2xl font-bold">{stats.totalSizeFormatted}</p>
              </div>
            </div>
          </div>

          {/* Create Backup Button */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Manual Backup</h3>
              <p className="text-sm text-muted-foreground">
                Create an immediate backup of your database
              </p>
            </div>
            <Button 
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
            >
              {createBackupMutation.isPending ? 'Creating...' : 'Create Backup'}
            </Button>
          </div>

          <Separator />

          {/* Backup List */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Available Backups</h3>
            
            {backups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No backups found. Create your first backup to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup) => (
                  <div key={backup.filename} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{backup.filename}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          Created: {format(new Date(backup.created), 'MMM dd, yyyy HH:mm')}
                        </span>
                        <span>Size: {backup.sizeFormatted}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreBackup(backup.filename)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Restore
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteBackup(backup.filename)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backup Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Backup Information</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Backups are automatically created daily</li>
              <li>• Old backups are automatically deleted after 30 days</li>
              <li>• Backups include all documents, signatures, and user data</li>
              <li>• Use the restore function to recover from any backup</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteBackup} onOpenChange={() => setDeleteBackup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this backup? This action cannot be undone.
              <br />
              <strong>{deleteBackup}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBackup && deleteBackupMutation.mutate(deleteBackup)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreBackup} onOpenChange={() => setRestoreBackup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Database</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore your database from this backup? This will replace all current data.
              <br />
              <strong>{restoreBackup}</strong>
              <br />
              <br />
              <strong>Warning:</strong> All data created after this backup will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreBackup && restoreBackupMutation.mutate(restoreBackup)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Restore Database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}