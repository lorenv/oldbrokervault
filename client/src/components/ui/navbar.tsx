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
import { Settings, FileText, LogOut, User, HelpCircle, Zap, Database } from "lucide-react";
import { useState } from "react";
import { SupportDialog } from "./support-dialog";

export function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [location] = useLocation();
  const isHomePage = location === '/';

  return (
    <nav className={isHomePage ? "absolute top-0 left-0 right-0 z-50" : "border-b"}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <Link href={user ? "/dashboard" : "/"}>
            <div className="flex items-center space-x-2">
              <img 
                src="/cim-share-logo.png" 
                alt="CIM Share" 
                className={`h-12 ${isHomePage ? "brightness-0 invert" : ""}`}
              />
            </div>
          </Link>
          {!user && (
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/pricing">
                <span className={`text-sm font-medium transition-colors ${isHomePage ? "text-white hover:text-gray-200" : "hover:text-primary"}`}>Pricing</span>
              </Link>
              <Link href="/contact">
                <span className={`text-sm font-medium transition-colors ${isHomePage ? "text-white hover:text-gray-200" : "hover:text-primary"}`}>Contact</span>
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
            {user.isAdmin && (
              <Link href="/admin">
                <span className="text-sm font-medium hover:text-primary">Admin Dashboard</span>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={isHomePage ? "bg-transparent border-white text-white hover:bg-white hover:text-gray-800 transition-colors" : ""}
                >
                  <User className="h-4 w-4 mr-2" />
                  My Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <div className="flex items-center">
                      <Zap className="h-4 w-4 mr-2" />
                      Create New CIM
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/documents">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      My CIMs
                    </div>
                  </Link>
                </DropdownMenuItem>
                {(user.subscriptionStatus === 'premium' || user.subscriptionStatus === 'standard' || user.isAdmin) && (
                  <DropdownMenuItem asChild>
                    <Link href="/investor-database">
                      <div className="flex items-center">
                        <Database className="h-4 w-4 mr-2" />
                        Investor Database
                      </div>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <div className="flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      My Account
                    </div>
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