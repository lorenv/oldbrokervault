import React, { useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
  currentPage: number;
  onPageChange: (page: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  children?: React.ReactNode; // For field overlays
  className?: string;
}

export default function ImageDocumentViewer({
  pageImages,
  currentPage,
  onPageChange,
  zoom,
  onZoomChange,
  children,
  className = ''
}: ImageDocumentViewerProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPageImage = pageImages.find(img => img.pageNumber === currentPage);
  const totalPages = pageImages.length;

  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
      setImageLoaded(false);
    }
  }, [currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
      setImageLoaded(false);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handleZoomIn = useCallback(() => {
    onZoomChange(Math.min(zoom * 1.2, 3));
  }, [zoom, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    onZoomChange(Math.max(zoom / 1.2, 0.3));
  }, [zoom, onZoomChange]);

  const handleResetZoom = useCallback(() => {
    onZoomChange(1);
  }, [onZoomChange]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoaded(false);
    setImageError(true);
  }, []);

  if (!currentPageImage) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 border border-dashed border-slate-300 rounded-lg ${className}`}>
        <div className="text-center p-8">
          <div className="text-slate-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No document loaded</h3>
          <p className="text-sm text-slate-500">Upload a PDF to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {/* Document Controls */}
      <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              Page {currentPage} of {totalPages}
            </Badge>
            <Badge 
              variant="outline" 
              className={`text-xs ${
                currentPageImage.width > currentPageImage.height 
                  ? 'text-orange-600 border-orange-300 bg-orange-50' 
                  : 'text-blue-600 border-blue-300 bg-blue-50'
              }`}
            >
              {currentPageImage.width > currentPageImage.height ? 'Landscape' : 'Portrait'}
            </Badge>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.3}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <Badge variant="outline" className="min-w-16">
            {Math.round(zoom * 100)}%
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetZoom}
            disabled={zoom === 1}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document Viewer */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-slate-100 relative"
        style={{ minHeight: '600px' }}
      >
        {/* Detect orientation and adjust container accordingly */}
        <div className={`p-4 ${currentPageImage.width > currentPageImage.height ? 'min-w-fit' : 'flex justify-center'}`}>
          <div 
            className="relative bg-white shadow-lg"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: currentPageImage.width > currentPageImage.height ? 'top left' : 'top center',
              transition: 'transform 0.2s ease',
              // Ensure landscape pages have proper width allowance
              minWidth: currentPageImage.width > currentPageImage.height ? `${currentPageImage.width}px` : 'auto',
            }}
          >
            {/* Document Image */}
            <div className="relative">
              {!imageLoaded && !imageError && (
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-slate-100 border border-slate-200"
                  style={{ 
                    width: currentPageImage.width, 
                    height: currentPageImage.height 
                  }}
                >
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-slate-500">Loading page...</p>
                  </div>
                </div>
              )}

              {imageError && (
                <div 
                  className="flex items-center justify-center bg-red-50 border border-red-200 text-red-600"
                  style={{ 
                    width: currentPageImage.width, 
                    height: currentPageImage.height 
                  }}
                >
                  <div className="text-center">
                    <p className="text-sm">Failed to load page image</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => {
                        setImageError(false);
                        setImageLoaded(false);
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              <img
                src={currentPageImage.imageDataUrl}
                alt={`Page ${currentPage}`}
                style={{
                  display: imageLoaded ? 'block' : 'none',
                  width: currentPageImage.width,
                  height: currentPageImage.height,
                }}
                onLoad={handleImageLoad}
                onError={handleImageError}
                draggable={false}
                className="border border-slate-200"
              />

              {/* Field Overlays */}
              {imageLoaded && children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}