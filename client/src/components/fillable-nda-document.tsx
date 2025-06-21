import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Mail, Type, FileSignature, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const [documentImages, setDocumentImages] = useState<string[]>([]);
  const { toast } = useToast();

  // Convert PDF to images for display
  useEffect(() => {
    const convertPdfToImages = async () => {
      if (!ndaContent) return;
      
      try {
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
          setDocumentImages(data.images || []);
        } else {
          console.error('Failed to convert PDF to images');
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
    return documentImages.map((imageBase64, pageIndex) => {
      const pageNumber = pageIndex + 1;
      const pageFields = signatureFields.filter(field => field.pageNumber === pageNumber);
      
      return (
        <div key={pageIndex} className="relative mb-8 shadow-lg rounded-lg overflow-hidden">
          {/* PDF Page as Background */}
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={`Document page ${pageNumber}`}
            className="w-full h-auto"
            style={{ maxWidth: '800px' }}
          />
          
          {/* Transparent Overlay with Form Fields */}
          <div className="absolute inset-0">
            {pageFields.map((field) => {
              const Icon = FIELD_ICONS[field.type];
              const isRequired = field.required !== false;
              
              // Calculate responsive positioning
              const style = {
                position: 'absolute' as const,
                left: `${(field.x / 612) * 100}%`, // Assuming 612px PDF width
                top: `${(field.y / 792) * 100}%`,  // Assuming 792px PDF height
                width: `${(field.width / 612) * 100}%`,
                height: `${(field.height / 792) * 100}%`,
                minHeight: '32px',
                zIndex: 10
              };

              return (
                <div key={field.id} style={style}>
                  {/* Field Label */}
                  <div className="absolute -top-6 left-0 text-xs font-medium text-gray-700 bg-white px-2 py-1 rounded shadow-sm border flex items-center gap-1">
                    <Icon className="w-3 h-3" />
                    {field.label}
                    {isRequired && <span className="text-red-500">*</span>}
                  </div>
                  
                  {/* Field Input */}
                  {field.type === 'date' ? (
                    <div className="w-full h-full bg-blue-50 border-2 border-blue-300 rounded p-1 text-xs flex items-center justify-center font-medium">
                      {new Date().toLocaleDateString()}
                    </div>
                  ) : field.type === 'signature' ? (
                    <input
                      type="text"
                      value={fieldValues[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder="Type your signature here"
                      className="w-full h-full bg-blue-50 border-2 border-blue-300 rounded px-2 text-sm font-handwriting"
                      style={{ 
                        fontFamily: 'Handwritania, cursive',
                        fontSize: '16px'
                      }}
                    />
                  ) : (
                    <input
                      type={field.type === 'email' ? 'email' : 'text'}
                      value={fieldValues[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className="w-full h-full bg-blue-50 border-2 border-blue-300 rounded px-2 text-sm"
                    />
                  )}
                  
                  {/* Error Message */}
                  {errors[field.id] && (
                    <div className="absolute -bottom-6 left-0 text-xs text-red-500 bg-white px-2 py-1 rounded shadow-sm border">
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="shadow-xl">
          <CardHeader className="text-center border-b">
            <CardTitle className="text-2xl font-bold text-gray-800">
              {documentTitle}
            </CardTitle>
            <p className="text-gray-600 mt-2">
              Please fill in the required information by clicking on the highlighted fields below
            </p>
          </CardHeader>
          
          <CardContent className="p-6">
            {/* Document with Overlay Fields */}
            <div className="mb-8">
              {documentImages.length > 0 ? (
                renderDocumentWithFields()
              ) : (
                <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading document...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Agreement Checkbox */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  I have read and agree to the terms of this Non-Disclosure Agreement. I understand that by signing this document, I am legally bound by its terms. 
                  <span className="text-red-500">*</span>
                </span>
              </label>
              {errors.agreement && (
                <p className="text-red-500 text-sm mt-2">{errors.agreement}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="text-center">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isLoading}
                className="px-8 py-3 text-lg font-semibold"
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