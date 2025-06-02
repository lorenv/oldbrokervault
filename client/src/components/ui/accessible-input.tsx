import { forwardRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  description?: string;
  isLoading?: boolean;
  showValidation?: boolean;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ 
    label, 
    error, 
    description, 
    isLoading, 
    showValidation = true,
    className,
    id,
    ...props 
  }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    
    const hasValue = props.value && String(props.value).length > 0;
    const status = error ? 'error' : hasValue ? 'success' : 'default';
    
    return (
      <div className="space-y-2">
        <Label 
          htmlFor={inputId}
          className={cn(
            "text-sm font-medium transition-colors",
            error && "text-destructive",
            isFocused && "text-primary"
          )}
        >
          {label}
          {props.required && (
            <span className="text-destructive ml-1" aria-label="required">
              *
            </span>
          )}
        </Label>
        
        {description && (
          <p 
            id={descriptionId}
            className="text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}
        
        <div className="relative">
          <Input
            {...props}
            ref={ref}
            id={inputId}
            className={cn(
              "transition-all duration-200",
              error && "border-destructive focus:border-destructive",
              hasValue && !error && "border-green-500",
              "pr-10", // Space for icon
              className
            )}
            aria-describedby={cn(
              descriptionId,
              errorId
            )}
            aria-invalid={!!error}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
          />
          
          {/* Status Icon */}
          {showValidation && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : error ? (
                <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
              ) : hasValue ? (
                <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
              ) : null}
            </div>
          )}
        </div>
        
        {error && (
          <p 
            id={errorId}
            className="text-sm text-destructive flex items-center gap-1"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  }
);

AccessibleInput.displayName = "AccessibleInput";