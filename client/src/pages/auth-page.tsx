import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  if (user) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to CIM Generator</CardTitle>
            <CardDescription>
              Login or create an account to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <LoginForm onSubmit={(data) => loginMutation.mutate(data)} />
              </TabsContent>

              <TabsContent value="register">
                <RegisterForm onSubmit={(data) => registerMutation.mutate(data)} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="hidden md:block bg-[url('https://images.unsplash.com/photo-1606836591695-4d58a73eba1e')] bg-cover bg-center">
        <div className="h-full w-full bg-black/50 p-12 flex items-center">
          <div className="text-white max-w-lg">
            <h2 className="text-3xl font-bold mb-4">
              Generate Professional CIM Documents
            </h2>
            <p className="text-lg opacity-90">
              Transform your meeting transcripts into structured Confidential Information Memorandums using AI-powered analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onSubmit }) {
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Input
          placeholder="Username"
          {...form.register("username")}
        />
      </div>
      <div>
        <Input
          type="password"
          placeholder="Password"
          {...form.register("password")}
        />
      </div>
      <Button type="submit" className="w-full">
        Login
      </Button>
    </form>
  );
}

function RegisterForm({ onSubmit }) {
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Input
          placeholder="Choose a username"
          {...form.register("username")}
        />
      </div>
      <div>
        <Input
          type="password"
          placeholder="Choose a password"
          {...form.register("password")}
        />
      </div>
      <div>
        <Input
          type="password"
          placeholder="Admin Code (optional)"
          {...form.register("adminCode")}
        />
      </div>
      <Button type="submit" className="w-full">
        Create Account
      </Button>
    </form>
  );
}