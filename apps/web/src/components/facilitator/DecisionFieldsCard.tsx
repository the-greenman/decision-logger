import { Lock, Unlock, RefreshCw, Maximize2, Loader2, Paperclip } from "lucide-react";
import { Label } from "@/components/ui/Label";
import type { Field, AgendaItemStatus } from "@/lib/ui-models";

interface DecisionFieldsCardProps {
  contextId: string;
  title: string;
  status: AgendaItemStatus;
  fields: Field[];
  isReadOnly?: boolean;
  supplementaryCount?: (fieldId: string) => number;
  onLock?: (fieldId: string) => void;
  onUnlock?: (fieldId: string) => void;
  onRegenerate?: (fieldId: string) => void;
  onZoom?: (fieldId: string) => void;
}

const STATUS_LABEL: Partial<Record<AgendaItemStatus, string>> = {
  pending: "pending",
  active: "active",
  drafted: "drafted",
  logged: "logged",
  deferred: "deferred",
};

const FIELD_ROW_BG: Record<Field["status"], string> = {
  idle:       "",
  editing:    "bg-accent-dim/20",
  generating: "bg-caution-dim/30",
  locked:     "bg-settled-dim/20",
};

export function DecisionFieldsCard({
  contextId,
  title,
  status,
  fields,
  isReadOnly = false,
  supplementaryCount,
  onLock,
  onUnlock,
  onRegenerate,
  onZoom,
}: DecisionFieldsCardProps) {
  return (
    <div className="border border-border">
      {/* Black header bar — MVD card header, inverts in dark theme via --nav-* vars */}
      <div className="ink-surface px-5 py-3 flex items-baseline gap-4" style={{ background: "var(--nav-bg)" }}>
        <span className="font-mono text-xs tracking-wider shrink-0" style={{ color: "var(--nav-text-dim)" }}>
          ctx-{contextId.slice(-6).toUpperCase()}
        </span>
        <span className="font-sans text-sm font-medium flex-1 leading-snug" style={{ color: "var(--nav-text)" }}>
          {title || "Untitled decision"}
        </span>
        <span className="font-mono text-xs uppercase tracking-widest shrink-0" style={{ color: "var(--nav-text-dim)" }}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {/* Field rows */}
      {fields.map((field) => (
        <div key={field.id} className={`border-t border-border ${FIELD_ROW_BG[field.status]}`}>
          {/* Label + value */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Label>{field.label}</Label>
              <FieldStatusIcon status={field.status} />
              {field.required && field.status === "idle" && !field.value && (
                <span className="font-mono text-xs text-danger/60">required</span>
              )}
            </div>

            {field.status === "generating" ? (
              <GeneratingPlaceholder />
            ) : field.value ? (
              <p className="text-fac-field text-text-primary leading-relaxed">{field.value}</p>
            ) : (
              <p className="text-fac-field text-text-muted italic">Not yet generated</p>
            )}
          </div>

          {/* Control strip — hidden in read-only mode */}
          {!isReadOnly && (
            <div className="flex items-center gap-1 px-4 py-1.5 border-t border-border bg-surface/50">
              {field.status === "locked" ? (
                <FieldIconButton
                  icon={<Unlock size={13} />}
                  label="Unlock field"
                  onClick={() => onUnlock?.(field.id)}
                  className="text-text-muted hover:text-caution"
                />
              ) : (
                <FieldIconButton
                  icon={<Lock size={13} />}
                  label="Lock field"
                  onClick={() => onLock?.(field.id)}
                  className="text-text-muted hover:text-settled"
                  disabled={!field.value || field.status === "generating"}
                />
              )}
              <FieldIconButton
                icon={<RefreshCw size={13} />}
                label="Regenerate field"
                onClick={() => onRegenerate?.(field.id)}
                className="text-text-muted hover:text-text-primary"
                disabled={field.status === "locked" || field.status === "generating"}
              />
              <FieldIconButton
                icon={<Maximize2 size={13} />}
                label="Zoom into field"
                onClick={() => onZoom?.(field.id)}
                className="text-text-muted hover:text-text-primary"
                disabled={!onZoom}
              />
              {supplementaryCount && supplementaryCount(field.id) > 0 && (
                <span
                  className="flex items-center gap-1 ml-1 font-mono text-xs text-text-muted"
                  title={`${supplementaryCount(field.id)} supplementary item${supplementaryCount(field.id) !== 1 ? "s" : ""}`}
                >
                  <Paperclip size={11} />
                  {supplementaryCount(field.id)}
                </span>
              )}
            </div>
          )}
        </div>
      ))}

      {fields.length === 0 && (
        <div className="border-t border-border px-5 py-8 text-center font-mono text-xs text-text-muted uppercase tracking-widest">
          No fields
        </div>
      )}
    </div>
  );
}

function FieldStatusIcon({ status }: { status: Field["status"] }) {
  if (status === "locked") {
    return <Lock size={12} className="text-settled shrink-0" />;
  }
  if (status === "generating") {
    return <Loader2 size={12} className="text-caution shrink-0 animate-spin" />;
  }
  return null;
}

function GeneratingPlaceholder() {
  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="h-3.5 bg-caution/10 animate-pulse-slow w-full" />
      <div className="h-3.5 bg-caution/10 animate-pulse-slow w-4/5" />
      <div className="h-3.5 bg-caution/10 animate-pulse-slow w-2/3" />
    </div>
  );
}

interface FieldIconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

function FieldIconButton({ icon, label, onClick, className = "", disabled }: FieldIconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
    >
      {icon}
    </button>
  );
}
