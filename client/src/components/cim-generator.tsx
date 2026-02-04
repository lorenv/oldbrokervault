import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCimDocumentSchema, DEFAULT_CIM_DIRECTIONS, DEFAULT_ANALYSIS_TEMPLATES, subscriptionPlans } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Settings, Upload, X, FileText, Download, Copy, File, Save, FolderOpen, NotebookPen, DollarSign, Settings2, Shield, UserCheck, ExternalLink, Paperclip, Check, Zap, Sparkles, Plus, Briefcase } from "lucide-react";
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
import { useBrandColor } from "@/hooks/use-brand-color";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FormattingProfileSelector, type CustomStyleConfig } from "./formatting-profile-selector";
import type { FormattingProfile } from "@shared/formatting-config";
import { ContentStyleSection } from "./content-style-section";
import { SDEAnalyzerModal } from "./sde-analyzer-modal";
import { sanitizeHtml } from "@/lib/sanitize";

// Default section lines for the new interface
const DEFAULT_SECTION_LINES = [
  { id: '1', content: 'Business Summary - Clear description of what the company does, its value proposition, and market position' },
  { id: '2', content: 'Market Opportunity - Analysis of target market size, growth potential, and competitive landscape' },
  { id: '3', content: 'Business Model - How the company generates revenue and creates value for customers' },
  { id: '4', content: 'Operations - Key operational processes, locations, technology, and competitive advantages' },
  { id: '5', content: 'Growth Opportunities - Strategic initiatives, expansion plans, and potential for scaling' },
  { id: '6', content: 'Management & Team - Key personnel and organizational structure' }
];

// Remove this line as it's not needed

interface CimGeneratorProps {
  onModeChange?: (mode: 'choice' | 'generate' | 'upload') => void;
  dealId?: number | null;
}

