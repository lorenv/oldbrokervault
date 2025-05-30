import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AddCustomSectionProps {
  docId: number;
  onSectionAdded: () => void;
}

const sectionOptions = [
  { value: "business-overview", label: "After Business Overview" },
  { value: "market-position", label: "After Market Position" },
  { value: "sales-revenue", label: "After Sales & Revenue" },
  { value: "operations", label: "After Operations" },
  { value: "team-management", label: "After Team Management" },
  { value: "products-inventory", label: "After Products & Inventory" },
  { value: "assets-infrastructure", label: "After Assets & Infrastructure" },
  { value: "ownership", label: "After Ownership" },
];

export function AddCustomSection({ docId, onSectionAdded }: AddCustomSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [insertAfter, setInsertAfter] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !insertAfter) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("POST", `/api/cim/${docId}/custom-sections`, {
        title: title.trim(),
        content: content.trim(),
        insertAfterSection: insertAfter,
      });

      toast({
        title: "Section Added",
        description: "Your custom section has been added successfully",
      });

      // Reset form
      setTitle("");
      setContent("");
      setInsertAfter("");
      setIsOpen(false);
      
      // Notify parent component
      onSectionAdded();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add custom section. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle("");
    setContent("");
    setInsertAfter("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="flex justify-center py-4">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Custom Section
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Add Custom Section</CardTitle>
          <Button
            onClick={handleCancel}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="section-title">Section Title</Label>
          <Input
            id="section-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter section title..."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="insert-after">Insert After Section</Label>
          <Select value={insertAfter} onValueChange={setInsertAfter}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose where to insert this section" />
            </SelectTrigger>
            <SelectContent>
              {sectionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="section-content">Section Content</Label>
          <Textarea
            id="section-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter the content for this section..."
            className="mt-1 min-h-[120px] resize-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isSubmitting ? "Adding..." : "Add Section"}
          </Button>
          <Button onClick={handleCancel} variant="outline">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}