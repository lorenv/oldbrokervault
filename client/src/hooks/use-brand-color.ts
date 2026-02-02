import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export function useBrandColor() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const brandColor = (profile as any)?.pdfPrimaryColor || (profile as any)?.brandColors?.[0] || null;

  // Helper to determine if brand color is light (needs dark text)
  const isLightColor = (hexColor: string): boolean => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  };

  const needsDarkText = brandColor ? isLightColor(brandColor) : false;

  return {
    brandColor,
    needsDarkText,
    // CSS styles for brand-colored elements
    brandButtonStyle: brandColor ? {
      backgroundColor: brandColor,
      color: needsDarkText ? '#1e293b' : '#ffffff',
      borderColor: brandColor,
    } : undefined,
    brandButtonHoverStyle: brandColor ? {
      backgroundColor: `${brandColor}dd`,
    } : undefined,
    // For subtle backgrounds
    brandBgLight: brandColor ? `${brandColor}15` : undefined,
    brandBgMedium: brandColor ? `${brandColor}25` : undefined,
    brandBorder: brandColor ? `${brandColor}40` : undefined,
  };
}
