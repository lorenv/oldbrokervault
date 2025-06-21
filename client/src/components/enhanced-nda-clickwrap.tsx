import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FileSignature, Calendar, Mail, Type, AlignLeft } from 'lucide-react';
import SignaturePad from 'signature_pad';

interface SignatureField {
  id: string;
  type: 'signature' | 'name' | 'date' | 'email' | 'text';
  label: string;
  required: boolean;
  placeholder?: string;
}

interface EnhancedNdaClickwrapProps {
  documentTitle: string;
  ndaContent: string;
  signatureFields: SignatureField[];
  onSign: (fieldValues: Record<string, string>) => Promise<void>;
  isLoading?: boolean;
}

const FIELD_ICONS = {
  signature: FileSignature,
  name: Type,
  date: Calendar,
  email: Mail,
  text: AlignLeft
};

export default function EnhancedNdaClickwrap({
  documentTitle,
  ndaContent,
  signatureFields,
  onSign,
  isLoading = false
}: EnhancedNdaClickwrapProps) {
  // Debug: Log the signature fields to see what we're receiving
  console.log('🔍 Enhanced NDA Clickwrap received signature fields:', signatureFields);
  console.log('📊 Field count:', signatureFields?.length || 0);
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
          minWidth: 0.5,
          maxWidth: 2.5,
        });
        
        signaturePadRefs.current[fieldId] = signaturePad;
        
        // Auto-resize canvas
        const resizeCanvas = () => {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          canvas.getContext('2d')?.scale(ratio, ratio);
          signaturePad.clear();
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        return () => window.removeEventListener('resize', resizeCanvas);
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

  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(prev => ({ ...prev, [fieldId]: '' }));
    }
  };

  const clearSignature = (fieldId: string) => {
    const signaturePad = signaturePadRefs.current[fieldId];
    if (signaturePad) {
      signaturePad.clear();
      setFieldValues(prev => ({ ...prev, [fieldId]: '' }));
    }
  };

  const validateFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    signatureFields.forEach(field => {
      if (field.required) {
        if (field.type === 'signature') {
          const signaturePad = signaturePadRefs.current[field.id];
          if (!signaturePad || signaturePad.isEmpty()) {
            newErrors[field.id] = `${field.label} is required`;
          }
        } else {
          const value = fieldValues[field.id];
          if (!value || value.trim() === '') {
            newErrors[field.id] = `${field.label} is required`;
          } else if (field.type === 'email' && !/\S+@\S+\.\S+/.test(value)) {
            newErrors[field.id] = 'Please enter a valid email address';
          }
        }
      }
    });

    if (!agreed) {
      newErrors.agreement = 'You must agree to the terms to continue';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSign = async () => {
    if (!validateFields()) {
      toast({
        title: "Please complete all required fields",
        description: "Fill in all required information before signing",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Collect all field values including signatures
      const allFieldValues: Record<string, string> = { ...fieldValues };
      
      // Add signature data
      signatureFields
        .filter(field => field.type === 'signature')
        .forEach(field => {
          const signaturePad = signaturePadRefs.current[field.id];
          if (signaturePad && !signaturePad.isEmpty()) {
            allFieldValues[field.id] = signaturePad.toDataURL();
          }
        });

      // Auto-fill date fields with current date if not provided
      signatureFields
        .filter(field => field.type === 'date' && !allFieldValues[field.id])
        .forEach(field => {
          allFieldValues[field.id] = new Date().toLocaleDateString();
        });

      await onSign(allFieldValues);
      
      toast({
        title: "Document signed successfully",
        description: "Your signature has been recorded and the document owner has been notified"
      });
      
    } catch (error) {
      console.error('Error signing document:', error);
      toast({
        title: "Error signing document",
        description: "Please try again or contact support if the problem persists",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: SignatureField) => {
    const Icon = FIELD_ICONS[field.type];
    const hasError = !!errors[field.id];
    
    switch (field.type) {
      case 'signature':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            <div className={`border-2 rounded-md ${hasError ? 'border-red-500' : 'border-gray-300'}`}>
              <canvas
                ref={(el) => {
                  if (el) signatureCanvasRefs.current[field.id] = el;
                }}
                className="w-full h-32 cursor-crosshair"
                style={{ touchAction: 'none' }}
              />
            </div>
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => clearSignature(field.id)}
              >
                Clear Signature
              </Button>
              {hasError && <span className="text-sm text-red-500">{errors[field.id]}</span>}
            </div>
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.id}
              type="date"
              value={fieldValues[field.id] || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className={hasError ? 'border-red-500' : ''}
              placeholder={field.placeholder}
            />
            {hasError && <span className="text-sm text-red-500">{errors[field.id]}</span>}
          </div>
        );

      case 'email':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.id}
              type="email"
              value={fieldValues[field.id] || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className={hasError ? 'border-red-500' : ''}
              placeholder={field.placeholder || 'Enter email address'}
            />
            {hasError && <span className="text-sm text-red-500">{errors[field.id]}</span>}
          </div>
        );

      default:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.id}
              type="text"
              value={fieldValues[field.id] || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className={hasError ? 'border-red-500' : ''}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            />
            {hasError && <span className="text-sm text-red-500">{errors[field.id]}</span>}
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Document Header */}
      <div className="text-center border-b pb-6">
        <h1 className="text-2xl font-bold mb-2">{documentTitle}</h1>
        <p className="text-gray-600">Please review and sign the confidentiality agreement below</p>
      </div>

      {/* NDA Content */}
      <Card>
        <CardHeader>
          <CardTitle>Confidentiality Agreement</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="prose max-w-none text-sm leading-relaxed max-h-96 overflow-y-auto border rounded-md p-4 bg-gray-50"
            dangerouslySetInnerHTML={{ __html: ndaContent }}
          />
        </CardContent>
      </Card>

      {/* Signature Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Required Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {signatureFields && signatureFields.length > 0 ? (
            signatureFields.map(renderField)
          ) : (
            <div className="text-center py-8 text-gray-500">
              Loading signature fields...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agreement Checkbox */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="agreement"
              checked={agreed}
              onCheckedChange={setAgreed}
              className={errors.agreement ? 'border-red-500' : ''}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="agreement" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                I agree to the terms and conditions of this confidentiality agreement
              </Label>
              {errors.agreement && (
                <span className="text-sm text-red-500">{errors.agreement}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sign Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleSign}
          disabled={isSubmitting || isLoading}
          size="lg"
          className="px-8"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Signing Document...
            </>
          ) : (
            <>
              <FileSignature className="w-4 h-4 mr-2" />
              Sign Document
            </>
          )}
        </Button>
      </div>
    </div>
  );
}