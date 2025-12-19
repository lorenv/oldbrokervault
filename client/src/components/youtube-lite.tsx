import { useState } from "react";
import { Play } from "lucide-react";

interface YouTubeLiteProps {
  videoId: string;
  title: string;
  className?: string;
}

/**
 * Lightweight YouTube embed that only loads the iframe when clicked.
 * Significantly improves page load performance by deferring the heavy YouTube embed.
 */
export function YouTubeLite({ videoId, title, className = "" }: YouTubeLiteProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  // YouTube thumbnail URL - use maxresdefault for best quality, fallback to hqdefault
  // maxresdefault only exists for videos uploaded at 1080p or higher
  const thumbnailUrl = thumbnailError
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

  if (isLoaded) {
    return (
      <div className={`relative aspect-video ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsLoaded(true)}
      className={`relative aspect-video w-full cursor-pointer group ${className}`}
      aria-label={`Play video: ${title}`}
    >
      {/* Thumbnail with fallback */}
      <img
        src={thumbnailUrl}
        alt={title}
        loading="lazy"
        onError={() => setThumbnailError(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300" />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-red-700 transition-all duration-300">
          <Play className="w-10 h-10 text-white ml-1" fill="white" />
        </div>
      </div>

      {/* YouTube branding hint */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded">
        YouTube
      </div>
    </button>
  );
}
