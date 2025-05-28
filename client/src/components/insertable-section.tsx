import { useState } from "react";
import { Plus, Image, Type, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InsertableSectionProps {
  afterSection: string;
  docId: number;
  onSectionAdded: () => void;
}

interface CustomSectionProps {
  id: number;
  type: 'text' | 'image';
  content?: string;
  imageUrl?: string;
  onDelete: (id: number) => void;
  onUpdate: (id: number, content: string) => void;
}

export function InsertableSection({ afterSection, docId, onSectionAdded }: InsertableSectionProps) {
  const [showHover, setShowHover] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleAddText = () => {
    setShowDialog(true);
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('afterSection', afterSection);

        const response = await fetch(`/api/cim/${docId}/custom-section/image`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (response.ok) {
          toast({
            title: "Image added successfully",
            description: "Your image section has been added to the CIM",
          });
          onSectionAdded();
        } else {
          throw new Error('Failed to upload image');
        }
      } catch (error) {
        toast({
          title: "Upload failed",
          description: "Please try again",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    };
    input.click();
  };

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setShowHover(true)}
      onMouseLeave={() => setShowHover(false)}
    >
      <div 
        className={`transition-all duration-200 ${
          showHover ? 'h-8 opacity-100' : 'h-2 opacity-0'
        } flex items-center justify-center`}
      >
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 border-dashed"></div>
        </div>
        <div className={`relative bg-white px-2 transition-all duration-200 ${
          showHover ? 'scale-100' : 'scale-0'
        }`}>
          <Button
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 rounded-full"
            onClick={() => setShowDialog(true)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
            <DialogDescription>
              Choose the type of content to add
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={handleAddText}
            >
              <Type className="h-6 w-6" />
              <span className="text-sm">Text</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={handleAddImage}
              disabled={isUploading}
            >
              <Image className="h-6 w-6" />
              <span className="text-sm">{isUploading ? "Uploading..." : "Image"}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CustomSection({ id, type, content, imageUrl, onDelete, onUpdate }: CustomSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [StarterKit],
    content: content || '',
    onUpdate: ({ editor }) => {
      onUpdate(id, editor.getHTML());
    },
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await apiRequest('DELETE', `/api/custom-section/${id}`);
      if (response.ok) {
        onDelete(id);
        toast({
          title: "Section deleted",
          description: "The custom section has been removed",
        });
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="group relative border border-gray-200 rounded-lg p-4 my-4 bg-gray-50">
      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {type === 'image' && imageUrl && (
        <div className="flex justify-center">
          <img 
            src={imageUrl} 
            alt="Custom section" 
            className="max-w-full h-auto rounded-lg shadow-md"
            style={{ borderRadius: '30px' }}
          />
        </div>
      )}

      {type === 'text' && (
        <div className="prose max-w-none">
          {isEditing ? (
            <div className="border rounded-md p-3">
              <EditorContent editor={editor} />
              <div className="flex justify-end gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className="cursor-pointer min-h-[2rem]" 
              onClick={() => setIsEditing(true)}
              dangerouslySetInnerHTML={{ __html: content || '<p>Click to edit text...</p>' }}
            />
          )}
        </div>
      )}
    </div>
  );
}