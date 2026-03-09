import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, FileText, BookOpen } from 'lucide-react';
import { MEETINGS, OPEN_CONTEXTS } from '@/lib/mock-data';
import { MeetingAgendaPlanner } from '@/components/shared/MeetingAgendaPlanner';
import {
  MeetingAttendeesPanel,
  type MeetingAttendeeEvent,
  type MeetingAttendeePresence,
} from '@/components/shared/MeetingAttendeesPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';

type SetupDraftState = {
  setupDraft?: {
    meetingTitle?: string;
    meetingDate?: string;
    participants?: string[];
    initialCandidates?: string[];
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

  const [draftAgendaItemTitle, setDraftAgendaItemTitle] = useState('');
  const [manualAgendaItems, setManualAgendaItems] = useState<string[]>([]);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [manualTranscriptTitle, setManualTranscriptTitle] = useState('');
  const [manualBackgroundTitle, setManualBackgroundTitle] = useState('');
  const [manualTranscripts, setManualTranscripts] = useState<string[]>([]);
  const [manualBackgroundDocs, setManualBackgroundDocs] = useState<string[]>([]);

  const selectedOpenContexts = OPEN_CONTEXTS.filter((ctx) => selectedContextIds.includes(ctx.id));
  const activeMeeting = MEETINGS.find((meeting) => meeting.id === id) ?? null;
  const initialAttendees = setupDraft?.participants ?? activeMeeting?.participants ?? [];
  const [attendees, setAttendees] = useState<MeetingAttendeePresence[]>(
    initialAttendees.map((name) => ({
      name,
      status: 'present',
      updatedAt: 'meeting start',
    })),
  );
  const [attendeeEvents, setAttendeeEvents] = useState<MeetingAttendeeEvent[]>(
    initialAttendees.map((name, index) => ({
      id: `home-attendee-start-${index}`,
      attendeeName: name,
      action: 'entered',
      at: 'meeting start',
    })),
  );

  function addManualAgendaItem() {
    const next = draftAgendaItemTitle.trim();
    if (!next) return;
    if (manualAgendaItems.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setDraftAgendaItemTitle('');
      return;
    }
    setManualAgendaItems((prev) => [...prev, next]);
    setDraftAgendaItemTitle('');
  }

  function removeManualAgendaItem(value: string) {
    setManualAgendaItems((prev) => prev.filter((item) => item !== value));
  }

  function moveManualAgendaItem(value: string, direction: 'up' | 'down') {
    setManualAgendaItems((prev) => {
      const idx = prev.indexOf(value);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
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

  function toggleAttendeeStatus(name: string) {
    let nextEvent: MeetingAttendeeEvent | null = null;

    setAttendees((prev) =>
      prev.map((attendee) => {
        if (attendee.name !== name) return attendee;
        const nextStatus = attendee.status === 'present' ? 'left' : 'present';
        const updatedAt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        nextEvent = {
          id: `home-attendee-event-${Date.now()}-${name.replace(/\s+/g, '-').toLowerCase()}`,
          attendeeName: name,
          action: nextStatus === 'present' ? 'entered' : 'left',
          at: updatedAt,
        };
        return {
          ...attendee,
          status: nextStatus,
          updatedAt,
        };
      }),
    );

    if (nextEvent) {
      const event = nextEvent;
      setAttendeeEvents((prev) => [event, ...prev].slice(0, 12));
    }
  }

  function addAttendee(name: string) {
    const normalized = name.trim();
    if (!normalized) return false;

    const exists = attendees.some((attendee) => attendee.name.toLowerCase() === normalized.toLowerCase());
    if (exists) return false;

    const updatedAt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setAttendees((prev) => [...prev, { name: normalized, status: 'present', updatedAt }]);
    setAttendeeEvents((prev) => [
      {
        id: `home-attendee-event-${Date.now()}-${normalized.replace(/\s+/g, '-').toLowerCase()}`,
        attendeeName: normalized,
        action: 'entered' as const,
        at: updatedAt,
      },
      ...prev,
    ].slice(0, 12));

    return true;
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
                    participants: attendees.map((attendee) => attendee.name),
                    initialCandidates: manualAgendaItems,
                    initialAgenda: {
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
          <p className="text-fac-meta text-text-muted">
            Manage attendance in the shared attendee panel below.
          </p>
        </Panel>

        <MeetingAgendaPlanner
          manualAgendaItems={manualAgendaItems}
          draftManualAgendaItem={draftAgendaItemTitle}
          onDraftManualAgendaItemChange={setDraftAgendaItemTitle}
          onAddManualAgendaItem={addManualAgendaItem}
          onRemoveManualAgendaItem={removeManualAgendaItem}
          onMoveManualAgendaItem={moveManualAgendaItem}
          selectedContextIds={selectedContextIds}
          onSelectedContextIdsChange={setSelectedContextIds}
          contexts={OPEN_CONTEXTS}
          currentMeeting={{ title: meetingTitle, date: meetingDate }}
        />

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
          <MeetingAttendeesPanel
            attendees={attendees}
            attendeeEvents={attendeeEvents}
            onToggleAttendee={toggleAttendeeStatus}
            onAddAttendee={addAttendee}
          />
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
