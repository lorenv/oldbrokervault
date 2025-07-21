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
import { CimGenerationProgress, type CimGenerationStage } from "@/components/ui/cim-generation-progress";
import { DocumentExport } from './document-export';
import { CimDisplay } from './cim-display';
import { CimFileUpload } from './cim-file-upload';
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ImageIcon, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { DraggableImagePositioner } from "./draggable-image-positioner";

export function CimGenerator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cimMode, setCimMode] = useState<'choice' | 'generate' | 'upload'>('choice');
  
  // Fetch user limits
  const { data: userLimits, isLoading: limitsLoading } = useQuery({
    queryKey: ["/api/user/limits"],
    staleTime: 1000 * 30, // 30 seconds
  });

  // Fetch user profile for personalized welcome message
  const { data: userProfile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Load analysis templates from database
  const { data: analysisTemplates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['/api/analysis-templates'],
    enabled: !!user,
  });
  const [analysis, setAnalysis] = useState<any>(null);
  const [currentDocId, setCurrentDocId] = useState<number | null>(null);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);
  const [websiteAnalysisStage, setWebsiteAnalysisStage] = useState<string | null>(null);
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isExtractingImages, setIsExtractingImages] = useState(false);
  
  // CIM Generation Progress State
  const [generationStage, setGenerationStage] = useState<CimGenerationStage | null>(null);
  const [progressStartTime, setProgressStartTime] = useState<number | null>(null);
  const [financialData, setFinancialData] = useState({
    askingPrice: '',
    revenue: '',
    ebitda: '',
  });
  const [financialFiles, setFinancialFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New analysis template state
  const [selectedPurpose, setSelectedPurpose] = useState<string>('business_overview');
  const [selectedTone, setSelectedTone] = useState<string>('professional');
  const [selectedAudience, setSelectedAudience] = useState<string>('investors');
  const [customDirections, setCustomDirections] = useState<string>(DEFAULT_ANALYSIS_TEMPLATES.business_overview.customDirections);
  const [templateName, setTemplateName] = useState<string>('');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState<string>('');

  // Cover image state
  const [selectedCoverImage, setSelectedCoverImage] = useState<string | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePosition, setCoverImagePosition] = useState({ x: 50, y: 50 });
  const [coverImageAttribution, setCoverImageAttribution] = useState<string>('');
  const [isUnsplashDialogOpen, setIsUnsplashDialogOpen] = useState(false);
  const [unsplashSearchQuery, setUnsplashSearchQuery] = useState('');
  const [unsplashResults, setUnsplashResults] = useState<any[]>([]);
  const [isSearchingUnsplash, setIsSearchingUnsplash] = useState(false);
  const [isCoverImageSectionOpen, setIsCoverImageSectionOpen] = useState(false);
  const coverImageFileInputRef = useRef<HTMLInputElement>(null);



  // Extend the schema with URL validation
  const formSchema = insertCimDocumentSchema.extend({
    websiteUrl: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          try {
            const url = val.startsWith('http') ? val : `https://${val}`;
            new URL(url);
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

  const renderValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return 'Not provided';
    }
    return value;
  };

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

  const selectUnsplashImage = async (image: any) => {
    try {
      const response = await fetch('/api/unsplash/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          downloadUrl: image.links.download_location
        })
      });
    } catch (error) {
      console.error('Failed to trigger Unsplash download event:', error);
    }
    
    const photographerUrl = `${image.user.links.html}?utm_source=CIM_Generator&utm_medium=referral`;
    const unsplashUrl = `https://unsplash.com/?utm_source=CIM_Generator&utm_medium=referral`;
    const attribution = `Photo by <a href="${photographerUrl}" target="_blank" rel="noopener noreferrer">${image.user.name}</a> on <a href="${unsplashUrl}" target="_blank" rel="noopener noreferrer">Unsplash</a>`;
    
    setSelectedCoverImage(image.urls.regular);
    setCoverImageFile(null); // Clear file state when selecting Unsplash image
    setCoverImageAttribution(attribution);
    setIsUnsplashDialogOpen(false);
  };

  const handleGenerate = async (data: FormValues) => {
    generateMutation.mutate(data);
  };

  const generateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Initialize progress tracking
      console.log("🚀 Starting CIM generation with progress tracking");
      setGenerationStage("initializing");
      setProgressStartTime(Date.now());
      console.log("📊 Progress stage set to: initializing");
      
      // Determine content characteristics for progress estimation
      const hasFinancials = financialFiles.length > 0 || 
        financialData.askingPrice || 
        financialData.revenue || 
        financialData.ebitda;
      const hasLargeContent = data.transcript.length > 4000;
      
      // Set up website analysis tracking
      const hasWebsiteUrl = !!data.websiteUrl?.trim();
      
      // Stage 2: Processing transcript
      setTimeout(() => setGenerationStage("processing_transcript"), 500);
      
      if (data.transcript.length > 4000 || financialFiles.length > 0) {
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

        // Add financial data (always enabled)
        formData.append('financials', JSON.stringify({
          enabled: true,
          ...financialData
        }));

        // Debug: Log what we're sending via FormData
        console.log("=== FRONTEND FORMDATA DEBUG ===");
        console.log("Financial data state:", financialData);
        console.log("Financial files state:", financialFiles);
        console.log("FormData financials:", JSON.stringify({
          enabled: true,
          ...financialData
        }));

        // Add financial files to FormData
        financialFiles.forEach((file, index) => {
          formData.append(`financialFile_${index}`, file);
        });

        // Add cover image data if selected
        if (selectedCoverImage) {
          formData.append('coverImageUrl', selectedCoverImage);
          formData.append('coverImagePosition', JSON.stringify(coverImagePosition));
          if (coverImageAttribution) {
            formData.append('coverImageAttribution', coverImageAttribution);
          }
          
          // If it's a blob URL (user uploaded file), also append the file
          if (selectedCoverImage.startsWith('blob:') && coverImageFile) {
            formData.append('coverImage', coverImageFile);
          }
        }

        try {
          // Stage 3: Analyzing content
          setTimeout(() => {
            console.log("📊 Progress stage set to: analyzing_content (FormData)");
            setGenerationStage("analyzing_content");
          }, 1000);
          
          // Stage 4: Generating document (before API call)
          setTimeout(() => {
            console.log("📊 Progress stage set to: generating_document (FormData)");
            setGenerationStage("generating_document");
          }, 2000);
          
          const res = await fetch('/api/cim/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to generate CIM");
          }
          
          // Stage 5: Processing financials (if any), then finalizing
          if (hasFinancials) {
            setGenerationStage("processing_financials");
            // Give a moment for the financial processing stage to show
            setTimeout(() => setGenerationStage("finalizing"), 500);
          } else {
            setGenerationStage("finalizing");
          }
          
          return res.json();
        } catch (error) {
          setWebsiteAnalysisStage(null);
          throw error;
        }
      } else {
        const payload = {
          title: data.title,
          transcript: data.transcript,
          directions: data.directions,
          purpose: selectedPurpose,
          tone: selectedTone,
          audience: selectedAudience,
          ...(hasWebsiteUrl && { websiteUrl: data.websiteUrl }),
          ...(selectedImages.length > 0 && { selectedImages }),
          ...(currentDocId && { docId: currentDocId }),
          financials: {
            enabled: true,
            ...financialData
          },
          ...(selectedCoverImage && {
            coverImageUrl: selectedCoverImage,
            coverImagePosition: JSON.stringify(coverImagePosition),
            ...(coverImageAttribution && { coverImageAttribution })
          })
        };

        // Debug: Log what we're sending to the server
        console.log("=== FRONTEND PAYLOAD DEBUG ===");
        console.log("Financial data state:", financialData);
        console.log("Financial files state:", financialFiles);
        console.log("Payload financials:", payload.financials);
        console.log("Full payload keys:", Object.keys(payload));
        console.log("Payload size:", JSON.stringify(payload).length);

        try {
          // Stage 3: Analyzing content
          setTimeout(() => {
            console.log("📊 Progress stage set to: analyzing_content (Regular)");
            setGenerationStage("analyzing_content");
          }, 1000);
          
          // Stage 4: Generating document (before API call)
          setTimeout(() => {
            console.log("📊 Progress stage set to: generating_document (Regular)");
            setGenerationStage("generating_document");
          }, 2000);
          
          const response = await apiRequest("POST", "/api/cim/generate", payload);
          
          // Stage 5: Processing financials (if any), then finalizing
          if (hasFinancials) {
            setGenerationStage("processing_financials");
            // Give a moment for the financial processing stage to show
            setTimeout(() => setGenerationStage("finalizing"), 500);
          } else {
            setGenerationStage("finalizing");
          }
          
          return response.json();
        } catch (error) {
          setWebsiteAnalysisStage(null);
          throw error;
        }
      }
    },
    onSuccess: (result) => {
      // Complete the progress
      setGenerationStage("complete");
      setWebsiteAnalysisStage(null);
      
      toast({
        title: "CIM Generated Successfully",
        description: "Your document has been created successfully!",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
      
      // Show completion for a moment, then redirect
      setTimeout(() => {
        setGenerationStage(null);
        setProgressStartTime(null);
        window.location.assign(`/documents/${result.id}?tab=edit`);
      }, 2000);
    },
    onError: (error) => {
      // Reset progress state on error
      setGenerationStage(null);
      setProgressStartTime(null);
      setWebsiteAnalysisStage(null);
      
      console.error("Generation error:", error);
      toast({
        title: "Error Generating CIM",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const regenerateAnalysisMutation = useMutation({
    mutationFn: async () => {
      const data = form.getValues();
      const payload = {
        docId: currentDocId,
        title: data.title,
        transcript: data.transcript,
        directions: data.directions,
        purpose: selectedPurpose,
        tone: selectedTone,
        audience: selectedAudience,
        websiteUrl: data.websiteUrl,
        selectedImages
      };
      
      const response = await apiRequest("POST", "/api/cim/regenerate", payload);
      return response.json();
    },
    onSuccess: (result) => {
      if (result.analysis) {
        setAnalysis(result.analysis);
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/cim/${currentDocId}`] });
      
      toast({
        title: "Analysis Regenerated",
        description: "Your document has been updated with new analysis.",
      });
    },
    onError: (error) => {
      console.error("Regeneration error:", error);
      toast({
        title: "Error Regenerating Analysis",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  // Template management mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: { name: string; customDirections: string }) => {
      return apiRequest("POST", "/api/analysis-templates", templateData);
    },
    onSuccess: () => {
      refetchTemplates();
      setTemplateName('');
      setIsTemplateDialogOpen(false);
      toast({
        title: "Template Saved",
        description: "Your template has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    }
  });

  const loadTemplate = (template: any) => {
    setCustomDirections(template.customDirections);
    form.setValue("directions", template.customDirections);
    setIsTemplateDialogOpen(false);
    toast({
      title: "Template Loaded",
      description: `Loaded template: ${template.name}`,
    });
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
      setCoverImageFile(file); // Store the actual file for upload
      setCoverImageAttribution('');
    }
    if (coverImageFileInputRef.current) {
      coverImageFileInputRef.current.value = '';
    }
  };

  if (cimMode === 'choice') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Generate Your CIM</h2>
          <p className="text-muted-foreground">
            Choose how you'd like to create your Confidential Information Memorandum
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCimMode('generate')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Generate from Notes/Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Upload or paste a business meeting transcript and let AI generate a professional CIM for you.
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCimMode('upload')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Existing Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Upload your own CIM to enhance it with NDA, sharing, and analytics
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (cimMode === 'upload') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setCimMode('choice')}
            className="gap-2"
          >
            ← Back to Options
          </Button>
        </div>
        <CimFileUpload />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {!analysis && (
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setCimMode('choice')}
            className="gap-2"
          >
            ← Back to Options
          </Button>
        </div>
      )}
      
      {!analysis ? (
        <Card>
          <CardContent className="pt-6">
            {/* Show progress during generation */}
            {generateMutation.isPending && generationStage && (
              <div className="mb-6">
                {console.log("🎯 Rendering progress bar with stage:", generationStage, "isPending:", generateMutation.isPending)}
                <CimGenerationProgress
                  stage={generationStage}
                  hasFinancials={
                    financialFiles.length > 0 || 
                    !!financialData.askingPrice || 
                    !!financialData.revenue || 
                    !!financialData.ebitda
                  }
                  hasLargeContent={(form.getValues("transcript")?.length || 0) > 4000}
                />
              </div>
            )}
            
            <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-8">
              
              {/* Document Information Section */}
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="text-lg font-semibold text-gray-900">Document Information</h3>
                  <p className="text-sm text-gray-600">Basic details about your CIM document</p>
                </div>
                
                <div className="space-y-4 ml-4">
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
                        placeholder="Website URL (optional) - e.g., example.com"
                        {...form.register("websiteUrl")}
                        className="pr-20"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = form.getValues("websiteUrl");
                          if (url?.trim()) {
                            extractImages(url);
                          }
                        }}
                        disabled={!form.watch("websiteUrl")?.trim() || isExtractingImages}
                        className="absolute right-1 top-1 h-8 px-2 text-xs"
                      >
                        {isExtractingImages ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Extract Images"
                        )}
                      </Button>
                    </div>
                    {form.formState.errors.websiteUrl && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.websiteUrl.message as string}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Business Notes Section */}
              <div className="space-y-4">
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="text-lg font-semibold text-gray-900">Business Notes</h3>
                  <p className="text-sm text-gray-600">Paste your business meeting transcript or notes</p>
                </div>
                
                <div className="ml-4">
                  <Textarea
                    placeholder="Paste your business notes here..."
                    className="min-h-[200px]"
                    {...form.register("transcript")}
                  />
                  {form.formState.errors.transcript && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.transcript.message as string}
                    </p>
                  )}
                </div>
              </div>

              {/* Image extraction and selection section */}
              {form.watch("websiteUrl") && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium">Website Images</h4>
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

              {/* Cover Image Section - Always visible */}
              <div className="border rounded-lg bg-background">
                <div className="p-4 border-b">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Cover Image</span>
                    {selectedCoverImage && <Badge variant="secondary">Set</Badge>}
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {selectedCoverImage && (
                    <div className="space-y-3">
                      <DraggableImagePositioner
                        imageUrl={selectedCoverImage}
                        position={coverImagePosition}
                        onPositionChange={setCoverImagePosition}
                        className="w-full"
                      />
                      
                      {coverImageAttribution && (
                        <div 
                          className="text-xs text-gray-500 p-2 bg-gray-50 rounded"
                          dangerouslySetInnerHTML={{ __html: coverImageAttribution }}
                        />
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
                      onClick={() => coverImageFileInputRef.current?.click()}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
                    </Button>
                    
                    <Dialog open={isUnsplashDialogOpen} onOpenChange={setIsUnsplashDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          type="button"
                          variant="outline" 
                          className="flex-1"
                        >
                          <Search className="h-4 w-4 mr-2" />
                          Search Unsplash
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                        <DialogHeader>
                          <DialogTitle>Search Unsplash Images</DialogTitle>
                          <DialogDescription>
                            Find professional cover images for your CIM document
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Search for images..."
                              value={unsplashSearchQuery}
                              onChange={(e) => setUnsplashSearchQuery(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && searchUnsplash()}
                            />
                            <Button onClick={searchUnsplash} disabled={isSearchingUnsplash}>
                              {isSearchingUnsplash ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                            {unsplashResults.map((image, index) => (
                              <div
                                key={index}
                                className="relative cursor-pointer border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                                onClick={() => selectUnsplashImage(image)}
                              >
                                <img
                                  src={image.urls.small}
                                  alt={image.alt_description || `Image ${index + 1}`}
                                  className="w-full h-32 object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-xs">
                                  by {image.user.name}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {unsplashResults.length === 0 && !isSearchingUnsplash && (
                            <div className="text-center py-8 text-muted-foreground">
                              Search for images above to get started
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <input
                    type="file"
                    ref={coverImageFileInputRef}
                    onChange={handleCoverImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Financial Information Section - Simplified */}
              <div className="space-y-4">
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="text-lg font-semibold text-gray-900">Financial Information</h3>
                  <p className="text-sm text-gray-600">Add key financial metrics to enhance your CIM</p>
                </div>
                
                <div className="ml-4 space-y-6 p-4 border rounded-lg bg-background">
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* Asking Price */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Asking Price</Label>
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
                      <Label className="text-sm font-medium">Annual Revenue</Label>
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
                      <Label className="text-sm font-medium">EBITDA</Label>
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
                </div>

              {/* Analysis Directions Section */}
              <div className="space-y-4">
                <div className="border-l-4 border-orange-500 pl-4">
                  <h3 className="text-lg font-semibold text-gray-900">Analysis Directions</h3>
                  <p className="text-sm text-gray-600">Customize how AI analyzes your transcript</p>
                </div>
                
                <div className="ml-4 space-y-4 p-4 border rounded-lg bg-background">
                  <div className="flex items-center justify-between">
                    <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
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
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Current Directions Editor */}
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
                            
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Template Name</Label>
                              <Input
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="Enter template name..."
                              />
                            </div>
                            
                            <Button 
                              size="sm" 
                              onClick={() => {
                                if (!templateName.trim()) {
                                  toast({
                                    title: "Error",
                                    description: "Please enter a template name.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                createTemplateMutation.mutate({
                                  name: templateName.trim(),
                                  customDirections: customDirections
                                });
                              }}
                              disabled={createTemplateMutation.isPending}
                              className="w-full"
                            >
                              {createTemplateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Save as Template
                            </Button>
                          </div>

                          {/* Saved Templates List */}
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">Saved Templates</Label>
                            <div className="border rounded-lg max-h-[350px] overflow-y-auto">
                              {analysisTemplates.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground">
                                  No saved templates yet. Create your first template!
                                </div>
                              ) : (
                                <div className="space-y-2 p-2">
                                  {analysisTemplates.map((template: any) => (
                                    <div key={template.id} className="p-3 border rounded hover:bg-muted/50 cursor-pointer"
                                         onClick={() => loadTemplate(template)}>
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <h4 className="font-medium text-sm">{template.name}</h4>
                                          <p className="text-xs text-muted-foreground">
                                            {template.customDirections.slice(0, 80)}...
                                          </p>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            loadTemplate(template);
                                          }}
                                        >
                                          <FolderOpen className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Purpose</Label>
                    <Select
                      value={selectedPurpose}
                      onValueChange={(value) => {
                        setSelectedPurpose(value);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="business_overview">Business Overview</SelectItem>
                        <SelectItem value="investment_memo">Investment Memo</SelectItem>
                        <SelectItem value="sale_preparation">Sale Preparation</SelectItem>
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
                        <SelectItem value="internal_team">Internal Team</SelectItem>
                        <SelectItem value="high_school_level">High School Level</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Custom directions with grey title */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Custom Directions</Label>
                  <Textarea
                    className="min-h-[160px] text-xs resize-y"
                    value={customDirections}
                    onChange={(e) => {
                      setCustomDirections(e.target.value);
                      form.setValue("directions", e.target.value);
                    }}
                    placeholder="Custom directions will appear here..."
                  />
                </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {generationStage ? 'Generating your CIM document...' : 'Starting generation...'}
                  </>
                ) : (
                  "Generate CIM"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Show progress when generating */}
          {generationStage && (
            <div className="mb-6">
              <CimGenerationProgress
                stage={generationStage}
                hasFinancials={
                  financialFiles.length > 0 || 
                  financialData.askingPrice || 
                  financialData.revenue || 
                  financialData.ebitda
                }
                hasLargeContent={(form.getValues("transcript")?.length || 0) > 4000}
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Generated CIM</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => regenerateAnalysisMutation.mutate()}
                disabled={regenerateAnalysisMutation.isPending}
                className="gap-2"
              >
                {regenerateAnalysisMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Regenerate"
                )}
              </Button>
              <DocumentExport
                analysis={analysis}
                docId={currentDocId}
                title={form.getValues("title")}
                logoUrl={analysis.logoUrl}
                selectedImages={selectedImages}
              />
            </div>
          </div>

          <CimDisplay
            analysis={analysis}
            docId={currentDocId}
            websiteUrl={form.getValues("websiteUrl")}
            logoUrl={analysis.logoUrl}
            selectedImages={selectedImages}
            title={form.getValues("title")}
          />
        </div>
      )}
    </div>
  );
}