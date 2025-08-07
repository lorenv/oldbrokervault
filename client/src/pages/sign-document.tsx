import React from 'react';
import { useRoute } from 'wouter';
import { DocumentSigner } from '@/components/esignature/document-signer';

export default function SignDocumentPage() {
  const [match, params] = useRoute('/sign/:accessToken');
  const accessToken = params?.accessToken;

  if (!accessToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h1>
          <p className="text-gray-600">This signing link is invalid or malformed.</p>
        </div>
      </div>
    );
  }

  return <DocumentSigner accessToken={accessToken} />;
}