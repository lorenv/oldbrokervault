import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const supportFormSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type SupportFormData = z.infer<typeof supportFormSchema>;

export function SupportForm() {
  const { toast } = useToast();
  const form = useForm<SupportFormData>({
    resolver: zodResolver(supportFormSchema),
  });

  const supportMutation = useMutation({
    mutationFn: async (data: SupportFormData) => {
      const res = await apiRequest("POST", "/api/support", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "We'll get back to you as soon as possible.",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((data) => supportMutation.mutate(data))}
      className="space-y-4"
    >
      <div>
        <Input
          placeholder="Subject"
          {...form.register("subject")}
        />
        {form.formState.errors.subject && (
          <p className="text-sm text-destructive mt-1">
            {form.formState.errors.subject.message}
          </p>
        )}
      </div>
      <div>
        <Textarea
          placeholder="How can we help?"
          className="min-h-[200px]"
          {...form.register("message")}
        />
        {form.formState.errors.message && (
          <p className="text-sm text-destructive mt-1">
            {form.formState.errors.message.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={supportMutation.isPending}
        className="w-full"
      >
        {supportMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        Send Message
      </Button>
    </form>
  );
}
