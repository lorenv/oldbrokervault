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
import { Settings, LogOut, User, HelpCircle, Plus, Menu, MessageCircle, BarChart3, WandSparkles, Signature, MoreHorizontal, FileCheck, ChevronDown, Users, FileText, Workflow, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { SupportDialog } from "./support-dialog";
import { useQuery } from "@tanstack/react-query";

export function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();

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

  // If no user, don't render the navbar (login/register pages handle their own layout)
  if (!user) {
    return null;
  }

  return (
    <nav className="border-b bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-200">
      <div className="container mx-auto px-4 h-16 flex items-center">
        {/* Logo - always on the left */}
        <Link href="/dashboard">
          <div className="flex items-center cursor-pointer">
            <img
              src="/brokervaultlogo.svg"
              alt="Broker Vault"
              className="h-9 w-auto"
              style={{ imageRendering: 'auto' }}
            />
          </div>
        </Link>

        {/* Spacer to push navigation to the right */}
        <div className="flex-1"></div>

        {/* Navigation for logged-in users - right aligned */}
        <nav className="hidden md:flex items-center space-x-1 mr-4">
          {/* Primary Nav Items */}
          <Link href="/dashboard?mode=cim">
            <Button
              variant="ghost"
              size="sm"
              className={`relative ${
                location === '/dashboard'
                  ? 'text-blue-700 font-semibold'
                  : 'text-gray-700'
              } hover:bg-white/10 transition-colors hover:text-gray-900`}
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
                  : 'text-gray-700'
              } hover:bg-white/10 transition-colors hover:text-gray-900`}
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
                  : 'text-gray-700'
              } hover:bg-white/10 transition-colors hover:text-gray-900`}
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
                  : 'text-gray-700'
              } hover:bg-white/10 transition-colors hover:text-gray-900`}
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
                    : 'text-gray-700'
                } hover:bg-white/10 transition-colors hover:text-gray-900`}
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

        {/* Desktop User Menu - Profile Dropdown */}
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

        {/* Mobile Menu Button for logged-in users */}
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
      </div>
      <SupportDialog open={isSupportOpen} onOpenChange={setIsSupportOpen} />
    </nav>
  );
}
