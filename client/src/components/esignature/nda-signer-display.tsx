import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, PenTool, Users } from 'lucide-react';

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
                <PenTool className="w-6 h-6" />
              </div>
            </div>
            
            {/* Signer info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">NDA Signer</h3>
                <Badge className="bg-blue-100 text-blue-800">
                  <PenTool className="w-3 h-3 mr-1" />
                  Designated Signer
                </Badge>
              </div>
              
              <p className="text-gray-600 text-sm leading-relaxed">
                This represents whoever will sign the NDA when they access it through a share link. 
                All signature fields you place will be assigned to this designated signer.
              </p>
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <div className="font-medium mb-1">NDA Share Link Workflow:</div>
              <ul className="space-y-1 text-amber-700">
                <li>• When someone clicks your share link, they'll encounter this NDA first</li>
                <li>• They must complete all required signature fields to proceed</li>
                <li>• No pre-registration or email verification needed</li>
                <li>• Their signature information is captured securely with audit trails</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}