import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Mail, Type, FileSignature, AlignLeft } from 'lucide-react';
import SignaturePad from 'signature_pad';
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
}

interface NdaFieldFormProps {
  signatureFields: SignatureField[];
  documentTitle: string;
  ndaContent: string;
  onSubmit: (fieldValues: Record<string, string>) => Promise<void>;
  isLoading?: boolean;
}

const FIELD_ICONS = {
  signature: FileSignature,
  name: Type,
  date: Calendar,
  email: Mail,
  text: AlignLeft
};

export default function NdaFieldForm({
  signatureFields,
  documentTitle,
  ndaContent,
  onSubmit,
  isLoading = false
}: NdaFieldFormProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const signaturePadRefs = useRef<Record<string, SignaturePad>>({});
  const signatureCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});

  // Initialize signature pads for signature fields
  useEffect(() => {
    const signatureFieldIds = signatureFields
      .filter(field => field.type === 'signature')
      .map(field => field.id);

    signatureFieldIds.forEach(fieldId => {
      const canvas = signatureCanvasRefs.current[fieldId];
      if (canvas && !signaturePadRefs.current[fieldId]) {
        const signaturePad = new SignaturePad(canvas, {
          backgroundColor: 'rgb(255, 255, 255)',
          penColor: 'rgb(0, 0, 0)',
          minWidth: 1,
          maxWidth: 2.5,
        });
        
        signaturePadRefs.current[fieldId] = signaturePad;
        
        // Update field value when signature changes
        signaturePad.addEventListener('endStroke', () => {
          if (!signaturePad.isEmpty()) {
            const dataURL = signaturePad.toDataURL();
            setFieldValues(prev => ({ ...prev, [fieldId]: dataURL }));
            setErrors(prev => ({ ...prev, [fieldId]: '' }));
          }
        });
      }
    });

    return () => {
      // Cleanup signature pads
      Object.values(signaturePadRefs.current).forEach(pad => {
        if (pad && typeof pad.off === 'function') {
          pad.off();
        }
      });
    };
  }, [signatureFields]);

  // Auto-populate date fields with current date
  useEffect(() => {
    const dateFields = signatureFields.filter(field => field.type === 'date');
    const currentDate = new Date().toLocaleDateString();
    
    const dateValues: Record<string, string> = {};
    dateFields.forEach(field => {
      dateValues[field.id] = currentDate;
    });
    
    if (Object.keys(dateValues).length > 0) {
      setFieldValues(prev => ({ ...prev, ...dateValues }));
    }
  }, [signatureFields]);

  const validateFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    signatureFields.forEach(field => {
      const value = fieldValues[field.id];
      
      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.id] = 'Please enter a valid email address';
        }
      }
      
      if (field.type === 'signature') {
        const signaturePad = signaturePadRefs.current[field.id];
        if (!signaturePad || signaturePad.isEmpty()) {
          newErrors[field.id] = 'Signature is required';
        }
      }
      
      if ((field.type === 'name' || field.type === 'email') && !value?.trim()) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });
    
    if (!agreed) {
      newErrors.agreement = 'You must agree to the terms to continue';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateFields()) {
      toast({
        title: "Please complete all required fields",
        description: "Check the highlighted fields below",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Ensure signature fields have their data URLs
      const finalFieldValues = { ...fieldValues };
      signatureFields
        .filter(field => field.type === 'signature')
        .forEach(field => {
          const signaturePad = signaturePadRefs.current[field.id];
          if (signaturePad && !signaturePad.isEmpty()) {
            finalFieldValues[field.id] = signaturePad.toDataURL();
          }
        });
      
      await onSubmit(finalFieldValues);
    } catch (error) {
      console.error('Error submitting NDA:', error);
      toast({
        title: "Submission failed",
        description: "Please try again or contact support",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearSignature = (fieldId: string) => {
    const signaturePad = signaturePadRefs.current[fieldId];
    if (signaturePad) {
      signaturePad.clear();
      setFieldValues(prev => ({ ...prev, [fieldId]: '' }));
      setErrors(prev => ({ ...prev, [fieldId]: '' }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            {documentTitle}
          </CardTitle>
          <p className="text-center text-gray-600">
            Please fill in the required information and review the agreement below
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Signature Fields Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4">
              {signatureFields.map(field => {
                const Icon = FIELD_ICONS[field.type];
                const hasError = errors[field.id];
                
                return (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {field.label}
                      {(field.type === 'name' || field.type === 'email' || field.type === 'signature') && (
                        <span className="text-red-500">*</span>
                      )}
                    </Label>
                    
                    {field.type === 'signature' ? (
                      <div className="space-y-2">
                        <div className={`border-2 rounded-lg ${hasError ? 'border-red-500' : 'border-gray-300'}`}>
                          <canvas
                            ref={el => {
                              if (el) signatureCanvasRefs.current[field.id] = el;
                            }}
                            width={400}
                            height={150}
                            className="w-full h-32 touch-none"
                            style={{ touchAction: 'none' }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => clearSignature(field.id)}
                        >
                          Clear Signature
                        </Button>
                      </div>
                    ) : field.type === 'text' ? (
                      <Textarea
                        id={field.id}
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => {
                          setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }));
                          setErrors(prev => ({ ...prev, [field.id]: '' }));
                        }}
                        className={hasError ? 'border-red-500' : ''}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={field.id}
                        type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : 'text'}
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => {
                          setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }));
                          setErrors(prev => ({ ...prev, [field.id]: '' }));
                        }}
                        className={hasError ? 'border-red-500' : ''}
                        readOnly={field.type === 'date'}
                      />
                    )}
                    
                    {hasError && (
                      <p className="text-sm text-red-600">{hasError}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* NDA Content */}
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-lg">Non-Disclosure Agreement</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose prose-sm max-w-none text-gray-700 max-h-64 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: ndaContent }}
                />
              </CardContent>
            </Card>

            {/* Agreement Checkbox */}
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="agreement"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  setErrors(prev => ({ ...prev, agreement: '' }));
                }}
                className="mt-1"
              />
              <Label htmlFor="agreement" className="text-sm">
                I have read and agree to the terms of this Non-Disclosure Agreement. 
                I understand that by signing this document, I am legally bound by its terms.
                <span className="text-red-500 ml-1">*</span>
              </Label>
            </div>
            
            {errors.agreement && (
              <p className="text-sm text-red-600">{errors.agreement}</p>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full"
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}