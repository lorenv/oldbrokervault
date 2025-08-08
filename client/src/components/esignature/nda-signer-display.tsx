import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText } from 'lucide-react';

interface NdaSignerDisplayProps {
  className?: string;
}

export default function NdaSignerDisplay({ className = '' }: NdaSignerDisplayProps) {
  return (
    <Card className={`${className} border-0`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Document Signer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Single designated placeholder signer */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-900">NDA Signer</h3>
          </div>
          <p className="text-gray-600 text-sm leading-relaxed">
            This represents whoever will sign the NDA when they access it through a share link.
            All signature fields you place will be assigned to this designated signer.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}