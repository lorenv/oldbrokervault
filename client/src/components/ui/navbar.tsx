import { Link } from "wouter";
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
import { Settings, FileText, LogOut, User, HelpCircle } from "lucide-react";
import { useState } from "react";
import { SupportDialog } from "./support-dialog";

export function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <a className="font-semibold text-lg">CIM God</a>
          </Link>
          {!user && (
            <div className="hidden md:flex items-center space-x-6 ml-8">
              <Link href="/pricing">
                <a className="text-sm font-medium hover:text-primary transition-colors">Pricing</a>
              </Link>
              <Link href="/contact">
                <a className="text-sm font-medium hover:text-primary transition-colors">Contact</a>
              </Link>
            </div>
          )}
        </div>

        {!user && (
          <div className="flex items-center space-x-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Sign Up</Button>
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
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  My Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Account Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href="/account">
                    <a className="flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      Account & Profile
                    </a>
                  </Link>
                </DropdownMenuItem>
                {user.subscriptionStatus !== "free" && (
                  <DropdownMenuItem>
                    <Link href="https://billing.stripe.com/p/login/test">
                      <a className="flex items-center">
                        <Settings className="h-4 w-4 mr-2" />
                        Manage Subscription
                      </a>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Link href="/documents">
                    <a className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      My CIMs
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