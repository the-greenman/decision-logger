import { useMemo, useRef, useState } from 'react';
import { Search, Check, ArrowLeft, Hash, Link as LinkIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

type TranscriptRowModel = {
  id: string;
  seq: number;
  meetingId: string;
  speaker: string | null;
  text: string;
};

const MEETING_NAMES: Record<string, string> = {
  'mtg-1': 'Current meeting',
  'mtg-2': 'Mar 1 review',
  'mtg-3': 'Feb 20 planning',
};

// Prototype: 120 rows across three meetings.
const MOCK_ROWS: TranscriptRowModel[] = Array.from({ length: 120 }, (_, i) => {
  const seq = i + 1;
  const speakers = ['Alice Chen', 'Bob Marsh', 'Priya Nair'];
  const speaker = seq % 7 === 0 ? null : speakers[i % 3]!;
  const meetingId = seq <= 80 ? 'mtg-1' : seq <= 105 ? 'mtg-2' : 'mtg-3';
  const snippets = [
    "Let's start with the API gateway decision. We've been running on ad-hoc nginx rules for too long.",
    'I looked at Kong and Traefik last week. Both are solid options.',
    'What about AWS API Gateway? We\'re already in AWS so there\'s less vendor friction.',
    'Cost at scale is a concern. And vendor lock-in is real.',
    'Kong has a great plugin ecosystem. WebSocket support out of the box.',
    'Traefik is more cloud-native. Better Kubernetes integration and the config is declarative.',
    'Do we need the plugin ecosystem right now? Traefik might be simpler to operate day-to-day.',
    'Our team knows Traefik from the staging environment already.',
    'I\'m comfortable with Traefik. Let\'s go with that.',
    'All agreed? Going with Traefik for the API gateway.',
    'We should think about the HA setup. Traefik in active-passive or active-active?',
    'The operational complexity of active-active is probably not worth it for our scale.',
    'Agreed. Active-passive with automatic failover is fine.',
    'What about rate limiting? Do we configure at gateway or service level?',
    'Gateway level is the right boundary. Services shouldn\'t need to know.',
  ];
  return {
    id: `r${seq}`,
    seq,
    meetingId,
    speaker,
    text: snippets[i % snippets.length]!,
  };
});

export function TranscriptPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [jumpInput, setJumpInput] = useState('');
  const [includeRelatedMeetings, setIncludeRelatedMeetings] = useState(false);

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragState = useRef<{
    active: boolean;
    anchorIndex: number;
    targetValue: boolean;
    touchedIds: Set<string>;
  }>({
    active: false,
    anchorIndex: 0,
    targetValue: false,
    touchedIds: new Set<string>(),
  });

  const scopedRows = useMemo(
    () =>
      includeRelatedMeetings
        ? MOCK_ROWS
        : MOCK_ROWS.filter((row) => row.meetingId === 'mtg-1'),
    [includeRelatedMeetings]
  );

  const filtered = scopedRows.filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const speakerText = r.speaker?.toLowerCase() ?? 'speaker unknown';
    return r.text.toLowerCase().includes(q) || speakerText.includes(q);
  });

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleJump() {
    const n = parseInt(jumpInput, 10);
    if (!n) return;
    const row = MOCK_ROWS.find((r) => r.seq === n);
    if (!row) return;
    const el = rowRefs.current.get(row.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-accent');
      setTimeout(() => el.classList.remove('ring-2', 'ring-accent'), 1500);
    }
    setJumpInput('');
  }

  function applyRangeSelection(fromIndex: number, toIndex: number, value: boolean) {
    const min = Math.min(fromIndex, toIndex);
    const max = Math.max(fromIndex, toIndex);

    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = min; i <= max; i += 1) {
        const row = filtered[i];
        if (!row) continue;
        if (value) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function beginDragSelection(rowId: string) {
    const anchorIndex = filtered.findIndex((row) => row.id === rowId);
    if (anchorIndex < 0) return;
    const shouldSelect = !selected.has(rowId);

    dragState.current.active = true;
    dragState.current.anchorIndex = anchorIndex;
    dragState.current.targetValue = shouldSelect;
    dragState.current.touchedIds = new Set([rowId]);
    applyRangeSelection(anchorIndex, anchorIndex, shouldSelect);
  }

  function updateDragSelection(rowId: string) {
    if (!dragState.current.active) return;
    if (dragState.current.touchedIds.has(rowId)) return;

    const index = filtered.findIndex((row) => row.id === rowId);
    if (index < 0) return;

    dragState.current.touchedIds.add(rowId);
    applyRangeSelection(dragState.current.anchorIndex, index, dragState.current.targetValue);
  }

  function endDragSelection() {
    dragState.current.active = false;
    dragState.current.touchedIds.clear();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current.active) return;
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const rowEl = el?.closest('[data-row-id]') as HTMLDivElement | null;
    if (!rowEl?.dataset.rowId) return;
    updateDragSelection(rowEl.dataset.rowId);
  }

  function handleConfirm() {
    const rowIds = Array.from(selected);
    const chunkIds = rowIds.map((rowId) => `chunk-${rowId.slice(1)}`);

    navigate('/meetings/mtg-1/facilitator', {
      state: {
        segmentSelection: {
          rowIds,
          chunkIds,
        },
      },
    });
  }

  return (
    <div className="density-facilitator min-h-screen bg-base flex flex-col">

      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          to="/meetings/mtg-1/facilitator"
          className="flex items-center gap-1.5 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
        <div className="w-px h-4 bg-border" />
        <span className="text-fac-field text-text-primary font-medium flex-1">
          Select transcript segments
        </span>
        <span className="text-fac-meta text-text-muted">
          {selected.size} row{selected.size !== 1 ? 's' : ''} selected
        </span>
        <button
          disabled={selected.size === 0}
          onClick={handleConfirm}
          className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta bg-settled text-base rounded font-medium hover:bg-settled/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check size={13} />
          Confirm selection
        </button>
      </header>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-3 shrink-0">
        {/* Text search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search transcript…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-1.5 pl-8 text-fac-field text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Jump to row — G3 */}
        <div className="flex items-center gap-1.5 border border-border rounded overflow-hidden bg-surface">
          <span className="pl-3 text-text-muted flex items-center">
            <Hash size={13} />
          </span>
          <input
            type="number"
            min={1}
            max={MOCK_ROWS.length}
            placeholder="Row…"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
            className="w-16 py-1.5 bg-transparent text-fac-meta text-text-primary focus:outline-none placeholder:text-text-muted"
          />
          <button
            onClick={handleJump}
            disabled={!jumpInput}
            className="px-2.5 py-1.5 text-fac-meta text-text-muted hover:text-accent transition-colors disabled:opacity-30"
            title="Jump to row"
          >
            <LinkIcon size={13} />
          </button>
        </div>

        <span className="text-fac-meta text-text-muted shrink-0">
          {filtered.length} / {MOCK_ROWS.length} rows
        </span>
        <label className="flex items-center gap-2 text-fac-meta text-text-secondary">
          <input
            type="checkbox"
            checked={includeRelatedMeetings}
            onChange={(e) => setIncludeRelatedMeetings(e.target.checked)}
            className="accent-accent"
          />
          Include related meetings
        </label>
      </div>

      {/* Transcript rows */}
      <main
        className="flex-1 overflow-y-auto px-4 py-3"
        onPointerMove={handlePointerMove}
        onPointerUp={endDragSelection}
        onPointerCancel={endDragSelection}
      >
        <div className="flex flex-col gap-0.5 max-w-3xl">
          {filtered.map((row) => (
            <TranscriptRow
              key={row.id}
              row={row}
              isSelected={selected.has(row.id)}
              onToggle={() => toggleRow(row.id)}
              onBeginDrag={() => beginDragSelection(row.id)}
              meetingLabel={MEETING_NAMES[row.meetingId] ?? row.meetingId}
              showMeetingLabel={row.meetingId !== 'mtg-1'}
              rowRef={(el) => {
                if (el) rowRefs.current.set(row.id, el);
                else rowRefs.current.delete(row.id);
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function TranscriptRow({
  row,
  isSelected,
  onToggle,
  onBeginDrag,
  meetingLabel,
  showMeetingLabel,
  rowRef,
}: {
  row: TranscriptRowModel;
  isSelected: boolean;
  onToggle: () => void;
  onBeginDrag: () => void;
  meetingLabel: string;
  showMeetingLabel: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={rowRef}
      data-row-id={row.id}
      onClick={onToggle}
      onPointerDown={onBeginDrag}
      className={`flex gap-3 px-3 py-2.5 rounded cursor-pointer select-none transition-colors transition-shadow ${
        isSelected
          ? 'bg-accent-dim/40 border border-accent/30'
          : 'hover:bg-surface border border-transparent'
      }`}
    >
      <span className="text-fac-meta text-text-muted w-8 text-right shrink-0 mt-0.5 tabular-nums">
        {row.seq}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-fac-meta text-text-secondary font-medium mr-2">
            {row.speaker ?? 'Speaker unknown'}:
          </span>
          {showMeetingLabel && (
            <span className="text-[11px] text-text-muted border border-border px-1.5 py-0.5 rounded-badge">
              {meetingLabel}
            </span>
          )}
        </div>
        <span className="text-fac-field text-text-primary">{row.text}</span>
      </div>
    </div>
  );
}
