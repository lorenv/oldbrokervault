import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Formats a numeric string with commas (e.g., "1500000" -> "1,500,000")
 */
function formatWithCommas(numStr: string): string {
  if (!numStr) return "";
  const parts = numStr.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/**
 * Strips everything except digits and a single decimal point from a string.
 */
function stripToNumeric(value: string): string {
  // Remove everything except digits and dots
  let cleaned = value.replace(/[^\d.]/g, "");
  // Allow only one decimal point
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1) {
    cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, "");
  }
  return cleaned;
}

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  /** The current value (can be formatted like "$1,500,000" or raw like "1500000") */
  value: string | number | undefined | null;
  /** Called with the formatted display string (e.g., "$1,500,000") */
  onChange?: (formattedValue: string) => void;
  /** Called with the raw numeric value (e.g., 1500000) — useful for fields that store numbers */
  onValueChange?: (numericValue: number | null) => void;
  /** Whether to show the $ prefix. Defaults to true. */
  showPrefix?: boolean;
  /** Whether to allow decimal values. Defaults to false. */
  allowDecimals?: boolean;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, onValueChange, showPrefix = true, allowDecimals = false, placeholder, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const combinedRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref]
    );

    // Convert incoming value to display format
    const toDisplay = React.useCallback((val: string | number | undefined | null): string => {
      if (val === undefined || val === null || val === "") return "";
      const str = String(val);
      const numeric = stripToNumeric(str);
      if (!numeric) return "";
      if (!allowDecimals) {
        const intPart = numeric.split(".")[0];
        return (showPrefix ? "$" : "") + formatWithCommas(intPart);
      }
      return (showPrefix ? "$" : "") + formatWithCommas(numeric);
    }, [showPrefix, allowDecimals]);

    const [displayValue, setDisplayValue] = React.useState(() => toDisplay(value));

    // Sync display when external value changes
    React.useEffect(() => {
      const newDisplay = toDisplay(value);
      setDisplayValue(newDisplay);
    }, [value, toDisplay]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawInput = e.target.value;
      const cursorPos = e.target.selectionStart ?? 0;

      // Count digits before cursor in the old value
      const oldVal = displayValue;
      const digitsBeforeCursor = rawInput.slice(0, cursorPos).replace(/[^\d.]/g, "").length;

      // Strip to numeric and format
      let numeric = stripToNumeric(rawInput);
      if (!allowDecimals) {
        numeric = numeric.split(".")[0];
      }

      const formatted = numeric ? (showPrefix ? "$" : "") + formatWithCommas(numeric) : "";

      setDisplayValue(formatted);

      // Notify consumers
      if (onChange) {
        onChange(formatted);
      }
      if (onValueChange) {
        const num = parseFloat(numeric);
        onValueChange(numeric ? (isNaN(num) ? null : num) : null);
      }

      // Restore cursor position based on digit count
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;

        let digitsSeen = 0;
        let newPos = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (/[\d.]/.test(formatted[i])) {
            digitsSeen++;
          }
          if (digitsSeen >= digitsBeforeCursor) {
            newPos = i + 1;
            break;
          }
        }
        if (digitsSeen < digitsBeforeCursor) {
          newPos = formatted.length;
        }
        el.setSelectionRange(newPos, newPos);
      });
    };

    return (
      <input
        ref={combinedRef}
        type="text"
        inputMode="numeric"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-900 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder ?? (showPrefix ? "$0" : "0")}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput, formatWithCommas, stripToNumeric };
