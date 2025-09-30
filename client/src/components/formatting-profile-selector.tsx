import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  const selectedProfileData = profiles.find(p => p.profile === value);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-1">
        <Label className="text-lg font-semibold text-slate-700">Writing Style</Label>
        <p className="text-sm text-muted-foreground">
          Choose the tone and format for your document.
        </p>
      </div>

      <Select value={value} onValueChange={(val) => onChange(val as FormattingProfile)}>
        <SelectTrigger className="w-full h-auto py-3">
          <SelectValue placeholder="Select a writing style" />
        </SelectTrigger>
        <SelectContent className="max-w-md">
          {profiles.map(({ profile, title, description, features, wordCount }) => (
            <SelectItem key={profile} value={profile} className="py-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">{title}</span>
                  <span className="text-xs text-muted-foreground">• {wordCount}</span>
                </div>
                <span className="text-xs text-muted-foreground">{description}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {features.slice(0, 3).map((feature, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}