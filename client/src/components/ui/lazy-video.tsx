import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface LazyVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  poster?: string;
  fallback?: React.ReactNode;
  skeletonClassName?: string;
  rootMargin?: string;
}

/**
 * LazyVideo component that only loads video when it enters the viewport.
 * Uses IntersectionObserver to defer loading until needed.
 * This significantly improves initial page load performance for pages with multiple videos.
 */
export function LazyVideo({
  src,
  poster,
  fallback,
  className,
  skeletonClassName,
  rootMargin = "200px", // Start loading 200px before video enters viewport
  autoPlay,
  muted,
  loop,
  playsInline,
  ...props
}: LazyVideoProps) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin, // Start loading before video is visible
        threshold: 0,
      }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [rootMargin]);

  // Handle autoplay when video becomes visible and loaded
  useEffect(() => {
    if (isInView && isLoaded && autoPlay && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay may fail due to browser policies, that's okay
      });
    }
  }, [isInView, isLoaded, autoPlay]);

  if (error && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
      {/* Skeleton/placeholder while loading */}
      {!isLoaded && (
        <div
          className={cn(
            "absolute inset-0 bg-gray-200 animate-pulse",
            skeletonClassName
          )}
        >
          {poster && (
            <img
              src={poster}
              alt=""
              className="w-full h-full object-cover opacity-50"
              loading="lazy"
            />
          )}
        </div>
      )}

      {/* Only render video element when in view */}
      {isInView && (
        <video
          ref={videoRef}
          src={src}
          muted={muted}
          loop={loop}
          playsInline={playsInline}
          preload="metadata"
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onLoadedData={() => setIsLoaded(true)}
          onError={() => setError(true)}
          {...props}
        />
      )}
    </div>
  );
}
