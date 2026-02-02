import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

// Helper to determine if a color is light (needs dark text)
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  const { user } = useAuth();
  const { toggleSidebar, isMobile } = useSidebar();

  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const brandColor = (profile as any)?.pdfPrimaryColor || (profile as any)?.brandColors?.[0];
  const needsDarkText = brandColor ? isLightColor(brandColor) : false;

  return (
    <div className="mb-4 md:mb-6 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 py-4 md:py-5 bg-gradient-to-r from-white via-slate-50/80 to-blue-50/50 border-b border-slate-200/80">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          {/* Mobile menu button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="flex-shrink-0 h-10 w-10 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          {icon && (
            <div
              className="flex-shrink-0 p-2 md:p-2.5 rounded-lg md:rounded-xl shadow-md"
              style={{
                background: brandColor
                  ? `linear-gradient(to bottom right, ${brandColor}, ${brandColor}dd)`
                  : 'linear-gradient(to bottom right, #334155, #1e293b)'
              }}
            >
              <span className={needsDarkText ? "text-slate-800" : "text-white"}>{icon}</span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-semibold text-slate-800 tracking-tight truncate">{title}</h1>
            {description && (
              <p className="text-slate-500 mt-0.5 text-xs md:text-sm truncate">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
