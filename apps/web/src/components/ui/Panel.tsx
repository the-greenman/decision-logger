import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Label } from "./Label";

interface PanelProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  right?: ReactNode;
}

export function Panel({ title, right, className, children, ...props }: PanelProps) {
  return (
    <section
      className={cn("border border-border bg-surface p-4", className)}
      {...props}
    >
      {(title || right) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title ? (
            <Label as="h2" className="text-text-primary">{title}</Label>
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
