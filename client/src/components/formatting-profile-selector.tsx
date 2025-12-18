import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { getFormattingConfig, type FormattingProfile, FORMATTING_PROFILES } from '@shared/formatting-config';
import { ListChecks, Scale, FileText, BookOpen, Pencil, Check, Save, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

// Custom style configuration type
export interface CustomStyleConfig {
  name: string;
  wordCountTarget: number;
  useBullets: boolean;
  useNumberedLists: boolean;
  useTables: boolean;
  toneDescription: string;
}

interface FormattingProfileSelectorProps {
  value: FormattingProfile;
  onChange: (profile: FormattingProfile) => void;
  className?: string;
  showPreview?: boolean;
  customStyleConfig?: CustomStyleConfig | null;
  onCustomStyleConfigChange?: (config: CustomStyleConfig | null) => void;
  savedCustomStyles?: CustomStyleConfig[];
  onSaveCustomStyle?: (config: CustomStyleConfig) => void;
  onDeleteCustomStyle?: (name: string) => void;
}

interface StyleCardData {
  profile: FormattingProfile | 'custom';
  title: string;
  shortDescription: string;
  fullDescription: string;
  wordCount: string;
  features: string[];
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconColor: string;
}

const DEFAULT_CUSTOM_CONFIG: CustomStyleConfig = {
  name: '',
  wordCountTarget: 1000,
  useBullets: true,
  useNumberedLists: true,
  useTables: true,
  toneDescription: '',
};

export function FormattingProfileSelector({
  value,
  onChange,
  className = "",
  customStyleConfig = null,
  onCustomStyleConfigChange,
  savedCustomStyles = [],
  onSaveCustomStyle,
  onDeleteCustomStyle
}: FormattingProfileSelectorProps) {
  const { toast } = useToast();
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<CustomStyleConfig>(DEFAULT_CUSTOM_CONFIG);
  const [isCustomActive, setIsCustomActive] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Sync isCustomActive with customStyleConfig
  useEffect(() => {
    setIsCustomActive(customStyleConfig !== null);
  }, [customStyleConfig]);

  const styleCards: StyleCardData[] = [
    {
      profile: 'memo',
      title: 'Bullets',
      shortDescription: 'Quick & scannable',
      fullDescription: 'Concise bullet points and short sentences. Perfect for executive summaries and quick overviews. Uses numbered lists for sequential information and bold emphasis for key terms.',
      wordCount: '~800',
      features: ['Bullet points', 'Short sentences', 'Numbered lists'],
      icon: ListChecks,
      gradient: 'from-emerald-50 to-teal-50 border-emerald-200 hover:border-emerald-400',
      iconColor: 'text-emerald-600'
    },
    {
      profile: 'balanced',
      title: 'Balanced',
      shortDescription: 'Best of both worlds',
      fullDescription: 'A balanced mix of paragraphs and bullet lists. Industry standard format that combines narrative flow with scannable key points. Ideal for most business documents.',
      wordCount: '~1,000',
      features: ['Mixed format', 'Lists + paragraphs', 'Clear structure'],
      icon: Scale,
      gradient: 'from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400',
      iconColor: 'text-blue-600'
    },
    {
      profile: 'professional',
      title: 'Paragraphs',
      shortDescription: 'Flowing narrative',
      fullDescription: 'Clean, formal writing with structured paragraphs and no bullet points. Creates a sophisticated, flowing narrative ideal for formal investor presentations and professional CIMs.',
      wordCount: '~1,200',
      features: ['Pure paragraphs', 'Formal tone', 'No bullets'],
      icon: BookOpen,
      gradient: 'from-violet-50 to-purple-50 border-violet-200 hover:border-violet-400',
      iconColor: 'text-violet-600'
    },
    {
      profile: 'robust',
      title: 'Robust',
      shortDescription: 'Comprehensive detail',
      fullDescription: 'Detailed, in-depth analysis with rich formatting. Includes thorough explanations, comprehensive lists, and detailed tables. Best for due diligence documents and detailed analysis.',
      wordCount: '~1,800',
      features: ['Detailed analysis', 'Rich formatting', 'Tables included'],
      icon: FileText,
      gradient: 'from-amber-50 to-orange-50 border-amber-200 hover:border-amber-400',
      iconColor: 'text-amber-600'
    }
  ];

  const handleCardClick = (profile: FormattingProfile | 'custom') => {
    if (profile === 'custom') {
      // Pre-populate with current custom config or defaults
      setTempConfig(customStyleConfig || DEFAULT_CUSTOM_CONFIG);
      setCustomDialogOpen(true);
    } else {
      setIsCustomActive(false);
      if (onCustomStyleConfigChange) {
        onCustomStyleConfigChange(null);
      }
      onChange(profile);
    }
  };

  const handleApplyCustom = () => {
    if (!tempConfig.toneDescription.trim()) {
      toast({
        title: "Style Description Required",
        description: "Please describe how you want the AI to write.",
        variant: "destructive"
      });
      return;
    }

    if (onCustomStyleConfigChange) {
      onCustomStyleConfigChange(tempConfig);
    }
    setIsCustomActive(true);
    // Use balanced as the base profile when custom is active
    onChange('balanced');
    setCustomDialogOpen(false);
    setShowSavePreset(false);
  };

  const handleSavePreset = () => {
    if (!savePresetName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your style preset.",
        variant: "destructive"
      });
      return;
    }

    if (onSaveCustomStyle) {
      onSaveCustomStyle({ ...tempConfig, name: savePresetName });
      toast({
        title: "Style Saved",
        description: `"${savePresetName}" has been saved to your presets.`
      });
      setSavePresetName('');
      setShowSavePreset(false);
    }
  };

  const handleLoadPreset = (preset: CustomStyleConfig) => {
    setTempConfig(preset);
    setSavePresetName(preset.name);
  };

  const isSelected = (profile: FormattingProfile | 'custom') => {
    if (profile === 'custom') {
      return isCustomActive;
    }
    return value === profile && !isCustomActive;
  };

  const getWordCountLabel = (count: number) => {
    if (count <= 600) return 'Brief';
    if (count <= 900) return 'Concise';
    if (count <= 1200) return 'Standard';
    if (count <= 1500) return 'Detailed';
    return 'Comprehensive';
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`space-y-4 ${className}`}>
        <div className="space-y-1">
          <Label className="text-lg font-semibold text-slate-700 flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Writing Style
          </Label>
          <p className="text-sm text-muted-foreground">
            Choose how the AI writes your content - from quick bullet points to comprehensive narratives.
          </p>
        </div>

        {/* Horizontal Card Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {styleCards.map((card) => {
            const Icon = card.icon;
            const selected = isSelected(card.profile);

            return (
              <Tooltip key={card.profile}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleCardClick(card.profile)}
                    className={cn(
                      "relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200",
                      "hover:shadow-md hover:-translate-y-0.5",
                      `bg-gradient-to-br ${card.gradient}`,
                      selected ? "ring-2 ring-offset-2 ring-blue-500 border-blue-500" : ""
                    )}
                  >
                    {/* Selection checkmark */}
                    {selected && (
                      <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Icon */}
                    <Icon className={cn("h-8 w-8 mb-2", card.iconColor)} />

                    {/* Title */}
                    <h4 className="font-semibold text-gray-800 text-sm">{card.title}</h4>

                    {/* Short description */}
                    <p className="text-xs text-gray-500 text-center mt-1">{card.shortDescription}</p>

                    {/* Word count badge */}
                    <Badge
                      variant="secondary"
                      className="mt-2 text-[10px] px-2 py-0.5 bg-white/60 text-gray-600"
                    >
                      {card.wordCount} words
                    </Badge>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="max-w-xs p-4 bg-white shadow-lg border"
                  sideOffset={8}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-5 w-5", card.iconColor)} />
                      <span className="font-semibold">{card.title}</span>
                      <Badge variant="outline" className="text-[10px]">{card.wordCount}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{card.fullDescription}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {card.features.map((feature, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[10px]">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Custom Style Card */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleCardClick('custom')}
                className={cn(
                  "relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200",
                  "hover:shadow-md hover:-translate-y-0.5",
                  "bg-gradient-to-br from-gray-50 to-slate-100 border-gray-200 hover:border-gray-400",
                  "border-dashed",
                  isCustomActive ? "ring-2 ring-offset-2 ring-blue-500 border-blue-500 border-solid" : ""
                )}
              >
                {isCustomActive && (
                  <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-0.5">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}

                <Pencil className="h-8 w-8 mb-2 text-gray-500" />
                <h4 className="font-semibold text-gray-800 text-sm">Custom</h4>
                <p className="text-xs text-gray-500 text-center mt-1">Define your voice</p>
                <Badge
                  variant="secondary"
                  className="mt-2 text-[10px] px-2 py-0.5 bg-white/60 text-gray-600"
                >
                  Your style
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-xs p-4 bg-white shadow-lg border"
              sideOffset={8}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-gray-500" />
                  <span className="font-semibold">Custom Style</span>
                </div>
                <p className="text-sm text-gray-600">
                  Build your own writing style. Configure word count, formatting options, and describe your preferred tone and voice.
                </p>
                {customStyleConfig && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500 font-medium">Current settings:</p>
                    <p className="text-xs text-gray-600 mt-1">~{customStyleConfig.wordCountTarget} words</p>
                    <p className="text-xs text-gray-600 line-clamp-2">{customStyleConfig.toneDescription}</p>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Show active custom style indicator */}
        {isCustomActive && customStyleConfig && (
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-3 mt-3">
            <div className="flex items-start gap-3">
              <Pencil className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium text-gray-600">Custom Style Active</p>
                  <Badge variant="outline" className="text-[10px]">~{customStyleConfig.wordCountTarget} words</Badge>
                  {customStyleConfig.useBullets && <Badge variant="secondary" className="text-[10px]">Bullets</Badge>}
                  {customStyleConfig.useNumberedLists && <Badge variant="secondary" className="text-[10px]">Lists</Badge>}
                  {customStyleConfig.useTables && <Badge variant="secondary" className="text-[10px]">Tables</Badge>}
                </div>
                <p className="text-sm text-gray-700 mt-1 line-clamp-2">{customStyleConfig.toneDescription}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setTempConfig(customStyleConfig);
                  setCustomDialogOpen(true);
                }}
              >
                Edit
              </Button>
            </div>
          </div>
        )}

        {/* Custom Style Configuration Dialog */}
        <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-gray-500" />
                Custom Writing Style
              </DialogTitle>
              <DialogDescription>
                Configure exactly how you want the AI to write your CIM.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Saved Presets */}
              {savedCustomStyles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Load Saved Style</Label>
                  <div className="flex flex-wrap gap-2">
                    {savedCustomStyles.map((preset) => (
                      <div key={preset.name} className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleLoadPreset(preset)}
                        >
                          {preset.name}
                        </Button>
                        {onDeleteCustomStyle && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                            onClick={() => onDeleteCustomStyle(preset.name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-4" />
                </div>
              )}

              {/* Word Count Target */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Target Word Count</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {getWordCountLabel(tempConfig.wordCountTarget)}
                    </Badge>
                    <span className="text-sm font-medium text-blue-600">~{tempConfig.wordCountTarget}</span>
                  </div>
                </div>
                <Slider
                  value={[tempConfig.wordCountTarget]}
                  onValueChange={([val]) => setTempConfig({ ...tempConfig, wordCountTarget: val })}
                  min={400}
                  max={2000}
                  step={100}
                  className="py-2"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Brief (400)</span>
                  <span>Standard (1000)</span>
                  <span>Detailed (2000)</span>
                </div>
              </div>

              <Separator />

              {/* Formatting Options */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Formatting Options</Label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Bullet Points */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="bullets" className="text-sm font-medium cursor-pointer">
                        Bullet Points
                      </Label>
                      <p className="text-xs text-gray-500">Use • for key points</p>
                    </div>
                    <Switch
                      id="bullets"
                      checked={tempConfig.useBullets}
                      onCheckedChange={(checked) => setTempConfig({ ...tempConfig, useBullets: checked })}
                    />
                  </div>

                  {/* Numbered Lists */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="numbered" className="text-sm font-medium cursor-pointer">
                        Numbered Lists
                      </Label>
                      <p className="text-xs text-gray-500">Use 1. 2. 3. for steps</p>
                    </div>
                    <Switch
                      id="numbered"
                      checked={tempConfig.useNumberedLists}
                      onCheckedChange={(checked) => setTempConfig({ ...tempConfig, useNumberedLists: checked })}
                    />
                  </div>

                  {/* Tables */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="tables" className="text-sm font-medium cursor-pointer">
                        Data Tables
                      </Label>
                      <p className="text-xs text-gray-500">Include formatted tables</p>
                    </div>
                    <Switch
                      id="tables"
                      checked={tempConfig.useTables}
                      onCheckedChange={(checked) => setTempConfig({ ...tempConfig, useTables: checked })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tone Description */}
              <div className="space-y-3">
                <Label htmlFor="tone" className="text-sm font-medium">
                  Writing Voice & Tone <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="tone"
                  value={tempConfig.toneDescription}
                  onChange={(e) => setTempConfig({ ...tempConfig, toneDescription: e.target.value })}
                  placeholder="Describe how you want the AI to write. Be specific about tone, style, vocabulary, and any preferences..."
                  className="min-h-[100px]"
                />
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-800 mb-2">Examples:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      "Write like a McKinsey consultant - precise, data-driven, strategic",
                      "Conversational but professional, emphasize growth story",
                      "Formal investment banking style with strong metrics focus",
                      "Clear and direct, avoid jargon, focus on value creation"
                    ].map((example, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTempConfig({ ...tempConfig, toneDescription: example })}
                        className="text-left text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100 p-2 rounded transition-colors"
                      >
                        "{example}"
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save as Preset */}
              {onSaveCustomStyle && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {!showSavePreset ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowSavePreset(true)}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save as Preset
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={savePresetName}
                          onChange={(e) => setSavePresetName(e.target.value)}
                          placeholder="Preset name (e.g., 'My Agency Style')"
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={handleSavePreset}
                          disabled={!savePresetName.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowSavePreset(false);
                            setSavePresetName('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => setCustomDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleApplyCustom}
                disabled={!tempConfig.toneDescription.trim()}
              >
                Apply Custom Style
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
