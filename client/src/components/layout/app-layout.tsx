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
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        {/* Global Header with Search and Quick Create */}
        <GlobalHeader />
        {/* Main content area */}
        <main className={`flex-1 overflow-x-hidden overflow-y-auto max-w-full ${isMobile ? 'pb-20' : ''}`}>
          {children}
        </main>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  );
}

export default AppLayout;
