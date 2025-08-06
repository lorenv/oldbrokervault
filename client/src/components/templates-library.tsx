import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Template {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: string;
}

interface TemplatesLibraryProps {
  onSelectTemplate: (template: Template) => void;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'business_overview',
    title: 'Business Overview',
    description: 'Comprehensive business overview for potential stakeholders',
    category: 'Standard',
    prompt: `Create a comprehensive business overview document that provides a complete picture of the company for potential stakeholders. Focus on:

1. Business Summary - Clear description of what the company does, its value proposition, and market position
2. Market Opportunity - Size of market, growth trends, and competitive landscape
3. Business Model - How the company generates revenue and key success factors
4. Operations - Key processes, suppliers, customers, and operational strengths
5. Financial Overview - Revenue trends, profitability, and key financial metrics
6. Growth Opportunities - Areas for expansion and potential value creation
7. Management & Team - Key personnel and organizational structure
8. Investment Highlights - Key reasons why this business is attractive

Write in a professional tone suitable for investors and business partners. Include specific details from the transcript and avoid generic statements.`
  }
];

export function TemplatesLibrary({ onSelectTemplate }: TemplatesLibraryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const handleSelectTemplate = (template: Template) => {
    onSelectTemplate(template);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FolderOpen className="h-4 w-4" />
          Templates Library
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Templates Library
          </DialogTitle>
          <DialogDescription>
            Choose from pre-built templates to get started quickly with your CIM generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4">
            {DEFAULT_TEMPLATES.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        {template.title}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {template.category}
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleSelectTemplate(template)}
                      size="sm"
                      className="ml-4"
                    >
                      Use Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {template.description}
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 mb-2">
                      View template prompt
                    </summary>
                    <div className="bg-gray-50 p-3 rounded border text-gray-700 whitespace-pre-wrap font-mono text-xs">
                      {template.prompt}
                    </div>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>

          {DEFAULT_TEMPLATES.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No templates available yet.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}