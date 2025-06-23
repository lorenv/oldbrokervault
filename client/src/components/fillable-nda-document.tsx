import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Mail, Type, FileSignature, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import UnifiedPdfDisplay from '@/components/unified-pdf-display';

interface SignatureField {
  id: string;
  type: 'signature' | 'name' | 'date' | 'email' | 'text';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  required?: boolean;
}

interface FillableNdaDocumentProps {
  documentTitle: string;
  ndaContent: string; // base64 PDF content
  signatureFields: SignatureField[];
  onSubmit: (fieldValues: Record<string, string>) => Promise<void>;
  isLoading?: boolean;
  prefilledName?: string;
  prefilledEmail?: string;
}

const FIELD_ICONS = {
  signature: FileSignature,
  name: Type,
  date: Calendar,
  email: Mail,
  text: Type
};

export default function FillableNdaDocument({
  documentTitle,
  ndaContent,
  signatureFields,
  onSubmit,
  isLoading = false,
  prefilledName = '',
  prefilledEmail = ''
}: FillableNdaDocumentProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentImages, setDocumentImages] = useState<Array<{imageUrl: string, width: number, height: number}>>([]);
  const { toast } = useToast();

  // Convert PDF to images for display with caching
  useEffect(() => {
    const convertPdfToImages = async () => {
      if (!ndaContent) return;
      
      try {
        // Check if images are already cached
        const cacheKey = `nda_images_${btoa(ndaContent).substring(0, 16)}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
          const cachedData = JSON.parse(cached);
          setDocumentImages(cachedData);
          return;
        }

        const response = await fetch('/api/pdf-to-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            pdfBase64: ndaContent,
            outputFormat: 'png'
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('PDF conversion response:', data);
          
          if (data.success && data.pages) {
            console.log('Raw page data received:', data.pages.length, 'pages');
            
            // Process pages with dimensions for accurate field positioning
            const processedPages = await Promise.all(
              data.pages.map(async (page: any, index: number) => {
                return new Promise<{imageUrl: string, width: number, height: number}>((resolve, reject) => {
                  const img = new Image();
                  
                  // Optimize loading
                  img.loading = 'eager';
                  img.decoding = 'sync';
                  
                  img.onload = () => {
                    console.log(`Page ${index + 1} loaded successfully: ${img.width}x${img.height}`);
                    resolve({
                      imageUrl: page.imageUrl,
                      width: img.naturalWidth,
                      height: img.naturalHeight
                    });
                  };
                  
                  img.onerror = (error) => {
                    console.error(`Failed to load page ${index + 1}:`, error);
                    console.error('Image URL:', page.imageUrl);
                    reject(new Error(`Failed to load page ${index + 1}`));
                  };
                  
                  console.log(`Loading page ${index + 1} from:`, page.imageUrl);
                  img.src = page.imageUrl;
                });
              })
            );
            
            console.log('All pages processed successfully:', processedPages.map(p => ({w: p.width, h: p.height})));
            setDocumentImages(processedPages);
            
            // Cache the processed images for faster reloads
            const cacheKey = `nda_images_${btoa(ndaContent).substring(0, 16)}`;
            sessionStorage.setItem(cacheKey, JSON.stringify(processedPages));
          } else {
            console.error('Invalid response structure:', data);
          }
        } else {
          console.error('Failed to convert PDF to images, status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
        }
      } catch (error) {
        console.error('Error converting PDF:', error);
      }
    };

    convertPdfToImages();
  }, [ndaContent]);

  // Auto-populate fields with prefilled values and current date
  useEffect(() => {
    const initialValues: Record<string, string> = {};
    
    signatureFields.forEach(field => {
      if (field.type === 'name' && prefilledName) {
        initialValues[field.id] = prefilledName;
      } else if (field.type === 'email' && prefilledEmail) {
        initialValues[field.id] = prefilledEmail;
      } else if (field.type === 'date') {
        // Format date as display format
        initialValues[field.id] = new Date().toLocaleDateString();
      }
    });
    
    if (Object.keys(initialValues).length > 0) {
      setFieldValues(prev => ({ ...prev, ...initialValues }));
    }
  }, [signatureFields, prefilledName, prefilledEmail]);

  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(prev => ({ ...prev, [fieldId]: '' }));
    }
  };

  const validateFields = () => {
    const newErrors: Record<string, string> = {};
    
    signatureFields.forEach(field => {
      if (field.required && !fieldValues[field.id]?.trim()) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });

    if (!agreed) {
      newErrors.agreement = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateFields()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and agree to the terms",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(fieldValues);
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: "Please try again or contact support",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDocumentWithFields = () => {
    return documentImages.map((pageData, pageIndex) => {
      const pageNumber = pageIndex + 1;
      const pageFields = signatureFields.filter(field => field.pageNumber === pageNumber);
      
      return (
        <div key={pageIndex} className="relative mb-8 shadow-lg rounded-lg overflow-hidden mx-auto" style={{ maxWidth: '800px' }}>
          {/* PDF Page as Background */}
          <img
            src={pageData.imageUrl}
            alt={`Document page ${pageNumber}`}
            className="block border border-gray-200"
            style={{ width: '800px', height: 'auto' }}
            loading="eager"
            decoding="sync"
            onError={(e) => {
              console.error('Image load error for page:', pageNumber);
              console.error('Image URL:', pageData.imageUrl);
              console.error('Error event:', e);
              e.currentTarget.style.display = 'none';
            }}
            onLoad={(e) => {
              const imgElement = e.currentTarget;
              const actualDisplayWidth = imgElement.clientWidth;
              const actualDisplayHeight = imgElement.clientHeight;
              console.log('Page loaded successfully:', pageNumber, 'fixed display size:', actualDisplayWidth, 'x', actualDisplayHeight);
            }}
          />
          
          {/* Transparent Overlay with Form Fields - Responsive Positioning */}
          <div className="absolute inset-0">
            {pageFields.map((field) => {
              const Icon = FIELD_ICONS[field.type];
              const isRequired = field.required !== false;
              
              // CONSISTENT POSITIONING: Use same system as template editor (800px fixed width)
              // Calculate display scale based on consistent 800px width (same as ImagePdfEditor)
              const FIXED_DISPLAY_WIDTH = 800;
              const displayScaleX = FIXED_DISPLAY_WIDTH / pageData.width;
              const displayScaleY = displayScaleX; // Maintain aspect ratio
              
              // Convert PDF coordinates to absolute pixel positioning (same as template editor)
              const fieldXPixels = field.x * displayScaleX;
              const fieldYPixels = field.y * displayScaleY;
              const fieldWidthPixels = field.width * displayScaleX;
              const fieldHeightPixels = field.height * displayScaleY;
              
              console.log(`Field ${field.id} consistent positioning:`, {
                original: { x: field.x, y: field.y, w: field.width, h: field.height },
                scale: { x: displayScaleX, y: displayScaleY },
                pixels: { x: fieldXPixels, y: fieldYPixels, w: fieldWidthPixels, h: fieldHeightPixels },
                pageSize: { w: pageData.width, h: pageData.height }
              });
              
              const style = {
                position: 'absolute' as const,
                left: `${fieldXPixels}px`,
                top: `${fieldYPixels}px`, 
                width: `${fieldWidthPixels}px`,
                height: `${fieldHeightPixels}px`,
                minHeight: window.innerWidth < 640 ? '28px' : '36px', // Mobile-specific sizing
                minWidth: window.innerWidth < 640 ? '80px' : '120px', // Mobile-specific sizing
                zIndex: 10
              };

              return (
                <div key={field.id} style={style}>
                  {/* Mobile-Optimized Field Label */}
                  <div className="absolute -top-6 left-0 text-xs font-medium text-gray-700 bg-blue-100 px-1.5 py-0.5 rounded shadow-sm border border-blue-200 flex items-center gap-1 whitespace-nowrap z-20 sm:-top-7 sm:px-2 sm:py-1">
                    <Icon className="w-3 h-3 text-blue-600 sm:w-3 sm:h-3" />
                    <span className="hidden xs:inline">{field.label}</span>
                    <span className="xs:hidden">{field.label.substring(0, 8)}</span>
                    {isRequired && <span className="text-red-500">*</span>}
                  </div>
                  
                  {/* Mobile-Optimized Field Input */}
                  {field.type === 'date' ? (
                    <div className="w-full h-full bg-blue-50 border-2 border-blue-400 rounded p-1 text-xs flex items-center justify-center font-medium text-blue-800 sm:p-2 sm:text-sm">
                      {new Date().toLocaleDateString()}
                    </div>
                  ) : field.type === 'signature' ? (
                    <input
                      type="text"
                      value={fieldValues[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder="Your signature"
                      className="w-full h-full bg-blue-50 border-2 border-blue-400 rounded px-1 text-xs italic focus:outline-none focus:ring-2 focus:ring-blue-300 sm:px-2 sm:text-sm"
                      style={{ 
                        fontFamily: 'cursive',
                        fontSize: window.innerWidth < 640 ? '12px' : '14px',
                        color: '#1e40af'
                      }}
                    />
                  ) : (
                    <input
                      type={field.type === 'email' ? 'email' : 'text'}
                      value={fieldValues[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={window.innerWidth < 640 ? field.label : `Enter ${field.label.toLowerCase()}`}
                      className="w-full h-full bg-blue-50 border-2 border-blue-400 rounded px-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 sm:px-2 sm:text-sm"
                    />
                  )}
                  
                  {/* Mobile-Optimized Error Message */}
                  {errors[field.id] && (
                    <div className="absolute -bottom-5 left-0 text-xs text-red-500 bg-white px-1.5 py-0.5 rounded shadow-sm border z-20 sm:-bottom-6 sm:px-2 sm:py-1">
                      {errors[field.id]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-2 sm:py-8">
      <div className="max-w-4xl mx-auto px-2 sm:px-4">
        <Card className="shadow-xl">
          <CardHeader className="text-center border-b p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">
              {documentTitle}
            </CardTitle>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              Please fill in the required information by tapping on the highlighted fields below
            </p>
            {/* Mobile-specific instruction */}
            <div className="sm:hidden mt-3 p-2 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 Tip: Scroll down to see all pages and tap on blue fields to fill them out
              </p>
            </div>
          </CardHeader>
          
          <CardContent className="p-3 sm:p-6">
            {/* Document with Overlay Fields */}
            <div className="mb-6 sm:mb-8">
              {documentImages.length > 0 ? (
                renderDocumentWithFields()
              ) : (
                <div className="flex items-center justify-center h-48 sm:h-64 bg-gray-100 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 text-sm sm:text-base">Loading document...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile-Optimized Agreement Checkbox */}
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
              <label className="flex items-start space-x-2 sm:space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0"
                />
                <span className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                  I have read and agree to the terms of this Non-Disclosure Agreement. I understand that by signing this document, I am legally bound by its terms. 
                  <span className="text-red-500">*</span>
                </span>
              </label>
              {errors.agreement && (
                <p className="text-red-500 text-xs sm:text-sm mt-2">{errors.agreement}</p>
              )}
            </div>

            {/* Mobile-Optimized Submit Button */}
            <div className="text-center">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isLoading}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 text-base sm:text-lg font-semibold"
                size="lg"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  'Sign NDA and Continue'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}