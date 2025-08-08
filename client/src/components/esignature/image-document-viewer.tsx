import React, { useState, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PageImage {
  pageNumber: number;
  imageDataUrl: string;
  width: number;
  height: number;
}

interface ImageDocumentViewerProps {
  pageImages: PageImage[];
  zoom: number;
  onZoomChange: (zoom: number) => void;
  children?: React.ReactNode; // For field overlays
  className?: string;
}

export default function ImageDocumentViewer({
  pageImages,
  zoom,
  onZoomChange,
  children,
  className = ''
}: ImageDocumentViewerProps) {
  const [imageLoadedStates, setImageLoadedStates] = useState<{[key: number]: boolean}>({});
  const [imageErrorStates, setImageErrorStates] = useState<{[key: number]: boolean}>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const totalPages = pageImages.length;

  const handleImageLoad = useCallback((pageNumber: number) => {
    setImageLoadedStates(prev => ({ ...prev, [pageNumber]: true }));
  }, []);

  const handleImageError = useCallback((pageNumber: number) => {
    setImageErrorStates(prev => ({ ...prev, [pageNumber]: true }));
  }, []);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom * 1.2, 3);
    onZoomChange(newZoom);
  }, [zoom, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom / 1.2, 0.25);
    onZoomChange(newZoom);
  }, [zoom, onZoomChange]);

  const handleResetZoom = useCallback(() => {
    onZoomChange(1);
  }, [onZoomChange]);

  if (!pageImages || pageImages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 bg-gray-100 rounded-lg ${className}`}>
        <p className="text-gray-500">No document pages available</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full bg-gray-50 ${className}`} ref={containerRef}>
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white rounded-lg shadow-md p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomOut}
          disabled={zoom <= 0.25}
          className="p-2"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        
        <div className="flex items-center px-3 py-1 bg-gray-100 rounded text-sm font-medium min-w-[60px] justify-center">
          {Math.round(zoom * 100)}%
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className="p-2"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        
        <div className="border-l border-gray-300 h-6 my-1"></div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetZoom}
          className="p-2"
          title="Reset zoom"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Document Pages - Vertical Scrollable Layout */}
      <div className="w-full h-full overflow-auto">
        <div className="p-8">
          {pageImages.map((pageImage) => {
            const isImageLoaded = imageLoadedStates[pageImage.pageNumber] || false;
            const isImageError = imageErrorStates[pageImage.pageNumber] || false;
            
            return (
              <div 
                key={pageImage.pageNumber}
                className="mb-8 flex flex-col items-center"
              >
                {/* Page Number Badge */}
                <div className="mb-4">
                  <Badge variant="secondary" className="px-3 py-1">
                    Page {pageImage.pageNumber} of {totalPages}
                  </Badge>
                </div>

                {/* Page Image Container */}
                <div className="relative bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div 
                    className="relative"
                    style={{
                      width: pageImage.width * zoom,
                      height: pageImage.height * zoom,
                      transformOrigin: 'top center',
                    }}
                  >
                    {/* Loading State */}
                    {!isImageLoaded && !isImageError && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse"
                        style={{
                          width: pageImage.width * zoom,
                          height: pageImage.height * zoom,
                        }}
                      >
                        <div className="text-gray-500">Loading page {pageImage.pageNumber}...</div>
                      </div>
                    )}

                    {/* Error State */}
                    {isImageError && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center bg-gray-100 text-red-500"
                        style={{
                          width: pageImage.width * zoom,
                          height: pageImage.height * zoom,
                        }}
                      >
                        <div>
                          <p>Failed to load page {pageImage.pageNumber}</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setImageErrorStates(prev => ({ ...prev, [pageImage.pageNumber]: false }));
                              setImageLoadedStates(prev => ({ ...prev, [pageImage.pageNumber]: false }));
                            }}
                            className="mt-2"
                          >
                            Retry
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Document Image */}
                    <img
                      src={pageImage.imageDataUrl}
                      alt={`Page ${pageImage.pageNumber}`}
                      className="block"
                      style={{
                        width: pageImage.width * zoom,
                        height: pageImage.height * zoom,
                        display: isImageError ? 'none' : 'block',
                      }}
                      onLoad={() => handleImageLoad(pageImage.pageNumber)}
                      onError={() => handleImageError(pageImage.pageNumber)}
                    />

                    {/* Field Overlays for this page */}
                    {React.Children.map(children, child => {
                      if (React.isValidElement(child) && child.props.pageNumber === pageImage.pageNumber) {
                        return React.cloneElement(child as React.ReactElement<any>, {
                          style: {
                            ...child.props.style,
                            transform: `scale(${zoom})`,
                            transformOrigin: 'top left',
                          }
                        });
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}