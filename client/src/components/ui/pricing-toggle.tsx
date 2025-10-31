import { Check } from "lucide-react";

interface PricingToggleProps {
  billingPeriod: "monthly" | "annual";
  onToggle: (period: "monthly" | "annual") => void;
}

export function PricingToggle({ billingPeriod, onToggle }: PricingToggleProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 mb-8">
      <div className="flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium transition-colors ${
            billingPeriod === "monthly" ? "text-gray-900" : "text-gray-500"
          }`}
        >
          Monthly
        </span>
        <button
          onClick={() => onToggle(billingPeriod === "monthly" ? "annual" : "monthly")}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            billingPeriod === "annual" ? "bg-blue-600" : "bg-gray-200"
          }`}
          role="switch"
          aria-checked={billingPeriod === "annual"}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
              billingPeriod === "annual" ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium transition-colors ${
            billingPeriod === "annual" ? "text-gray-900" : "text-gray-500"
          }`}
        >
          Annual
        </span>
      </div>
      {billingPeriod === "annual" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
          <Check className="h-3 w-3" />
          Save up to 16%
        </span>
      )}
    </div>
  );
}
