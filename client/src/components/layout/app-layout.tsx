import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { GlobalHeader } from "./global-header";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      {/* Global Header - fixed full-width at top */}
      <GlobalHeader />
      {/* Content area with top padding to offset fixed header */}
      <div className="flex min-h-screen pt-16">
        <AppSidebar />
        <SidebarInset className="flex flex-col">
          {/* Main content area */}
          <main className={`flex-1 overflow-x-hidden overflow-y-auto max-w-full ${isMobile ? 'pb-20' : ''}`}>
            {children}
          </main>
        </SidebarInset>
      </div>
      <MobileBottomNav />
    </SidebarProvider>
  );
}

export default AppLayout;
