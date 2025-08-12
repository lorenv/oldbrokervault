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
import { Loader2, Settings, Upload, X, FileText, Download, Copy, File, Save, FolderOpen, NotebookPen, DollarSign, Settings2 } from "lucide-react";
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
import { UnsplashIcon } from "@/components/ui/unsplash-icon";
import { TemplatesLibrary } from "./templates-library";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FormattingProfileSelector } from "./formatting-profile-selector";
import type { FormattingProfile } from "@shared/formatting-config";
import { ContentStyleSection } from "./content-style-section";

// Default section lines for the new interface
const DEFAULT_SECTION_LINES = [
  { id: '1', content: 'Business Summary - Clear description of what the company does, its value proposition, and market position' },
  { id: '2', content: 'Market Opportunity - Analysis of target market size, growth potential, and competitive landscape' },
  { id: '3', content: 'Business Model - How the company generates revenue and creates value for customers' },
  { id: '4', content: 'Operations - Key operational processes, locations, technology, and competitive advantages' },
  { id: '5', content: 'Growth Opportunities - Strategic initiatives, expansion plans, and potential for scaling' },
  { id: '6', content: 'Management & Team - Key personnel and organizational structure' },
  { id: '7', content: 'Financial Overview - Revenue, profitability, and key financial metrics' }
];

