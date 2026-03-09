import { Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RelationsAccordion } from '@/components/shared/RelationsAccordion';
import { TagPill } from '@/components/shared/TagPill';
import { ACTIVE_CONTEXT, MEETINGS } from '@/lib/mock-data';

const LOGGED_DECISION = {
  ...ACTIVE_CONTEXT,
  method: 'Consensus',
  loggedBy: 'Alice Chen',
  loggedAt: '2026-03-08T15:42:00Z',
  fields: ACTIVE_CONTEXT.fields.map((f) => ({
    ...f,
    value: f.value || 'Traefik, for its cloud-native Kubernetes integration and operational familiarity.',
    status: 'locked' as const,
  })),
};

export function LoggedDecisionPage() {
  const navigate = useNavigate();
  const d = LOGGED_DECISION;
  const activeMeeting = MEETINGS.find((meeting) => meeting.status === 'active') ?? null;

  return (
    <div className="density-display min-h-screen bg-base">
      <main className="max-w-4xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-8">
          <div className="flex-1 min-w-0">
            <p className="text-display-label text-text-secondary uppercase tracking-widest mb-2">
              Logged decision
            </p>
            <h1 className="text-display-title text-text-primary">{d.title}</h1>
            <p className="text-display-meta text-text-secondary mt-3 max-w-2xl leading-relaxed">
              {d.summary}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {d.tags.map((tag) => (
                <TagPill key={tag.id} name={tag.name} category={tag.category} />
              ))}
            </div>
          </div>

          {/* Export */}
          <div className="flex flex-col gap-2 shrink-0">
            <button className="flex items-center gap-2 px-3 py-2 text-fac-meta text-text-muted border border-border rounded hover:border-border-strong hover:text-text-primary transition-colors">
              <Download size={14} />
              Export
            </button>
            <button
              onClick={() => {
                if (!activeMeeting) return;
                navigate(`/meetings/${activeMeeting.id}/facilitator`, {
                  state: {
                    createContextDraft: {
                      title: `Follow-up: ${d.title}`,
                      summary: `Follow-up context linked to logged decision \"${d.title}\".`,
                      relation: {
                        targetId: d.id,
                        targetTitle: d.title,
                        relationType: 'related' as const,
                      },
                    },
                  },
                });
              }}
              disabled={!activeMeeting}
              className="flex items-center gap-2 px-3 py-2 text-fac-meta border border-accent/30 text-accent rounded hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create follow-up in active meeting
            </button>
            {!activeMeeting && (
              <p className="text-fac-meta text-text-muted max-w-48">
                No active meeting available. Start or resume a meeting to create follow-up contexts.
              </p>
            )}
          </div>
        </div>

        {/* Meta bar */}
        <div className="flex items-center gap-6 px-5 py-3 rounded-card border border-border bg-surface mb-8 text-fac-meta">
          <MetaItem label="Method" value={d.method} />
          <MetaItem label="Logged by" value={d.loggedBy} />
          <MetaItem label="Date" value="8 March 2026" />
          <MetaItem label="Template" value={d.templateName} />
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-6 mb-8">
          {d.fields.filter((f) => f.value).map((field) => (
            <div key={field.id} className="flex flex-col gap-3 p-8 rounded-card border border-border-locked bg-settled-dim/10">
              <p className="text-display-label text-text-secondary uppercase tracking-widest">
                {field.label}
              </p>
              <p className="text-display-field text-text-primary leading-relaxed">{field.value}</p>
            </div>
          ))}
        </div>

        {/* Relations */}
        {d.relations.length > 0 && (
          <RelationsAccordion relations={d.relations} density="display" />
        )}
      </main>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-muted text-[11px] uppercase tracking-wider">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}
