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
import { Settings, LogOut, User, HelpCircle, Plus, Menu, MessageCircle, BarChart3, WandSparkles, Signature, MoreHorizontal, FileCheck, ChevronDown, ChevronRight, Users, FileText, Zap, Shield, Database, PenTool, Briefcase, MessageSquare, TrendingUp, Link2, Workflow, LayoutGrid } from "lucide-react";
import { useState, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SupportDialog } from "./support-dialog";
import { useQuery } from "@tanstack/react-query";

export function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const featuresTimeout = useRef<NodeJS.Timeout | null>(null);
  const isHomePage = location === '/';

  // Fetch profile data for profile picture
  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  // Fetch listings settings for My Listings Page link
  const { data: listingsSettings } = useQuery<{
    listingsEnabled: boolean;
    listingsSlug: string | null;
  }>({
    queryKey: ["/api/listings/settings"],
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
          <div className="flex items-center cursor-pointer">
            {user ? (
              <img
                src="/brokervaultlogo.svg"
                alt="Broker Vault"
                className="h-8 max-w-[160px] object-contain"
              />
            ) : (
              <span className={`text-xl font-bold ${isHomePage ? "text-white" : "text-gray-900"}`}>
                BrokerVault<span className="text-indigo-600">.ai</span>
              </span>
            )}
          </div>
        </Link>

        {/* Spacer to push navigation to the right */}
        <div className="flex-1"></div>

        {/* Navigation for logged-in users - right aligned */}
        {user && (
          <>
            <nav className="hidden md:flex items-center space-x-1 mr-4">
              {/* Primary Nav Items */}
              <Link href="/dashboard?mode=cim">
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
                      ['/analytics', '/messages', '/sde-analyzer', '/nda-templates', '/integrations'].includes(location)
                        ? 'text-blue-700 font-semibold'
                        : isHomePage ? 'text-white' : 'text-gray-700'
                    } hover:bg-white/10 transition-colors ${isHomePage ? 'hover:text-white' : 'hover:text-gray-900'}`}
                  >
                    <MoreHorizontal className="mr-1 h-4 w-4" />
                    More
                    <ChevronDown className="ml-1 h-3 w-3" />
                    {['/analytics', '/messages', '/sde-analyzer', '/nda-templates', '/integrations'].includes(location) && (
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
                  <DropdownMenuItem asChild>
                    <Link href="/nda-templates" className="flex items-center cursor-pointer w-full">
                      <FileCheck className="h-4 w-4 mr-2" />
                      NDA Templates
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/integrations" className="flex items-center cursor-pointer w-full">
                      <Workflow className="h-4 w-4 mr-2" />
                      Integrations
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
            {/* Features Dropdown - Hover */}
            <div
              className="relative"
              onMouseEnter={() => {
                if (featuresTimeout.current) clearTimeout(featuresTimeout.current);
                setFeaturesOpen(true);
              }}
              onMouseLeave={() => {
                featuresTimeout.current = setTimeout(() => setFeaturesOpen(false), 150);
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                className={`${isHomePage ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-700 hover:text-gray-900"} transition-colors`}
              >
                Features
                <ChevronDown className={`ml-1 h-3 w-3 transition-transform duration-200 ${featuresOpen ? 'rotate-180' : ''}`} />
              </Button>
              {featuresOpen && (
                <div className="absolute top-full right-0 mt-2 w-[600px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200/60 p-6 z-50">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {/* Left Column */}
                    <div className="space-y-1">
                      <div className="px-3 py-2 mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Core Platform</span>
                      </div>
                      <Link href="/features/ai-powered-cim" onClick={() => setFeaturesOpen(false)}>
                        <div className="flex items-start px-3 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center mr-3">
                            <Zap className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">AI CIM Generator</div>
                            <div className="text-sm text-gray-500 mt-0.5">Create professional CIMs in minutes with AI</div>
                          </div>
                        </div>
                      </Link>
                      <Link href="/features/esignatures" onClick={() => setFeaturesOpen(false)}>
                        <div className="flex items-start px-3 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center mr-3">
                            <PenTool className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">eSignatures</div>
                            <div className="text-sm text-gray-500 mt-0.5">Secure digital document signing</div>
                          </div>
                        </div>
                      </Link>
                      <Link href="/features/sde-analyzer" onClick={() => setFeaturesOpen(false)}>
                        <div className="flex items-start px-3 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                            <WandSparkles className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">SDE Analyzer</div>
                            <div className="text-sm text-gray-500 mt-0.5">AI-powered financial analysis</div>
                          </div>
                        </div>
                      </Link>
                      <Link href="/features/nda-protection" onClick={() => setFeaturesOpen(false)}>
                        <div className="flex items-start px-3 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mr-3">
                            <Shield className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">NDA Protection</div>
                            <div className="text-sm text-gray-500 mt-0.5">Secure document sharing controls</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                    {/* Right Column */}
                    <div className="space-y-1">
                      <div className="px-3 py-2 mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tools & Integrations</span>
                      </div>
                      <Link href="/features/investor-database" onClick={() => setFeaturesOpen(false)}>
                        <div className="flex items-start px-3 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
                            <Database className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">Investor CRM</div>
                            <div className="text-sm text-gray-500 mt-0.5">Track and manage buyer relationships</div>
                          </div>
                        </div>
                      </Link>
                      <Link href="/features/messages" onClick={() => setFeaturesOpen(false)}>
                        <div className="flex items-start px-3 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center mr-3">
                            <MessageSquare className="h-5 w-5 text-cyan-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors">Message Center</div>
                            <div className="text-sm text-gray-500 mt-0.5">Centralized buyer communication</div>
                          </div>
                        </div>
                      </Link>
                      <Link href="/features/analytics" onClick={() => setFeaturesOpen(false)}>
                        <div className="flex items-start px-3 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mr-3">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">Analytics Dashboard</div>
                            <div className="text-sm text-gray-500 mt-0.5">Track engagement and deal progress</div>
                          </div>
                        </div>
                      </Link>
                      <Link href="/features/integrations" onClick={() => setFeaturesOpen(false)}>
                        <div className="flex items-start px-3 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                            <Workflow className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Integrations</div>
                            <div className="text-sm text-gray-500 mt-0.5">Connect to Zapier, HubSpot & more</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                  {/* Bottom CTA */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <Link href="/virtual-data-room" onClick={() => setFeaturesOpen(false)}>
                      <div className="flex items-center justify-between px-3 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group">
                        <div className="flex items-center">
                          <img src="/vv.png" alt="Virtual Diligence Room" className="w-10 h-10 object-contain mr-3" />
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-slate-600 transition-colors">Virtual Diligence Room</div>
                            <div className="text-sm text-gray-500 mt-0.5">Secure deal management & document sharing</div>
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-gray-400 -rotate-90" />
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link href="/pricing">
              <Button
                variant="ghost"
                size="sm"
                className={`${isHomePage ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-700 hover:text-gray-900"} transition-colors`}
              >
                Pricing
              </Button>
            </Link>
          </div>
        )}

        {/* CTA buttons for non-users */}
        {!user && (
          <div className="flex items-center space-x-3">
            {/* Desktop Book a Demo + Login */}
            <div className="hidden md:flex items-center gap-2">
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${isHomePage ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-700 hover:text-gray-900"} transition-colors`}
                  data-testid="button-login"
                >
                  Login
                </Button>
              </Link>
              <a href="https://meetings-na2.hubspot.com/rob-kale" target="_blank" rel="noopener noreferrer">
                <Button
                  size="sm"
                  className={`${isHomePage ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-primary text-white hover:bg-primary/90"} transition-colors`}
                >
                  Book a Demo
                </Button>
              </a>
            </div>

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
                    {/* Collapsible Features Section */}
                    <Collapsible open={mobileFeaturesOpen} onOpenChange={setMobileFeaturesOpen}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-md">
                        <span className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-orange-500" />
                          Features
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${mobileFeaturesOpen ? 'rotate-180' : ''}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 space-y-1 mt-1">
                        <Link href="/features/ai-powered-cim" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <Zap className="mr-3 h-4 w-4 text-orange-500" />
                            AI CIM Generator
                          </Button>
                        </Link>
                        <Link href="/features/esignatures" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <PenTool className="mr-3 h-4 w-4 text-indigo-500" />
                            eSignatures
                          </Button>
                        </Link>
                        <Link href="/features/sde-analyzer" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <WandSparkles className="mr-3 h-4 w-4 text-blue-500" />
                            SDE Analyzer
                          </Button>
                        </Link>
                        <Link href="/features/nda-protection" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <Shield className="mr-3 h-4 w-4 text-green-500" />
                            NDA Protection
                          </Button>
                        </Link>
                        <Link href="/features/investor-database" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <Database className="mr-3 h-4 w-4 text-indigo-500" />
                            Investor CRM
                          </Button>
                        </Link>
                        <Link href="/features/messages" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <MessageSquare className="mr-3 h-4 w-4 text-cyan-500" />
                            Message Center
                          </Button>
                        </Link>
                        <Link href="/features/analytics" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <TrendingUp className="mr-3 h-4 w-4 text-emerald-500" />
                            Analytics Dashboard
                          </Button>
                        </Link>
                        <Link href="/features/integrations" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <Workflow className="mr-3 h-4 w-4 text-blue-600" />
                            Integrations
                          </Button>
                        </Link>
                        <Link href="/virtual-data-room" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <img src="/vv.png" alt="" className="mr-3 h-4 w-4 object-contain" />
                            Virtual Diligence Room
                          </Button>
                        </Link>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Collapsible Solutions Section */}
                    <Collapsible open={mobileSolutionsOpen} onOpenChange={setMobileSolutionsOpen}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-md">
                        <span className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-blue-600" />
                          Solutions
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${mobileSolutionsOpen ? 'rotate-180' : ''}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 space-y-1 mt-1">
                        <Link href="/solutions/business-brokers" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <Briefcase className="mr-3 h-4 w-4 text-blue-600" />
                            For M&A Advisors
                          </Button>
                        </Link>
                        <Link href="/solutions/investment-banking" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start text-left h-10 text-sm">
                            <BarChart3 className="mr-3 h-4 w-4 text-slate-700" />
                            For Investment Banks
                          </Button>
                        </Link>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Non-collapsible items */}
                    <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-left h-11" data-testid="link-pricing">
                        Pricing
                      </Button>
                    </Link>

                    <div className="pt-4 border-t mt-4 space-y-2">
                      <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full" data-testid="button-login-mobile">
                          Login
                        </Button>
                      </Link>
                      <a href="https://meetings-na2.hubspot.com/rob-kale" target="_blank" rel="noopener noreferrer" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full">
                          Book a Demo
                        </Button>
                      </a>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
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
                {listingsSettings?.listingsEnabled && listingsSettings?.listingsSlug ? (
                  <DropdownMenuItem asChild>
                    <div className="flex items-center justify-between w-full">
                      <a
                        href={`/listings/${listingsSettings.listingsSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center cursor-pointer flex-1"
                      >
                        <LayoutGrid className="h-4 w-4 mr-2" />
                        My Listings Page
                      </a>
                      <Link
                        href="/account?subtab=listings"
                        className="p-1 hover:bg-gray-100 rounded ml-2"
                        title="Listings Settings"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Settings className="h-3.5 w-3.5 text-gray-500 hover:text-gray-700" />
                      </Link>
                    </div>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href="/account?subtab=listings" className="flex items-center cursor-pointer w-full">
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      My Listings Page
                    </Link>
                  </DropdownMenuItem>
                )}
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
                    <Link href="/dashboard?mode=cim" onClick={() => setIsMobileMenuOpen(false)}>
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
                    {listingsSettings?.listingsEnabled && listingsSettings?.listingsSlug ? (
                      <div className="flex items-center w-full">
                        <a
                          href={`/listings/${listingsSettings.listingsSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex-1"
                        >
                          <Button variant="ghost" className="w-full justify-start text-left h-12 text-base">
                            <LayoutGrid className="mr-3 h-5 w-5" />
                            My Listings Page
                          </Button>
                        </a>
                        <Link
                          href="/account?subtab=listings"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="p-2 hover:bg-gray-100 rounded mr-2"
                          title="Listings Settings"
                        >
                          <Settings className="h-5 w-5 text-gray-500" />
                        </Link>
                      </div>
                    ) : (
                      <Link href="/account?subtab=listings" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-left h-12 text-base">
                          <LayoutGrid className="mr-3 h-5 w-5" />
                          My Listings Page
                        </Button>
                      </Link>
                    )}
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