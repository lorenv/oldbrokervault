import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Check for WebP support (cached result)
let webpSupported: boolean | null = null;

function checkWebPSupport(): Promise<boolean> {
  if (webpSupported !== null) {
    return Promise.resolve(webpSupported);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      webpSupported = img.width > 0 && img.height > 0;
      resolve(webpSupported);
    };
    img.onerror = () => {
      webpSupported = false;
      resolve(false);
    };
    // Tiny WebP image
    img.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
  });
}

/**
 * Get WebP version of an image path
 * e.g., "/image.png" -> "/image.webp"
 */
function getWebPPath(src: string): string | null {
  const imageExtensions = /\.(png|jpg|jpeg)$/i;
  if (imageExtensions.test(src)) {
    return src.replace(imageExtensions, ".webp");
  }
  return null;
}

interface ResponsiveSize {
  width: number;
  suffix?: string; // e.g., "-sm", "-md", "-lg"
}

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  quality?: number;
  progressive?: boolean;
  blurDataURL?: string;
  /**
   * Enable automatic WebP conversion attempt.
   * Will try to load .webp version first, falling back to original.
   */
  preferWebP?: boolean;
  /**
   * Responsive sizes for srcset generation.
   * Provide an array of widths, and the component will look for
   * files like "image-640.png", "image-1024.png" etc.
   */
  responsiveSizes?: ResponsiveSize[];
  /**
   * Custom srcSet string (overrides responsiveSizes)
   */
  srcSet?: string;
  /**
   * Sizes attribute for responsive images
   */
  sizes?: string;
}

export function OptimizedImage({
  src,
  alt,
  fallbackSrc,
  quality = 75,
  progressive = true,
  blurDataURL,
  preferWebP = true,
  responsiveSizes,
  srcSet,
  sizes,
  className,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(blurDataURL || '');
  const [supportsWebP, setSupportsWebP] = useState<boolean | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check WebP support on mount
  useEffect(() => {
    if (preferWebP) {
      checkWebPSupport().then(setSupportsWebP);
    } else {
      setSupportsWebP(false);
    }
  }, [preferWebP]);

  // Determine the best source to use
  useEffect(() => {
    if (supportsWebP === null) return; // Still checking WebP support

    const tryLoadImage = (imageSrc: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = imageSrc;
      });
    };

    const loadBestImage = async () => {
      // Try WebP version first if supported
      if (supportsWebP && preferWebP) {
        const webpPath = getWebPPath(src);
        if (webpPath) {
          const webpLoaded = await tryLoadImage(webpPath);
          if (webpLoaded) {
            setCurrentSrc(webpPath);
            setIsLoading(false);
            return;
          }
        }
      }

      // Fall back to original source
      const loaded = await tryLoadImage(src);
      if (loaded) {
        setCurrentSrc(src);
        setIsLoading(false);
        return;
      }

      // Try fallback if original fails
      if (fallbackSrc) {
        const fallbackLoaded = await tryLoadImage(fallbackSrc);
        if (fallbackLoaded) {
          setCurrentSrc(fallbackSrc);
          setIsLoading(false);
          return;
        }
      }

      // All failed
      setError(true);
      setIsLoading(false);
    };

    loadBestImage();
  }, [src, fallbackSrc, supportsWebP, preferWebP]);

  // Generate srcSet if responsiveSizes provided
  const computedSrcSet = srcSet || (responsiveSizes && responsiveSizes.length > 0
    ? responsiveSizes.map(({ width, suffix }) => {
        const ext = src.match(/\.[^.]+$/)?.[0] || '';
        const basePath = src.replace(/\.[^.]+$/, '');
        const sizeSuffix = suffix || `-${width}`;
        const path = `${basePath}${sizeSuffix}${supportsWebP && preferWebP ? '.webp' : ext}`;
        return `${path} ${width}w`;
      }).join(', ')
    : undefined);

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
        srcSet={computedSrcSet}
        sizes={sizes}
        alt={alt}
        loading="lazy"
        decoding="async"
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

// Lazy loading image component with IntersectionObserver
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
      { threshold: 0.1, rootMargin: "50px" }
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

/**
 * ResponsiveImage component using picture element for WebP with fallback.
 * This is the preferred approach when you have WebP versions of your images.
 */
interface ResponsiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  webpSrc?: string;
  srcSet?: string;
  webpSrcSet?: string;
  sizes?: string;
}

export function ResponsiveImage({
  src,
  alt,
  webpSrc,
  srcSet,
  webpSrcSet,
  sizes,
  className,
  ...props
}: ResponsiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const computedWebpSrc = webpSrc || getWebPPath(src);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <picture>
        {/* WebP source - browser will use if supported */}
        {computedWebpSrc && (
          <source
            type="image/webp"
            srcSet={webpSrcSet || computedWebpSrc}
            sizes={sizes}
          />
        )}
        {/* Fallback for browsers without WebP support */}
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn(
            "transition-opacity duration-300 w-full h-full object-cover",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setIsLoaded(true)}
          {...props}
        />
      </picture>
    </div>
  );
}
