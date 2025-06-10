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

      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const error = await res.json();
        // Check for specific authentication errors that might indicate incognito mode
        if (res.status === 500 && error.message?.includes("session")) {
          throw new Error("Authentication failed. Please ensure you're not using incognito/private browsing mode and try again.");
        }
        throw new Error(error.message || "Invalid email or password");
      }
      return await res.json();
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
    mutationFn: async (credentials: InsertUser) => {
      // Check if user is in incognito/private mode
      try {
        const isIncognito = await detectIncognitoMode();
        if (isIncognito) {
          throw new Error("Please disable incognito/private browsing mode to register. Incognito mode blocks the secure cookies needed for authentication.");
        }
      } catch (e) {
        console.warn("Could not detect incognito mode during registration:", e);
      }

      const res = await apiRequest("POST", "/api/register", credentials);
      if (!res.ok) {
        const error = await res.json();
        // Check for specific authentication errors that might indicate incognito mode
        if (res.status === 500 && error.message?.includes("session")) {
          throw new Error("Registration failed. Please ensure you're not using incognito/private browsing mode and try again.");
        }
        throw new Error(error.message || "Registration failed");
      }
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Welcome!",
        description: "Your account has been created successfully.",
      });
      // Redirect to dashboard after successful registration
      setLocation("/dashboard");
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