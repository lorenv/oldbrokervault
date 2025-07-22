import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      console.log('Submitting contact form with data:', formData);
      console.log('Share slug:', shareSlug);
      
      const response = await fetch(`/api/share/${shareSlug}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response data:', errorData);
        throw new Error(errorData.error || 'Failed to send message');
      }

      const successData = await response.json();
      console.log('Success response data:', successData);

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
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error
      });
      
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
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <MessageSquare className="h-5 w-5" />
            Message Sent
          </CardTitle>
          <CardDescription className="text-green-700">
            Your question has been sent to the broker. They will respond to you directly at {formData.viewerEmail}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            onClick={() => setIsSubmitted(false)}
            className="border-green-300 text-green-800 hover:bg-green-100"
          >
            Send Another Question
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          Ask the Broker Your Questions
        </CardTitle>
        <CardDescription>
          Get detailed information about this opportunity directly from the broker
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="viewerName">Your Name *</Label>
              <Input
                id="viewerName"
                value={formData.viewerName}
                onChange={(e) => handleInputChange('viewerName', e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="viewerEmail">Your Email *</Label>
              <Input
                id="viewerEmail"
                type="email"
                value={formData.viewerEmail}
                onChange={(e) => handleInputChange('viewerEmail', e.target.value)}
                placeholder="Enter your email address"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="viewerPhone">Your Phone Number (Optional)</Label>
            <Input
              id="viewerPhone"
              type="tel"
              value={formData.viewerPhone}
              onChange={(e) => handleInputChange('viewerPhone', e.target.value)}
              placeholder="Enter your phone number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="question">Your Question *</Label>
            <Textarea
              id="question"
              value={formData.question}
              onChange={(e) => handleInputChange('question', e.target.value)}
              placeholder="Ask about financials, operations, growth opportunities, or any other details about this business..."
              rows={4}
              required
            />
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending Message...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Question to Broker
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}