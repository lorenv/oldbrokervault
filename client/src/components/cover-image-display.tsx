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
    <div className="relative w-full">
      {/* Cover Image with 16:3 aspect ratio */}
      <div className="relative w-full h-0 pb-[18.75%] overflow-hidden">
        <img 
          src={coverImageUrl}
          alt="Cover image"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: `${imagePosition.x}% ${imagePosition.y}%`
          }}
        />
        
        {/* Semi-transparent gradient overlay for visual appeal */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-black/10 to-transparent" />
      </div>
      
      {/* Attribution */}
      {coverImageAttribution && (
        <div 
          className="mt-2 text-xs text-gray-500 text-right px-6"
          dangerouslySetInnerHTML={{ __html: coverImageAttribution }}
        />
      )}
    </div>
  );
}