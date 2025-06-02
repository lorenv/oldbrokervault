import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  quality?: number;
  progressive?: boolean;
  blurDataURL?: string;
}

export function OptimizedImage({
  src,
  alt,
  fallbackSrc,
  quality = 75,
  progressive = true,
  blurDataURL,
  className,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(blurDataURL || '');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoading(false);
    };
    img.onerror = () => {
      if (fallbackSrc && currentSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc);
        setError(false);
      } else {
        setError(true);
        setIsLoading(false);
      }
    };
    img.src = src;
  }, [src, fallbackSrc, currentSrc]);

  if (error && !fallbackSrc) {
    return (
      <div className={cn("bg-muted flex items-center justify-center text-muted-foreground", className)}>
        Failed to load image
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={cn(
          "absolute inset-0 bg-muted flex items-center justify-center",
          className
        )}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        onLoad={() => setIsLoading(false)}
        {...props}
      />
    </div>
  );
}

// Lazy loading image component
export function LazyImage({ src, alt, className, ...props }: OptimizedImageProps) {
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className}>
      {inView ? (
        <OptimizedImage src={src} alt={alt} className={className} {...props} />
      ) : (
        <div className={cn("bg-muted animate-pulse", className)} />
      )}
    </div>
  );
}