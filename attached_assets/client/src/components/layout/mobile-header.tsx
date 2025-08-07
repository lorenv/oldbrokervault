import { Menu, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import undersignedLogo from "../../assets/undersigned-logo.png";

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
      <div className="flex items-center">
        <PenTool className="h-6 w-6 text-blue-600 mr-2" />
        <img 
          src={undersignedLogo} 
          alt="Undersigned" 
          className="h-8 w-auto"
        />
      </div>
      
      <Button variant="ghost" size="sm" onClick={onMenuClick}>
        <Menu size={24} />
      </Button>
    </header>
  );
}