import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText } from 'lucide-react';

interface NdaSignerDisplayProps {
  className?: string;
}

export default function NdaSignerDisplay({ className = '' }: NdaSignerDisplayProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Document Signer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Single designated placeholder signer */}
        <div className="p-6 border-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start gap-4">
            {/* Signer indicator */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            {/* Signer info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">NDA Signer</h3>
              </div>

              <p className="text-gray-600 text-sm leading-relaxed">
                This represents whoever will sign the NDA when they access it through a share link.
                All signature fields you place will be assigned to this designated signer.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}