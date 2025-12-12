import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Mail, Phone, User, Building2, CheckCircle, Send } from "lucide-react";

interface ShareContactBottomProps {
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

export function ShareContactBottom({ shareSlug, cimTitle, userProfile, logoUrl, themeColors }: ShareContactBottomProps) {
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

  const primaryColor = themeColors?.primary || '#2563eb';
  const gradientFrom = themeColors?.gradient?.from || '#475569';
  const gradientTo = themeColors?.gradient?.to || '#2563eb';

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm rounded-2xl ring-1 ring-gray-200/50 overflow-hidden animate-slide-up">
      <CardHeader
        className="pb-6 pt-8 px-8 text-white"
        style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }}
      >
        <CardTitle className="flex items-center gap-3 text-2xl font-bold text-white">
          <div className="p-2 bg-white/20 rounded-lg">
            <MessageSquare className="h-6 w-6 text-white" />
          </div>
          Get In Touch
        </CardTitle>
      </CardHeader>

      <CardContent className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Information */}
          {userProfile && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="h-5 w-5" style={{ color: primaryColor }} />
                Contact Information
              </h3>

              <div className="flex items-start gap-4">
                {userProfile.profilePhoto && (
                  <img
                    src={userProfile.profilePhoto}
                    alt="Profile"
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  />
                )}
                <div className="space-y-1 min-w-0">
                  {userProfile.name && (
                    <h4 className="text-lg font-bold text-slate-900">{userProfile.name}</h4>
                  )}
                  {userProfile.title && (
                    <p className="text-sm font-medium" style={{ color: primaryColor }}>{userProfile.title}</p>
                  )}
                  {userProfile.businessName && (
                    <p className="text-sm text-slate-600 flex items-center gap-1">
                      <Building2 className="h-3 w-3 flex-shrink-0" />
                      {userProfile.businessName}
                    </p>
                  )}
                </div>
              </div>

              {userProfile.businessLogo && (
                <div className="pt-2">
                  <img
                    src={userProfile.businessLogo}
                    alt="Business Logo"
                    className="max-w-40 max-h-16 object-contain"
                  />
                </div>
              )}

              <div className="space-y-3 pt-2">
                {userProfile.email && (
                  <a
                    href={`mailto:${userProfile.email}`}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <div className="p-2 rounded-lg" style={{ backgroundColor: primaryColor }}>
                      <Mail className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium" style={{ color: primaryColor }}>{userProfile.email}</span>
                  </a>
                )}
                {(userProfile.phoneNumber || userProfile.phone) && (
                  <a
                    href={`tel:${userProfile.phoneNumber || userProfile.phone}`}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <div className="p-2 rounded-lg" style={{ backgroundColor: primaryColor }}>
                      <Phone className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium" style={{ color: primaryColor }}>{userProfile.phoneNumber || userProfile.phone}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Contact Form */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Send className="h-5 w-5" style={{ color: primaryColor }} />
              Send a Message
            </h3>

            {isSubmitted ? (
              <div className="text-center py-8 bg-green-50 rounded-xl">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h4 className="text-lg font-semibold text-green-700 mb-2">Message Sent!</h4>
                <p className="text-sm text-slate-600 mb-4">The broker will contact you directly.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSubmitted(false)}
                >
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    value={formData.viewerName}
                    onChange={(e) => handleInputChange('viewerName', e.target.value)}
                    placeholder="Your name *"
                    required
                  />
                  <Input
                    type="email"
                    value={formData.viewerEmail}
                    onChange={(e) => handleInputChange('viewerEmail', e.target.value)}
                    placeholder="Your email *"
                    required
                  />
                </div>
                <Input
                  type="tel"
                  value={formData.viewerPhone}
                  onChange={(e) => handleInputChange('viewerPhone', e.target.value)}
                  placeholder="Your phone (optional)"
                />
                <Textarea
                  value={formData.question}
                  onChange={(e) => handleInputChange('question', e.target.value)}
                  placeholder="Your question or message *"
                  rows={4}
                  required
                />
                <Button
                  type="submit"
                  className="w-full text-white"
                  style={{ backgroundColor: primaryColor }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
