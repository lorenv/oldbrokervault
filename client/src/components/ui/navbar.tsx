import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, FileText, LogOut, User, HelpCircle, Zap, Database, Menu } from "lucide-react";
import { useState } from "react";
import { SupportDialog } from "./support-dialog";
import { useQuery } from "@tanstack/react-query";

export function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [location] = useLocation();
  const isHomePage = location === '/';

  // Fetch profile data for profile picture
  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  return (
    <nav className={
      isHomePage 
        ? "absolute top-0 left-0 right-0 z-50" 
        : user 
          ? "border-b bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-200" 
          : "border-b"
    }>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <Link href={user ? "/dashboard" : "/"}>
            <div className="flex items-center space-x-2 cursor-pointer">
              <img 
                src="/cim-share-logo.png" 
                alt="CIM Share" 
                className={`h-10 ${isHomePage ? "brightness-0 invert" : ""}`}
              />
            </div>
          </Link>
          {!user && (
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/pricing">
                <span className={`text-sm font-medium transition-colors cursor-pointer ${isHomePage ? "text-white hover:text-gray-200" : "hover:text-primary"}`}>Pricing</span>
              </Link>
              <Link href="/contact">
                <span className={`text-sm font-medium transition-colors cursor-pointer ${isHomePage ? "text-white hover:text-gray-200" : "hover:text-primary"}`}>Contact</span>
              </Link>
            </div>
          )}
        </div>

        {!user && (
          <div className="flex items-center ml-8">
            <Link href="/login">
              <Button 
                variant="outline"
                size="sm" 
                className={isHomePage ? "bg-transparent border-white text-white hover:bg-white hover:text-gray-800 transition-colors" : ""}
              >
                Login / Sign Up
              </Button>
            </Link>
          </div>
        )}

        {user && (
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`flex items-center gap-2 ${isHomePage ? "bg-transparent border-white text-white hover:bg-white hover:text-gray-800 transition-colors" : ""}`}
                >
                  Menu
                  {(profile as any)?.profilePhoto ? (
                    <img 
                      src={(profile as any).profilePhoto} 
                      alt="Profile" 
                      className="w-6 h-6 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Menu</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center cursor-pointer w-full">
                    <Zap className="h-4 w-4 mr-2" />
                    Create New CIM
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/documents" className="flex items-center cursor-pointer w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    My CIMs
                  </Link>
                </DropdownMenuItem>
                {(user.subscriptionStatus === 'premium' || user.subscriptionStatus === 'standard' || user.isAdmin) && (
                  <DropdownMenuItem asChild>
                    <Link href="/investor-database" className="flex items-center cursor-pointer w-full">
                      <Database className="h-4 w-4 mr-2" />
                      Investor Database
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/nda-templates" className="flex items-center cursor-pointer w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    NDA Templates
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center cursor-pointer w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    My Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsSupportOpen(true)}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Support
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      <SupportDialog open={isSupportOpen} onOpenChange={setIsSupportOpen} />
    </nav>
  );
}