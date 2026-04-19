import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface LabelProps {
  children: ReactNode;
  className?: string;
  as?: "span" | "label" | "div" | "h2";
  variant?: "default" | "dim" | "invert";
}

/**
 * Styleguide label pattern — mono, uppercase, wide tracking
 * Used for field labels, section headers, and metadata
 */
export function Label({
  children,
  className,
  as: Component = "span",
  variant = "default",
}: LabelProps) {
  const variantClasses = {
    default: "text-text-muted",
    dim: "text-text-muted/60",
    invert: "text-white/50",
  };

  return (
    <Component
      className={cn(
        "font-mono text-xs uppercase tracking-[0.08em]",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </Component>
  );
}

/**
 * Section label — styleguide section-header pattern
 * 12% letter spacing, more prominent
 */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono text-xs uppercase tracking-[0.12em] text-text-muted mb-6",
        className
      )}
    >
      {children}
    </div>
  );
}
