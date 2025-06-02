import { z } from "zod";

// Enhanced validation schemas with better error messages
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(100, "Email must be less than 100 characters");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

export const urlSchema = z
  .string()
  .url("Please enter a valid URL")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    "URL must use http or https protocol"
  );

export const transcriptSchema = z
  .string()
  .min(50, "Transcript must be at least 50 characters")
  .max(50000, "Transcript must be less than 50,000 characters");

export const titleSchema = z
  .string()
  .min(1, "Title is required")
  .max(200, "Title must be less than 200 characters")
  .regex(/^[a-zA-Z0-9\s\-_.,!?()]+$/, "Title contains invalid characters");

// Real-time validation helpers
export function validateField<T>(
  schema: z.ZodSchema<T>,
  value: any
): { isValid: boolean; error?: string } {
  const result = schema.safeParse(value);
  return {
    isValid: result.success,
    error: result.success ? undefined : result.error.errors[0]?.message,
  };
}

export function getFieldStatus(
  value: any,
  error?: string,
  touched?: boolean
): "default" | "error" | "success" {
  if (!touched) return "default";
  if (error) return "error";
  if (value) return "success";
  return "default";
}

// Debounced validation hook
import { useState, useEffect, useCallback } from "react";

export function useDebouncedValidation<T>(
  value: T,
  schema: z.ZodSchema<T>,
  delay: number = 500
) {
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    error?: string;
    isValidating: boolean;
  }>({
    isValid: true,
    isValidating: false,
  });

  const debouncedValidate = useCallback(
    debounce((val: T) => {
      const result = validateField(schema, val);
      setValidationState({
        ...result,
        isValidating: false,
      });
    }, delay),
    [schema, delay]
  );

  useEffect(() => {
    if (value) {
      setValidationState((prev) => ({ ...prev, isValidating: true }));
      debouncedValidate(value);
    } else {
      setValidationState({ isValid: true, isValidating: false });
    }
  }, [value, debouncedValidate]);

  return validationState;
}

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  }) as T;
}