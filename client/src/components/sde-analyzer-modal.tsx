import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  Info,
  ExternalLink,
  Zap,
  Lock
} from 'lucide-react';
import { useLocation } from 'wouter';

interface SDEAnalyzerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Usage {
  used: number;
  limit: number;
  remaining: number;
}

export function SDEAnalyzerModal({ open, onOpenChange }: SDEAnalyzerModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Check if user has access
  const { data: usageData } = useQuery<{ hasAccess: boolean; usage: Usage }>({
    queryKey: ['/api/sde-analyzer/usage'],
    enabled: !!user && open,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      setUploadProgress(0);

      const response = await fetch('/api/sde-analyzer/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUploadSuccess(true);
      toast({
        title: 'Analysis Started!',
        description: `We'll email you at ${user?.email} when your SDE Sheet is ready (usually 2-5 minutes).`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sde-analyzer/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sde-analyzer/usage'] });

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadProgress(null);
        setUploadSuccess(false);
      }, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
      setUploadProgress(null);
      setUploadSuccess(false);
    },
  });

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload an Excel file (.xls or .xlsx)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (8MB limit)
    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'File size must be less than 8MB',
        variant: 'destructive',
      });
      return;
    }

    uploadMutation.mutate(file);
  };

  const hasAccess = usageData?.hasAccess ?? false;
  const usage = usageData?.usage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            SDE Analyzer
          </DialogTitle>
          <DialogDescription>
            Upload financial documents to generate an SDE Sheet with AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Free user upgrade prompt */}
          {!hasAccess && (
            <Alert className="border-blue-200 bg-blue-50">
              <Lock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <div className="flex items-start justify-between">
                  <div>
                    <strong>Upgrade Required:</strong> SDE Analyzer is available on Starter plan and above.
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/pricing');
                    }}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Upgrade
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Usage stats */}
          {hasAccess && usage && (
            <div className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
              <span className="text-muted-foreground">Monthly usage:</span>
              <span className="font-medium">
                {usage.used} / {usage.limit === Infinity ? '∞' : usage.limit}
                {usage.limit !== Infinity && ` (${usage.remaining} remaining)`}
              </span>
            </div>
          )}

          {/* Upload area */}
          {hasAccess && (
            <>
              {uploadSuccess ? (
                <div className="text-center py-8 space-y-4">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                  <div>
                    <h3 className="font-semibold text-lg">Upload Successful!</h3>
                    <p className="text-sm text-muted-foreground">
                      Check your email for the completed SDE Sheet
                    </p>
                  </div>
                </div>
              ) : uploadProgress !== null ? (
                <div className="py-8 space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
                  <div className="space-y-2">
                    <p className="text-center font-medium">Uploading...</p>
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="font-medium mb-2">Upload Excel File</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    .xls or .xlsx files up to 8MB
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending || (usage && usage.remaining <= 0)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Select File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xls,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                </div>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Analysis takes 2-5 minutes. You'll receive an email when complete. Files are retained for 30 days.
                </AlertDescription>
              </Alert>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/sde-analyzer');
                }}
              >
                View All Analyses
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {/* Feature description for free users */}
          {!hasAccess && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Upload your business financial Excel files and get a professional SDE (Seller's Discretionary Earnings) Sheet automatically generated.
              </p>
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <p className="font-medium">Features:</p>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>✓ Automated financial analysis</li>
                  <li>✓ Professional SDE Sheet generation</li>
                  <li>✓ Email delivery of results</li>
                  <li>✓ 30-day file retention</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
