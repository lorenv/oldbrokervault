import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableRichTextEditor } from "@/components/resizable-rich-text-editor";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Mail, Phone, User, Building2, CheckCircle, Expand } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ShareStickySidebarProps {
  shareSlug: string;
  cimTitle: string;
  userProfile?: any;
  logoUrl?: string;
  themeColors?: {
    primary: string;
    primaryLight: string;
    gradient: { from: string; to: string };
  };
}

export function ShareStickySidebar({ shareSlug, cimTitle, userProfile, logoUrl, themeColors }: ShareStickySidebarProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Theme colors with defaults
  const primaryColor = themeColors?.primary || '#2563eb';
  const primaryLight = themeColors?.primaryLight || '#dbeafe';
  const gradientFrom = themeColors?.gradient?.from || '#475569';
  const gradientTo = themeColors?.gradient?.to || '#2563eb';
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
    <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
      {/* Combined Contact Information and Form Card */}
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm rounded-2xl ring-1 ring-gray-200/50">
        {/* Contact Information Section */}
        {userProfile && (
          <>
            <CardHeader className="pb-2 pt-6 px-6" style={{ backgroundColor: `${primaryColor}08` }}>
              <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-700">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${primaryColor}15` }}>
                  <User className="h-4 w-4" style={{ color: primaryColor }} />
                </div>
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-4">
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
                    <h3 className="text-lg font-bold text-slate-900 break-words overflow-wrap-anywhere">
                      {userProfile.name}
                    </h3>
                  )}
                  {userProfile.title && (
                    <p className="text-sm font-medium break-words overflow-wrap-anywhere" style={{ color: primaryColor }}>{userProfile.title}</p>
                  )}
                  {userProfile.businessName && (
                    <p className="text-sm text-slate-600 font-medium flex items-center justify-center gap-1 break-words">
                      <Building2 className="h-3 w-3 flex-shrink-0" />
                      <span className="break-words overflow-wrap-anywhere max-w-full">{userProfile.businessName}</span>
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
                    <div
                      className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-sm"
                      style={{ background: `linear-gradient(to right, ${primaryColor}10, ${primaryColor}18)` }}
                    >
                      <div className="p-1.5 rounded-lg shadow-sm" style={{ backgroundColor: primaryColor }}>
                        <Mail className="h-4 w-4 text-white flex-shrink-0" />
                      </div>
                      <a
                        href={`mailto:${userProfile.email}`}
                        className="text-sm font-semibold transition-colors break-all min-w-0 flex-1"
                        style={{ color: primaryColor }}
                      >
                        {userProfile.email}
                      </a>
                    </div>
                  )}
                  {(userProfile.phoneNumber || userProfile.phone) && (
                    <div
                      className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-sm"
                      style={{ background: `linear-gradient(to right, ${primaryColor}10, ${primaryColor}18)` }}
                    >
                      <div className="p-1.5 rounded-lg shadow-sm" style={{ backgroundColor: primaryColor }}>
                        <Phone className="h-4 w-4 text-white flex-shrink-0" />
                      </div>
                      <a
                        href={`tel:${userProfile.phoneNumber || userProfile.phone}`}
                        className="text-sm font-semibold transition-colors break-all min-w-0 flex-1"
                        style={{ color: primaryColor }}
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
          <CardHeader className="pb-4 pt-6 px-6 border-t border-gray-200/50" style={{ backgroundColor: `${primaryColor}08` }}>
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-700">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${primaryColor}15` }}>
                <MessageSquare className="h-4 w-4" style={{ color: primaryColor }} />
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

                  <div className="relative">
                    <RichTextEditor
                      value={formData.question}
                      onChange={(value) => handleInputChange('question', value)}
                      placeholder="Ask about financials, operations, growth opportunities, or any other details..."
                      className="text-sm min-h-20"
                    />
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-gray-100"
                          title="Expand to fullscreen"
                        >
                          <Expand className="h-4 w-4 text-gray-500" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Write Your Message
                          </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 mt-4">
                          <RichTextEditor
                            value={formData.question}
                            onChange={(value) => handleInputChange('question', value)}
                            placeholder="Ask about financials, operations, growth opportunities, or any other details..."
                            className="h-full"
                            autoFocus
                          />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                          >
                            Done
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }}
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