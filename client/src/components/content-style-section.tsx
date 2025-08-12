
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X, Settings2 } from "lucide-react";
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
    <div className="space-y-0">
      <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
        <Settings2 className="h-5 w-5" />
        <div>
          <h3 className="font-semibold">Content & Style</h3>
          <p className="text-sm text-slate-200">Customize your CIM structure and formatting</p>
        </div>
      </div>

      <div className="space-y-6 p-4 border border-t-0 rounded-b-lg bg-white">
        {/* Section Directions */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Section Directions</Label>
          <p className="text-sm text-muted-foreground">
            Define what sections to generate and their specific requirements.
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
          <FormattingProfileSelector
            selectedProfile={formattingProfile}
            onProfileChange={onFormattingProfileChange}
            showPreview={false}
          />
        </div>
      </div>
    </div>
  );
}
