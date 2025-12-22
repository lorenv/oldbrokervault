import { Link, useLocation } from "wouter";
import { Plus, FileText, MessageCircle } from "lucide-react";
import { useBrandColor } from "@/hooks/use-brand-color";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { label: "Create", icon: Plus, href: "/dashboard" },
  { label: "My CIMs", icon: FileText, href: "/documents" },
  { label: "Messages", icon: MessageCircle, href: "/messages" },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { brandColor } = useBrandColor();

  // Only show on mobile
  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || location.startsWith(item.href + "/");

          return (
            <Link key={item.href} href={item.href}>
              <button
                className="flex flex-col items-center justify-center w-full h-full px-4 py-2 transition-colors"
                style={isActive && brandColor ? { color: brandColor } : undefined}
              >
                <Icon
                  className={`h-5 w-5 mb-1 ${isActive ? '' : 'text-gray-500'}`}
                  style={isActive && brandColor ? { color: brandColor } : undefined}
                />
                <span
                  className={`text-xs font-medium ${isActive ? '' : 'text-gray-500'}`}
                  style={isActive && brandColor ? { color: brandColor } : undefined}
                >
                  {item.label}
                </span>
                {isActive && (
                  <div
                    className="absolute bottom-0 w-12 h-0.5 rounded-full"
                    style={{ backgroundColor: brandColor || '#3b82f6' }}
                  />
                )}
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