export function CimGenerator({ onModeChange, dealId }: CimGeneratorProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { brandColor, needsDarkText } = useBrandColor();
  const [cimMode, setCimMode] = useState<'choice' | 'generate' | 'upload'>('choice');

  // Debug: Log dealId prop
  console.log('[CimGenerator] Received dealId prop:', dealId, 'type:', typeof dealId);

  // Notify parent component when mode changes
  useEffect(() => {
    onModeChange?.(cimMode);
  }, [cimMode, onModeChange]);

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

  // NDA Protection state (declare early for hook dependencies)
  const [ndaSettings, setNdaSettings] = useState({
    ndaProtected: false,
    ndaTemplateId: null as number | null,
    ndaApprovalRequired: false
  });

  // Load analysis templates from database
  const { data: analysisTemplates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['/api/analysis-templates'],
    enabled: !!user,
  });
  
  // Load NDA templates from database
  const { data: ndaTemplates = [], isLoading: ndaTemplatesLoading, error: ndaTemplatesError } = useQuery<any[]>({
    queryKey: ['/api/nda-templates'],
    enabled: !!user, // Always load templates when user is authenticated
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/nda-templates");
      if (!response.ok) throw new Error('Failed to fetch NDA templates');
      const data = await response.json();
// Debug log
      return data;
    }
  });
  
  const [analysis, setAnalysis] = useState<any>(null);
  const [currentDocId, setCurrentDocId] = useState<number | null>(null);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);
  const [websiteAnalysisStage, setWebsiteAnalysisStage] = useState<string | null>(null);
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isExtractingImages, setIsExtractingImages] = useState(false);
  const [enableWebsiteAnalysis, setEnableWebsiteAnalysis] = useState(true);
  const [isSDEModalOpen, setIsSDEModalOpen] = useState(false);

  // CIM Generation Progress State
  const [generationStage, setGenerationStage] = useState<CimGenerationStage | null>(null);
  const stageTimersRef = useRef<NodeJS.Timeout[]>([]);
  const [progressStartTime, setProgressStartTime] = useState<number | null>(null);
  const [financialData, setFinancialData] = useState({
    askingPrice: '',
    revenue: '',
    ebitda: '',
  });
  const [financialFiles, setFinancialFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);  // Separate ref for text extraction

  // File upload state for text extraction
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string>('');
  const [extractedTextMetadata, setExtractedTextMetadata] = useState<{
    filename: string;
    fileType: string;
    fileSize: number;
    pageCount?: number;
    wordCount: number;
    processingTime: number;
  } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [supportedTypes, setSupportedTypes] = useState<{
    extensions: string[];
    mimeTypes: string[];
    maxSize: number;
  } | null>(null);

  // Template state
  const [customDirections, setCustomDirections] = useState<string>('');
  const [selectedTemplateTitle, setSelectedTemplateTitle] = useState<string>('');
  
  // Content & Style state
  const [selectedFormattingProfile, setSelectedFormattingProfile] = useState<FormattingProfile>('balanced');
  const [sectionDirections, setSectionDirections] = useState(DEFAULT_SECTION_LINES);
  const [customStyleConfig, setCustomStyleConfig] = useState<CustomStyleConfig | null>(null);

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

  // Fetch supported file types on component mount
  useEffect(() => {
    const fetchSupportedTypes = async () => {
      try {
        const response = await apiRequest('GET', '/api/text-extraction/info');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSupportedTypes(data.supportedTypes);
          }
        }
      } catch (error) {
      }
    };

    fetchSupportedTypes();
  }, []);

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
    }

    const photographerUrl = `${image.user.links.html}?utm_source=CIM_Generator&utm_medium=referral`;
    const unsplashUrl = `https://unsplash.com/?utm_source=CIM_Generator&utm_medium=referral`;
    const attribution = `Photo by <a href="${photographerUrl}" target="_blank" rel="noopener noreferrer">${image.user.name}</a> on <a href="${unsplashUrl}" target="_blank" rel="noopener noreferrer">Unsplash</a>`;

    setSelectedCoverImage(image.urls.regular);
    setCoverImageFile(null); // Clear file state when selecting Unsplash image
    setCoverImageAttribution(attribution);
    setIsUnsplashDialogOpen(false);
  };

  // File upload handler for text extraction
  const handleTextFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingFile(true);
    setUploadingFileName(file.name);
    setShowSuccessAnimation(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiRequest('POST', '/api/text-extraction/extract', {
        body: formData
        // Don't set Content-Type header, let browser set it with boundary for FormData
      });


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract text from file');
      }

      const result = await response.json();
      
      if (result.success) {
        // Set the extracted text in the form
        form.setValue('transcript', result.text);
        
        // Store metadata for success animation
        setExtractedTextMetadata(result.metadata);
        setShowSuccessAnimation(true);
        
        // Hide success animation after 5 seconds
        setTimeout(() => setShowSuccessAnimation(false), 5000);

        toast({
          title: "Text Extracted Successfully!",
          description: `Extracted ${result.metadata.wordCount} words from ${result.metadata.filename}`,
        });
      } else {
        throw new Error(result.error || 'Text extraction failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract text from file';
      
      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploadingFile(false);
      setUploadingFileName('');
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleGenerate = async (data: FormValues) => {
    generateMutation.mutate(data);
  };

  const generateMutation = useMutation({
    mutationFn: async (data: FormValues) => {

      // Clear any existing timers before starting new ones
      stageTimersRef.current.forEach(timer => clearTimeout(timer));
      stageTimersRef.current = [];

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

      // Start stage progression timers immediately (run independently while API works)
      // Shorter intervals for smoother progression - the API typically takes 15-30 seconds total

      // Stage 2: Processing transcript (1.5 second delay - quick start)
      stageTimersRef.current.push(
        setTimeout(() => setGenerationStage("processing_transcript"), 1500)
      );

      // Stage 3+: Adjust timing based on whether website analysis is enabled
      if (data.websiteUrl?.trim() && enableWebsiteAnalysis) {
        // With website: more stages, spread across expected ~25-30 second generation
        stageTimersRef.current.push(
          setTimeout(() => setGenerationStage("analyzing_website"), 4000)
        );
        stageTimersRef.current.push(
          setTimeout(() => setGenerationStage("analyzing_content"), 8000)
        );
        stageTimersRef.current.push(
          setTimeout(() => setGenerationStage("generating_document"), 12000)
        );
      } else {
        // Without website: fewer stages, spread across expected ~15-20 second generation
        stageTimersRef.current.push(
          setTimeout(() => setGenerationStage("analyzing_content"), 4000)
        );
        stageTimersRef.current.push(
          setTimeout(() => setGenerationStage("generating_document"), 7000)
        );
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

        // Add custom style config if active
        if (customStyleConfig) {
          formData.append('customStyleConfig', JSON.stringify(customStyleConfig));
        }

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

        // Add NDA settings
        formData.append('ndaSettings', JSON.stringify(ndaSettings));

        // Add deal association if provided
        if (dealId) {
          formData.append('dealId', dealId.toString());
          console.log('[CimGenerator] Added dealId to FormData:', dealId);
        } else {
          console.log('[CimGenerator] No dealId to add to FormData. Value:', dealId);
        }

        try {
          // Start API call immediately (runs in background while stage timers progress)
          const res = await fetch('/api/cim/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to generate CIM");
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

        try {
          // Include formatting parameters and section directions in payload
          const enhancedPayload = {
            ...payload,
            sectionDirections,
            formattingProfile: selectedFormattingProfile,
            tone: selectedFormattingProfile,
            purpose: data.purpose || "business_overview",
            audience: data.audience || "investors",
            ndaSettings,
            ...(customStyleConfig && { customStyleConfig }),
            ...(dealId && { dealId })
          };

          console.log('[CimGenerator] Enhanced payload dealId:', enhancedPayload.dealId, 'from prop:', dealId);

          // Start API call immediately (runs in background while stage timers progress)
          const response = await apiRequest("POST", "/api/cim/generate", { body: enhancedPayload });

          return response.json();
        } catch (error) {
          setWebsiteAnalysisStage(null);
          throw error;
        }
      }
    },
    onSuccess: async (result) => {
      // Store in session storage so we can check after redirect
      if (result.id) {
        sessionStorage.setItem(`doc_${result.id}_nda`, JSON.stringify({
          ndaProtected: result.ndaProtected,
          ndaTemplateId: result.ndaTemplateId,
          ndaApprovalRequired: result.ndaApprovalRequired,
          timestamp: new Date().toISOString()
        }));
      }

      // Clear all pending stage timers
      stageTimersRef.current.forEach(timer => clearTimeout(timer));
      stageTimersRef.current = [];

      // Background generation is now in progress on the server
      // Show brief "redirecting" stage, then navigate to document page
      // The document page will show the generating state and poll for completion
      setGenerationStage("generating_document");
      setWebsiteAnalysisStage(null);

      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });

      // Brief delay to show the stage transition, then redirect
      // Document page will handle the "generating" state with polling
      setTimeout(() => {
        setGenerationStage(null);
        setProgressStartTime(null);
        window.location.assign(`/documents/${result.id}?tab=edit`);
      }, 800); // Quick transition to document page
    },
    onError: (error) => {
      // Clear all pending stage timers
      stageTimersRef.current.forEach(timer => clearTimeout(timer));
      stageTimersRef.current = [];

      // Reset progress state on error
      setGenerationStage(null);
      setProgressStartTime(null);
      setWebsiteAnalysisStage(null);

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

      const response = await apiRequest("POST", "/api/cim/regenerate", { body: payload });
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
      <div className="space-y-8 max-w-3xl mx-auto">
        {/* Deal Association Banner */}
        {dealId && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Briefcase className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">Creating CIM for Deal #{dealId}</p>
              <p className="text-xs text-blue-600">This CIM will be automatically linked to your deal</p>
            </div>
          </div>
        )}
        <div className="space-y-6">
          {/* Primary Option - Generate CIM */}
          <Card className="border-2 border-blue-200 hover:border-blue-400 hover:shadow-xl transition-all duration-200 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Plus className="h-7 w-7 text-blue-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                    Generate New CIM
                  </CardTitle>
                  <CardDescription className="text-base">
                    AI generates professional CIMs from your notes, transcripts, and website URLs - automatically extracting information and images.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setCimMode('generate')}
                className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all"
                style={brandColor ? {
                  backgroundColor: brandColor,
                  color: needsDarkText ? '#1e293b' : '#ffffff',
                } : {
                  background: 'linear-gradient(to right, #475569, #2563eb)',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => {
                  if (brandColor) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${brandColor}dd`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (brandColor) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = brandColor;
                  }
                }}
              >
                <Plus className="h-5 w-5 mr-2" />
                Generate CIM with AI
              </Button>
            </CardContent>
          </Card>

          {/* OR Divider */}
          <div className="flex items-center justify-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <div className="px-4">
              <span className="text-gray-400 font-medium text-sm">or</span>
            </div>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Secondary Option - Upload Document (De-emphasized) */}
          <Card className="border border-gray-200 hover:border-gray-300 transition-all duration-200 bg-gray-50/50 scale-95">
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Upload className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base font-semibold text-gray-600">
                    Upload Existing Document
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500 mt-1">
                    Upload your own CIM to enhance it with NDA protection, sharing, and analytics.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                onClick={() => setCimMode('upload')}
                variant="outline"
                className="w-full h-10 text-sm text-gray-600 border-gray-300 hover:bg-gray-100 hover:text-gray-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (cimMode === 'upload') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Deal Association Banner for upload mode */}
        {dealId && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Briefcase className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">Uploading CIM for Deal #{dealId}</p>
              <p className="text-xs text-blue-600">This CIM will be automatically linked to your deal</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setCimMode('choice')}
            className="gap-2"
          >
            ← Back to Options
          </Button>
        </div>
        <CimFileUpload dealId={dealId} />
      </div>
    );
  }

  // Calculate progress
  const hasTitle = !!form.watch('title');
  const hasTranscript = !!form.watch('transcript') && form.watch('transcript').length > 0;
  const hasWebsite = !!form.watch('websiteUrl');
  const hasFinancials = !!(financialData.askingPrice || financialData.revenue || financialData.ebitda || financialFiles.length > 0);
  const hasCoverImage = !!selectedCoverImage;

  const transcriptWordCount = form.watch('transcript')?.split(/\s+/).filter(word => word.length > 0).length || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {!analysis ? (
        <form onSubmit={form.handleSubmit(handleGenerate)} className="lg:grid lg:grid-cols-12 lg:gap-6 space-y-5 lg:space-y-0 relative">
          {/* Main Form Content */}
          <div className="lg:col-span-9 space-y-5 bg-gradient-to-br from-slate-50/50 to-blue-50/30 lg:p-6 lg:rounded-xl">
            {/* Back Button and Title - Only in first column */}
            {!analysis && (
              <div className="flex items-center gap-4 mb-4">
                <Button
                  variant="ghost"
                  onClick={() => setCimMode('choice')}
                  className="gap-2 flex-shrink-0"
                >
                  ← Back
                </Button>
                <div className="flex-1 text-center">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-600 to-blue-600 bg-clip-text text-transparent drop-shadow-sm">
                    {form.watch('title') || 'New CIM'}
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">Complete the fields below to generate your document</p>
                </div>
              </div>
            )}

          {/* Cover Image Section - Now at the top */}
          <div id="cover-image-section" className="space-y-0 scroll-mt-8">
            <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
              <ImageIcon className="h-5 w-5" />
              <div className="flex-1">
                <h3 className="font-semibold">Cover Image</h3>
                <p className="text-sm text-slate-200">Add a professional cover image to enhance your CIM</p>
              </div>
              {selectedCoverImage && <Badge variant="secondary" className="bg-white/20 text-white border-white/30">Set</Badge>}
            </div>
            <div className="p-3 border border-t-0 rounded-b-lg bg-white space-y-4">
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
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(coverImageAttribution) }}
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

          {/* Document Information Section */}
          <div id="document-info-section" className="space-y-0 scroll-mt-8">
            <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
              <FileText className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">Document Information</h3>
                <p className="text-sm text-slate-200">Basic details about your CIM document</p>
              </div>
            </div>

            <div className="space-y-4 p-3 border border-t-0 rounded-b-lg bg-white">
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
                            className="text-sm font-medium cursor-pointer text-gray-900"
                          >
                            AI Website Information Extraction
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

          {/* Image extraction and selection section - moved above Business Notes */}
          {form.watch("websiteUrl") && extractedImages.length > 0 && (
            <div className="space-y-0">
              <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
                <ImageIcon className="h-5 w-5" />
                <div>
                  <h3 className="font-semibold">Website Images</h3>
                  <p className="text-sm text-slate-200">Select images to include in your CIM document</p>
                </div>
              </div>
              <div className="p-3 border border-t-0 rounded-b-lg bg-white">
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Click to select/deselect images:
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
              </div>
            </div>
          )}

          {/* Business Notes Section */}
          <div id="business-notes-section" className="space-y-0 scroll-mt-8">
            <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
              <NotebookPen className="h-5 w-5" />
              <div className="flex-1">
                <h3 className="font-semibold">Business Notes</h3>
                <p className="text-sm text-slate-200">Paste your business meeting transcript or notes, or upload a document</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={textFileInputRef}
                  accept=".pdf,.docx,.doc,.txt,.rtf,.md,.vtt"
                  onChange={(e) => {
                    handleTextFileUpload(e);
                  }}
                  className="hidden"
                  data-testid="file-input-attachment"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    textFileInputRef.current?.click();
                  }}
                  disabled={isUploadingFile}
                  className="text-white hover:bg-white/20 transition-colors"
                  data-testid="button-upload-attachment"
                  title="Upload document to extract text"
                >
                  {isUploadingFile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                {supportedTypes && (
                  <div className="text-xs text-slate-300 hidden sm:block">
                    {supportedTypes.extensions.slice(0, 3).join(', ')}
                    {supportedTypes.extensions.length > 3 && '...'}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border border-t-0 rounded-b-lg bg-white">
              {/* Upload Progress Indicator */}
              {isUploadingFile && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Extracting text from file...</p>
                      <p className="text-xs text-blue-600">{uploadingFileName}</p>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-blue-200 rounded-full h-1">
                    <div className="bg-blue-600 h-1 rounded-full transition-all duration-500 ease-out w-3/4"></div>
                  </div>
                </div>
              )}

              {/* Success Animation */}
              {extractedTextMetadata && showSuccessAnimation && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-in slide-in-from-top duration-500">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center animate-bounce">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">
                        Text extracted successfully! 
                      </p>
                      <p className="text-xs text-green-600">
                        {extractedTextMetadata.wordCount} words from {extractedTextMetadata.filename}
                        {extractedTextMetadata.pageCount && ` (${extractedTextMetadata.pageCount} pages)`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSuccessAnimation(false)}
                      className="text-green-600 hover:bg-green-100"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="relative">
                <Textarea
                  placeholder="Paste your business notes here or upload a document using the attachment icon above..."
                  className="min-h-[200px]"
                  {...form.register("transcript")}
                  data-testid="textarea-transcript"
                />
                {supportedTypes && (
                  <div className="absolute bottom-2 right-2 text-xs text-muted-foreground sm:hidden">
                    Upload: {supportedTypes.extensions.slice(0, 2).join(', ')}...
                  </div>
                )}
              </div>

              {form.formState.errors.transcript && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.transcript.message as string}
                </p>
              )}
            </div>
          </div>

          {/* Financial Information Section - Simplified */}
          <div id="financial-info-section" className="space-y-0 scroll-mt-8">
            <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center gap-3">
              <DollarSign className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">Financial Information</h3>
                <p className="text-sm text-slate-200">Add key financial metrics to enhance your CIM</p>
              </div>
            </div>

            <div className="space-y-6 p-3 border border-t-0 rounded-b-lg bg-white">
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
                      <div
                        className="border-2 border-dashed border-muted rounded-lg p-4 transition-colors hover:border-blue-300 cursor-pointer"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                          const files = e.dataTransfer.files;
                          if (files && files.length > 0) {
                            const validFiles = Array.from(files).filter(file => {
                              const ext = file.name.toLowerCase().split('.').pop();
                              return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'].includes(ext || '');
                            });
                            if (validFiles.length > 0) {
                              setFinancialFiles(prev => [...prev, ...validFiles]);
                            }
                          }
                        }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="text-center pointer-events-none">
                          <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Drag & drop files here, or click to browse
                          </p>
                          <div className="flex gap-2 justify-center mb-2 pointer-events-auto">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                              }}
                              className="gap-2"
                            >
                              <File className="h-4 w-4" />
                              Upload Files
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsSDEModalOpen(true);
                              }}
                              className="gap-2 border-blue-200 hover:bg-blue-50"
                            >
                              <Sparkles className="h-4 w-4 text-blue-600" />
                              SDE Analyzer
                            </Button>
                          </div>
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
          <div id="content-style-section" className="scroll-mt-8">
          <ContentStyleSection
            sectionDirections={sectionDirections}
            onSectionDirectionsChange={setSectionDirections}
            formattingProfile={selectedFormattingProfile}
            onFormattingProfileChange={(profile) => {
              setSelectedFormattingProfile(profile);
              form.setValue("formattingProfile", profile);
            }}
            customStyleConfig={customStyleConfig}
            onCustomStyleConfigChange={setCustomStyleConfig}
          />
          </div>

          {/* NDA Protection Section - This will be moved to sidebar on desktop */}
          <div id="nda-section" className="lg:hidden scroll-mt-8">
          <Card className="w-full">
            <div className="bg-slate-600 bg-opacity-80 bg-gradient-to-r from-slate-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5" />
                <div>
                  <h3 className="font-semibold">NDA Protection</h3>
                  <p className="text-sm text-slate-200">Configure confidentiality settings for your CIM document</p>
                </div>
              </div>
            </div>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="nda-protected"
                  checked={ndaSettings.ndaProtected}
                  onCheckedChange={(checked) => {
                    setNdaSettings(prev => ({ ...prev, ndaProtected: checked }));
                    if (!checked) {
                      setNdaSettings(prev => ({ ...prev, ndaTemplateId: null, ndaApprovalRequired: false }));
                    }
                  }}
                  data-testid="switch-nda-protected"
                />
                <Label htmlFor="nda-protected" className="text-sm font-medium">
                  Enable NDA Protection
                </Label>
              </div>

              {ndaSettings.ndaProtected && (
                <div className="space-y-4 ml-6 border-l-2 border-muted pl-4">
                  <div className="space-y-2">
                    <Label className="text-sm">NDA Template</Label>
                    <Select
                      value={ndaSettings.ndaTemplateId?.toString() || ''}
                      onValueChange={(value) => {
                        setNdaSettings(prev => ({ ...prev, ndaTemplateId: value ? parseInt(value) : null }));
                      }}
                    >
                      <SelectTrigger data-testid="select-nda-template">
                        <SelectValue placeholder="Select an NDA template" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          return (
                            <>
                              {ndaTemplates.length > 0 ? (
                                ndaTemplates.map((template: any) => (
                                  <SelectItem key={template.id} value={template.id.toString()}>
                                    {template.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="" disabled>
                                  {ndaTemplatesLoading ? "Loading templates..." : "No NDA templates available"}
                                </SelectItem>
                              )}
                              <div className="border-t mt-2 pt-2">
                                <a
                                  href="/nda-templates"
                                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <Settings2 className="h-4 w-4" />
                                  <span>Manage NDA Templates</span>
                                  <ExternalLink className="h-3 w-3 ml-auto" />
                                </a>
                              </div>
                            </>
                          );
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="manual-approval"
                      checked={ndaSettings.ndaApprovalRequired}
                      onCheckedChange={(checked) => {
                        setNdaSettings(prev => ({ ...prev, ndaApprovalRequired: checked }));
                      }}
                      data-testid="switch-manual-approval"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="manual-approval" className="text-sm font-medium flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Require Manual Approval
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, you must manually approve each person before they can view the document
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Mobile Generate Button */}
          <div className="lg:hidden">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full">
                  <Button
                    type="submit"
                    className={`w-full border-0 shadow-lg h-14 text-lg ${
                      userLimits && !userLimits.canCreateDocument && !generateMutation.isPending
                        ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed opacity-50"
                        : "bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700"
                    } text-white`}
                    disabled={generateMutation.isPending || (userLimits && !userLimits.canCreateDocument)}
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {generationStage ? 'Generating your CIM document...' : 'Starting generation...'}
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-5 w-5" />
                        Generate CIM
                      </>
                    )}
                  </Button>

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

              {/* Show progress during generation and completion */}
              {generationStage && (
                <CimGenerationProgress
                  stage={generationStage}
                  hasFinancials={
                    financialFiles.length > 0 ||
                    !!financialData.askingPrice ||
                    !!financialData.revenue ||
                    !!financialData.ebitda
                  }
                  hasLargeContent={(form.getValues("transcript")?.length || 0) > 4000}
                  showAsModal={true}
                />
              )}
          </div>
          </div>

          {/* Sticky Summary Sidebar - Desktop Only */}
          <div className="hidden lg:block lg:col-span-3">
            <div className="sticky top-4 space-y-3 bg-white lg:p-4 lg:rounded-xl lg:shadow-sm">
              {/* Progress Checklist Card */}
              <Card className="border-0 shadow-none bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {/* Cover Image */}
                  <button
                    type="button"
                    onClick={() => document.getElementById('cover-image-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-full text-left flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      hasCoverImage ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {hasCoverImage && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${hasCoverImage ? 'text-gray-900' : 'text-gray-500'}`}>
                        Cover Image
                      </p>
                      {hasCoverImage && (
                        <p className="text-xs text-green-600">Added</p>
                      )}
                    </div>
                  </button>

                  {/* Document Title */}
                  <button
                    type="button"
                    onClick={() => document.getElementById('document-info-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-full text-left flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      hasTitle ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {hasTitle && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${hasTitle ? 'text-gray-900' : 'text-gray-500'}`}>
                        Document Title
                      </p>
                      {hasTitle && (
                        <p className="text-xs text-gray-500 truncate">{form.watch('title')}</p>
                      )}
                    </div>
                  </button>

                  {/* Website Analysis */}
                  <button
                    type="button"
                    onClick={() => document.getElementById('document-info-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-full text-left flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      hasWebsite && enableWebsiteAnalysis ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {hasWebsite && enableWebsiteAnalysis && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${hasWebsite && enableWebsiteAnalysis ? 'text-gray-900' : 'text-gray-500'}`}>
                        Website Analyzed by AI
                      </p>
                      {hasWebsite && enableWebsiteAnalysis && (
                        <p className="text-xs text-green-600">Enabled</p>
                      )}
                    </div>
                  </button>

                  {/* Business Notes */}
                  <button
                    type="button"
                    onClick={() => document.getElementById('business-notes-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-full text-left flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      hasTranscript ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {hasTranscript && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${hasTranscript ? 'text-gray-900' : 'text-gray-500'}`}>
                        Business Notes
                      </p>
                      {hasTranscript && (
                        <p className="text-xs text-gray-500">{transcriptWordCount} words</p>
                      )}
                    </div>
                  </button>

                  {/* Financial Data */}
                  <button
                    type="button"
                    onClick={() => document.getElementById('financial-info-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-full text-left flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      hasFinancials ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {hasFinancials && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${hasFinancials ? 'text-gray-900' : 'text-gray-500'}`}>
                        Financial Data
                      </p>
                      <p className="text-xs text-gray-500">Optional</p>
                    </div>
                  </button>
                </CardContent>
              </Card>

              {/* Separator */}
              <div className="border-t border-slate-200 my-4"></div>

              {/* NDA Protection Card */}
              <Card className="border-0 shadow-none bg-transparent">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-400" />
                    <CardTitle className="text-sm font-semibold text-slate-500">NDA Protection</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="nda-protected-sidebar"
                      checked={ndaSettings.ndaProtected}
                      onCheckedChange={(checked) => {
                        setNdaSettings(prev => ({ ...prev, ndaProtected: checked }));
                        if (!checked) {
                          setNdaSettings(prev => ({ ...prev, ndaTemplateId: null, ndaApprovalRequired: false }));
                        }
                      }}
                    />
                    <Label htmlFor="nda-protected-sidebar" className="text-sm font-medium cursor-pointer">
                      Enable NDA Protection
                    </Label>
                  </div>

                  {ndaSettings.ndaProtected && (
                    <div className="space-y-3 pl-1">
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600">NDA Template</Label>
                        <Select
                          value={ndaSettings.ndaTemplateId?.toString() || ''}
                          onValueChange={(value) => {
                            setNdaSettings(prev => ({ ...prev, ndaTemplateId: value ? parseInt(value) : null }));
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            {ndaTemplates.length > 0 ? (
                              ndaTemplates.map((template: any) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>
                                {ndaTemplatesLoading ? "Loading..." : "No templates"}
                              </SelectItem>
                            )}
                            <div className="border-t mt-2 pt-2">
                              <a
                                href="/nda-templates"
                                className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <Settings2 className="h-3 w-3" />
                                <span>Manage Templates</span>
                                <ExternalLink className="h-3 w-3 ml-auto" />
                              </a>
                            </div>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-start space-x-2">
                        <Switch
                          id="manual-approval-sidebar"
                          checked={ndaSettings.ndaApprovalRequired}
                          onCheckedChange={(checked) => {
                            setNdaSettings(prev => ({ ...prev, ndaApprovalRequired: checked }));
                          }}
                          className="mt-1"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="manual-approval-sidebar" className="text-xs font-medium cursor-pointer">
                            Require Manual Approval
                          </Label>
                          <p className="text-xs text-gray-500">
                            Approve each viewer manually
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Generate Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full">
                      <Button
                        type="submit"
                        className={`w-full border-0 shadow-xl h-14 text-lg ${
                          userLimits && !userLimits.canCreateDocument && !generateMutation.isPending
                            ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed opacity-50"
                            : "bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700"
                        } text-white`}
                        disabled={generateMutation.isPending || (userLimits && !userLimits.canCreateDocument)}
                      >
                        {generateMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Zap className="mr-2 h-5 w-5" />
                            Generate CIM
                          </>
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {userLimits && !userLimits.canCreateDocument && !generateMutation.isPending && (
                    <TooltipContent>
                      <p>You've reached your monthly limit ({userLimits.documentsCreated}/{userLimits.documentLimit})</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              {/* Show progress during generation and completion */}
              {generationStage && (
                <CimGenerationProgress
                  stage={generationStage}
                  hasFinancials={hasFinancials}
                  hasLargeContent={(form.getValues("transcript")?.length || 0) > 4000}
                  showAsModal={true}
                />
              )}
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          {/* Show progress when generating */}
          {generationStage && (
            <CimGenerationProgress
              stage={generationStage}
              hasFinancials={
                financialFiles.length > 0 ||
                !!financialData.askingPrice ||
                !!financialData.revenue ||
                !!financialData.ebitda
              }
              hasLargeContent={(form.getValues("transcript")?.length || 0) > 4000}
              showAsModal={true}
            />
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

      {/* SDE Analyzer Modal */}
      <SDEAnalyzerModal
        open={isSDEModalOpen}
        onOpenChange={setIsSDEModalOpen}
      />
    </div>
  );
}