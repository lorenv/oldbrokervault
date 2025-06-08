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
            <a className="flex items-center space-x-2">
              <img 
                src="/cim-share-logo.png" 
                alt="CIM Share" 
                className={`h-12 ${isHomePage ? "brightness-0 invert" : ""}`}
              />
            </a>
          </Link>
          {!user && (
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/pricing">
                <a className={`text-sm font-medium transition-colors ${isHomePage ? "text-white hover:text-gray-200" : "hover:text-primary"}`}>Pricing</a>
              </Link>
              <Link href="/contact">
                <a className={`text-sm font-medium transition-colors ${isHomePage ? "text-white hover:text-gray-200" : "hover:text-primary"}`}>Contact</a>
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
                <a className="text-sm font-medium hover:text-primary">Admin Dashboard</a>
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
                <DropdownMenuItem>
                  <Link href="/dashboard">
                    <a className="flex items-center">
                      <Zap className="h-4 w-4 mr-2" />
                      Create New CIM
                    </a>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/documents">
                    <a className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      My CIMs
                    </a>
                  </Link>
                </DropdownMenuItem>
                {(user.subscriptionStatus === 'premium' || user.subscriptionStatus === 'standard' || user.isAdmin) && (
                  <DropdownMenuItem>
                    <Link href="/investor-database">
                      <a className="flex items-center">
                        <Database className="h-4 w-4 mr-2" />
                        Investor Database
                      </a>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Link href="/account">
                    <a className="flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      My Account
                    </a>
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