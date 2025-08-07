import { Link, useLocation } from "wouter";
import { 
  FileText, 
  Users, 
  LayoutTemplate, 
  Settings, 
  BarChart3, 
  User,
  Menu,
  X,
  LogOut,
  PenTool
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import undersignedLogo from "../../assets/undersigned-logo.png";

const navigationItems = [
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/documents", icon: FileText, label: "Documents" },
  { href: "/templates", icon: LayoutTemplate, label: "Templates" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [location] = useLocation();
  const isMobile = useIsMobile();

  // Close sidebar when clicking on navigation items on mobile
  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const sidebarContent = (
    <div className="bg-white shadow-lg border-r border-slate-200 flex flex-col h-full">
      {/* Logo and Brand */}
      <div className="px-6 py-6 border-b border-slate-200 h-[89px] flex items-center">
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1">
            <PenTool className="h-6 w-6 text-blue-600 mr-2 flex-shrink-0" />
            <img 
              src={undersignedLogo} 
              alt="Undersigned" 
              className="h-12 w-full object-contain"
            />
          </div>
          {isMobile && onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="ml-2">
              <X size={20} />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = location === item.href || 
                          (item.href === "/dashboard" && location === "/") ||
                          (item.href === "/documents" && location.startsWith("/document/")) ||
                          (item.href === "/templates" && location.startsWith("/template/")) ||
                          (item.href === "/settings" && location === "/settings");
            const Icon = item.icon;
            
            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    onClick={handleNavClick}
                    className={`w-full justify-start ${
                      isActive 
                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100" 
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="text-white" size={16} />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-900">Robert Kale</p>
              <p className="text-xs text-slate-500">Free Plan</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-500 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile Overlay */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
        
        {/* Mobile Sidebar */}
        <div className={`
          fixed top-0 left-0 z-50 w-64 h-full transform transition-transform duration-300 ease-in-out lg:hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {sidebarContent}
        </div>
      </>
    );
  }

  // Desktop sidebar
  return (
    <div className="w-64 hidden lg:block">
      {sidebarContent}
    </div>
  );
}
