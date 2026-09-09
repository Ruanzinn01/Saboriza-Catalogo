import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-linear-to-b from-gold-400 to-gold-600 text-forest-950 shadow-sm shadow-gold-600/20 hover:from-gold-400 hover:to-gold-500 active:from-gold-500 active:to-gold-600",
  secondary:
    "bg-linear-to-b from-forest-700 to-forest-900 text-cream-50 shadow-sm shadow-forest-950/30 hover:from-forest-600 hover:to-forest-800",
  outline: "border border-forest-900/20 text-forest-900 hover:bg-forest-900/5",
  ghost: "text-forest-900 hover:bg-forest-900/5",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
