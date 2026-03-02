import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-zinc-900 text-white hover:bg-zinc-700": variant === "default",
            "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50": variant === "outline",
            "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700": variant === "destructive",
          },
          {
            "h-8 px-3 text-xs": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-11 px-6 text-sm": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
