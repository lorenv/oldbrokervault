import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="sticky top-8 space-y-6">
      {/* Contact Information Card */}
      {userProfile && (
        <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/50 pb-4 pt-6 px-6">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Profile Photo */}
              {userProfile.profilePhoto && (
                <div className="flex justify-center">
                  <img 
                    src={userProfile.profilePhoto} 
                    alt="Profile" 
                    className="w-20 h-20 rounded-xl object-cover border-2 border-gray-100"
                  />
                </div>
              )}
              
              {/* Name and Title */}
              <div className="text-center space-y-1">
                {userProfile.name && (
                  <h3 className="text-lg font-bold text-slate-900">
                    {userProfile.name}
                  </h3>
                )}
                {userProfile.title && (
                  <p className="text-sm text-blue-600 font-medium">{userProfile.title}</p>
                )}
                {userProfile.businessName && (
                  <p className="text-sm text-slate-600 font-medium flex items-center justify-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {userProfile.businessName}
                  </p>
                )}
              </div>
              
              {/* Contact Details */}
              <div className="space-y-2">
                {userProfile.email && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <a 
                      href={`mailto:${userProfile.email}`} 
                      className="text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors truncate"
                    >
                      {userProfile.email}
                    </a>
                  </div>
                )}
                {userProfile.phoneNumber && (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <Phone className="h-4 w-4 text-slate-600 flex-shrink-0" />
                    <a 
                      href={`tel:${userProfile.phoneNumber}`} 
                      className="text-slate-600 text-sm font-medium hover:text-slate-700 transition-colors"
                    >
                      {userProfile.phoneNumber}
                    </a>
                  </div>
                )}
              </div>
              
              {/* Company Logo */}
              {logoUrl && (
                <div className="flex justify-center pt-2">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <img 
                      src={logoUrl} 
                      alt="Company Logo" 
                      className="max-w-24 max-h-16 object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Form Card */}
      <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50/50 pb-4 pt-6 px-6">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <div className="p-1.5 bg-green-100 rounded-lg">
              <MessageSquare className="h-4 w-4 text-green-600" />
            </div>
            Ask Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
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
                  <Label htmlFor="viewerName" className="text-xs font-medium text-slate-700">Your Name *</Label>
                  <Input
                    id="viewerName"
                    value={formData.viewerName}
                    onChange={(e) => handleInputChange('viewerName', e.target.value)}
                    placeholder="Enter your full name"
                    className="mt-1 text-sm"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="viewerEmail" className="text-xs font-medium text-slate-700">Your Email *</Label>
                  <Input
                    id="viewerEmail"
                    type="email"
                    value={formData.viewerEmail}
                    onChange={(e) => handleInputChange('viewerEmail', e.target.value)}
                    placeholder="Enter your email"
                    className="mt-1 text-sm"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="viewerPhone" className="text-xs font-medium text-slate-700">Phone (Optional)</Label>
                  <Input
                    id="viewerPhone"
                    type="tel"
                    value={formData.viewerPhone}
                    onChange={(e) => handleInputChange('viewerPhone', e.target.value)}
                    placeholder="Your phone number"
                    className="mt-1 text-sm"
                  />
                </div>
                
                <div>
                  <Label htmlFor="question" className="text-xs font-medium text-slate-700">Your Question *</Label>
                  <Textarea
                    id="question"
                    value={formData.question}
                    onChange={(e) => handleInputChange('question', e.target.value)}
                    placeholder="What would you like to know about this opportunity?"
                    className="mt-1 text-sm min-h-20 resize-none"
                    required
                  />
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium text-sm"
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
      </Card>
    </div>
  );
}