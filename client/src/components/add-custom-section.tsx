import { useState } from "react";
import { Plus, X, Type, Image, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [sectionType, setSectionType] = useState<'text' | 'image' | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [insertAfter, setInsertAfter] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showUnsplashDialog, setShowUnsplashDialog] = useState(false);
  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [unsplashResults, setUnsplashResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!title.trim() || !insertAfter || !sectionType) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (sectionType === 'text' && !content.trim()) {
      toast({
        title: "Missing Content",
        description: "Please add text content for the section",
        variant: "destructive",
      });
      return;
    }

    if (sectionType === 'image' && selectedImages.length === 0) {
      toast({
        title: "Missing Images",
        description: "Please add at least one image to the section",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        type: sectionType,
        insertAfterSection: insertAfter,
        ...(sectionType === 'text' && { content: content.trim() }),
        ...(sectionType === 'image' && { imageUrls: selectedImages }),
      };

      await apiRequest("POST", `/api/cim/${docId}/custom-sections`, payload);

      toast({
        title: "Section Added",
        description: `Your custom ${sectionType} section has been added successfully`,
      });

      // Reset form
      setTitle("");
      setContent("");
      setInsertAfter("");
      setSectionType(null);
      setSelectedImages([]);
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
    setSectionType(null);
    setSelectedImages([]);
    setIsOpen(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadPromises = Array.from(files).map(async (file) => {
      const formData = new FormData();
      formData.append('image', file);

      try {
        const response = await fetch(`/api/cim/${docId}/upload-image`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          return result.imageUrl;
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
        return null;
      }
    });

    const uploadedUrls = await Promise.all(uploadPromises);
    const validUrls = uploadedUrls.filter(url => url !== null);

    if (validUrls.length > 0) {
      setSelectedImages(prev => [...prev, ...validUrls]);
      toast({
        title: "Images Uploaded",
        description: `Successfully uploaded ${validUrls.length} image(s)`,
      });
    }
  };

  const searchUnsplash = async () => {
    if (!unsplashQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/unsplash/search?query=${encodeURIComponent(unsplashQuery)}&per_page=12`);
      if (response.ok) {
        const data = await response.json();
        setUnsplashResults(data.results || []);
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      toast({
        title: "Search Failed",
        description: "Could not search Unsplash images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const addUnsplashImage = async (image: any) => {
    // Trigger Unsplash download event
    try {
      console.log('Triggering Unsplash download for:', image.links.download_location);
      const response = await fetch('/api/unsplash/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          downloadUrl: image.links.download_location
        })
      });

      if (response.ok) {
        console.log('Unsplash download event triggered successfully');
      } else {
        console.error('Failed to trigger Unsplash download event:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to trigger Unsplash download event:', error);
    }

    const imageUrl = image.urls?.regular || image.urls?.small;
    if (imageUrl && !selectedImages.includes(imageUrl)) {
      setSelectedImages(prev => [...prev, imageUrl]);
      toast({
        title: "Image Added",
        description: "Unsplash image added to section",
      });
    }
  };

  const removeImage = (imageUrl: string) => {
    setSelectedImages(prev => prev.filter(url => url !== imageUrl));
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
    <>
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
          {/* Section Type Selector */}
          {!sectionType && (
            <div>
              <Label>Section Type</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-2 hover:bg-blue-50"
                  onClick={() => setSectionType('text')}
                >
                  <Type className="h-6 w-6" />
                  <span className="text-sm">Text Section</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-2 hover:bg-blue-50"
                  onClick={() => setSectionType('image')}
                >
                  <Image className="h-6 w-6" />
                  <span className="text-sm">Image Section</span>
                </Button>
              </div>
            </div>
          )}

          {/* Common Fields */}
          {sectionType && (
            <>
              <div className="flex items-center gap-2 p-2 bg-blue-100 rounded-lg">
                {sectionType === 'text' ? <Type className="h-4 w-4" /> : <Image className="h-4 w-4" />}
                <span className="text-sm font-medium">
                  {sectionType === 'text' ? 'Text Section' : 'Image Section'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSectionType(null)}
                  className="ml-auto h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

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

              {/* Text Section Fields */}
              {sectionType === 'text' && (
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
              )}

              {/* Image Section Fields */}
              {sectionType === 'image' && (
                <div className="space-y-4">
                  <div>
                    <Label>Add Images</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <Button
                        variant="outline"
                        className="flex flex-col gap-2 h-16"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        <span className="text-xs">Upload Files</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="flex flex-col gap-2 h-16"
                        onClick={() => setShowUnsplashDialog(true)}
                      >
                        <Search className="h-4 w-4" />
                        <span className="text-xs">Search Unsplash</span>
                      </Button>
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Selected Images */}
                  {selectedImages.length > 0 && (
                    <div>
                      <Label>Selected Images ({selectedImages.length})</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {selectedImages.map((imageUrl, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={imageUrl}
                              alt={`Selected ${index + 1}`}
                              className="w-full h-20 object-cover rounded border"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImage(imageUrl)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
            </>
          )}
        </CardContent>
      </Card>

      {/* Unsplash Search Dialog */}
      <Dialog open={showUnsplashDialog} onOpenChange={setShowUnsplashDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Unsplash Images</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={unsplashQuery}
                onChange={(e) => setUnsplashQuery(e.target.value)}
                placeholder="Search for images..."
                onKeyPress={(e) => e.key === 'Enter' && searchUnsplash()}
              />
              <Button onClick={searchUnsplash} disabled={isSearching}>
                {isSearching ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {unsplashResults.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {unsplashResults.map((image, index) => (
                  <div key={index} className="relative group cursor-pointer">
                    <img
                      src={image.urls?.small}
                      alt={image.alt_description || 'Unsplash image'}
                      className="w-full h-32 object-cover rounded border"
                      onClick={() => addUnsplashImage(image)}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => addUnsplashImage(image)}
                      >
                        Add Image
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}