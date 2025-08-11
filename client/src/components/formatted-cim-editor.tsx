import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/rich-text-editor';
import { FormattingProfileSelector } from '@/components/formatting-profile-selector';
import { type FormattingProfile } from '@shared/formatting-config';
import { Settings, Eye, Edit } from 'lucide-react';

interface FormattedCimEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onFormattingChange?: (profile: FormattingProfile) => void;
  className?: string;
}

export function FormattedCimEditor({
  initialContent = '',
  onContentChange,
  onFormattingChange,
  className = ''
}: FormattedCimEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [formattingProfile, setFormattingProfile] = useState<FormattingProfile>('professional');
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
  };

  const handleFormattingChange = (profile: FormattingProfile) => {
    setFormattingProfile(profile);
    onFormattingChange?.(profile);
  };

  const handleSave = () => {
    setIsEditing(false);
    // Auto-save functionality would go here
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to previous content if needed
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                CIM Content Editor
              </CardTitle>
              <CardDescription>
                Create and edit your document content with customizable formatting
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={activeTab === 'settings' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-1"
              >
                <Settings className="h-4 w-4" />
                Format
              </Button>
              <Button
                variant={activeTab === 'editor' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('editor')}
                className="flex items-center gap-1"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant={activeTab === 'preview' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('preview')}
                className="flex items-center gap-1"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="settings" className="mt-0">
              <FormattingProfileSelector
                selectedProfile={formattingProfile}
                onProfileChange={handleFormattingChange}
                className="max-w-4xl mx-auto"
              />
            </TabsContent>

            <TabsContent value="editor" className="mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">
                      Content Editor - {formattingProfile.charAt(0).toUpperCase() + formattingProfile.slice(1)} Style
                    </h3>
                    <p className="text-xs text-gray-600">
                      The toolbar and formatting options are configured based on your selected style
                    </p>
                  </div>
                  {!isEditing && (
                    <Button
                      onClick={() => setIsEditing(true)}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Edit Content
                    </Button>
                  )}
                </div>

                <RichTextEditor
                  value={content}
                  onChange={handleContentChange}
                  formattingProfile={formattingProfile}
                  isEditing={isEditing}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  placeholder={`Start typing your ${formattingProfile} content...`}
                  className="min-h-[400px]"
                />

                {content && (
                  <div className="p-3 bg-gray-50 rounded-lg border text-xs text-gray-600">
                    <strong>Content Stats:</strong> {content.replace(/<[^>]*>/g, '').split(' ').length} words, 
                    {content.match(/<p>/g)?.length || 0} paragraphs,
                    {content.match(/<li>/g)?.length || 0} list items,
                    {content.match(/<table>/g)?.length || 0} tables
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-0">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-base">Content Preview</CardTitle>
                  <CardDescription>
                    How your content will appear in the final document
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {content ? (
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Edit className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No content to preview</p>
                      <p className="text-xs">Switch to the Editor tab to add content</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Example usage component for demonstration
export function FormattedCimEditorDemo() {
  const [currentProfile, setCurrentProfile] = useState<FormattingProfile>('professional');
  const [editorContent, setEditorContent] = useState('');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2">AI Formatting Configuration Demo</h1>
        <p className="text-gray-600">
          This demonstrates how formatting profiles control both the editor interface and AI output
        </p>
      </div>

      <FormattedCimEditor
        initialContent={editorContent}
        onContentChange={setEditorContent}
        onFormattingChange={setCurrentProfile}
      />

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Integration Notes:</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• The selected formatting profile ({currentProfile}) controls which toolbar buttons appear</li>
          <li>• When generating content with AI, the same profile determines formatting instructions</li>
          <li>• Table support is automatically enabled/disabled based on the profile</li>
          <li>• All HTML output is validated to match the selected profile requirements</li>
        </ul>
      </div>
    </div>
  );
}