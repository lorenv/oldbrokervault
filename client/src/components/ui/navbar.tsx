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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Settings, FileText, LogOut, User, HelpCircle, Zap, Database, Menu, MessageCircle } from "lucide-react";
import { useState } from "react";
import { SupportDialog } from "./support-dialog";
import { useQuery } from "@tanstack/react-query";

export function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        {/* Logo */}
        <Link href={user ? "/dashboard" : "/"}>
          <div className="flex items-center space-x-2 cursor-pointer">
            <img 
              src="/cim-share-logo.png" 
              alt="CIM Share" 
              className={`h-10 ${isHomePage ? "brightness-0 invert" : ""}`}
            />
          </div>
        </Link>

        {/* Navigation for logged-in users */}
        {user && (
          <div className="hidden md:flex items-center justify-center flex-1 mx-8">
            <nav className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${location === '/dashboard' ? 'bg-white text-gray-900' : ''} hover:bg-white/80`}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Create CIM
                </Button>
              </Link>
              <Link href="/documents">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${location === '/documents' ? 'bg-white text-gray-900' : ''} hover:bg-white/80`}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  My CIMs
                </Button>
              </Link>
              <Link href="/messages">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${location === '/messages' ? 'bg-white text-gray-900' : ''} hover:bg-white/80`}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Messages
                </Button>
              </Link>
              <Link href="/investor-database">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${location === '/investor-database' ? 'bg-white text-gray-900' : ''} hover:bg-white/80`}
                >
                  <Database className="mr-2 h-4 w-4" />
                  Investors
                </Button>
              </Link>
            </nav>
          </div>
        )}

        {/* Non-user navigation */}
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

        {!user && (
          <div className="flex items-center ml-8 space-x-3">
            {/* Mobile Menu for Logged-out Users */}
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className={`h-10 w-10 p-0 ${isHomePage ? "text-white hover:bg-white/20" : ""}`}
                    aria-label="Open menu"
                    data-testid="button-mobile-menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="grid gap-4 py-6">
                    <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left" data-testid="link-pricing">
                        Pricing
                      </Button>
                    </Link>
                    <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left" data-testid="link-contact">
                        Contact
                      </Button>
                    </Link>
                    <div className="pt-4 border-t">
                      <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full" data-testid="button-login-mobile">
                          Login / Sign Up
                        </Button>
                      </Link>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            
            {/* Desktop Login Button */}
            <div className="hidden md:block">
              <Link href="/login">
                <Button 
                  variant="outline"
                  size="sm" 
                  className={`${isHomePage ? "bg-transparent border-white text-white hover:bg-white hover:text-gray-800 transition-colors" : ""}`}
                  data-testid="button-login"
                >
                  Login / Sign Up
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Desktop User Menu - Profile Dropdown */}
        {user && (
          <div className="hidden md:flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 px-2 py-2 h-auto"
                >
                  {(profile as any)?.profilePhoto ? (
                    <img
                      src={(profile as any).profilePhoto}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover border-2 border-white/20"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-700" />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Account</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center cursor-pointer w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Account Settings
                  </Link>
                </DropdownMenuItem>
                {user.isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center cursor-pointer w-full">
                      <User className="h-4 w-4 mr-2" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setIsSupportOpen(true)}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Support
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logoutMutation.mutate()}
                  className="text-red-600"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Mobile Menu Button for logged-in users */}
        {user && (
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="w-full cursor-pointer">
                      <Zap className="mr-2 h-4 w-4" />
                      Create CIM
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/documents" className="w-full cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      My CIMs
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/messages" className="w-full cursor-pointer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Messages
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/investor-database" className="w-full cursor-pointer">
                      <Database className="mr-2 h-4 w-4" />
                      Investor Database
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="w-full cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Account Settings
                    </Link>
                  </DropdownMenuItem>
                  {user.isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="w-full cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setIsSupportOpen(true)}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Support
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    className="text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
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