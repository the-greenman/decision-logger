import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline-accent";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:         "bg-accent text-white hover:opacity-80",
  secondary:       "border border-border text-text-muted hover:text-text-primary hover:border-border-strong",
  ghost:           "text-text-muted hover:text-text-primary",
  danger:          "border border-danger text-danger hover:bg-danger-dim",
  "outline-accent":"border border-border-strong text-text-primary hover:bg-surface",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-fac-meta",
  md: "px-4 py-2 text-fac-meta",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    />
  );
}