export function CimGenerator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cimMode, setCimMode] = useState<'choice' | 'generate' | 'upload'>('choice');

  // Fetch user limits
  const { data: userLimits, isLoading: limitsLoading } = useQuery<{
    canCreateDocument: boolean;
    canRegenerate: boolean;
    documentsCreated: number;
    documentLimit: number;
    regenerationsUsed: number;
    regenerationLimit: number;
    subscriptionStatus: string;
  }>({
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
  const [enableWebsiteAnalysis, setEnableWebsiteAnalysis] = useState(true);

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

  // Template state
  const [customDirections, setCustomDirections] = useState<string>('');
  const [selectedTemplateTitle, setSelectedTemplateTitle] = useState<string>('');
  
  // Content & Style state
  const [selectedFormattingProfile, setSelectedFormattingProfile] = useState<FormattingProfile>('balanced');
  const [sectionDirections, setSectionDirections] = useState(DEFAULT_SECTION_LINES);

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
    tone?: string;
    purpose?: string;
    audience?: string;
    sectionDirections?: Array<{id: string; content: string}>;
    formattingProfile?: string;
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      transcript: "",
      directions: DEFAULT_CIM_DIRECTIONS,
      websiteUrl: "",
      tone: "balanced",
      purpose: "business_overview", 
      audience: "investors",
      sectionDirections: DEFAULT_SECTION_LINES,
      formattingProfile: "balanced"
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
        // Show user-friendly message if provided by the API
        const message = data.message || "No suitable images were found on this website";
        toast({
          title: "No Images Found",
          description: message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error extracting images:', error);
      
      // Try to get user-friendly message from error response
      let errorMessage = "Failed to extract images from website";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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

  // Handle template selection
  const handleTemplateSelection = (template: any) => {
    setCustomDirections(template.prompt);
    setSelectedTemplateTitle(template.title);
    toast({
      title: "Template Applied",
      description: `${template.title} template has been applied to your analysis directions.`,
    });
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
      setGenerationStage("initializing");
      setProgressStartTime(Date.now());

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
      
      // Stage 3: Website analysis (if enabled)
      if (data.websiteUrl?.trim() && enableWebsiteAnalysis) {
        setTimeout(() => setGenerationStage("analyzing_website"), 1000);
      }

      if (data.transcript.length > 4000 || financialFiles.length > 0) {
        const file = new Blob([data.transcript], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('transcript', file, 'transcript.txt');
        formData.append('title', data.title);
        formData.append('directions', data.directions);
        
        // Add new section directions and formatting
        formData.append('sectionDirections', JSON.stringify(sectionDirections));
        formData.append('formattingProfile', selectedFormattingProfile);
        formData.append('tone', selectedFormattingProfile);
        formData.append('purpose', data.purpose || "business_overview");
        formData.append('audience', data.audience || "investors");

        if (hasWebsiteUrl) {
          if (enableWebsiteAnalysis) {
            formData.append('websiteUrl', data.websiteUrl!);
          }
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
          // Stage 4: Analyzing content
          const contentStageDelay = (data.websiteUrl?.trim() && enableWebsiteAnalysis) ? 1500 : 1000;
          setTimeout(() => setGenerationStage("analyzing_content"), contentStageDelay);

          // Stage 5: Generating document (before API call)
          const documentStageDelay = (data.websiteUrl?.trim() && enableWebsiteAnalysis) ? 2500 : 2000;
          setTimeout(() => setGenerationStage("generating_document"), documentStageDelay);

          const res = await fetch('/api/cim/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to generate CIM");
          }

          // Smooth completion sequence after AI response received
          // Stage 5: Processing financials (quick transition to show progress)
          setGenerationStage("processing_financials");
          await new Promise(resolve => setTimeout(resolve, 400));
          
          // Stage 6: Finalizing (another quick visual update)
          setGenerationStage("finalizing");
          await new Promise(resolve => setTimeout(resolve, 300));

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
          ...(hasWebsiteUrl && enableWebsiteAnalysis && { websiteUrl: data.websiteUrl }),
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
          // Stage 4: Analyzing content
          const contentStageDelay = (data.websiteUrl?.trim() && enableWebsiteAnalysis) ? 1500 : 1000;
          setTimeout(() => setGenerationStage("analyzing_content"), contentStageDelay);

          // Stage 5: Generating document (before API call)
          const documentStageDelay = (data.websiteUrl?.trim() && enableWebsiteAnalysis) ? 2500 : 2000;
          setTimeout(() => setGenerationStage("generating_document"), documentStageDelay);

          // Include formatting parameters and section directions in payload
          const enhancedPayload = {
            ...payload,
            sectionDirections,
            formattingProfile: selectedFormattingProfile,
            tone: selectedFormattingProfile,
            purpose: data.purpose || "business_overview",
            audience: data.audience || "investors"
          };
          
          const response = await apiRequest("POST", "/api/cim/generate", enhancedPayload);

          // Smooth completion sequence after AI response received
          // Stage 5: Processing financials (quick transition to show progress)
          setGenerationStage("processing_financials");
          await new Promise(resolve => setTimeout(resolve, 400));
          
          // Stage 6: Finalizing (another quick visual update)
          setGenerationStage("finalizing");
          await new Promise(resolve => setTimeout(resolve, 300));

          return response.json();
        } catch (error) {
          setWebsiteAnalysisStage(null);
          throw error;
        }
      }
    },
    onSuccess: (result) => {
      // Final completion stage for visual satisfaction
      setGenerationStage("complete");
      
      // Reset progress after a brief moment to show completion
      setTimeout(() => {
        setGenerationStage(null);
        setProgressStartTime(null);
      }, 300);

      // Show remaining stages quickly for visual completion
      const hasFinancials = financialFiles.length > 0 || 
        !!financialData.askingPrice || 
        !!financialData.revenue || 
        !!financialData.ebitda;

      if (hasFinancials) {
        // Already handled in the API call completion sequence
        setGenerationStage("processing_financials");
        setTimeout(() => {
          setGenerationStage("finalizing");
          setTimeout(() => {
            setGenerationStage("complete");
            setWebsiteAnalysisStage(null);
          }, 300); // Quick 300ms to show finalizing
        }, 400); // Quick 400ms to show processing_financials
      } else {
        // Skip to finalizing then complete
        setGenerationStage("finalizing");
        setTimeout(() => {
          setGenerationStage("complete");
          setWebsiteAnalysisStage(null);
        }, 400); // Quick 400ms to show finalizing
      }

      toast({
        title: "CIM Generated Successfully",
        description: "Your document has been created successfully! Redirecting you to the editor...",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });

      // Show completion for a moment, then redirect with first-time parameter
      setTimeout(() => {
        setGenerationStage(null);
        setProgressStartTime(null);
        window.location.assign(`/documents/${result.id}?tab=edit&first-time=true`);
      }, 2500); // Slightly longer to accommodate the quick completion sequence
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
        sectionDirections,
        formattingProfile: selectedFormattingProfile,
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
        <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-8">

          {/* Document Information Section */}
          <div className="space-y-0">
            <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
              <FileText className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">Document Information</h3>
                <p className="text-sm text-slate-200">Basic details about your CIM document</p>
              </div>
            </div>

            <div className="space-y-4 p-4 border border-t-0 rounded-b-lg bg-white">
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

                  <div className="space-y-3">
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

                    {/* Website Analysis Toggle */}
                    {form.watch("websiteUrl")?.trim() && (
                      <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Switch
                          id="website-analysis"
                          checked={enableWebsiteAnalysis}
                          onCheckedChange={setEnableWebsiteAnalysis}
                        />
                        <div className="flex-1">
                          <label 
                            htmlFor="website-analysis" 
                            className="text-sm font-medium cursor-pointer"
                          >
                            Enhanced Website Analysis
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Automatically extract additional business information from the website to enhance your CIM
                          </p>
                        </div>
                      </div>
                    )}

                    {form.formState.errors.websiteUrl && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.websiteUrl.message as string}
                      </p>
                    )}
                  </div>
                </div>
              </div>

          {/* Business Notes Section */}
          <div className="space-y-0">
            <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
              <NotebookPen className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">Business Notes</h3>
                <p className="text-sm text-slate-200">Paste your business meeting transcript or notes</p>
              </div>
            </div>

            <div className="p-4 border border-t-0 rounded-b-lg bg-white">
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
                          <UnsplashIcon className="h-4 w-4 mr-2" />
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
          <div className="space-y-0">
            <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
              <DollarSign className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">Financial Information</h3>
                <p className="text-sm text-slate-200">Add key financial metrics to enhance your CIM</p>
              </div>
            </div>

            <div className="space-y-6 p-4 border border-t-0 rounded-b-lg bg-white">
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

          {/* Content & Style Section */}
          <ContentStyleSection
            sectionDirections={sectionDirections}
            onSectionDirectionsChange={setSectionDirections}
            formattingProfile={selectedFormattingProfile}
            onFormattingProfileChange={(profile) => {
              setSelectedFormattingProfile(profile);
              form.setValue("formattingProfile", profile);
            }}
          />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full">
                  <Button 
                    type="submit" 
                    className={`w-full border-0 shadow-lg ${
                      userLimits && !userLimits.canCreateDocument && !generateMutation.isPending
                        ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed opacity-50" 
                        : "bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700"
                    } text-white`}
                    disabled={generateMutation.isPending || (userLimits && !userLimits.canCreateDocument)}
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
                  {/* Debug form validation - remove this after testing */}
                  {!form.formState.isValid && (
                    <div className="text-xs text-red-500 mt-2">
                      Form errors: {JSON.stringify(form.formState.errors)}
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              {userLimits && !userLimits.canCreateDocument && !generateMutation.isPending && (
                <TooltipContent>
                  <p>You've reached your monthly CIM generation limit ({userLimits.documentsCreated}/{userLimits.documentLimit}). 
                     Upgrade your subscription to continue creating CIMs.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

              {/* Show progress during generation */}
              {generateMutation.isPending && generationStage && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-600 mb-2 font-medium">
                    Generating your CIM document...
                  </div>
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
        </form>
      ) : (
        <div className="space-y-6">
          {/* Show progress when generating */}
          {generationStage && (
            <div className="mb-6">
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

          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Generated CIM</h2>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="outline"
                        onClick={() => regenerateAnalysisMutation.mutate()}
                        disabled={regenerateAnalysisMutation.isPending || (userLimits && !userLimits.canRegenerate)}
                        className={`gap-2 ${
                          userLimits && !userLimits.canRegenerate && !regenerateAnalysisMutation.isPending
                            ? "opacity-50 cursor-not-allowed" 
                            : ""
                        }`}
                      >
                        {regenerateAnalysisMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Regenerate"
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {userLimits && !userLimits.canRegenerate && !regenerateAnalysisMutation.isPending && (
                    <TooltipContent>
                      <p>You've reached your monthly regeneration limit ({userLimits.regenerationsUsed}/{userLimits.regenerationLimit}). 
                         Upgrade your subscription to continue regenerating CIMs.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <DocumentExport
                analysis={analysis}
                docId={currentDocId || 0}
                websiteUrl={form.getValues("websiteUrl")}
                logoUrl={analysis.logoUrl}
                selectedImages={selectedImages}
              />
            </div>
          </div>

          <CimDisplay
            analysis={analysis}
            docId={currentDocId || 0}
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