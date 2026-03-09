import { useMemo, useState } from 'react';
import { CalendarDays, Link2, X } from 'lucide-react';
import type { OpenContextSummary } from '@/lib/mock-data';

interface AddExistingContextDialogProps {
  contexts: OpenContextSummary[];
  currentMeeting: { title: string; date: string };
  onConfirm: (context: OpenContextSummary) => void;
  onCancel: () => void;
}

export function AddExistingContextDialog({
  contexts,
  currentMeeting,
  onConfirm,
  onCancel,
}: AddExistingContextDialogProps) {
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('2026-03');
  const [selectedDate, setSelectedDate] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedId, setSelectedId] = useState(contexts[0]?.id ?? '');

  const querySuggestions = useMemo(() => {
    const values = new Set<string>();
    contexts.forEach((ctx) => {
      values.add(ctx.title);
      values.add(ctx.sourceMeetingTitle);
      values.add(ctx.sourceMeetingDate);
      ctx.sourceMeetingTags.forEach((tag) => values.add(tag));
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b)).slice(0, 16);
  }, [contexts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contexts.filter((ctx) => {
      if (selectedDate && ctx.sourceMeetingDate !== selectedDate) return false;
      if (month && !ctx.sourceMeetingDate.startsWith(month)) return false;

      if (!q) return true;
      if (ctx.title.toLowerCase().includes(q)) return true;
      if (ctx.sourceMeetingTitle.toLowerCase().includes(q)) return true;
      if (ctx.sourceMeetingDate.includes(q)) return true;
      if (ctx.sourceMeetingTags.some((tag) => tag.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [contexts, query, month, selectedDate]);

  const monthDates = useMemo(() => {
    const all = contexts
      .map((ctx) => ctx.sourceMeetingDate)
      .filter((date) => date.startsWith(month));
    return Array.from(new Set(all)).sort();
  }, [contexts, month]);

  const selected = filtered.find((ctx) => ctx.id === selectedId) ?? filtered[0] ?? null;
  const selectedIsCrossMeeting = !!selected && (
    selected.sourceMeetingDate !== currentMeeting.date ||
    selected.sourceMeetingTitle !== currentMeeting.title
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-card shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Link2 size={16} className="text-accent" />
          <h2 className="text-fac-field text-text-primary font-medium flex-1">Add existing context</h2>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          <div className="flex gap-2">
            <input
              list="related-meeting-suggestions"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by date, title, or tag..."
              className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
            />
            <datalist id="related-meeting-suggestions">
              {querySuggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <button
              onClick={() => setShowCalendar((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded border text-fac-meta transition-colors ${
                showCalendar
                  ? 'border-accent/40 text-accent bg-accent-dim/20'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <CalendarDays size={13} />
              Calendar
            </button>
          </div>

          {showCalendar && (
            <div className="rounded-card border border-border p-3 bg-overlay/40">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-fac-meta text-text-muted">Month</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setSelectedDate('');
                  }}
                  className="px-2 py-1 rounded border border-border bg-surface text-fac-meta text-text-primary focus:outline-none focus:border-accent"
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="ml-auto text-fac-meta text-text-muted hover:text-text-primary"
                  >
                    Clear date
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {monthDates.length === 0 && (
                  <span className="text-fac-meta text-text-muted italic">No related meetings this month.</span>
                )}
                {monthDates.map((date) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`px-2 py-1 rounded border text-fac-meta transition-colors ${
                      selectedDate === date
                        ? 'border-accent/40 text-accent bg-accent-dim/20'
                        : 'border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {date}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {filtered.map((ctx) => (
              <button
                key={ctx.id}
                onClick={() => setSelectedId(ctx.id)}
                className={`text-left p-3 rounded-card border transition-colors ${
                  selected?.id === ctx.id ? 'border-accent/40 bg-accent-dim/20' : 'border-border hover:border-border-strong'
                }`}
              >
                <p className="text-fac-field text-text-primary font-medium">{ctx.title}</p>
                <p className="text-fac-meta text-text-muted mt-1">
                  {ctx.sourceMeetingDate} · {ctx.sourceMeetingTitle}
                </p>
                <p className="text-fac-meta text-text-muted">
                  {ctx.templateName} · {ctx.status} · {ctx.sourceMeetingTags.join(', ')}
                </p>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-fac-meta text-text-muted italic p-2">No matching contexts.</p>
            )}
          </div>

          {selectedIsCrossMeeting && selected && (
            <div className="rounded-card border border-accent/30 bg-accent-dim/15 p-3">
              <p className="text-fac-meta text-text-secondary">
                This context is from another meeting. Saving will first link the meeting relation:
              </p>
              <p className="text-fac-meta text-text-primary mt-1">
                {selected.sourceMeetingDate} · {selected.sourceMeetingTitle}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="flex items-center gap-1.5 px-4 py-2 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Link2 size={13} />
            {selectedIsCrossMeeting ? 'Link meeting + add context' : 'Add to agenda'}
          </button>
        </div>
      </div>
    </div>
  );
}
