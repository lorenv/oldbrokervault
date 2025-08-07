import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-violet focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 ink-ripple",
  {
    variants: {
      variant: {
        default: "signature-gradient text-white shadow-lg hover:shadow-xl hover:scale-[1.02] border-none",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md hover:shadow-lg",
        outline:
          "glass-card border-ink-violet/20 text-ink-violet hover:bg-ink-violet/5 hover:scale-[1.02]",
        secondary:
          "glass-card text-ink-violet-dark hover:bg-ink-violet/5 shadow-md hover:shadow-lg",
        ghost: "hover:bg-ink-violet/10 hover:text-ink-violet-dark text-document-gray-dark",
        link: "text-ink-violet underline-offset-4 hover:underline hover:text-ink-violet-dark",
        signature: "signature-pen text-white shadow-lg hover:shadow-xl hover:scale-[1.02] border-none",
        emerald: "bg-gradient-to-br from-seal-emerald to-seal-emerald/80 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] seal-glow",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
