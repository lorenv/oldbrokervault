import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

export function MarkdownGuide() {
  return (
    <Card className="mt-4 bg-gray-50 border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-gray-700">
          <Info className="h-4 w-4" />
          Markdown Formatting Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-gray-600 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div><code className="bg-gray-200 px-1 rounded">**Bold**</code> → <strong>Bold</strong></div>
              <div><code className="bg-gray-200 px-1 rounded">*Italic*</code> → <em>Italic</em></div>
              <div><code className="bg-gray-200 px-1 rounded">***Bold Italic***</code> → <strong><em>Bold Italic</em></strong></div>
              <div><code className="bg-gray-200 px-1 rounded">~~Strike~~</code> → <s>Strike</s></div>
              <div><code className="bg-gray-200 px-1 rounded">`Code`</code> → <code className="bg-gray-200 px-1 rounded">Code</code></div>
            </div>
            <div className="space-y-1">
              <div><code className="bg-gray-200 px-1 rounded"># Heading</code> → Large heading</div>
              <div><code className="bg-gray-200 px-1 rounded">## Subheading</code> → Medium heading</div>
              <div><code className="bg-gray-200 px-1 rounded">- List item</code> → • List item</div>
              <div><code className="bg-gray-200 px-1 rounded">[Link](URL)</code> → Clickable link</div>
              <div><code className="bg-gray-200 px-1 rounded">Line\nBreak</code> → Line break</div>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-300">
            <div className="text-gray-500">
              Use a backslash to prevent formatting: <code className="bg-gray-200 px-1 rounded">\*</code> shows * instead of italic
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}