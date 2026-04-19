import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type HeaderTone = "active" | "completed" | "neutral";
type HeaderVariant = "light" | "dark";

export interface MainHeaderNavItem {
  label: string;
  to?: string;
  icon?: ReactNode;
}

interface MainHeaderProps {
  variant?: HeaderVariant;
  navItems?: MainHeaderNavItem[];
  title: string;
  titleTo?: string;
  subtitle?: string;
  meta?: ReactNode;
  status?: {
    label: string;
    tone?: HeaderTone;
  };
  actions?: ReactNode;
  className?: string;
}

export function MainHeader({
  variant = "light",
  navItems = [],
  title,
  titleTo,
  subtitle,
  meta,
  status,
  actions,
  className = "px-6 py-4",
}: MainHeaderProps) {
  const dark = variant === "dark";

  const containerStyle: CSSProperties = dark
    ? { background: "var(--nav-bg)", borderBottomColor: "var(--nav-border)" }
    : {};

  const titleStyle: CSSProperties = dark ? { color: "var(--nav-text)" } : {};
  const dimStyle: CSSProperties = dark ? { color: "var(--nav-text-dim)" } : {};

  return (
    <header
      className={`border-b ${dark ? "ink-surface" : "border-border"} ${className}`}
      style={containerStyle}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[280px]">
          {navItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {navItems.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                  {item.to ? (
                    <Link
                      to={item.to}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 border text-fac-meta ${
                        dark
                          ? "hover:opacity-80"
                          : "border-border text-text-muted hover:text-text-primary"
                      }`}
                      style={dark ? { color: "var(--nav-text-dim)", borderColor: "var(--nav-border)" } : {}}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 text-fac-meta"
                      style={dark ? dimStyle : { color: "var(--color-text-secondary)" }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                  )}
                  {index < navItems.length - 1 && (
                    <span className="text-fac-meta" style={dark ? dimStyle : { color: "var(--color-text-muted)" }}>
                      /
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {titleTo ? (
              <Link
                to={titleTo}
                className="text-fac-title truncate hover:opacity-75"
                style={dark ? titleStyle : { color: "var(--color-text-primary)" }}
              >
                {title}
              </Link>
            ) : (
              <h1
                className="text-fac-title truncate"
                style={dark ? titleStyle : { color: "var(--color-text-primary)" }}
              >
                {title}
              </h1>
            )}
            {status && (
              <span
                className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono uppercase tracking-wider border"
                style={
                  dark
                    ? { color: "var(--nav-text-dim)", borderColor: "var(--nav-border)" }
                    : { color: "var(--color-text-muted)", borderColor: "var(--color-border)" }
                }
              >
                {status.label}
              </span>
            )}
          </div>

          {(subtitle || meta) && (
            <div
              className="text-fac-meta mt-0.5 flex flex-wrap items-center gap-1.5"
              style={dark ? dimStyle : { color: "var(--color-text-secondary)" }}
            >
              {subtitle && <span>{subtitle}</span>}
              {subtitle && meta && <span>·</span>}
              {meta && <span style={dark ? dimStyle : {}}>{meta}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <ThemeToggle dark={dark} />
        </div>
      </div>
    </header>
  );
}
