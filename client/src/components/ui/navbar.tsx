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
          <Link href="/" className="font-semibold text-lg hover:text-primary">
            CIM Generator
          </Link>
        </div>

        {user && (
          <div className="flex items-center space-x-4">
            {user.isAdmin && (
              <Link href="/admin" className="text-sm font-medium hover:text-primary">
                Admin Dashboard
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
                <Link href="/account">
                  <DropdownMenuItem>
                    <div className="flex items-center w-full">
                      <User className="h-4 w-4 mr-2" />
                      My Account
                    </div>
                  </DropdownMenuItem>
                </Link>
                {user.subscriptionStatus !== "free" && (
                  <DropdownMenuItem>
                    <a 
                      href="https://billing.stripe.com/p/login/test" 
                      className="flex items-center w-full" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Subscription
                    </a>
                  </DropdownMenuItem>
                )}
                <Link href="/documents">
                  <DropdownMenuItem>
                    <div className="flex items-center w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      My CIMs
                    </div>
                  </DropdownMenuItem>
                </Link>
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