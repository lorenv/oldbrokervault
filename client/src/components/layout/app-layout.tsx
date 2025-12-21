import { ReactNode } from "react";
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
}

// Mobile menu trigger - only shows on small screens
function MobileMenuTrigger() {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      className="fixed top-4 left-4 z-50 md:hidden h-10 w-10 bg-white/90 backdrop-blur-sm border border-gray-200/50 shadow-sm hover:bg-white"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <MobileMenuTrigger />
      <SidebarInset>
        {/* Main content area - no top bar */}
        <main className="flex-1 overflow-auto min-h-screen">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default AppLayout;
