import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormattingProfileSelector } from "./formatting-profile-selector";
import type { FormattingProfile } from "@shared/formatting-config";
import { DEFAULT_SECTION_DIRECTIONS } from "@shared/schema";

interface ContentStyleSectionProps {
  sectionDirections: {
    businessSummary?: string;
    marketOpportunity?: string;
    businessModel?: string;
    operations?: string;
    growthOpportunities?: string;
    managementTeam?: string;
  };
  onSectionDirectionsChange: (directions: typeof sectionDirections) => void;
  formattingProfile: FormattingProfile;
  onFormattingProfileChange: (profile: FormattingProfile) => void;
}

export function ContentStyleSection({
  sectionDirections,
  onSectionDirectionsChange,
  formattingProfile,
  onFormattingProfileChange
}: ContentStyleSectionProps) {
  const sections = [
    { key: 'businessSummary', label: 'Business Summary', defaultValue: DEFAULT_SECTION_DIRECTIONS.businessSummary },
    { key: 'marketOpportunity', label: 'Market Opportunity', defaultValue: DEFAULT_SECTION_DIRECTIONS.marketOpportunity },
    { key: 'businessModel', label: 'Business Model', defaultValue: DEFAULT_SECTION_DIRECTIONS.businessModel },
    { key: 'operations', label: 'Operations', defaultValue: DEFAULT_SECTION_DIRECTIONS.operations },
    { key: 'growthOpportunities', label: 'Growth Opportunities', defaultValue: DEFAULT_SECTION_DIRECTIONS.growthOpportunities },
    { key: 'managementTeam', label: 'Management & Team', defaultValue: DEFAULT_SECTION_DIRECTIONS.managementTeam }
  ];

  const handleSectionChange = (key: string, value: string) => {
    onSectionDirectionsChange({
      ...sectionDirections,
      [key]: value
    });
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
            Customize what should be included in each section of your CIM document:
          </p>
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.key} className="space-y-2">
                <Label htmlFor={section.key} className="text-sm font-medium">
                  {section.label}
                </Label>
                <Input
                  id={section.key}
                  value={sectionDirections[section.key as keyof typeof sectionDirections] || section.defaultValue}
                  onChange={(e) => handleSectionChange(section.key, e.target.value)}
                  placeholder={section.defaultValue}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Formatting Style */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Formatting Style</Label>
          <FormattingProfileSelector
            selectedProfile={formattingProfile}
            onProfileChange={onFormattingProfileChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}