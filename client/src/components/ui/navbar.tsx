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
import { Settings, FileText, LogOut, User, HelpCircle, Zap, Database, Menu, MessageCircle, BarChart3 } from "lucide-react";
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
      <div className="container mx-auto px-4 h-16 flex items-center">
        {/* Logo - always on the left */}
        <Link href={user ? "/dashboard" : "/"}>
          <div className="flex items-center space-x-2 cursor-pointer">
            <img
              src="/cim-share-logo.png"
              alt="CIM Share"
              className={`h-10 ${isHomePage ? "brightness-0 invert" : ""}`}
            />
          </div>
        </Link>

        {/* Spacer to push navigation to the right */}
        <div className="flex-1"></div>

        {/* Navigation for logged-in users - right aligned */}
        {user && (
          <>
            <nav className="hidden md:flex items-center space-x-1 mr-4">
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative ${
                    location === '/dashboard'
                      ? 'text-blue-700 font-semibold'
                      : isHomePage ? 'text-white' : 'text-gray-700'
                  } hover:bg-white/10 transition-colors ${isHomePage ? 'hover:text-white' : 'hover:text-gray-900'}`}
                >
                  <Zap className="mr-1 h-4 w-4" />
                  Create CIM
                  {location === '/dashboard' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </Button>
              </Link>
              <Link href="/documents">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative ${
                    location === '/documents' || location.startsWith('/documents/')
                      ? 'text-blue-700 font-semibold'
                      : isHomePage ? 'text-white' : 'text-gray-700'
                  } hover:bg-white/10 transition-colors ${isHomePage ? 'hover:text-white' : 'hover:text-gray-900'}`}
                >
                  <FileText className="mr-1 h-4 w-4" />
                  My CIMs
                  {(location === '/documents' || location.startsWith('/documents/')) && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </Button>
              </Link>
              <Link href="/analytics">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative ${
                    location === '/analytics'
                      ? 'text-blue-700 font-semibold'
                      : isHomePage ? 'text-white' : 'text-gray-700'
                  } hover:bg-white/10 transition-colors ${isHomePage ? 'hover:text-white' : 'hover:text-gray-900'}`}
                >
                  <BarChart3 className="mr-1 h-4 w-4" />
                  Analytics
                  {location === '/analytics' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </Button>
              </Link>
              <Link href="/messages">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative ${
                    location === '/messages'
                      ? 'text-blue-700 font-semibold'
                      : isHomePage ? 'text-white' : 'text-gray-700'
                  } hover:bg-white/10 transition-colors ${isHomePage ? 'hover:text-white' : 'hover:text-gray-900'}`}
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  Messages
                  {location === '/messages' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </Button>
              </Link>
              <Link href="/investor-database">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative ${
                    location === '/investor-database'
                      ? 'text-blue-700 font-semibold'
                      : isHomePage ? 'text-white' : 'text-gray-700'
                  } hover:bg-white/10 transition-colors ${isHomePage ? 'hover:text-white' : 'hover:text-gray-900'}`}
                >
                  <Database className="mr-1 h-4 w-4" />
                  CRM
                  {location === '/investor-database' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </Button>
              </Link>
            </nav>
          </>
        )}

        {/* Navigation for non-logged-in users - right aligned */}
        {!user && (
          <div className="hidden md:flex items-center space-x-6 mr-4">
            <Link href="/pricing">
              <span className={`text-sm font-medium transition-colors cursor-pointer ${isHomePage ? "text-white hover:text-gray-200" : "hover:text-primary"}`}>Pricing</span>
            </Link>
            <Link href="/contact">
              <span className={`text-sm font-medium transition-colors cursor-pointer ${isHomePage ? "text-white hover:text-gray-200" : "hover:text-primary"}`}>Contact</span>
            </Link>
          </div>
        )}

        {/* Login button for non-users */}
        {!user && (
          <div className="flex items-center space-x-3">
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
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] sm:w-[350px]">
                  <SheetHeader className="border-b pb-4">
                    <div className="flex items-center gap-3">
                      {(profile as any)?.profilePhoto ? (
                        <img
                          src={(profile as any).profilePhoto}
                          alt="Profile"
                          className="w-12 h-12 rounded-full object-cover border-2 border-blue-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                      )}
                      <div className="flex flex-col text-left">
                        <SheetTitle className="text-base">{user.email}</SheetTitle>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="flex flex-col gap-2 py-6">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2">
                      Navigation
                    </div>
                    <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/dashboard' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-12 text-base"
                      >
                        <Zap className="mr-3 h-5 w-5" />
                        Create CIM
                      </Button>
                    </Link>
                    <Link href="/documents" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/documents' || location.startsWith('/documents/') ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-12 text-base"
                      >
                        <FileText className="mr-3 h-5 w-5" />
                        My CIMs
                      </Button>
                    </Link>
                    <Link href="/analytics" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/analytics' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-12 text-base"
                      >
                        <BarChart3 className="mr-3 h-5 w-5" />
                        Analytics
                      </Button>
                    </Link>
                    <Link href="/messages" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/messages' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-12 text-base"
                      >
                        <MessageCircle className="mr-3 h-5 w-5" />
                        Messages
                      </Button>
                    </Link>
                    <Link href="/investor-database" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/investor-database' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-12 text-base"
                      >
                        <Database className="mr-3 h-5 w-5" />
                        CRM
                      </Button>
                    </Link>

                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2 mt-6">
                      Account
                    </div>
                    <Link href="/account" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-12 text-base">
                        <Settings className="mr-3 h-5 w-5" />
                        Account Settings
                      </Button>
                    </Link>
                    {user.isAdmin && (
                      <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-left h-12 text-base">
                          <User className="mr-3 h-5 w-5" />
                          Admin Panel
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left h-12 text-base"
                      onClick={() => {
                        setIsSupportOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <HelpCircle className="mr-3 h-5 w-5" />
                      Support
                    </Button>

                    <div className="border-t mt-6 pt-6">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-left h-12 text-base text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          logoutMutation.mutate();
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <LogOut className="mr-3 h-5 w-5" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
        )}
      </div>
      <SupportDialog open={isSupportOpen} onOpenChange={setIsSupportOpen} />
    </nav>
  );
}