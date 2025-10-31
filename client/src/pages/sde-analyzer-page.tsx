import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Lock,
  Zap,
  Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';

interface Analysis {
  id: number;
  originalFilename: string;
  resultFilename: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  processingTimeSeconds: number | null;
  downloadCount: number;
}

interface Usage {
  used: number;
  limit: number;
  remaining: number;
}

export default function SDEAnalyzerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Check if user has access
  const { data: usageData } = useQuery<{ hasAccess: boolean; usage: Usage; subscriptionStatus: string }>({
    queryKey: ['/api/sde-analyzer/usage'],
    enabled: !!user,
  });

  // Get analyses list
  const { data: analysesData, isLoading } = useQuery<{ analyses: Analysis[]; usage: Usage }>({
    queryKey: ['/api/sde-analyzer/list'],
    enabled: !!user && usageData?.hasAccess,
    refetchInterval: (data) => {
      // Auto-refresh every 10 seconds if there are any pending/processing analyses
      const hasPending = data?.analyses.some(a => a.status === 'pending' || a.status === 'processing');
      return hasPending ? 10000 : false;
    }
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
      toast({
        title: 'Analysis Started!',
        description: `We'll email you at ${user?.email} when your SDE Sheet is ready (usually 2-5 minutes).`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sde-analyzer/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sde-analyzer/usage'] });
      setUploadProgress(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
      setUploadProgress(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/sde-analyzer/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Analysis Deleted',
        description: 'The analysis has been removed from your history.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sde-analyzer/list'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDownload = async (id: number, filename: string) => {
    try {
      const response = await fetch(`/api/sde-analyzer/download/${id}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Download Started',
        description: `Downloading ${filename}`,
      });

      // Refresh to update download count
      queryClient.invalidateQueries({ queryKey: ['/api/sde-analyzer/list'] });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: Analysis['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'processing':
        return <Badge className="gap-1 bg-blue-500"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
    }
  };

  const getDaysUntilExpiration = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Please log in to access the SDE Analyzer.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show upgrade prompt for free users
  if (usageData && !usageData.hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle className="text-2xl">SDE Analyzer</CardTitle>
                <CardDescription>Professional financial analysis powered by Claude AI</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-blue-200 bg-blue-50">
              <Zap className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <strong>Upgrade Required:</strong> SDE Analyzer is available on Starter plan and above.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="font-semibold">What is the SDE Analyzer?</h3>
              <p className="text-muted-foreground">
                Upload your business financial Excel files and get a professional SDE (Seller's Discretionary Earnings) Sheet automatically generated.
                Our AI analyzes your financials and creates a comprehensive breakdown including revenue, expenses, add-backs, and normalized earnings.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Features:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>✓ Automated financial analysis</li>
                  <li>✓ Professional SDE Sheet generation</li>
                  <li>✓ Email delivery of results</li>
                  <li>✓ 30-day file retention</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={() => navigate('/pricing')}
              className="w-full bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700"
            >
              <Zap className="mr-2 h-4 w-4" />
              Upgrade to Access SDE Analyzer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const usage = analysesData?.usage || usageData?.usage;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">SDE Analyzer</h1>
        <p className="text-muted-foreground mt-1">
          Upload Excel files to generate professional SDE Sheets with AI-powered analysis
        </p>
      </div>

      {/* Usage Stats */}
      {usage && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Monthly Usage</p>
                <p className="text-2xl font-bold">
                  {usage.used} / {usage.limit === Infinity ? '∞' : usage.limit}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {usage.limit === Infinity ? 'Unlimited' : `${usage.remaining} remaining`}
                </p>
              </div>
            </div>
            {usage.limit !== Infinity && (
              <Progress value={(usage.used / usage.limit) * 100} className="mt-3" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Financial Document
          </CardTitle>
          <CardDescription>
            Upload an Excel file (.xls or .xlsx) to generate an SDE Sheet. Maximum file size: 8MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            {uploadProgress !== null ? (
              <div className="space-y-3">
                <p className="font-medium">Uploading...</p>
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
              </div>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">
                  Drop your Excel file here or click to browse
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Supports .xls and .xlsx files up to 8MB
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending || (usage && usage.remaining <= 0)}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Select File
                    </>
                  )}
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
              </>
            )}
          </div>

          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              After upload, analysis typically takes 2-5 minutes. You'll receive an email when your SDE Sheet is ready.
              Files are retained for 30 days.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Analysis History */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis History</CardTitle>
          <CardDescription>View and download your SDE Sheet analyses</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-muted-foreground mt-2">Loading analyses...</p>
            </div>
          ) : !analysesData?.analyses || analysesData.analyses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p>No analyses yet. Upload a file to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysesData.analyses.map((analysis) => {
                const daysLeft = analysis.expiresAt ? getDaysUntilExpiration(analysis.expiresAt) : null;
                const isExpiringSoon = daysLeft !== null && daysLeft <= 7;

                return (
                  <div
                    key={analysis.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <FileSpreadsheet className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        <span className="font-medium truncate">{analysis.originalFilename}</span>
                        {getStatusBadge(analysis.status)}
                        {isExpiringSoon && (
                          <Badge variant="outline" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Uploaded {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}</p>
                        {analysis.status === 'completed' && analysis.completedAt && (
                          <p>
                            Completed in {analysis.processingTimeSeconds}s •
                            Downloaded {analysis.downloadCount} time{analysis.downloadCount !== 1 ? 's' : ''}
                          </p>
                        )}
                        {analysis.status === 'failed' && analysis.errorMessage && (
                          <p className="text-red-600">Error: {analysis.errorMessage}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {analysis.status === 'completed' && analysis.resultFilename && (
                        <Button
                          size="sm"
                          onClick={() => handleDownload(analysis.id, analysis.resultFilename!)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(analysis.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
