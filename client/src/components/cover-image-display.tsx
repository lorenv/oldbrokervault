interface CoverImageDisplayProps {
  coverImageUrl?: string | null;
  coverImagePosition?: string | null;
  coverImageAttribution?: string | null;
  title?: string;
}

export function CoverImageDisplay({ 
  coverImageUrl, 
  coverImagePosition, 
  coverImageAttribution, 
  title 
}: CoverImageDisplayProps) {
  if (!coverImageUrl) {
    return null;
  }

  let imagePosition = { x: 50, y: 50 };
  if (coverImagePosition) {
    try {
      imagePosition = JSON.parse(coverImagePosition);
    } catch {
      // Use default position if parsing fails
    }
  }

  return (
    <div className="relative w-full mb-8">
      {/* Cover Image with 16:3 aspect ratio */}
      <div className="relative w-full h-0 pb-[18.75%] overflow-hidden rounded-lg">
        <img 
          src={coverImageUrl}
          alt="Cover image"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: `${imagePosition.x}% ${imagePosition.y}%`
          }}
        />
        
        {/* Gradient overlay for smooth transition to content */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white opacity-60" />
        
        {/* Title overlay if provided */}
        {title && (
          <div className="absolute bottom-4 left-6 right-6">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">
              {title}
            </h1>
          </div>
        )}
      </div>
      
      {/* Attribution */}
      {coverImageAttribution && (
        <div className="mt-2 text-xs text-gray-500 text-right">
          {coverImageAttribution}
        </div>
      )}
    </div>
  );
}