import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bold as BoldIcon, Italic as ItalicIcon, List, ListOrdered, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isEditing?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  isEditing = true,
  onSave,
  onCancel,
  className = ""
}: RichTextEditorProps) {
  const [content, setContent] = useState(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable extensions we don't want
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
      }),
    ],
    content: content,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContent(html);
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] p-3',
      },
    },
  });

  // Update editor content when value prop changes
  useEffect(() => {
    if (editor && value !== content) {
      setContent(value);
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const handleSave = () => {
    if (onSave) {
      onSave();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      // Reset to original value
      setContent(value);
      editor.commands.setContent(value);
      onCancel();
    }
  };

  if (!isEditing) {
    return (
      <div 
        className={`prose prose-sm max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <Card className={`border-blue-200 bg-blue-50 ${className}`}>
      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b border-blue-200 bg-blue-100/50">
          <Button
            type="button"
            variant={editor.isActive('bold') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="h-8 w-8 p-0"
            title="Bold"
          >
            <BoldIcon className="h-4 w-4" />
          </Button>
          
          <Button
            type="button"
            variant={editor.isActive('italic') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="h-8 w-8 p-0"
            title="Italic"
          >
            <ItalicIcon className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          <Button
            type="button"
            variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className="h-8 w-8 p-0"
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className="h-8 w-8 p-0"
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          {(onSave || onCancel) && (
            <>
              <div className="w-px h-6 bg-gray-300 mx-1" />
              
              {onSave && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  className="h-8 px-2"
                  title="Save"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              )}

              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-8 px-2"
                  title="Cancel"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>

        {/* Editor */}
        <div className="min-h-[100px]">
          <EditorContent editor={editor} />
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to convert HTML to plain text for AI processing
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Convert HTML to plain text while preserving some structure
  let text = tempDiv.textContent || tempDiv.innerText || '';
  
  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Helper function to convert plain text with formatting instructions to HTML
export function plainTextWithFormattingToHtml(text: string): string {
  if (!text) return '';
  
  let html = text;
  
  // Convert bullet points to HTML lists
  html = html.replace(/(?:^|\n)(?:\*|\-|\•)\s+(.+)/gm, (match, content) => {
    return `<li>${content.trim()}</li>`;
  });
  
  // Wrap consecutive list items in ul tags
  html = html.replace(/(<li>.*?<\/li>)(?:\s*<li>.*?<\/li>)*/g, (match) => {
    return `<ul>${match}</ul>`;
  });
  
  // Convert numbered lists
  html = html.replace(/(?:^|\n)\d+\.\s+(.+)/gm, (match, content) => {
    return `<li>${content.trim()}</li>`;
  });
  
  // Wrap consecutive numbered list items in ol tags
  html = html.replace(/(<li>.*?<\/li>)(?:\s*<li>.*?<\/li>)*/g, (match) => {
    // Check if this was from numbered list by looking for the pattern before
    const beforeMatch = text.substring(0, text.indexOf(match.replace(/<[^>]*>/g, '')));
    if (beforeMatch.includes('1.') || beforeMatch.includes('2.')) {
      return `<ol>${match}</ol>`;
    }
    return match;
  });
  
  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  // Convert line breaks to paragraphs
  const paragraphs = html.split(/\n\s*\n/);
  html = paragraphs
    .filter(p => p.trim())
    .map(p => {
      // Don't wrap if already wrapped in block elements
      if (p.match(/^<(ul|ol|li|p|div|h[1-6])/)) {
        return p;
      }
      return `<p>${p.trim()}</p>`;
    })
    .join('');
  
  return html;
}