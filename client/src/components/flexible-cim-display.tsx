import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, Copy, Share2, Eye, Edit, Clock } from "lucide-react";
import { DocumentExport } from './document-export';
import ReactMarkdown from 'react-markdown';

interface FlexibleCimSection {
  id: string;
  title: string;
  content: string;
  order: number;
  type: 'text' | 'table' | 'list';
}

interface FlexibleCimDocument {
  title: string;
  companyName?: string;
  generatedAt: string;
  sections: FlexibleCimSection[];
  metadata: {
    purpose: string;
    tone: string;
    audience: string;
    customDirections: string;
    wordCount: number;
    hasFinancials: boolean;
    hasImages: boolean;
  };
}

interface FlexibleCimDisplayProps {
  document: FlexibleCimDocument;
  docId: number;
  websiteUrl?: string;
  logoUrl?: string;
  selectedImages?: string[];
  title: string;
}

export function FlexibleCimDisplay({
  document,
  docId,
  websiteUrl,
  logoUrl,
  selectedImages,
  title
}: FlexibleCimDisplayProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);

  const formatContent = (content: string, type: string) => {
    switch (type) {
      case 'table':
        // Convert markdown tables to HTML tables
        return <ReactMarkdown className="prose prose-sm max-w-none">{content}</ReactMarkdown>;
      case 'list':
        return <ReactMarkdown className="prose prose-sm max-w-none">{content}</ReactMarkdown>;
      default:
        return <ReactMarkdown className="prose prose-sm max-w-none">{content}</ReactMarkdown>;
    }
  };

  const getAudienceLabel = (audience: string) => {
    const labels = {
      investors: "Investors",
      partners: "Business Partners", 
      internal_team: "Internal Team",
      potential_buyers: "Potential Buyers"
    };
    return labels[audience as keyof typeof labels] || audience;
  };

  const getPurposeLabel = (purpose: string) => {
    const labels = {
      business_overview: "Business Overview",
      equity_raise: "Equity Raise",
      acquisition_summary: "Acquisition Summary",
      partnership_brief: "Partnership Brief"
    };
    return labels[purpose as keyof typeof labels] || purpose;
  };

  return (
    <div className="space-y-6">
      {/* Document Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{document.title}</CardTitle>
              {document.companyName && (
                <p className="text-lg text-muted-foreground">{document.companyName}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{getPurposeLabel(document.metadata.purpose)}</Badge>
                <Badge variant="outline">{document.metadata.tone}</Badge>
                <Badge variant="outline">{getAudienceLabel(document.metadata.audience)}</Badge>
                <Badge variant="secondary">
                  <FileText className="w-3 h-3 mr-1" />
                  {document.metadata.wordCount} words
                </Badge>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsExportOpen(true)}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Generated {new Date(document.generatedAt).toLocaleDateString()}
            </div>
            {document.metadata.hasFinancials && (
              <Badge variant="outline" className="text-xs">
                Includes Financials
              </Badge>
            )}
            {document.metadata.hasImages && (
              <Badge variant="outline" className="text-xs">
                Includes Images
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Company Logo */}
      {logoUrl && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <img 
                src={logoUrl} 
                alt="Company Logo" 
                className="max-h-20 w-auto object-contain"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Sections */}
      <div className="space-y-6">
        {document.sections
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {formatContent(section.content, section.type)}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Selected Images */}
      {selectedImages && selectedImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Business Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {selectedImages.map((imageUrl, index) => (
                <div key={index} className="aspect-square">
                  <img
                    src={imageUrl}
                    alt={`Business image ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analysis Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Custom Directions Used:</h4>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              {document.metadata.customDirections.length > 200 
                ? `${document.metadata.customDirections.substring(0, 200)}...`
                : document.metadata.customDirections
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Export Component */}
      {isExportOpen && (
        <DocumentExport
          docId={docId}
          analysis={document}
          title={title}
          onClose={() => setIsExportOpen(false)}
          websiteUrl={websiteUrl}
          logoUrl={logoUrl}
          selectedImages={selectedImages}
        />
      )}
    </div>
  );
}