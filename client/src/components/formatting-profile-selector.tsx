import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getFormattingConfig, type FormattingProfile, FORMATTING_PROFILES } from '@shared/formatting-config';
import { CheckCircle, Circle } from 'lucide-react';

interface FormattingProfileSelectorProps {
  value: FormattingProfile;
  onChange: (profile: FormattingProfile) => void;
  className?: string;
  showPreview?: boolean;
}

export function FormattingProfileSelector({
  value,
  onChange,
  className = "",
  showPreview = true
}: FormattingProfileSelectorProps) {
  const [previewProfile, setPreviewProfile] = useState<FormattingProfile | null>(null);

  // Remove conversational option as requested
  const profiles: Array<{
    profile: FormattingProfile;
    title: string;
    description: string;
    features: string[];
    wordCount: string;
    bestFor: string;
  }> = [
    {
      profile: 'balanced',
      title: 'Balanced',
      description: 'Mix of paragraphs and lists for comprehensive coverage',
      features: ['Mixed format', 'Moderate length', 'Lists + paragraphs', 'Clear structure'],
      wordCount: '800-1200 words',
      bestFor: 'General business documents'
    },
    {
      profile: 'professional',
      title: 'Professional',
      description: 'Clean, formal documents with structured paragraphs',
      features: ['Paragraph format only', 'Minimal formatting', 'Bold for key terms', 'Italic for market terms'],
      wordCount: '1000-1200 words',
      bestFor: 'Investor presentations, formal CIMs'
    },
    {
      profile: 'memo',
      title: 'Memo Style',
      description: 'Concise, scannable format with bullet points',
      features: ['Bullet points', 'Short sentences', 'Numbered lists', 'Bold emphasis'],
      wordCount: 'Under 800 words',
      bestFor: 'Quick overviews, executive summaries'
    },
    {
      profile: 'robust',
      title: 'Robust',
      description: 'Detailed analysis with comprehensive formatting',
      features: ['Detailed paragraphs', 'Rich formatting', 'Tables supported', 'Comprehensive lists'],
      wordCount: '1200-1800 words',
      bestFor: 'Due diligence, detailed analysis'
    }
  ];

  const currentProfile = previewProfile || value;
  const config = getFormattingConfig(currentProfile);

  const formatFeatures = () => {
    const features: string[] = [];
    if (config.bold) features.push('Bold text');
    if (config.italic) features.push('Italic text');
    if (config.bulletLists) features.push('Bullet lists');
    if (config.orderedLists) features.push('Numbered lists');
    if (config.tables) features.push('Tables');
    if (config.headings) features.push('Headings');
    if (config.blockquotes) features.push('Blockquotes');
    return features;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-base font-medium mb-2">Formatting Style</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select how you want your AI-generated content to be formatted and structured.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map(({ profile, title, description, features, wordCount, bestFor }) => {
          const isSelected = value === profile;
          const isPreview = previewProfile === profile;
          
          return (
            <Card
              key={profile}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 
                isPreview ? 'ring-1 ring-gray-300 bg-gray-50' : ''
              }`}
              onMouseEnter={() => setPreviewProfile(profile)}
              onMouseLeave={() => setPreviewProfile(null)}
              onClick={() => onChange(profile)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isSelected ? (
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-400" />
                    )}
                    {title}
                  </CardTitle>
                </div>
                <CardDescription className="text-sm">
                  {description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-1">Features:</div>
                  <div className="flex flex-wrap gap-1">
                    {features.map((feature, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">
                    <strong>Length:</strong> {wordCount}
                  </div>
                  <div className="text-xs text-gray-600">
                    <strong>Best for:</strong> {bestFor}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}