import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import SignaturePad from 'signature_pad';

interface SignaturePadProps {
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  onSignature?: (dataURL: string) => void;
  className?: string;
}

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

export const SignaturePadComponent = forwardRef<SignaturePadRef, SignaturePadProps>(({
  width = 400,
  height = 200,
  penColor = 'black',
  backgroundColor = 'white',
  onSignature,
  className = ''
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useImperativeHandle(ref, () => ({
    clear: () => {
      signaturePadRef.current?.clear();
    },
    isEmpty: () => {
      return signaturePadRef.current?.isEmpty() ?? true;
    },
    toDataURL: () => {
      return signaturePadRef.current?.toDataURL() ?? '';
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Initialize SignaturePad
    const signaturePad = new SignaturePad(canvas, {
      backgroundColor,
      penColor,
      minWidth: 0.5,
      maxWidth: 2.5,
    });

    signaturePadRef.current = signaturePad;

    // Handle signature completion
    const handleEnd = () => {
      if (onSignature && !signaturePad.isEmpty()) {
        onSignature(signaturePad.toDataURL());
      }
    };

    signaturePad.addEventListener('endStroke', handleEnd);

    // Handle window resize
    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      signaturePad.clear();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      signaturePad.removeEventListener('endStroke', handleEnd);
    };
  }, [width, height, backgroundColor, penColor, onSignature]);

  return (
    <canvas
      ref={canvasRef}
      className={`border border-gray-300 rounded cursor-crosshair ${className}`}
      style={{ touchAction: 'none' }}
    />
  );
});

SignaturePadComponent.displayName = 'SignaturePad';