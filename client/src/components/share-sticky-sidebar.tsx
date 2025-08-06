import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableRichTextEditor } from "@/components/resizable-rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Mail, Phone, User, Building2, CheckCircle } from "lucide-react";

interface ShareStickySidebarProps {
  shareSlug: string;
  cimTitle: string;
  userProfile?: any;
  logoUrl?: string;
}

export function ShareStickySidebar({ shareSlug, cimTitle, userProfile, logoUrl }: ShareStickySidebarProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    viewerName: '',
    viewerEmail: '',
    viewerPhone: '',
    question: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.viewerName.trim() || !formData.viewerEmail.trim() || !formData.question.trim()) {
      toast({
        title: "Required fields missing",
        description: "Please fill in your name, email, and question.",
        variant: "destructive"
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.viewerEmail)) {
      toast({
        title: "Invalid email format",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/share/${shareSlug}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      setIsSubmitted(true);
      toast({
        title: "Message sent successfully",
        description: "Your question has been forwarded to the broker. They will contact you directly.",
      });

      // Reset form
      setFormData({
        viewerName: '',
        viewerEmail: '',
        viewerPhone: '',
        question: ''
      });

    } catch (error) {
      console.error('Error sending broker contact:', error);
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sticky top-8">
      {/* Combined Contact Information and Form Card */}
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden ring-1 ring-gray-200/50">
        {/* Contact Information Section */}
        {userProfile && (
          <>
            <CardHeader className="pb-4 pt-6 px-6 bg-blue-50/30">
              <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-700">
                <div className="p-1.5 bg-blue-100/80 rounded-lg">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-6">
                {/* Profile Photo */}
                {userProfile.profilePhoto && (
                  <div className="flex justify-center">
                    <img
                      src={userProfile.profilePhoto}
                      alt="Profile"
                      className="w-28 h-28 rounded-xl object-cover"
                    />
                  </div>
                )}

                {/* Name and Title */}
                <div className="text-center space-y-2">
                  {userProfile.name && (
                    <h3 className="text-lg font-bold text-slate-900 break-words">
                      {userProfile.name}
                    </h3>
                  )}
                  {userProfile.title && (
                    <p className="text-sm text-blue-600 font-medium break-words">{userProfile.title}</p>
                  )}
                  {userProfile.businessName && (
                    <p className="text-sm text-slate-600 font-medium flex items-center justify-center gap-1 break-words">
                      <Building2 className="h-3 w-3 flex-shrink-0" />
                      <span className="break-words">{userProfile.businessName}</span>
                    </p>
                  )}

                  {/* User's Business Logo - only show user's actual business logo */}
                  {userProfile.businessLogo && (
                    <div className="flex justify-center pt-2">
                      <img
                        src={userProfile.businessLogo}
                        alt="Business Logo"
                        className="max-w-32 max-h-16 object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Contact Details */}
                <div className="space-y-3">
                  {userProfile.email && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-150 transition-all duration-200 transform hover:scale-[1.02] shadow-sm">
                      <div className="p-1.5 bg-blue-500 rounded-lg shadow-sm">
                        <Mail className="h-4 w-4 text-white flex-shrink-0" />
                      </div>
                      <a
                        href={`mailto:${userProfile.email}`}
                        className="text-blue-700 text-sm font-semibold hover:text-blue-800 transition-colors truncate"
                      >
                        {userProfile.email}
                      </a>
                    </div>
                  )}
                  {(userProfile.phoneNumber || userProfile.phone) && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl hover:from-emerald-100 hover:to-emerald-150 transition-all duration-200 transform hover:scale-[1.02] shadow-sm">
                      <div className="p-1.5 bg-emerald-500 rounded-lg shadow-sm">
                        <Phone className="h-4 w-4 text-white flex-shrink-0" />
                      </div>
                      <a
                        href={`tel:${userProfile.phoneNumber || userProfile.phone}`}
                        className="text-emerald-700 text-sm font-semibold hover:text-emerald-800 transition-colors"
                      >
                        {userProfile.phoneNumber}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Ask Questions Section */}
        <div className="border-t border-gray-200/50">
          <CardHeader className="pb-4 pt-6 px-6 border-t border-gray-200/50 bg-purple-50/30">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-700">
              <div className="p-1.5 bg-purple-100/80 rounded-lg">
                <MessageSquare className="h-4 w-4 text-purple-600" />
              </div>
              Ask Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {isSubmitted ? (
              <div className="text-center py-6">
                <div className="flex justify-center mb-3">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-green-700 mb-2">Message Sent!</h3>
                <p className="text-sm text-slate-600">The broker will contact you directly.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsSubmitted(false)}
                >
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Input
                      id="viewerName"
                      value={formData.viewerName}
                      onChange={(e) => handleInputChange('viewerName', e.target.value)}
                      placeholder="Enter your full name"
                      className="text-sm"
                      required
                    />
                  </div>

                  <div>
                    <Input
                      id="viewerEmail"
                      type="email"
                      value={formData.viewerEmail}
                      onChange={(e) => handleInputChange('viewerEmail', e.target.value)}
                      placeholder="Enter your email"
                      className="text-sm"
                      required
                    />
                  </div>

                  <div>
                    <Input
                      id="viewerPhone"
                      type="tel"
                      value={formData.viewerPhone}
                      onChange={(e) => handleInputChange('viewerPhone', e.target.value)}
                      placeholder="Your phone number (optional)"
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="question" className="text-sm font-medium">What would you like to know about this opportunity? *</Label>
                    <ResizableRichTextEditor
                      value={formData.question}
                      onChange={(value) => handleInputChange('question', value)}
                      placeholder="Ask about financials, operations, growth opportunities, or any other details..."
                      className="text-sm"
                      minHeight={120}
                      maxHeight={250}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 mr-2 border-2 border-white border-t-transparent"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </div>
      </Card>
    </div>
  );
}