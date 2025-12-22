import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { useBrandColor } from "@/hooks/use-brand-color";
import { cn } from "@/lib/utils";

interface BrandedButtonProps extends ButtonProps {
  // If true, uses brand color as primary background
  // If false/undefined, uses default button styling
  branded?: boolean;
}

const BrandedButton = React.forwardRef<HTMLButtonElement, BrandedButtonProps>(
  ({ branded = true, className, style, children, ...props }, ref) => {
    const { brandColor, needsDarkText } = useBrandColor();

    // Only apply brand styling if branded is true and we have a brand color
    const shouldBrand = branded && brandColor;

    return (
      <Button
        ref={ref}
        className={cn(
          shouldBrand && "border-0 shadow-md hover:shadow-lg transition-all",
          className
        )}
        style={
          shouldBrand
            ? {
                backgroundColor: brandColor,
                color: needsDarkText ? '#1e293b' : '#ffffff',
                ...style,
              }
            : style
        }
        onMouseEnter={(e) => {
          if (shouldBrand) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${brandColor}dd`;
          }
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (shouldBrand) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = brandColor;
          }
          props.onMouseLeave?.(e);
        }}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

BrandedButton.displayName = "BrandedButton";

export { BrandedButton };
