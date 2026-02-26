import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";

export interface FormQuestion {
  id: string;
  text: string;
  type: string;
  options?: string[];
  required: boolean;
  section?: string;
  crmField?: string | null;
  placeholder?: string;
}

interface FormBuilderProps {
  questions: FormQuestion[];
  onChange: (questions: FormQuestion[]) => void;
  sections?: string[];
  crmFieldOptions?: { label: string; value: string }[];
  questionTypes?: string[];
}

const DEFAULT_TYPES = ["text", "textarea", "select", "multi_select", "number"];

export function FormBuilder({
  questions,
  onChange,
  sections = [],
  crmFieldOptions = [],
  questionTypes = DEFAULT_TYPES,
}: FormBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addQuestion = () => {
    const newQuestion: FormQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: "",
      type: "text",
      required: false,
      section: sections[0] || undefined,
      crmField: null,
    };
    onChange([...questions, newQuestion]);
    setExpandedId(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<FormQuestion>) => {
    onChange(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const updated = [...questions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const q = questions.find((q) => q.id === questionId);
    if (!q) return;
    const options = [...(q.options || [])];
    options[optionIndex] = value;
    updateQuestion(questionId, { options });
  };

  const addOption = (questionId: string) => {
    const q = questions.find((q) => q.id === questionId);
    if (!q) return;
    updateQuestion(questionId, { options: [...(q.options || []), ""] });
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const q = questions.find((q) => q.id === questionId);
    if (!q) return;
    const options = [...(q.options || [])];
    options.splice(optionIndex, 1);
    updateQuestion(questionId, { options });
  };

  // Group questions by section
  const groupedQuestions: { section: string; questions: { question: FormQuestion; originalIndex: number }[] }[] = [];
  const sectionMap = new Map<string, { question: FormQuestion; originalIndex: number }[]>();

  questions.forEach((q, i) => {
    const sec = q.section || "Uncategorized";
    if (!sectionMap.has(sec)) sectionMap.set(sec, []);
    sectionMap.get(sec)!.push({ question: q, originalIndex: i });
  });

  sectionMap.forEach((items, section) => {
    groupedQuestions.push({ section, questions: items });
  });

  const showOptions = (type: string) => type === "select" || type === "multi_select";

  return (
    <div className="space-y-4">
      {groupedQuestions.map(({ section, questions: sectionQuestions }) => (
        <div key={section}>
          {sections.length > 0 && (
            <h4 className="text-sm font-semibold text-gray-700 mb-2 px-1">{section}</h4>
          )}
          <div className="space-y-2">
            {sectionQuestions.map(({ question: q, originalIndex }) => {
              const isExpanded = expandedId === q.id;
              return (
                <Card key={q.id} className="border border-gray-200">
                  <CardContent className="p-3">
                    {/* Collapsed header */}
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    >
                      <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-900 flex-1 truncate">
                        {q.text || "(untitled question)"}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {q.type}
                      </span>
                      {q.required && (
                        <span className="text-xs text-red-500">Required</span>
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => { e.stopPropagation(); moveQuestion(originalIndex, "up"); }}
                          disabled={originalIndex === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => { e.stopPropagation(); moveQuestion(originalIndex, "down"); }}
                          disabled={originalIndex === questions.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded editor */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        <div>
                          <Label className="text-xs text-gray-600">Question Text</Label>
                          <Input
                            value={q.text}
                            onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                            placeholder="Enter your question..."
                            className="mt-1"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-gray-600">Type</Label>
                            <Select
                              value={q.type}
                              onValueChange={(v) => updateQuestion(q.id, { type: v })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {questionTypes.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t.replace(/_/g, " ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {sections.length > 0 && (
                            <div>
                              <Label className="text-xs text-gray-600">Section</Label>
                              <Select
                                value={q.section || ""}
                                onValueChange={(v) => updateQuestion(q.id, { section: v })}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select section" />
                                </SelectTrigger>
                                <SelectContent>
                                  {sections.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {crmFieldOptions.length > 0 && (
                          <div>
                            <Label className="text-xs text-gray-600">CRM Field Mapping</Label>
                            <Select
                              value={q.crmField || "none"}
                              onValueChange={(v) =>
                                updateQuestion(q.id, { crmField: v === "none" ? null : v })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="No mapping" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No mapping</SelectItem>
                                {crmFieldOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div>
                          <Label className="text-xs text-gray-600">Placeholder</Label>
                          <Input
                            value={q.placeholder || ""}
                            onChange={(e) => updateQuestion(q.id, { placeholder: e.target.value })}
                            placeholder="Input hint text..."
                            className="mt-1"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={q.required}
                            onCheckedChange={(v) => updateQuestion(q.id, { required: v })}
                          />
                          <Label className="text-xs text-gray-600">Required</Label>
                        </div>

                        {/* Options editor for select/multi_select */}
                        {showOptions(q.type) && (
                          <div>
                            <Label className="text-xs text-gray-600">Options</Label>
                            <div className="mt-1 space-y-1">
                              {(q.options || []).map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input
                                    value={opt}
                                    onChange={(e) => updateOption(q.id, idx, e.target.value)}
                                    placeholder={`Option ${idx + 1}`}
                                    className="text-sm"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-500"
                                    onClick={() => removeOption(q.id, idx)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addOption(q.id)}
                                className="text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Option
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addQuestion}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" /> Add Question
      </Button>
    </div>
  );
}
