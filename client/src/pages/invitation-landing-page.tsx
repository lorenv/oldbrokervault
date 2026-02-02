import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Users, Mail, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface InvitationDetails {
  documentTitle: string;
  inviterName: string;
  inviterEmail: string;
  permission: "Edit" | "Assist";
  invitedEmail: string;
  status: string;
  alreadyAccepted: boolean;
}

export function InvitationLandingPage() {
  const [, params] = useRoute("/invitation/:token");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!params?.token) {
        setError("Invalid invitation link");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/collaborator/invitation/${params.token}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load invitation");
        }

        setInvitation(data);
        setLoading(false);

        // If user is already logged in, redirect to accept page
        if (user) {
          setLocation(`/accept-collaboration/${params.token}`);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to load invitation");
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [params?.token, user, setLocation]);

  const handleSignUp = () => {
    if (params?.token) {
      setLocation(`/login?tab=register&redirect=/accept-collaboration/${params.token}`);
    }
  };

  const handleLogin = () => {
    if (params?.token) {
      setLocation(`/login?redirect=/accept-collaboration/${params.token}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center space-y-4 py-12">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 mx-auto mb-4">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
            <CardDescription>{error || "This invitation link is not valid"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.alreadyAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Already Accepted</CardTitle>
            <CardDescription>This invitation has already been accepted</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 mx-auto">
            <Users className="h-12 w-12 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-3xl mb-2">You're Invited!</CardTitle>
            <CardDescription className="text-base">
              You've been invited to collaborate on a CIM document
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 space-y-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Document</p>
                <p className="text-lg font-semibold text-gray-900">{invitation.documentTitle}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Invited by</p>
                <p className="text-base font-semibold text-gray-900">{invitation.inviterName}</p>
                <p className="text-sm text-gray-600">{invitation.inviterEmail}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Invitation sent to</p>
                <p className="text-base font-semibold text-gray-900">{invitation.invitedEmail}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Permission level:</span>{" "}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {invitation.permission}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {invitation.permission === "Edit"
                  ? "You'll be able to edit and manage this document"
                  : "You'll be able to view and assist with this document"}
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Create an account or sign in to start collaborating
              </p>
            </div>
            <Button onClick={handleSignUp} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 text-lg shadow-lg hover:shadow-xl transition-all">
              Sign Up to Accept Invitation
            </Button>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Already have an account?</p>
              <Button onClick={handleLogin} variant="outline" className="w-full border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all">
                Sign In
              </Button>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-gray-600">
              <strong className="text-gray-900">What is Broker Vault?</strong>
              <br />
              Broker Vault is a platform for creating, sharing, and collaborating on Confidential Information Memorandums (CIMs) and business documents.
              Your collaborator has invited you to work together on their document.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
