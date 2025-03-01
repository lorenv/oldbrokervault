import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { user, logoutMutation } = useAuth();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <a className="font-semibold text-lg">CIM Generator</a>
          </Link>
          {user && (
            <Link href="/saved-cims">
              <a className="text-sm font-medium hover:text-primary">My Saved CIMs</a>
            </Link>
          )}
        </div>

        {user && (
          <div className="flex items-center space-x-4">
            {user.isAdmin && (
              <Link href="/admin">
                <a className="text-sm font-medium hover:text-primary">Admin Dashboard</a>
              </Link>
            )}
            <Button 
              variant="outline" 
              onClick={() => logoutMutation.mutate()}
            >
              Logout
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}