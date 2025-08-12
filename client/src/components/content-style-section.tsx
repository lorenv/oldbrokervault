import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { FormattingProfileSelector } from "./formatting-profile-selector";
import type { FormattingProfile } from "@shared/formatting-config";

interface SectionLine {
  id: string;
  content: string;
}

interface ContentStyleSectionProps {
  sectionDirections: SectionLine[];
  onSectionDirectionsChange: (directions: SectionLine[]) => void;
  formattingProfile: FormattingProfile;
  onFormattingProfileChange: (profile: FormattingProfile) => void;
}

export function ContentStyleSection({
  sectionDirections,
  onSectionDirectionsChange,
  formattingProfile,
  onFormattingProfileChange
}: ContentStyleSectionProps) {
  
  const updateSectionLine = (index: number, content: string) => {
    const updated = [...sectionDirections];
    updated[index] = { ...updated[index], content };
    onSectionDirectionsChange(updated);
  };

  const addSectionLine = () => {
    const newLine: SectionLine = {
      id: Date.now().toString(),
      content: ""
    };
    onSectionDirectionsChange([...sectionDirections, newLine]);
  };

  const removeSectionLine = (index: number) => {
    if (sectionDirections.length > 1) {
      const updated = sectionDirections.filter((_, i) => i !== index);
      onSectionDirectionsChange(updated);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content & Style</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section Directions */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Section Directions</Label>
          <p className="text-sm text-muted-foreground">
            Define what sections to generate and their specific requirements. You can add, edit, or remove lines as needed.
          </p>
          <div className="space-y-3">
            {sectionDirections.map((line, index) => (
              <div key={line.id} className="flex items-center space-x-2">
                <Input
                  value={line.content}
                  onChange={(e) => updateSectionLine(index, e.target.value)}
                  placeholder="Section Name - Description of what to include..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeSectionLine(index)}
                  className="shrink-0"
                  disabled={sectionDirections.length <= 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={addSectionLine}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>
        </div>

        {/* Formatting Style */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Choose Formatting Style</Label>
          <p className="text-sm text-muted-foreground">
            Select how you want your AI-generated content to be formatted and structured. This affects both the editor toolbar and how the AI writes content.
          </p>
          <FormattingProfileSelector
            selectedProfile={formattingProfile}
            onProfileChange={onFormattingProfileChange}
            showPreview={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}