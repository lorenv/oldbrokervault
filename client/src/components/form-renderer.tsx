import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export interface FormQuestion {
  id: string;
  text: string;
  type: string;
  options?: string[];
  required: boolean;
  section?: string;
  placeholder?: string;
}

interface FormRendererProps {
  questions: FormQuestion[];
  values: Record<string, any>;
  onChange: (questionId: string, value: any) => void;
  groupBySection?: boolean;
  disabled?: boolean;
}

export function FormRenderer({
  questions,
  values,
  onChange,
  groupBySection = false,
  disabled = false,
}: FormRendererProps) {
  // Group by section if enabled
  const sections: { section: string; questions: FormQuestion[] }[] = [];
  if (groupBySection) {
    const sectionMap = new Map<string, FormQuestion[]>();
    for (const q of questions) {
      const sec = q.section || "General";
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push(q);
    }
    sectionMap.forEach((qs, section) => {
      sections.push({ section, questions: qs });
    });
  } else {
    sections.push({ section: "", questions });
  }

  const renderField = (q: FormQuestion) => {
    const value = values[q.id];

    switch (q.type) {
      case "text":
        return (
          <Input
            value={value || ""}
            onChange={(e) => onChange(q.id, e.target.value)}
            placeholder={q.placeholder || ""}
            disabled={disabled}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => onChange(q.id, e.target.value)}
            placeholder={q.placeholder || ""}
            disabled={disabled}
            rows={3}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(q.id, e.target.value ? Number(e.target.value) : "")}
            placeholder={q.placeholder || ""}
            disabled={disabled}
          />
        );

      case "select":
        return (
          <Select
            value={value || ""}
            onValueChange={(v) => onChange(q.id, v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={q.placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {(q.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multi_select": {
        const selected: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {(q.options || []).map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange(q.id, [...selected, opt]);
                    } else {
                      onChange(q.id, selected.filter((s) => s !== opt));
                    }
                  }}
                  disabled={disabled}
                />
                <span className="text-sm text-gray-800">{opt}</span>
              </div>
            ))}
          </div>
        );
      }

      default:
        return (
          <Input
            value={value || ""}
            onChange={(e) => onChange(q.id, e.target.value)}
            placeholder={q.placeholder || ""}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {sections.map(({ section, questions: sectionQuestions }) => (
        <div key={section}>
          {groupBySection && section && (
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
              {section}
            </h3>
          )}
          <div className="space-y-4">
            {sectionQuestions.map((q) => (
              <div key={q.id}>
                <Label className="text-sm font-medium text-gray-800">
                  {q.text}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <div className="mt-1.5">{renderField(q)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
