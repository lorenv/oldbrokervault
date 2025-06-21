import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import EnhancedNdaClickwrap from '@/components/enhanced-nda-clickwrap';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface NdaTemplateData {
  id: number;
  name: string;
  fileContent: string;
  signatureFields: any[];
  documentTitle: string;
}

export default function EnhancedNdaSigningPage() {
  const [match, params] = useRoute('/share/:shareSlug/sign-nda');
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const shareSlug = params?.shareSlug;

  // Fetch NDA template data
  const { data: templateData, isLoading, error: fetchError } = useQuery<NdaTemplateData>({
    queryKey: ['/api/share', shareSlug, 'nda-template'],
    queryFn: async () => {
      const response = await fetch(`/api/share/${shareSlug}/nda-template`);
      if (!response.ok) {
        throw new Error('Failed to fetch NDA template');
      }
      return response.json();
    },
    enabled: !!shareSlug
  });

  // Sign NDA mutation
  const signNdaMutation = useMutation({
    mutationFn: async (fieldValues: Record<string, string>) => {
      // Extract required values from field data
      const nameField = templateData?.signatureFields.find(f => f.type === 'name');
      const emailField = templateData?.signatureFields.find(f => f.type === 'email');
      
      const signerName = nameField ? fieldValues[nameField.id] : 'Unknown';
      const signerEmail = emailField ? fieldValues[emailField.id] : '';

      const response = await fetch(`/api/share/${shareSlug}/sign-nda`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signerName,
          signerEmail,
          fieldValues
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign NDA');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setIsComplete(true);
      
      // If manual approval is required, show different success message
      if (data.requiresApproval) {
        // The success message is already shown by the clickwrap component
      }
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to sign NDA');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !templateData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
            <p className="text-gray-600 mb-4">
              {fetchError?.message || 'The requested document could not be found or may have expired.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Document Signed Successfully</h2>
            <p className="text-gray-600">
              Your signature has been recorded and the document owner has been notified.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Signing Failed</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-primary hover:underline"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Debug: Log the template data to see what we're receiving
  console.log('🔍 Template data received:', templateData);
  console.log('📋 Signature fields:', templateData?.signatureFields);

  // Render the enhanced clickwrap interface
  const ndaContent = templateData.fileContent 
    ? `<iframe src="data:application/pdf;base64,${templateData.fileContent}" width="100%" height="400px"></iframe>`
    : '<p>NDA content not available</p>';

  return (
    <div className="min-h-screen bg-gray-50">
      <EnhancedNdaClickwrap
        documentTitle={templateData.documentTitle}
        ndaContent={ndaContent}
        signatureFields={templateData.signatureFields || []}
        onSign={signNdaMutation.mutateAsync}
        isLoading={signNdaMutation.isPending}
      />
    </div>
  );
}