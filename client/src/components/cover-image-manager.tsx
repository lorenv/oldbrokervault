import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ImageIcon, Upload, Search, X, ChevronDown, ChevronRight, Move } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DraggableImagePositioner } from "./draggable-image-positioner";

interface CoverImageManagerProps {
  docId: number;
  currentCoverImage?: string | null;
  currentPosition?: string | null;
  currentAttribution?: string | null;
  onUpdate?: () => void;
}

interface UnsplashImage {
  id: string;
  urls: {
    small: string;
    regular: string;
    full: string;
  };
  links: {
    download_location: string;
  };
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
  description?: string;
}

export function CoverImageManager({ 
  docId, 
  currentCoverImage, 
  currentPosition, 
  currentAttribution, 
  onUpdate 
}: CoverImageManagerProps) {
  const [isOpen, setIsOpen] = useState(true); // Expanded by default
  const [isUnsplashDialogOpen, setIsUnsplashDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unsplashResults, setUnsplashResults] = useState<UnsplashImage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(currentCoverImage || null);
  const [imagePosition, setImagePosition] = useState(() => {
    if (currentPosition) {
      try {
        return JSON.parse(currentPosition);
      } catch {
        return { x: 50, y: 50 };
      }
    }
    return { x: 50, y: 50 };
  });
  const [attribution, setAttribution] = useState(currentAttribution || "");
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Update local state when props change (e.g., after document generation)
  useEffect(() => {
    if (currentCoverImage !== selectedImage && !hasUserInteracted) {
      setSelectedImage(currentCoverImage);
    }
  }, [currentCoverImage, selectedImage, hasUserInteracted]);

  useEffect(() => {
    if (currentPosition && !hasUserInteracted) {
      try {
        const newPosition = JSON.parse(currentPosition);
        setImagePosition(newPosition);
      } catch {
        // Keep current position if parsing fails
      }
    }
  }, [currentPosition, hasUserInteracted]);

  useEffect(() => {
    if (currentAttribution !== attribution && !hasUserInteracted) {
      setAttribution(currentAttribution || "");
    }
  }, [currentAttribution, attribution, hasUserInteracted]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateCoverImageMutation = useMutation({
    mutationFn: async (data: {
      coverImageUrl?: string;
      coverImagePosition?: string;
      coverImageAttribution?: string;
      file?: File;
    }) => {
      const formData = new FormData();
      
      if (data.file) {
        formData.append('coverImage', data.file);
      }
      if (data.coverImageUrl) {
        formData.append('coverImageUrl', data.coverImageUrl);
      }
      if (data.coverImagePosition) {
        formData.append('coverImagePosition', data.coverImagePosition);
      }
      if (data.coverImageAttribution) {
        formData.append('coverImageAttribution', data.coverImageAttribution);
      }
      
      const response = await fetch(`/api/cim/${docId}/cover-image`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to update cover image');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
      queryClient.invalidateQueries({ queryKey: ['/api/cim'] });
      
      // Update local state to show the image immediately
      setSelectedImage(data.coverImageUrl);
      if (data.coverImageAttribution) {
        setAttribution(data.coverImageAttribution);
      }
      
      toast({
        title: "Cover image updated",
        description: "Your cover image has been successfully updated.",
      });
      // Removed onUpdate?.() to prevent modal from closing
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update cover image. Please try again.",
        variant: "destructive",
      });
    }
  });

  const removeCoverImageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/cim/${docId}/cover-image`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove cover image');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cim', docId] });
      setSelectedImage(null);
      setAttribution("");
      toast({
        title: "Cover image removed",
        description: "The cover image has been successfully removed.",
      });
      // Removed onUpdate?.() to prevent modal from closing
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove cover image. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setHasUserInteracted(true);
      updateCoverImageMutation.mutate({
        file,
        coverImagePosition: JSON.stringify(imagePosition),
        coverImageAttribution: attribution,
      });
    }
  };

  const handleUnsplashSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/unsplash/search?query=${encodeURIComponent(searchQuery)}&per_page=12`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search images');
      }
      
      const data = await response.json();
      setUnsplashResults(data.results || []);
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Failed to search Unsplash images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUnsplashImageSelect = async (image: UnsplashImage) => {
    setHasUserInteracted(true);
    
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
    
    // Create attribution with UTM parameters
    const photographerUrl = `${image.user.links.html}?utm_source=CIM_Generator&utm_medium=referral`;
    const unsplashUrl = `https://unsplash.com/?utm_source=CIM_Generator&utm_medium=referral`;
    const attribution = `Photo by <a href="${photographerUrl}" target="_blank" rel="noopener noreferrer">${image.user.name}</a> on <a href="${unsplashUrl}" target="_blank" rel="noopener noreferrer">Unsplash</a>`;
    
    updateCoverImageMutation.mutate({
      coverImageUrl: image.urls.regular,
      coverImagePosition: JSON.stringify(imagePosition),
      coverImageAttribution: attribution,
    });
    setIsUnsplashDialogOpen(false);
  };

  const handlePositionChange = (axis: 'x' | 'y', value: number[]) => {
    setHasUserInteracted(true);
    const newPosition = { ...imagePosition, [axis]: value[0] };
    setImagePosition(newPosition);
    
    if (selectedImage) {
      updateCoverImageMutation.mutate({
        coverImageUrl: selectedImage,
        coverImagePosition: JSON.stringify(newPosition),
        coverImageAttribution: attribution,
      });
    }
  };

  const handleDragPositionChange = useCallback((newPosition: { x: number; y: number }) => {
    setHasUserInteracted(true);
    setImagePosition(newPosition);
  }, []);

  // Debounced API call to prevent excessive requests - only after user interaction
  useEffect(() => {
    if (!selectedImage || !hasUserInteracted) return;
    
    const timeoutId = setTimeout(() => {
      updateCoverImageMutation.mutate({
        coverImageUrl: selectedImage,
        coverImagePosition: JSON.stringify(imagePosition),
        coverImageAttribution: attribution,
      });
    }, 1000); // Wait 1 second after user stops dragging

    return () => clearTimeout(timeoutId);
  }, [imagePosition, selectedImage, attribution, hasUserInteracted]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Cover Image</span>
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {selectedImage && (
              <div className="space-y-4">
                <DraggableImagePositioner
                  imageUrl={selectedImage}
                  position={imagePosition}
                  onPositionChange={handleDragPositionChange}
                  disabled={updateCoverImageMutation.isPending}
                />
                
                {attribution && (
                  <div 
                    className="text-xs text-gray-500 p-2 bg-gray-50 rounded"
                    dangerouslySetInnerHTML={{ __html: attribution }}
                  />
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => removeCoverImageMutation.mutate()}
                  disabled={removeCoverImageMutation.isPending}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove Cover Image
                </Button>
              </div>
            )}
            
            {!selectedImage && (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm text-gray-500 mb-4">
                  Add a cover image to enhance your document presentation
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={updateCoverImageMutation.isPending}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </Button>
              
              <Dialog open={isUnsplashDialogOpen} onOpenChange={setIsUnsplashDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    disabled={updateCoverImageMutation.isPending}
                    className="flex-1"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Unsplash
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Search Unsplash Images</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search for images..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleUnsplashSearch()}
                      />
                      <Button 
                        onClick={handleUnsplashSearch}
                        disabled={isSearching || !searchQuery.trim()}
                      >
                        Search
                      </Button>
                    </div>
                    
                    {unsplashResults.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                        {unsplashResults.map((image) => (
                          <div 
                            key={image.id}
                            className="relative cursor-pointer group"
                            onClick={() => handleUnsplashImageSelect(image)}
                          >
                            <img 
                              src={image.urls.small}
                              alt={image.description || "Unsplash image"}
                              className="w-full h-32 object-cover rounded-lg group-hover:opacity-80"
                            />
                            <div className="absolute bottom-2 left-2 text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
                              {image.user.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}