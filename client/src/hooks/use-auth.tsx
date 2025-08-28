import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import confetti from "canvas-confetti";

// Function to detect incognito/private browsing mode
async function detectIncognitoMode(): Promise<boolean> {
  try {
    // Test localStorage availability (blocked in incognito in some browsers)
    if (!window.localStorage) {
      return true;
    }

    // Test sessionStorage availability
    if (!window.sessionStorage) {
      return true;
    }

    // Test if we can write to localStorage
    const testKey = '__incognito_test__';
    try {
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
    } catch (e) {
      return true;
    }

    // Chrome/Edge specific test using quota estimation
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        // In incognito mode, quota is typically much smaller (around 10MB vs 100GB+)
        if (estimate.quota && estimate.quota < 50 * 1024 * 1024) { // Less than 50MB
          return true;
        }
      } catch (e) {
        // Storage estimation failed, might be incognito
        return true;
      }
    }

    // Firefox specific test using indexedDB
    if ('indexedDB' in window) {
      try {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('__incognito_test__');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        // @ts-ignore
        db.close();
        return false;
      } catch (e) {
        return true;
      }
    }

    return false;
  } catch (e) {
    // If any test fails, assume incognito mode for safety
    return true;
  }
}

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "email" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // Check if user is in incognito/private mode
      try {
        const isIncognito = await detectIncognitoMode();
        if (isIncognito) {
          throw new Error("Please disable incognito/private browsing mode to log in. Incognito mode blocks the secure cookies needed for authentication.");
        }
      } catch (e) {
        // If incognito detection fails, proceed with login attempt
        console.warn("Could not detect incognito mode:", e);
      }

      try {
        const res = await apiRequest("POST", "/api/login", credentials);
        
        // Log response details before parsing
        const contentType = res.headers.get('content-type') || '';
        console.log("Login response details:", {
          status: res.status,
          statusText: res.statusText,
          contentType: contentType,
          url: res.url
        });
        
        if (!contentType.includes('application/json')) {
          // If we're not getting JSON, let's see what we got
          const text = await res.text();
          console.error("Expected JSON but got:", contentType, "Content:", text.substring(0, 500));
          throw new Error(`Server returned ${contentType} instead of JSON. This suggests a routing or server configuration issue.`);
        }
        
        const userData = await res.json();
        console.log("Login successful, received user data:", userData);
        return userData;
      } catch (error: any) {
        console.error("Login error:", error);
        
        // Parse the error message from the API response
        const errorMessage = error.message || "Invalid email or password";
        
        // Check for specific authentication errors that might indicate incognito mode
        if (errorMessage.includes("session")) {
          throw new Error("Authentication failed. Please ensure you're not using incognito/private browsing mode and try again.");
        }
        
        // Extract status code and message
        const statusMatch = errorMessage.match(/^(\d+): (.+)/);
        if (statusMatch) {
          const [, status, message] = statusMatch;
          if (status === "401") {
            throw new Error("Invalid email or password. Please check your credentials and try again.");
          }
          if (status === "400") {
            throw new Error(message || "Please check your input and try again.");
          }
          throw new Error(message || "Login failed. Please try again.");
        }
        
        throw new Error(errorMessage);
      }
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      // Redirect to dashboard after successful login
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser | FormData) => {
      // Check if user is in incognito/private mode
      try {
        const isIncognito = await detectIncognitoMode();
        if (isIncognito) {
          throw new Error("Please disable incognito/private browsing mode to register. Incognito mode blocks the secure cookies needed for authentication.");
        }
      } catch (e) {
        console.warn("Could not detect incognito mode during registration:", e);
      }

      try {
        const res = await apiRequest("POST", "/api/register", credentials);
        const responseData = await res.json();
        
        // Check if email verification is needed
        if (responseData.needsVerification) {
          throw new Error("VERIFICATION_NEEDED: " + responseData.message);
        }
        
        return responseData;
      } catch (error: any) {
        // Parse the error message from the API response
        const errorMessage = error.message || "Registration failed";
        
        // Check for verification needed case
        if (errorMessage.startsWith("VERIFICATION_NEEDED:")) {
          throw new Error(errorMessage.replace("VERIFICATION_NEEDED: ", ""));
        }
        
        // Extract the actual error message from the API response
        if (errorMessage.includes(": ")) {
          const jsonPart = errorMessage.split(": ").slice(1).join(": ");
          try {
            const errorData = JSON.parse(jsonPart);
            if (errorData.message) {
              throw new Error(errorData.message);
            }
            if (errorData.error === "Validation failed" && errorData.details) {
              const validationErrors = errorData.details.map((detail: any) => detail.msg).join(", ");
              throw new Error(`Please check your input: ${validationErrors}`);
            }
          } catch (parseError) {
            // If we can't parse the JSON, use the original error message
          }
        }
        
        throw new Error(errorMessage);
      }
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      
      // Play success sound
      const audio = new Audio('/success-sound.mp3');
      audio.volume = 0.4;
      audio.play().catch(e => console.log('Could not play success sound:', e));
      
      // Trigger celebratory confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      // Additional confetti bursts
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
      }, 200);
      
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 400);
      

      
      // Mark user as new for get started checklist
      localStorage.setItem('show-get-started-checklist', 'true');
      
      // Redirect to dashboard after successful registration
      setTimeout(() => setLocation("/dashboard"), 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      // Redirect to home page after successful logout
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}