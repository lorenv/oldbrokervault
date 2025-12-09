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
import { Settings, LogOut, User, HelpCircle, Plus, Menu, MessageCircle, BarChart3, WandSparkles, Signature, MoreHorizontal, FileCheck, ChevronDown, Users, FileText, Zap, Shield, Database, PenTool, Briefcase, MessageSquare, TrendingUp } from "lucide-react";
import { useState } from "react";
import { SupportDialog } from "./support-dialog";
import { useQuery } from "@tanstack/react-query";

export function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
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
              {/* Primary Nav Items */}
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
                  <Plus className="mr-1 h-4 w-4" />
                  New CIM
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
                  <Users className="mr-1 h-4 w-4" />
                  CRM
                  {location === '/investor-database' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </Button>
              </Link>
              <Link href="/esign">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative ${
                    location.startsWith('/esign')
                      ? 'text-blue-700 font-semibold'
                      : isHomePage ? 'text-white' : 'text-gray-700'
                  } hover:bg-white/10 transition-colors ${isHomePage ? 'hover:text-white' : 'hover:text-gray-900'}`}
                >
                  <Signature className="mr-1 h-4 w-4" />
                  Sign
                  {location.startsWith('/esign') && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </Button>
              </Link>

              {/* More Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`relative ${
                      ['/analytics', '/messages', '/sde-analyzer', '/nda-templates'].includes(location)
                        ? 'text-blue-700 font-semibold'
                        : isHomePage ? 'text-white' : 'text-gray-700'
                    } hover:bg-white/10 transition-colors ${isHomePage ? 'hover:text-white' : 'hover:text-gray-900'}`}
                  >
                    <MoreHorizontal className="mr-1 h-4 w-4" />
                    More
                    <ChevronDown className="ml-1 h-3 w-3" />
                    {['/analytics', '/messages', '/sde-analyzer', '/nda-templates'].includes(location) && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/analytics" className="flex items-center cursor-pointer w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/messages" className="flex items-center cursor-pointer w-full">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Messages
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/sde-analyzer" className="flex items-center cursor-pointer w-full">
                      <WandSparkles className="h-4 w-4 mr-2" />
                      SDE Analyzer
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/nda-templates" className="flex items-center cursor-pointer w-full">
                      <FileCheck className="h-4 w-4 mr-2" />
                      NDA Templates
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </>
        )}

        {/* Navigation for non-logged-in users - right aligned */}
        {!user && (
          <div className="hidden md:flex items-center space-x-1 mr-4">
            {/* Features Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${isHomePage ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-700 hover:text-gray-900"} transition-colors`}
                >
                  Features
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/features/ai-powered-cim" className="flex items-center cursor-pointer w-full">
                    <Zap className="h-4 w-4 mr-2 text-orange-500" />
                    <div>
                      <div className="font-medium">AI CIM Generator</div>
                      <div className="text-xs text-muted-foreground">Create CIMs in minutes</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/features/sde-analyzer" className="flex items-center cursor-pointer w-full">
                    <WandSparkles className="h-4 w-4 mr-2 text-blue-500" />
                    <div>
                      <div className="font-medium">SDE Analyzer</div>
                      <div className="text-xs text-muted-foreground">AI financial analysis</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/features/nda-protection" className="flex items-center cursor-pointer w-full">
                    <Shield className="h-4 w-4 mr-2 text-green-500" />
                    <div>
                      <div className="font-medium">NDA Protection</div>
                      <div className="text-xs text-muted-foreground">Secure document sharing</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/features/investor-database" className="flex items-center cursor-pointer w-full">
                    <Database className="h-4 w-4 mr-2 text-indigo-500" />
                    <div>
                      <div className="font-medium">Investor CRM</div>
                      <div className="text-xs text-muted-foreground">Track buyer relationships</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/features/messages" className="flex items-center cursor-pointer w-full">
                    <MessageSquare className="h-4 w-4 mr-2 text-cyan-500" />
                    <div>
                      <div className="font-medium">Message Center</div>
                      <div className="text-xs text-muted-foreground">Centralized communication</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/features/analytics" className="flex items-center cursor-pointer w-full">
                    <TrendingUp className="h-4 w-4 mr-2 text-emerald-500" />
                    <div>
                      <div className="font-medium">Analytics Dashboard</div>
                      <div className="text-xs text-muted-foreground">Track buyer engagement</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/virtual-data-room" className="flex items-center cursor-pointer w-full">
                    <FileText className="h-4 w-4 mr-2 text-purple-500" />
                    <div>
                      <div className="font-medium">Virtual Data Room</div>
                      <div className="text-xs text-muted-foreground">Secure deal management</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Solutions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${isHomePage ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-700 hover:text-gray-900"} transition-colors`}
                >
                  Solutions
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/solutions/business-brokers" className="flex items-center cursor-pointer w-full">
                    <Briefcase className="h-4 w-4 mr-2 text-blue-600" />
                    <div>
                      <div className="font-medium">For M&A Advisors</div>
                      <div className="text-xs text-muted-foreground">Streamline deal flow</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/solutions/investment-banking" className="flex items-center cursor-pointer w-full">
                    <BarChart3 className="h-4 w-4 mr-2 text-slate-700" />
                    <div>
                      <div className="font-medium">For Investment Banks</div>
                      <div className="text-xs text-muted-foreground">Enterprise solutions</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/pricing">
              <Button
                variant="ghost"
                size="sm"
                className={`${isHomePage ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-700 hover:text-gray-900"} transition-colors`}
              >
                Pricing
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                variant="ghost"
                size="sm"
                className={`${isHomePage ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-700 hover:text-gray-900"} transition-colors`}
              >
                Contact
              </Button>
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
                <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-2 py-6">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2">
                      Features
                    </div>
                    <Link href="/features/ai-powered-cim" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11">
                        <Zap className="mr-3 h-4 w-4 text-orange-500" />
                        AI CIM Generator
                      </Button>
                    </Link>
                    <Link href="/features/sde-analyzer" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11">
                        <WandSparkles className="mr-3 h-4 w-4 text-blue-500" />
                        SDE Analyzer
                      </Button>
                    </Link>
                    <Link href="/features/nda-protection" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11">
                        <Shield className="mr-3 h-4 w-4 text-green-500" />
                        NDA Protection
                      </Button>
                    </Link>
                    <Link href="/features/investor-database" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11">
                        <Database className="mr-3 h-4 w-4 text-indigo-500" />
                        Investor CRM
                      </Button>
                    </Link>
                    <Link href="/features/messages" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11">
                        <MessageSquare className="mr-3 h-4 w-4 text-cyan-500" />
                        Message Center
                      </Button>
                    </Link>
                    <Link href="/features/analytics" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11">
                        <TrendingUp className="mr-3 h-4 w-4 text-emerald-500" />
                        Analytics Dashboard
                      </Button>
                    </Link>
                    <Link href="/virtual-data-room" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11">
                        <FileText className="mr-3 h-4 w-4 text-purple-500" />
                        Virtual Data Room
                      </Button>
                    </Link>

                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2 mt-4">
                      Solutions
                    </div>
                    <Link href="/solutions/business-brokers" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11">
                        <Briefcase className="mr-3 h-4 w-4 text-blue-600" />
                        For M&A Advisors
                      </Button>
                    </Link>
                    <Link href="/solutions/investment-banking" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11">
                        <BarChart3 className="mr-3 h-4 w-4 text-slate-700" />
                        For Investment Banks
                      </Button>
                    </Link>

                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2 mt-4">
                      Company
                    </div>
                    <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11" data-testid="link-pricing">
                        Pricing
                      </Button>
                    </Link>
                    <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11" data-testid="link-contact">
                        Contact
                      </Button>
                    </Link>

                    <div className="pt-4 border-t mt-4">
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
                  <DropdownMenuItem onClick={() => setLocation("/admin")} className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    Admin Panel
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
                <SheetContent side="right" className="w-[280px] sm:w-[350px] flex flex-col h-full">
                  <SheetHeader className="border-b pb-4 flex-shrink-0">
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

                  <div className="flex flex-col gap-2 py-6 overflow-y-auto flex-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2">
                      Main
                    </div>
                    <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/dashboard' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-12 text-base"
                      >
                        <Plus className="mr-3 h-5 w-5" />
                        New CIM
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
                    <Link href="/investor-database" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/investor-database' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-12 text-base"
                      >
                        <Users className="mr-3 h-5 w-5" />
                        CRM
                      </Button>
                    </Link>
                    <Link href="/esign" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location.startsWith('/esign') ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-12 text-base"
                      >
                        <Signature className="mr-3 h-5 w-5" />
                        Sign
                      </Button>
                    </Link>

                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2 mt-4">
                      Tools
                    </div>
                    <Link href="/analytics" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/analytics' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-11 text-base"
                      >
                        <BarChart3 className="mr-3 h-5 w-5" />
                        Analytics
                      </Button>
                    </Link>
                    <Link href="/messages" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/messages' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-11 text-base"
                      >
                        <MessageCircle className="mr-3 h-5 w-5" />
                        Messages
                      </Button>
                    </Link>
                    <Link href="/sde-analyzer" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/sde-analyzer' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-11 text-base"
                      >
                        <WandSparkles className="mr-3 h-5 w-5" />
                        SDE Analyzer
                      </Button>
                    </Link>
                    <Link href="/nda-templates" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant={location === '/nda-templates' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-11 text-base"
                      >
                        <FileCheck className="mr-3 h-5 w-5" />
                        NDA Templates
                      </Button>
                    </Link>

                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2 mt-4">
                      Account
                    </div>
                    <Link href="/account" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-12 text-base">
                        <Settings className="mr-3 h-5 w-5" />
                        Account Settings
                      </Button>
                    </Link>
                    {user.isAdmin && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-left h-12 text-base"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setLocation("/admin");
                        }}
                      >
                        <User className="mr-3 h-5 w-5" />
                        Admin Panel
                      </Button>
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
                </SheetContent>
              </Sheet>
            </div>
        )}
      </div>
      <SupportDialog open={isSupportOpen} onOpenChange={setIsSupportOpen} />
    </nav>
  );
}