import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableRichTextEditor } from "@/components/resizable-rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, User, Mail, Phone, Building2 } from "lucide-react";

interface BrokerContactFormProps {
  shareSlug: string;
  cimTitle: string;
  userProfile?: any;
}

export function BrokerContactForm({ shareSlug, cimTitle, userProfile }: BrokerContactFormProps) {
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

      const successData = await response.json();

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

  if (isSubmitted) {
    return (
      <Card className="border-green-200 bg-green-50 w-full">
        <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
          <CardTitle className="flex items-center gap-2 text-green-800 text-base sm:text-lg">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span>Message Sent</span>
          </CardTitle>
          <CardDescription className="text-green-700 text-sm sm:text-base">
            Your question has been sent to the broker. They will respond to you directly at {formData.viewerEmail}.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <Button 
            variant="outline" 
            onClick={() => setIsSubmitted(false)}
            className="w-full sm:w-auto border-green-300 text-green-800 hover:bg-green-100 text-sm sm:text-base"
          >
            Send Another Question
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
          <span className="truncate">Ask the Broker Your Questions</span>
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Get detailed information about this opportunity directly from the broker
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="viewerName" className="text-sm font-medium">Your Name *</Label>
              <Input
                id="viewerName"
                value={formData.viewerName}
                onChange={(e) => handleInputChange('viewerName', e.target.value)}
                placeholder="Enter your full name"
                className="text-sm sm:text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="viewerEmail" className="text-sm font-medium">Your Email *</Label>
              <Input
                id="viewerEmail"
                type="email"
                value={formData.viewerEmail}
                onChange={(e) => handleInputChange('viewerEmail', e.target.value)}
                placeholder="Enter your email address"
                className="text-sm sm:text-base"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="viewerPhone" className="text-sm font-medium">Your Phone Number (Optional)</Label>
            <Input
              id="viewerPhone"
              type="tel"
              value={formData.viewerPhone}
              onChange={(e) => handleInputChange('viewerPhone', e.target.value)}
              placeholder="Enter your phone number"
              className="text-sm sm:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="question" className="text-sm font-medium">Your Question *</Label>
            <ResizableRichTextEditor
              value={formData.question}
              onChange={(value) => handleInputChange('question', value)}
              placeholder="Ask about financials, operations, growth opportunities, or any other details about this business..."
              className="text-sm sm:text-base"
              minHeight={100}
              maxHeight={300}
            />
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full h-10 sm:h-11 text-sm sm:text-base font-medium bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Sending Message...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>Send Question to Broker</span>
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}