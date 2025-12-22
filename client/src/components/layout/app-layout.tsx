import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Main content area - no top bar */}
        <main className={`flex-1 overflow-x-hidden overflow-y-auto min-h-screen max-w-full ${isMobile ? 'pb-20' : ''}`}>
          {children}
        </main>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  );
}

export default AppLayout;
