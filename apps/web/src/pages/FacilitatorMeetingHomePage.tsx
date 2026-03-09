import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Plus, UserPlus, Trash2, ClipboardList, Link2, ArrowRight, FileText, BookOpen } from 'lucide-react';
import { MEETINGS, OPEN_CONTEXTS } from '@/lib/mock-data';
import { AgendaList } from '@/components/shared/AgendaList';
import { OpenContextPicker } from '@/components/shared/OpenContextPicker';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { TabButton } from '@/components/ui/Tabs';
import { Panel } from '@/components/ui/Panel';

type SetupDraftState = {
  setupDraft?: {
    meetingTitle?: string;
    meetingDate?: string;
    participants?: string[];
  };
};

export function FacilitatorMeetingHomePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const setupDraft = (location.state as SetupDraftState | null)?.setupDraft;

  const [meetingTitle, setMeetingTitle] = useState(setupDraft?.meetingTitle ?? 'New Meeting');
  const [meetingDate, setMeetingDate] = useState(
    setupDraft?.meetingDate ?? new Date().toISOString().slice(0, 10),
  );
  const [participants, setParticipants] = useState<string[]>(setupDraft?.participants ?? []);
  const [newParticipant, setNewParticipant] = useState('');

  const [agendaTab, setAgendaTab] = useState<'stubs' | 'open-contexts'>('stubs');
  const [stubTitle, setStubTitle] = useState('');
  const [agendaStubs, setAgendaStubs] = useState<string[]>([]);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [manualTranscriptTitle, setManualTranscriptTitle] = useState('');
  const [manualBackgroundTitle, setManualBackgroundTitle] = useState('');
  const [manualTranscripts, setManualTranscripts] = useState<string[]>([]);
  const [manualBackgroundDocs, setManualBackgroundDocs] = useState<string[]>([]);

  const selectedOpenContexts = OPEN_CONTEXTS.filter((ctx) => selectedContextIds.includes(ctx.id));
  const activeMeeting = MEETINGS.find((meeting) => meeting.id === id) ?? null;

  function addParticipant() {
    const name = newParticipant.trim();
    if (!name || participants.includes(name)) return;
    setParticipants((prev) => [...prev, name]);
    setNewParticipant('');
  }

  function removeParticipant(name: string) {
    setParticipants((prev) => prev.filter((p) => p !== name));
  }

  function addAgendaStub() {
    const next = stubTitle.trim();
    if (!next) return;
    if (agendaStubs.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setStubTitle('');
      return;
    }
    setAgendaStubs((prev) => [...prev, next]);
    setStubTitle('');
  }

  function removeAgendaStub(value: string) {
    setAgendaStubs((prev) => prev.filter((item) => item !== value));
  }

  function addManualTranscript() {
    const next = manualTranscriptTitle.trim();
    if (!next) return;
    setManualTranscripts((prev) => [...prev, next]);
    setManualTranscriptTitle('');
  }

  function addManualBackgroundDoc() {
    const next = manualBackgroundTitle.trim();
    if (!next) return;
    setManualBackgroundDocs((prev) => [...prev, next]);
    setManualBackgroundTitle('');
  }

  return (
    <div className="density-facilitator min-h-screen bg-base">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-fac-title text-text-primary">{meetingTitle}</h1>
          <p className="text-fac-meta text-text-secondary mt-0.5">
            Meeting home — no active decision context yet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/meetings/mtg-1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-2 rounded border border-border text-fac-meta text-text-muted hover:text-text-primary transition-colors"
          >
            Shared screen
          </Link>
          <Button
            onClick={() =>
              navigate('/meetings/mtg-1/facilitator', {
                state: {
                  setupDraft: {
                    meetingTitle,
                    meetingDate,
                    participants,
                    initialAgenda: {
                      stubs: agendaStubs,
                      openContexts: selectedOpenContexts.map((ctx) => ({
                        id: ctx.id,
                        title: ctx.title,
                        sourceMeetingTitle: ctx.sourceMeetingTitle,
                        sourceMeetingDate: ctx.sourceMeetingDate,
                      })),
                    },
                  },
                },
              })
            }
            variant="primary"
          >
            Open facilitator workspace
            <ArrowRight size={13} />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Meeting details" className="flex flex-col gap-3">
          <Input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            className="w-full"
          />
          <Input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="w-48"
          />
          <div className="flex flex-col gap-1.5">
            {participants.map((p) => (
              <div key={p} className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-overlay/60">
                <span className="text-fac-meta text-text-primary flex-1">{p}</span>
                <button onClick={() => removeParticipant(p)} className="text-text-muted hover:text-danger transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Add participant..."
                value={newParticipant}
                onChange={(e) => setNewParticipant(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                inputSize="sm"
                className="flex-1"
              />
              <Button
                onClick={addParticipant}
                disabled={!newParticipant.trim()}
                variant="outline-accent"
                size="sm"
              >
                <UserPlus size={13} />
                Add
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Decision agenda" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <TabButton active={agendaTab === 'stubs'} onClick={() => setAgendaTab('stubs')} compact>
              Agenda placeholders
            </TabButton>
            <TabButton active={agendaTab === 'open-contexts'} onClick={() => setAgendaTab('open-contexts')} compact>
              Browse open contexts
            </TabButton>
          </div>

          {agendaTab === 'stubs' ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Decision stub title..."
                  value={stubTitle}
                  onChange={(e) => setStubTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAgendaStub()}
                  inputSize="sm"
                  className="flex-1"
                />
                <Button
                  onClick={addAgendaStub}
                  disabled={!stubTitle.trim()}
                  variant="outline-accent"
                  size="sm"
                >
                  <Plus size={13} />
                  Add
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {agendaStubs.map((item) => (
                  <div key={item} className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-overlay/60">
                    <ClipboardList size={13} className="text-text-muted" />
                    <span className="text-fac-meta text-text-primary flex-1">{item}</span>
                    <IconButton onClick={() => removeAgendaStub(item)} tone="danger" className="w-7 h-7 border-0">
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <OpenContextPicker
                idPrefix="meeting-home-open-contexts"
                contexts={OPEN_CONTEXTS}
                currentMeeting={{ title: meetingTitle, date: meetingDate }}
                selectionMode="multiple"
                selectedIds={selectedContextIds}
                onChange={setSelectedContextIds}
              />
            </div>
          )}
        </Panel>

        <Panel title="Agenda overview" className="lg:col-span-2">
          {agendaStubs.length === 0 && selectedOpenContexts.length === 0 ? (
            <p className="text-fac-meta text-text-muted mt-1">
              Add placeholders or existing contexts to shape meeting agenda before opening a decision workspace.
            </p>
          ) : (
            <AgendaList
              items={[
                ...agendaStubs.map((item) => ({
                  id: `stub-${item}`,
                  title: `${item} (stub)`,
                  status: 'pending' as const,
                })),
                ...selectedOpenContexts.map((ctx) => ({
                  id: `ctx-${ctx.id}`,
                  title: `${ctx.title} (open context)`,
                  status: ctx.status === 'deferred' ? 'deferred' as const : 'drafted' as const,
                })),
              ]}
            />
          )}
          <div className="mt-3 flex items-center gap-2 text-fac-meta text-text-muted">
            <Link2 size={13} />
            Cross-meeting context linking is applied when open contexts are attached in facilitator workspace.
          </div>
        </Panel>

        <Panel title="Meeting materials" className="flex flex-col gap-3">
          <p className="text-fac-meta text-text-muted">
            Add manual transcripts or background documents for this meeting.
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              value={manualTranscriptTitle}
              onChange={(e) => setManualTranscriptTitle(e.target.value)}
              placeholder="Add transcript note..."
              inputSize="sm"
              className="flex-1"
            />
            <Button
              onClick={addManualTranscript}
              disabled={!manualTranscriptTitle.trim()}
              variant="outline-accent"
              size="sm"
            >
              <FileText size={13} />
              Add
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              value={manualBackgroundTitle}
              onChange={(e) => setManualBackgroundTitle(e.target.value)}
              placeholder="Add background document..."
              inputSize="sm"
              className="flex-1"
            />
            <Button
              onClick={addManualBackgroundDoc}
              disabled={!manualBackgroundTitle.trim()}
              variant="outline-accent"
              size="sm"
            >
              <BookOpen size={13} />
              Add
            </Button>
          </div>
          {(manualTranscripts.length > 0 || manualBackgroundDocs.length > 0) && (
            <div className="rounded border border-border bg-overlay/40 p-3">
              {manualTranscripts.map((item) => (
                <p key={`tr-${item}`} className="text-fac-meta text-text-primary">• Transcript: {item}</p>
              ))}
              {manualBackgroundDocs.map((item) => (
                <p key={`bg-${item}`} className="text-fac-meta text-text-primary">• Background: {item}</p>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Attendance and outcomes" className="flex flex-col gap-3">
          <p className="text-fac-meta text-text-muted">
            Track who is/was in the meeting and review decision outcomes when meeting is closed.
          </p>
          <div className="rounded border border-border bg-overlay/40 p-3 flex flex-col gap-1">
            {(participants.length > 0 ? participants : activeMeeting?.participants ?? []).map((participant, idx) => (
              <p key={participant} className="text-fac-meta text-text-primary">
                • {participant} <span className="text-text-muted">{idx % 3 === 0 ? '(left early)' : '(present)'}</span>
              </p>
            ))}
          </div>
          {activeMeeting?.status === 'closed' ? (
            <div className="rounded border border-border bg-overlay/40 p-3">
              <p className="text-fac-meta text-text-secondary">Meeting outcomes</p>
              <p className="text-fac-meta text-text-primary mt-1">• Decisions made: 3</p>
              <p className="text-fac-meta text-text-primary">• Decisions deferred: 1</p>
            </div>
          ) : (
            <div className="rounded border border-border bg-overlay/40 p-3">
              <p className="text-fac-meta text-text-muted">
                Outcomes summary appears when the meeting is marked completed.
              </p>
            </div>
          )}
        </Panel>

      </main>
    </div>
  );
}
