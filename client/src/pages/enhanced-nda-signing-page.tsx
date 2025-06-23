import React, { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import FillableNdaDocument from '@/components/fillable-nda-document';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface NdaTemplateData {
  id: number;
  name: string;
  fileContent: string;
  signatureFields: any[];
  documentTitle: string;
}

interface SignNdaResponse {
  success: boolean;
  message: string;
  requiresApproval: boolean;
  accessToken?: string;
  redirectUrl?: string;
}

export default function EnhancedNdaSigningPage() {
  const [match, params] = useRoute('/share/:shareSlug/sign-nda');
  const [isComplete, setIsComplete] = useState(false);
  const [signResponse, setSignResponse] = useState<SignNdaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const shareSlug = params?.shareSlug;
  
  // Get URL parameters for pre-filling name/email
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledName = urlParams.get('name') || '';
  const prefilledEmail = urlParams.get('email') || '';

  // Fetch NDA template data
  const { data: templateData, isLoading, error: fetchError } = useQuery<NdaTemplateData>({
    queryKey: ['/api/share', shareSlug, 'nda-template'],
    queryFn: async () => {
      console.log('=== FRONTEND API CALL ===');
      console.log('Fetching template for slug:', shareSlug);
      const url = `/api/share/${shareSlug}/nda-template`;
      console.log('API URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('API Error Response:', text.substring(0, 200));
        throw new Error(`Failed to fetch template: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Template data received:', data);
      console.log('=== END FRONTEND API CALL ===');
      return data;
    },
    enabled: !!shareSlug
  });

  // Sign NDA mutation
  const signNdaMutation = useMutation({
    mutationFn: async (fieldValues: Record<string, string>) => {
      console.log('=== FRONTEND NDA SIGNING DEBUG ===');
      console.log('Template data:', templateData);
      console.log('Signature fields:', templateData?.signatureFields);
      console.log('Field values received:', fieldValues);
      console.log('Prefilled name:', prefilledName);
      console.log('Prefilled email:', prefilledEmail);
      
      // Extract required values from field data or URL parameters
      const nameField = templateData?.signatureFields.find(f => f.type === 'name');
      const emailField = templateData?.signatureFields.find(f => f.type === 'email');
      
      console.log('Name field found:', nameField);
      console.log('Email field found:', emailField);
      
      // Use field values if available, otherwise fall back to URL parameters
      const signerName = nameField ? fieldValues[nameField.id] : prefilledName || 'Unknown';
      const signerEmail = emailField ? fieldValues[emailField.id] : prefilledEmail || '';

      console.log('Final signer name:', signerName);
      console.log('Final signer email:', signerEmail);
      console.log('=== END FRONTEND DEBUG ===');
      console.log('NDA signing request data:', { signerName, signerEmail, fieldValues });

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
      console.log('NDA signed successfully:', data);
      setSignResponse(data);
      setIsComplete(true);
      // No automatic redirect - user will check email for access link
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
    const requiresApproval = signResponse?.requiresApproval;
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Document Signed Successfully</h2>
            
            {requiresApproval ? (
              <div>
                <p className="text-gray-600 mb-4">
                  Your signature has been recorded and sent to the document owner for approval.
                </p>
                <p className="text-sm text-blue-600 font-medium">
                  You will receive an email notification once your access is approved.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">
                  Your signature has been recorded successfully.
                </p>
                <p className="text-sm text-blue-600 font-medium">
                  Please check your email for the link to access the document.
                </p>
              </div>
            )}
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

  // Convert base64 NDA content to displayable format
  const ndaContent = templateData.fileContent 
    ? `<p>Please review the NDA document and fill in the required fields below.</p>`
    : 'No NDA content available';

  return (
    <FillableNdaDocument
      documentTitle={templateData.documentTitle || 'Non-Disclosure Agreement'}
      ndaContent={templateData.fileContent || ''}
      signatureFields={templateData.signatureFields || []}
      onSubmit={signNdaMutation.mutateAsync}
      isLoading={signNdaMutation.isPending}
      prefilledName={prefilledName}
      prefilledEmail={prefilledEmail}
    />
  );
}