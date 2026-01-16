import { Link, useLocation } from "wouter";
import { Home, Briefcase, CheckSquare, Menu } from "lucide-react";
import { useBrandColor } from "@/hooks/use-brand-color";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";

const navItems = [
  { label: "Dashboard", icon: Home, href: "/dashboard" },
  { label: "Deals", icon: Briefcase, href: "/deals" },
  { label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { label: "More", icon: Menu, href: null, action: "openSidebar" },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { brandColor } = useBrandColor();
  const { open, setOpen } = useSidebar();
  const { unreadCount } = useUnreadNotifications();

  // Only show on mobile
  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.href ? (location === item.href || location.startsWith(item.href + "/")) : false;

          // Handle "More" button differently
          if (item.action === "openSidebar") {
            return (
              <button
                key={index}
                onClick={() => setOpen(true)}
                className="flex flex-col items-center justify-center w-full h-full px-4 py-2 transition-colors relative"
              >
                {unreadCount > 0 && (
                  <div className="absolute top-1 right-1/2 translate-x-3 -translate-y-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
                <Icon className="h-5 w-5 mb-1 text-gray-500" />
                <span className="text-xs font-medium text-gray-500">
                  {item.label}
                </span>
              </button>
            );
          }

          // Regular navigation items
          return (
            <Link key={item.href} href={item.href!}>
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
