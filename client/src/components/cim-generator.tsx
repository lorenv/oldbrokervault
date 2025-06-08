import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCimDocumentSchema, DEFAULT_CIM_DIRECTIONS, DEFAULT_ANALYSIS_TEMPLATES, subscriptionPlans } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Settings, Upload, X, FileText, Download, Copy, File, Save, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { LoadingAnimation } from "@/components/ui/loading-animation";
import { DocumentExport } from './document-export';  // Fixed import path
import { CimDisplay } from './cim-display';
import { CimFileUpload } from './cim-file-upload';
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ImageIcon, Search, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DraggableImagePositioner } from "./draggable-image-positioner";

export function CimGenerator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cimMode, setCimMode] = useState<'choice' | 'generate' | 'upload'>('choice');
  const [analysis, setAnalysis] = useState<any>(null);
  const [currentDocId, setCurrentDocId] = useState<number | null>(null);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);
  const [websiteAnalysisStage, setWebsiteAnalysisStage] = useState<string | null>(null);
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isExtractingImages, setIsExtractingImages] = useState(false);
  const [financialsEnabled, setFinancialsEnabled] = useState(false);
  const [financialData, setFinancialData] = useState({
    askingPrice: '',
    revenue: '',
    ebitda: '',
    askingPriceIncluded: false,
    revenueIncluded: false,
    ebitdaIncluded: false,
  });
  const [financialFiles, setFinancialFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New analysis template state
  const [selectedPurpose, setSelectedPurpose] = useState<string>('business_overview');
  const [selectedTone, setSelectedTone] = useState<string>('professional');
  const [selectedAudience, setSelectedAudience] = useState<string>('investors');
  const [customDirections, setCustomDirections] = useState<string>(DEFAULT_ANALYSIS_TEMPLATES.business_overview.customDirections);
  const [templateNameInput, setTemplateNameInput] = useState<string>('');

  // Cover image state
  const [selectedCoverImage, setSelectedCoverImage] = useState<string | null>(null);
  const [coverImagePosition, setCoverImagePosition] = useState({ x: 50, y: 50 });
  const [coverImageAttribution, setCoverImageAttribution] = useState<string>('');
  const [isUnsplashDialogOpen, setIsUnsplashDialogOpen] = useState(false);
  const [unsplashSearchQuery, setUnsplashSearchQuery] = useState('');
  const [unsplashResults, setUnsplashResults] = useState<any[]>([]);
  const [isSearchingUnsplash, setIsSearchingUnsplash] = useState(false);
  const [isCoverImageSectionOpen, setIsCoverImageSectionOpen] = useState(false);
  const coverImageFileInputRef = useRef<HTMLInputElement>(null);

  // Load analysis templates from database
  const { data: analysisTemplates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['/api/analysis-templates'],
    enabled: !!user,
  });

  // Mutations for template management
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await fetch('/api/analysis-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      });
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
    onSuccess: () => {
      refetchTemplates();
      toast({
        title: "Template Saved",
        description: "Your template has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await fetch(`/api/analysis-templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete template');
      return response.json();
    },
    onSuccess: () => {
      refetchTemplates();
      toast({
        title: "Template Deleted",
        description: "Template has been removed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handler to update custom directions when presets change
  const handlePresetChange = (purpose: string, tone?: string, audience?: string) => {
    const template = DEFAULT_ANALYSIS_TEMPLATES[purpose as keyof typeof DEFAULT_ANALYSIS_TEMPLATES];
    if (template) {
      setCustomDirections(template.customDirections);
      form.setValue('directions', template.customDirections);
    }
  };

  // Handler to save custom template
  const saveCustomTemplate = (name: string) => {
    const templateData = {
      name: name.trim(),
      purpose: selectedPurpose,
      tone: selectedTone,
      audience: selectedAudience,
      customDirections: customDirections,
      isPublic: false
    };
    
    createTemplateMutation.mutate(templateData);
    setTemplateNameInput('');
  };

  // Handler to load template with confirmation
  const loadTemplate = (template: any) => {
    setCustomDirections(template.customDirections);
    form.setValue("directions", template.customDirections);
    setSelectedPurpose(template.purpose);
    setSelectedTone(template.tone);
    setSelectedAudience(template.audience);
    toast({
      title: "Template Loaded",
      description: `"${template.name}" has been loaded successfully.`,
    });
  };

  // Handler to delete template
  const deleteTemplate = (templateId: number) => {
    deleteTemplateMutation.mutate(templateId);
  };

  // Extend the schema with URL validation
  const formSchema = insertCimDocumentSchema.extend({
    websiteUrl: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => {
          if (!val) return true; // Optional field
          try {
            // Basic URL validation
            // Allow URLs without protocol for user convenience
            const url = val.startsWith('http') ? val : `https://${val}`;
            new URL(url);
            
            // Validate domain is reasonable (has at least one dot and no spaces)
            return url.includes('.') && !url.includes(' ');
          } catch (error) {
            return false;
          }
        },
        { 
          message: "Please enter a valid website URL (e.g., example.com or https://example.com)" 
        }
      )
  });

  // Define the form values type
  type FormValues = {
    title: string;
    transcript: string;
    directions: string;
    websiteUrl?: string;
  };
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      transcript: "",
      directions: DEFAULT_CIM_DIRECTIONS,
      websiteUrl: ""
    }
  });

  // Function to extract images from website
  const extractImages = async (websiteUrl: string) => {
    if (!websiteUrl.trim()) return;
    
    setIsExtractingImages(true);
    try {
      const encodedUrl = encodeURIComponent(websiteUrl);
      const response = await apiRequest("GET", `/api/website-images/${encodedUrl}`);
      const data = await response.json();
      
      if (data.images && data.images.length > 0) {
        setExtractedImages(data.images);
        toast({
          title: "Images Found!",
          description: `Found ${data.images.length} images from the website`,
        });
      } else {
        toast({
          title: "No Images Found",
          description: "No suitable images were found on this website",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error extracting images:', error);
      toast({
        title: "Error",
        description: "Failed to extract images from website",
        variant: "destructive",
      });
    } finally {
      setIsExtractingImages(false);
    }
  };

  // Toggle image selection
  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev => 
      prev.includes(imageUrl)
        ? prev.filter(url => url !== imageUrl)
        : [...prev, imageUrl]
    );
  };

  // File handling functions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setFinancialFiles(prev => [...prev, ...Array.from(files)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFinancialFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Cover image handlers
  const handleCoverImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSelectedCoverImage(url);
      setCoverImageAttribution('');
    }
    if (coverImageFileInputRef.current) {
      coverImageFileInputRef.current.value = '';
    }
  };

  const searchUnsplash = async () => {
    if (!unsplashSearchQuery.trim()) return;
    
    setIsSearchingUnsplash(true);
    try {
      const response = await apiRequest("GET", `/api/unsplash/search?query=${encodeURIComponent(unsplashSearchQuery)}`);
      const data = await response.json();
      setUnsplashResults(data.results || []);
    } catch (error) {
      toast({
        title: "Search Error",
        description: "Failed to search Unsplash images",
        variant: "destructive",
      });
    } finally {
      setIsSearchingUnsplash(false);
    }
  };

  const selectUnsplashImage = (image: any) => {
    setSelectedCoverImage(image.urls.regular);
    setCoverImageAttribution(`Photo by ${image.user.name} on Unsplash`);
    setIsUnsplashDialogOpen(false);
  };

  const handlePositionChange = (axis: 'x' | 'y', value: number[]) => {
    setCoverImagePosition(prev => ({
      ...prev,
      [axis]: value[0]
    }));
  };

  const generateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Set up website analysis tracking
      const hasWebsiteUrl = !!data.websiteUrl?.trim();
      
      if (data.transcript.length > 4000) {
        const file = new Blob([data.transcript], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('transcript', file, 'transcript.txt');
        formData.append('title', data.title);
        formData.append('directions', data.directions);
        formData.append('purpose', selectedPurpose);
        formData.append('tone', selectedTone);
        formData.append('audience', selectedAudience);
        
        if (hasWebsiteUrl) {
          formData.append('websiteUrl', data.websiteUrl!);
          if (selectedImages.length > 0) {
            formData.append('selectedImages', JSON.stringify(selectedImages));
          }
        }
        
        if (currentDocId) {
          formData.append('docId', currentDocId.toString());
        }

        // Add financial data if enabled
        if (financialsEnabled) {
          formData.append('financials', JSON.stringify({
            enabled: true,
            ...financialData
          }));
        }

        // Add cover image data if selected
        if (selectedCoverImage) {
          formData.append('coverImageUrl', selectedCoverImage);
          formData.append('coverImagePosition', JSON.stringify(coverImagePosition));
          if (coverImageAttribution) {
            formData.append('coverImageAttribution', coverImageAttribution);
          }
        }
        


        try {
          if (hasWebsiteUrl) {
            setWebsiteAnalysisStage('analyzing');
          }
          
          const res = await fetch('/api/cim/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to generate CIM");
          }
          
          if (hasWebsiteUrl) {
            setWebsiteAnalysisStage('enhancing');
          }
          
          return res.json();
        } catch (error) {
          // Reset website analysis stage on error
          setWebsiteAnalysisStage(null);
          throw error;
        }
      } else {
        try {
          const res = await apiRequest("POST", "/api/cim", {
            ...data,
            docId: currentDocId,
            purpose: selectedPurpose,
            tone: selectedTone,
            audience: selectedAudience,
            selectedImages: selectedImages.length > 0 ? selectedImages : undefined,
            financials: financialsEnabled ? {
              enabled: true,
              ...financialData
            } : undefined,
            coverImage: selectedCoverImage ? {
              url: selectedCoverImage,
              position: coverImagePosition,
              attribution: coverImageAttribution
            } : undefined,
          });
          
          console.log("Sending selected images to backend:", selectedImages);
          
          return res.json();
        } catch (error) {
          throw error;
        }
      }
    },
    onSuccess: async (data) => {
      // Upload financial files after CIM is created
      if (financialFiles.length > 0) {
        try {
          for (const file of financialFiles) {
            const formData = new FormData();
            formData.append('file', file);
            
            await fetch(`/api/cim/${data.id}/financial-files`, {
              method: 'POST',
              body: formData,
              credentials: 'include'
            });
          }
          
          // Clear the local file list after successful upload
          setFinancialFiles([]);
        } catch (error) {
          console.error('Error uploading financial files:', error);
          toast({
            title: "Warning",
            description: "CIM created successfully but some financial files failed to upload",
            variant: "destructive"
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
      
      // Reset website analysis stage
      setWebsiteAnalysisStage(null);
      
      // Show success message
      const websiteUrl = form.getValues('websiteUrl');
      toast({
        title: "CIM Generated Successfully",
        description: websiteUrl ? `Your CIM has been enhanced with data from ${websiteUrl}` : "Your CIM has been generated successfully",
        duration: 3000
      });
      
      // Redirect to My CIMs page to view the editable version
      setTimeout(() => {
        window.location.href = `/documents/${data.id}`;
      }, 1500);
    },
    onError: (error: any) => {
      // Reset website analysis stage
      setWebsiteAnalysisStage(null);
      
      // Check if the error message contains a website-related error
      const isWebsiteError = error.message && (
        error.message.includes('website') || 
        error.message.includes('URL') || 
        error.message.includes('Perplexity') ||
        error.message.includes('fetch')
      );
      
      toast({
        title: isWebsiteError ? "Website Analysis Error" : "Error",
        description: error.message || "Failed to generate CIM",
        variant: "destructive"
      });
      
      // If it's a website error but we still have a transcript, suggest trying without the website
      if (isWebsiteError && form.getValues('transcript')) {
        toast({
          title: "Suggestion",
          description: "You can try generating the CIM without the website URL",
          duration: 5000
        });
      }
    }
  });

  const handleGenerate = (data: FormValues) => {
    if (currentDocId) {
      const plan = subscriptionPlans[user?.subscriptionStatus as keyof typeof subscriptionPlans];
      if (analysis?.regenerationCount >= plan.regenerationLimit) {
        toast({
          title: "Regeneration Limit Reached",
          description: `Your ${plan.name} plan allows ${plan.regenerationLimit} regenerations per CIM. Please upgrade to increase this limit.`,
          variant: "destructive"
        });
        return;
      }
    }
    generateMutation.mutate(data);
  };

  const handleCopyToClipboard = async () => {
    try {
      const cimText = `
Business Summary:
${analysis.story.businessSummary}

Market Analysis:
${analysis.marketAnalysis.customerProfile}
${analysis.marketAnalysis.strengths.join("\n")}

Operations:
${analysis.operations.customers.recurring}
${analysis.team.ownerResponsibilities}
      `.trim();

      await navigator.clipboard.writeText(cimText);
      toast({
        title: "Copied to clipboard",
        description: "CIM content has been copied to your clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleExport = async (format: 'pdf' | 'word') => {
    toast({
      title: "Coming Soon",
      description: `Export to ${format.toUpperCase()} will be available soon`,
    });
  };



  const renderValue = (value: any): string => {
    // Handle null or undefined
    if (value === null || value === undefined) {
      return "[NOT ANSWERED]";
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "[NOT ANSWERED]";
      }
      return value.map(item => renderValue(item)).join(", ");
    }
    
    // Handle objects
    if (typeof value === "object") {
      if (Object.keys(value).length === 0) {
        return "[NOT ANSWERED]";
      }
      
      try {
        // Try to extract meaningful content from the object
        const entries = Object.entries(value);
        if (entries.length === 0) {
          return "[NOT ANSWERED]";
        }
        
        // Format object entries into a more readable structure
        // Remove camelCase artifacts and add proper spacing
        return entries
          .map(([key, val]) => {
            // Skip keys that just represent types or metadata
            if (key === 'type' || key === 'value' || key === 'metric') {
              return renderValue(val);
            }
            
            // Format the key for better readability
            const formattedKey = key
              // Add spaces between camelCase words
              .replace(/([A-Z])/g, ' $1')
              // Capitalize first letter
              .replace(/^./, str => str.toUpperCase())
              // Clean up any excess spaces
              .trim();
              
            return `${formattedKey}: ${renderValue(val)}`;
          })
          .filter(item => item.trim() !== '')
          .join(". ");
      } catch (error) {
        // Fallback if something goes wrong
        return "[NOT ANSWERED]";
      }
    }
    
    // Handle empty strings
    if (typeof value === "string" && value.trim() === "") {
      return "[NOT ANSWERED]";
    }
    
    // Handle long strings that might contain JSON or object notation
    if (typeof value === "string" && value.includes(':') && !value.includes(' ')) {
      // Add spaces after colons if they don't have spaces
      return value.replace(/:/g, ': ');
    }
    
    // Default case: convert to string
    const stringValue = String(value);
    return stringValue === "N/A" ? "[NOT ANSWERED]" : stringValue;
  };

  return (
    <div className="space-y-6">
      {cimMode === 'choice' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
                    onClick={() => setCimMode('generate')}>
                <CardContent className="p-6 text-center space-y-3">
                  <FileText className="w-12 h-12 text-primary mx-auto" />
                  <h3 className="font-semibold">Generate New CIM</h3>
                  <p className="text-sm text-muted-foreground">
                    Transform your meeting transcript into a professional CIM using AI
                  </p>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
                    onClick={() => setCimMode('upload')}>
                <CardContent className="p-6 text-center space-y-3">
                  <Upload className="w-12 h-12 text-primary mx-auto" />
                  <h3 className="font-semibold">Upload Existing CIM</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload your existing CIM file to share with secure NDA protection
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {cimMode === 'upload' && (
        <div className="space-y-4">
          <Button 
            variant="outline" 
            onClick={() => setCimMode('choice')}
            className="mb-4"
          >
            ← Back to Options
          </Button>
          <CimFileUpload onSuccess={(docId) => {
            setCurrentDocId(docId);
            // Redirect to documents page where they can enable sharing
            setTimeout(() => {
              window.location.href = '/documents';
            }, 2000);
          }} />
        </div>
      )}

      {cimMode === 'generate' && (
        <>
          <div className="flex items-center space-x-2 mb-4">
            <Button 
              variant="outline" 
              onClick={() => setCimMode('choice')}
            >
              ← Back to Options
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-4">
                {/* Cover Image Section - Collapsible */}
                <Collapsible open={isCoverImageSectionOpen} onOpenChange={setIsCoverImageSectionOpen}>
                  <div className="border rounded-lg bg-background">
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">Cover Image</span>
                          {selectedCoverImage && <Badge variant="secondary">Set</Badge>}
                        </div>
                        {isCoverImageSectionOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 pt-0 space-y-4">
                        {selectedCoverImage && (
                          <div className="space-y-3">
                            <DraggableImagePositioner
                              imageUrl={selectedCoverImage}
                              position={coverImagePosition}
                              onPositionChange={setCoverImagePosition}
                              className="w-full"
                            />
                            
                            {coverImageAttribution && (
                              <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                                {coverImageAttribution}
                              </div>
                            )}
                            
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setSelectedCoverImage(null);
                                setCoverImageAttribution('');
                                setCoverImagePosition({ x: 50, y: 50 });
                              }}
                              className="w-full"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remove Cover Image
                            </Button>
                          </div>
                        )}
                        
                        {!selectedCoverImage && (
                          <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                            <ImageIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-xs text-gray-500 mb-3">
                              Add a cover image to enhance your CIM presentation
                            </p>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm"
                            onClick={() => coverImageFileInputRef.current?.click()}
                            className="flex-1"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload
                          </Button>
                          
                          <Dialog open={isUnsplashDialogOpen} onOpenChange={setIsUnsplashDialogOpen}>
                            <DialogTrigger asChild>
                              <Button 
                                type="button"
                                variant="outline" 
                                size="sm"
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
                                    value={unsplashSearchQuery}
                                    onChange={(e) => setUnsplashSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && searchUnsplash()}
                                  />
                                  <Button onClick={searchUnsplash} disabled={isSearchingUnsplash}>
                                    {isSearchingUnsplash ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                                  {unsplashResults.map((image: any) => (
                                    <div 
                                      key={image.id} 
                                      className="cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => selectUnsplashImage(image)}
                                    >
                                      <img 
                                        src={image.urls.small} 
                                        alt={image.description || 'Unsplash image'}
                                        className="w-full h-24 object-cover rounded"
                                      />
                                      <p className="text-xs text-gray-500 mt-1 truncate">
                                        by {image.user.name}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        
                        <input
                          ref={coverImageFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleCoverImageUpload}
                          className="hidden"
                        />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

            <div>
              <Input
                placeholder="Document Title"
                {...form.register("title")}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.title.message as string}
                </p>
              )}
            </div>
            

            
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="Business Website URL (optional)"
                  {...form.register("websiteUrl")}
                />
                {form.formState.errors.websiteUrl && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.websiteUrl.message as string}
                  </p>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Add a business website URL to enhance the CIM with website content
                </div>
              </div>
              
              {/* Image extraction and selection section */}
              {form.watch("websiteUrl") && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium">Website Images</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = form.getValues("websiteUrl");
                        if (url) extractImages(url);
                      }}
                      disabled={isExtractingImages}
                    >
                      {isExtractingImages ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {isExtractingImages ? "Extracting..." : "Extract Images"}
                    </Button>
                  </div>
                  
                  {extractedImages.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">
                        Select images to include in your CIM document (click to select/deselect):
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {extractedImages.map((imageUrl, index) => (
                          <div
                            key={index}
                            className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all hover:shadow-md ${
                              selectedImages.includes(imageUrl)
                                ? "border-primary ring-2 ring-primary/20"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => toggleImageSelection(imageUrl)}
                          >
                            <img
                              src={imageUrl}
                              alt={`Website image ${index + 1}`}
                              className="w-full h-24 object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            {selectedImages.includes(imageUrl) && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                  ✓
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {selectedImages.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                        </div>
                      )}
                    </div>
                  )}
                  
                  {extractedImages.length === 0 && !isExtractingImages && (
                    <div className="text-xs text-muted-foreground">
                      Click "Extract Images" to find images from the website
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Textarea
                placeholder="Paste your notes or meeting transcript here..."
                className="min-h-[200px]"
                {...form.register("transcript")}
              />
              {form.formState.errors.transcript && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.transcript.message as string}
                </p>
              )}
            </div>

            {/* Financial Information - Cleaner styling */}
            <div className="space-y-4 p-4 border rounded-lg bg-background">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Financial Information</h3>
                  <p className="text-xs text-muted-foreground">
                    Add key financial metrics to enhance the CIM
                  </p>
                </div>
                <Switch
                  id="financials-enabled"
                  checked={financialsEnabled}
                  onCheckedChange={(checked) => {
                    setFinancialsEnabled(checked);
                    // When enabling financials for the first time, auto-check all three fields
                    if (checked && !financialsEnabled) {
                      setFinancialData(prev => ({
                        ...prev,
                        askingPriceIncluded: true,
                        revenueIncluded: true,
                        ebitdaIncluded: true
                      }));
                    }
                  }}
                />
              </div>
              
              {financialsEnabled && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-4">
                  {/* Asking Price */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={financialData.askingPriceIncluded}
                        onCheckedChange={(checked) => 
                          setFinancialData(prev => ({ ...prev, askingPriceIncluded: checked as boolean }))
                        }
                        className="h-4 w-4"
                      />
                      <Label className="text-xs text-muted-foreground">Asking Price</Label>
                    </div>
                    <Input
                      placeholder="$1,000,000"
                      value={financialData.askingPrice}
                      onChange={(e) => 
                        setFinancialData(prev => ({ ...prev, askingPrice: e.target.value }))
                      }
                      className="h-9"
                    />
                  </div>

                  {/* Annual Revenue */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={financialData.revenueIncluded}
                        onCheckedChange={(checked) => 
                          setFinancialData(prev => ({ ...prev, revenueIncluded: checked as boolean }))
                        }
                        className="h-4 w-4"
                      />
                      <Label className="text-xs text-muted-foreground">Annual Revenue</Label>
                    </div>
                    <Input
                      placeholder="$500,000"
                      value={financialData.revenue}
                      onChange={(e) => 
                        setFinancialData(prev => ({ ...prev, revenue: e.target.value }))
                      }
                      className="h-9"
                    />
                  </div>

                  {/* EBITDA */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={financialData.ebitdaIncluded}
                        onCheckedChange={(checked) => 
                          setFinancialData(prev => ({ ...prev, ebitdaIncluded: checked as boolean }))
                        }
                        className="h-4 w-4"
                      />
                      <Label className="text-xs text-muted-foreground">EBITDA</Label>
                    </div>
                    <Input
                      placeholder="$150,000"
                      value={financialData.ebitda}
                      onChange={(e) => 
                        setFinancialData(prev => ({ ...prev, ebitda: e.target.value }))
                      }
                      className="h-9"
                    />
                  </div>
                </div>
                
                <div className="space-y-3 mt-4">
                  <Label className="text-xs text-muted-foreground">Financial Documents (Optional)</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-4">
                    <div className="text-center">
                      <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <File className="h-4 w-4" />
                        Upload Files
                      </Button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Financial statements, tax returns, or other documents
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      multiple={true}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    />
                  </div>
                  
                  {financialFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Uploaded Files:</Label>
                      <div className="space-y-2">
                        {financialFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded border">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{file.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>

            {/* Analysis Directions - Cleaner, less busy interface */}
            <div className="space-y-4 p-4 border rounded-lg bg-background">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Analysis Directions</h3>
                  <p className="text-xs text-muted-foreground">
                    Customize how AI analyzes your transcript
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Settings className="h-4 w-4" />
                      Templates
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Manage Direction Templates</DialogTitle>
                      <DialogDescription>
                        Create, save, and load custom analysis direction templates
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Current Directions</Label>
                        <Textarea
                          className="min-h-[300px] text-sm"
                          value={customDirections}
                          onChange={(e) => {
                            setCustomDirections(e.target.value);
                            form.setValue("directions", e.target.value);
                          }}
                          placeholder="Enter your custom analysis directions..."
                        />
                      </div>

                      <div className="flex gap-2">
                        <Input 
                          placeholder="Template name (e.g., 'Investor Deck Template')"
                          value={templateNameInput}
                          onChange={(e) => setTemplateNameInput(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          type="button"
                          onClick={() => {
                            if (templateNameInput.trim()) {
                              saveCustomTemplate(templateNameInput.trim());
                            }
                          }}
                          disabled={!templateNameInput.trim()}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          Save Template
                        </Button>
                      </div>
                      
                      {analysisTemplates && analysisTemplates.length > 0 && (
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Saved Templates</Label>
                          <div className="grid grid-cols-1 gap-2">
                            {analysisTemplates.map((template) => (
                              <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                <div className="flex-1">
                                  <span className="text-sm font-medium">{template.name}</span>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {template.purpose} • {template.tone} • {template.audience}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadTemplate(template)}
                                    className="gap-2"
                                  >
                                    <FolderOpen className="h-4 w-4" />
                                    Load
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteTemplate(template.id)}
                                    className="gap-2 text-destructive hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              {/* Simplified preset controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Purpose</Label>
                  <Select
                    value={selectedPurpose}
                    onValueChange={(value) => {
                      setSelectedPurpose(value);
                      handlePresetChange(value, selectedTone, selectedAudience);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business_overview">Business Overview</SelectItem>
                      <SelectItem value="equity_raise">Equity Raise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tone</Label>
                  <Select
                    value={selectedTone}
                    onValueChange={(value) => {
                      setSelectedTone(value);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                      <SelectItem value="executive_summary">Executive Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Audience</Label>
                  <Select
                    value={selectedAudience}
                    onValueChange={(value) => {
                      setSelectedAudience(value);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investors">Investors</SelectItem>
                      <SelectItem value="partners">Partners</SelectItem>
                      <SelectItem value="internal_team">Internal Team</SelectItem>
                      <SelectItem value="potential_buyers">Potential Buyers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Compact custom directions field */}
              <div className="space-y-2">
                <Textarea
                  className="min-h-[80px] text-xs resize-y"
                  value={customDirections}
                  onChange={(e) => {
                    setCustomDirections(e.target.value);
                    form.setValue("directions", e.target.value);
                  }}
                  placeholder="Custom directions will appear here..."
                />
              </div>
              


              {currentDocId && (
                <div className="text-xs text-muted-foreground">
                  Regenerations remaining: {Math.max(0, subscriptionPlans[user?.subscriptionStatus as keyof typeof subscriptionPlans]?.regenerationLimit - (analysis?.regenerationCount || 0))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Button
                type="submit"
                disabled={generateMutation.isPending}
                className="w-full h-10 flex items-center justify-center"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {generateMutation.isPending ? "Processing..." : currentDocId ? "Regenerate CIM" : "Generate CIM"}
              </Button>
              
              {/* Show loading animation below the button in black text */}
              {generateMutation.isPending && (
                <div className="text-foreground text-center">
                  <LoadingAnimation 
                    size="sm" 
                    text={form.getValues('websiteUrl') 
                      ? "Analyzing transcript and website data..." 
                      : "Analyzing transcript..."} 
                    showProgress={!!form.getValues('websiteUrl')?.trim()}
                    progressSteps={[
                      "Validating website URL format...",
                      "Connecting to website...",
                      "Analyzing website content...",
                      "Enhancing CIM with website data..."
                    ]}
                  />
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {analysis && currentDocId && (
        <div>
          {analysis.sections ? (
            <div className="space-y-6">
              <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                <h3 className="font-medium text-green-800">New Flexible CIM Generated!</h3>
                <p className="text-sm text-green-600 mt-1">
                  Your document has been created using the new flexible system with {analysis.sections?.length || 0} sections.
                </p>
              </div>
              
              {/* Display flexible CIM structure */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{analysis.title || form.getValues("title")}</h2>
                  <div className="flex gap-2 text-sm">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {analysis.metadata?.purpose || 'Business Overview'}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                      {analysis.metadata?.tone || 'Professional'}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                      {analysis.metadata?.audience || 'Investors'}
                    </span>
                  </div>
                </div>
                
                {analysis.sections?.map((section: any, index: number) => (
                  <div key={section.id || index} className="border rounded-lg p-4">
                    <h3 className="font-medium text-lg mb-3">{section.title}</h3>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {section.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <CimDisplay
              analysis={analysis}
              docId={currentDocId}
              websiteUrl={form.getValues("websiteUrl")}
              logoUrl={analysis.logoUrl}
              selectedImages={selectedImages}
              title={form.getValues("title")}
            />
          )}
        </div>
      )}

      {analysis && !currentDocId && (
        <Card>
          <CardHeader>
            <CardTitle>Generated CIM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8 max-w-4xl mx-auto">
              {/* Company Logo Section - Display at the very top */}
              {analysis.logoUrl && (
                <div className="text-center py-6 border-b">
                  <img 
                    src={analysis.logoUrl} 
                    alt="Company Logo"
                    className="h-16 mx-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Business Overview</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Background</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium">Founded</p>
                        <p className="text-muted-foreground">{renderValue(analysis.story.yearStarted)}</p>
                      </div>
                      <div>
                        <p className="font-medium">Structure</p>
                        <p className="text-muted-foreground">{renderValue(analysis.story.businessStructure)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Website URL Display - After Background section */}
                  {form.getValues('websiteUrl') && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Business Website</h3>
                      <a 
                        href={form.getValues('websiteUrl').startsWith('http') ? form.getValues('websiteUrl') : `https://${form.getValues('websiteUrl')}`} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {form.getValues('websiteUrl')}
                      </a>
                      
                      {/* We'll implement screenshots in next phase */}
                    </div>
                  )}

                  {/* Selected Images Section */}
                  {selectedImages && selectedImages.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Business Images</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {selectedImages.map((imagePath: string, index: number) => (
                          <div key={index} className="border rounded-lg overflow-hidden">
                            <img
                              src={imagePath}
                              alt={`Business image ${index + 1}`}
                              className="w-full h-32 object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Business Summary</h3>
                    <p className="text-muted-foreground">{renderValue(analysis.story.businessSummary)}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Growth History</h3>
                    <p className="text-muted-foreground">{renderValue(analysis.story.growthHistory)}</p>
                  </div>

                  {analysis.story.saleReason && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Reason for Sale</h3>
                      <p className="text-muted-foreground">{renderValue(analysis.story.saleReason)}</p>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Investment Highlights</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Key Attractions</h3>
                    <ul className="list-disc pl-6 space-y-1">
                      {analysis.story.keyAttractions?.map((item: string, i: number) => (
                        <li key={i} className="text-muted-foreground">{renderValue(item)}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Growth Opportunities</h3>
                    <ul className="list-disc pl-6 space-y-1">
                      {analysis.executiveSummary.growthOpportunities?.map((item: string, i: number) => (
                        <li key={i} className="text-muted-foreground">{renderValue(item)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Market Position</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Target Market</h3>
                    <p className="text-muted-foreground">{renderValue(analysis.marketAnalysis.customerProfile)}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Competitive Landscape</h3>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Key Competitors</h4>
                          <ul className="list-disc pl-6 space-y-1">
                            {analysis.marketAnalysis.competitors?.map((competitor: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{renderValue(competitor)}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Business Strengths</h4>
                          <ul className="list-disc pl-6 space-y-1">
                            {analysis.marketAnalysis.strengths?.map((strength: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{renderValue(strength)}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Operations</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Customer Relationships</h3>
                    <div className="bg-muted rounded-lg p-4">
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Only show recurring revenue if it's explicitly mentioned and has meaningful content */}
                        {analysis.operations.customers.recurring && 
                         !String(analysis.operations.customers.recurring).toLowerCase().includes('not mentioned') &&
                         !String(analysis.operations.customers.recurring).toLowerCase().includes('unknown') &&
                         !String(analysis.operations.customers.recurring).toLowerCase().includes('n/a') &&
                         !String(analysis.operations.customers.recurring).toLowerCase().includes('not applicable') &&
                         !String(analysis.operations.customers.recurring).toLowerCase().includes('not provided') &&
                         !String(analysis.operations.customers.recurring).toLowerCase().includes('not specified') &&
                         !String(analysis.operations.customers.recurring).toLowerCase().includes('not answered') && (
                          <div>
                            <dt className="font-medium">Recurring Revenue</dt>
                            <dd className="text-muted-foreground">{renderValue(analysis.operations.customers.recurring)}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="font-medium">Customer Base</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.customers.relationships)}</dd>
                        </div>
                        {/* Only show concentration if it exists and isn't "not mentioned" */}
                        {analysis.operations.customers.concentration && 
                         !String(analysis.operations.customers.concentration).toLowerCase().includes('not mentioned') && (
                          <div>
                            <dt className="font-medium">Revenue Concentration</dt>
                            <dd className="text-muted-foreground">{renderValue(analysis.operations.customers.concentration)}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="font-medium">Contract Terms</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.customers.contracts)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Supply Chain</h3>
                    <div className="bg-muted rounded-lg p-4">
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <dt className="font-medium">Number of Suppliers</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.suppliers.count)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Supplier Terms</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.suppliers.terms)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Concentration</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.suppliers.concentration)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Relationship Transfer</dt>
                          <dd className="text-muted-foreground">{renderValue(analysis.operations.suppliers.transferability)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Team Structure</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Ownership & Management</h3>
                    <div className="space-y-2">
                      <p><strong>Owner's Role:</strong> {renderValue(analysis.team.ownerResponsibilities)}</p>
                      <p><strong>Required Hours:</strong> {renderValue(analysis.team.ownerHours)}</p>
                      <p><strong>Management Structure:</strong> {renderValue(analysis.team.management)}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Employee Overview</h3>
                    <div className="space-y-2">
                      <p><strong>Total Employees:</strong> {renderValue(analysis.team.employeeCount)}</p>
                      {analysis.team.contractorCount && (
                        <p><strong>Contractors:</strong> {renderValue(analysis.team.contractorCount)}</p>
                      )}
                      <p className="text-muted-foreground">{renderValue(analysis.team.employeeSummary)}</p>

                      {analysis.team.keyEmployees?.length > 0 && (
                        <div className="mt-4">
                          <p className="font-medium">Key Team Members:</p>
                          <ul className="list-disc pl-6 mt-2">
                            {analysis.team.keyEmployees.map((employee: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{renderValue(employee)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Equipment & Assets</h3>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">{renderValue(analysis.assets.equipmentDetails)}</p>
                      <p className="text-muted-foreground">{renderValue(analysis.assets.inventoryDetails)}</p>
                      <p><strong>Equipment Value:</strong> {renderValue(analysis.assets.equipmentValue)}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Contract Terms</h3>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium">Customer Contracts:</p>
                        <p className="text-muted-foreground">{renderValue(analysis.sales.contractTerms)}</p>
                      </div>
                      <div>
                        <p className="font-medium">Supplier Terms:</p>
                        <p className="text-muted-foreground">{renderValue(analysis.operations.suppliers.terms)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Marketing & Client Acquisition</h3>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">{renderValue(analysis.marketing.clientAcquisition)}</p>
                      <div className="mt-2">
                        <p className="font-medium">Marketing Strategies:</p>
                        <ul className="list-disc pl-6 mt-2">
                          {analysis.marketing.strategies.map((strategy: string, i: number) => (
                            <li key={i} className="text-muted-foreground">{renderValue(strategy)}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold border-b pb-2 mb-4">Facilities</h2>
                <div className="bg-muted rounded-lg p-4">
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="font-medium">Ownership Status</dt>
                      <dd className="text-muted-foreground">{renderValue(analysis.facility.ownership)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Size</dt>
                      <dd className="text-muted-foreground">{renderValue(analysis.facility.size)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Monthly Cost</dt>
                      <dd className="text-muted-foreground">{renderValue(analysis.facility.cost)}</dd>
                    </div>
                    {analysis.facility.leaseDetails && (
                      <div>
                        <dt className="font-medium">Lease Details</dt>
                        <dd className="text-muted-foreground">{renderValue(analysis.facility.leaseDetails)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>

              {analysis && (
                <div className="pt-4">
                  <DocumentExport analysis={analysis} docId={currentDocId!} user={user} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  );
}