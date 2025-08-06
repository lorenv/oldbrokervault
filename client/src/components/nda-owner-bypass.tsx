import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Crown, ArrowRight } from 'lucide-react';

interface NdaOwnerBypassProps {
  onComplete: () => void;
  documentTitle: string;
}

export function NdaOwnerBypass({ onComplete, documentTitle }: NdaOwnerBypassProps) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
      <Card className="max-w-lg animate-in fade-in-0 zoom-in-95 duration-500">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-xl text-gray-800">NDA Bypass - Document Owner</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-blue-600 mb-4">
            <Crown className="h-5 w-5" />
            <span className="font-semibold">Owner Access</span>
          </div>
          
          <p className="text-gray-600">
            As the owner of <strong>{documentTitle}</strong>, you don't need to sign the NDA.
          </p>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-700 mb-2">
              Redirecting to your document in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <span className="text-sm">Loading document</span>
              <ArrowRight className="h-4 w-4 animate-pulse" />
            </div>
          </div>
          
          <p className="text-xs text-gray-500">
            You'll see this document exactly as your viewers do, plus an owner toolbar for quick access to analytics and settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}