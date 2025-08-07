import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Database, Upload, HardDrive } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface MigrationProgress {
  totalDocuments: number;
  migratedDocuments: number;
  totalTemplates: number;
  migratedTemplates: number;
  totalDocumentImages: number;
  migratedDocumentImages: number;
  totalTemplateImages: number;
  migratedTemplateImages: number;
  errors: string[];
}

export default function MigrationPage() {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  const startMigration = async () => {
    setIsRunning(true);
    setIsComplete(false);
    
    try {
      const response = await fetch('/api/migration/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        setProgress(result.progress);
        setIsComplete(true);
        toast({
          title: "Migration Completed",
          description: "Object storage migration has been completed successfully.",
        });
      } else {
        throw new Error(result.message || 'Migration failed');
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: "Migration Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getProgress = async () => {
    try {
      const response = await fetch('/api/migration/progress');
      const result = await response.json();
      
      if (result.success) {
        setProgress(result.progress);
      }
    } catch (error) {
      console.error('Error getting progress:', error);
    }
  };

  const verifyMigration = async () => {
    try {
      const response = await fetch('/api/migration/verify', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Verification Complete",
          description: result.verification.success ? 
            "Migration verification passed successfully." : 
            "Migration verification found issues. Check console for details.",
          variant: result.verification.success ? 'default' : 'destructive',
        });
        console.log('Verification details:', result.verification.details);
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: "Failed to verify migration.",
        variant: 'destructive',
      });
    }
  };

  const calculateTotalProgress = () => {
    if (!progress) return 0;
    
    const total = progress.totalDocuments + progress.totalTemplates + 
                 progress.totalDocumentImages + progress.totalTemplateImages;
    const migrated = progress.migratedDocuments + progress.migratedTemplates + 
                    progress.migratedDocumentImages + progress.migratedTemplateImages;
    
    return total > 0 ? (migrated / total) * 100 : 100;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Object Storage Migration</h1>
        <p className="text-muted-foreground mt-2">
          Migrate documents and templates from base64 database storage to efficient object storage
        </p>
      </div>

      <div className="grid gap-6">
        {/* Migration Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Migration Overview
            </CardTitle>
            <CardDescription>
              This migration moves file data from the PostgreSQL database to object storage, reducing database size and improving performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button 
                onClick={startMigration} 
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {isRunning ? 'Migrating...' : 'Start Migration'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={getProgress}
                className="flex items-center gap-2"
              >
                <HardDrive className="h-4 w-4" />
                Check Progress
              </Button>

              <Button 
                variant="outline" 
                onClick={verifyMigration}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Verify Migration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress Display */}
        {progress && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Migration Progress
                {isComplete && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Overall Progress</span>
                    <span>{Math.round(calculateTotalProgress())}%</span>
                  </div>
                  <Progress value={calculateTotalProgress()} className="w-full" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Documents</h4>
                    <div className="text-sm text-muted-foreground">
                      {progress.migratedDocuments} / {progress.totalDocuments} files
                    </div>
                    <Progress 
                      value={progress.totalDocuments > 0 ? (progress.migratedDocuments / progress.totalDocuments) * 100 : 100} 
                      className="h-2" 
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Templates</h4>
                    <div className="text-sm text-muted-foreground">
                      {progress.migratedTemplates} / {progress.totalTemplates} files
                    </div>
                    <Progress 
                      value={progress.totalTemplates > 0 ? (progress.migratedTemplates / progress.totalTemplates) * 100 : 100} 
                      className="h-2" 
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Document Images</h4>
                    <div className="text-sm text-muted-foreground">
                      {progress.migratedDocumentImages} / {progress.totalDocumentImages} images
                    </div>
                    <Progress 
                      value={progress.totalDocumentImages > 0 ? (progress.migratedDocumentImages / progress.totalDocumentImages) * 100 : 100} 
                      className="h-2" 
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Template Images</h4>
                    <div className="text-sm text-muted-foreground">
                      {progress.migratedTemplateImages} / {progress.totalTemplateImages} images
                    </div>
                    <Progress 
                      value={progress.totalTemplateImages > 0 ? (progress.migratedTemplateImages / progress.totalTemplateImages) * 100 : 100} 
                      className="h-2" 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Errors */}
        {progress && progress.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div>
                <strong>Migration Errors ({progress.errors.length}):</strong>
                <ul className="mt-2 space-y-1">
                  {progress.errors.slice(0, 5).map((error, index) => (
                    <li key={index} className="text-sm">• {error}</li>
                  ))}
                  {progress.errors.length > 5 && (
                    <li className="text-sm">• ... and {progress.errors.length - 5} more errors</li>
                  )}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Reduced Database Size</h4>
                  <p className="text-sm text-muted-foreground">
                    Move large file data out of PostgreSQL, reducing storage costs and improving query performance
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Better Performance</h4>
                  <p className="text-sm text-muted-foreground">
                    Faster database operations and reduced memory usage for large documents
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Scalable Storage</h4>
                  <p className="text-sm text-muted-foreground">
                    Object storage can handle large files more efficiently and cost-effectively
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}