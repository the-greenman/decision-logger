import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Undo2,
  CheckSquare,
  ExternalLink,
  Home,
  FilePlus2,
  Upload,
  Lightbulb,
  PauseCircle,
  Link2,
  Plus,
  Radio,
  Flag,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  ACTIVE_CONTEXT,
  AGENDA_ITEMS,
  CANDIDATES,
  OPEN_CONTEXTS,
  SUPPLEMENTARY_ITEMS,
  getMockFieldsForTemplate,
} from '@/lib/mock-data';
import { FacilitatorFieldCard } from '@/components/facilitator/FacilitatorFieldCard';
import { CandidateCard } from '@/components/facilitator/CandidateCard';
import { AgendaList } from '@/components/shared/AgendaList';
import { RelationsAccordion } from '@/components/shared/RelationsAccordion';
import { TagPill } from '@/components/shared/TagPill';
import { FieldZoom } from '@/components/facilitator/FieldZoom';
import { RegenerateDialog } from '@/components/facilitator/RegenerateDialog';
import { FinaliseDialog } from '@/components/facilitator/FinaliseDialog';
import { CreateContextDialog } from '@/components/facilitator/CreateContextDialog';
import { ChangeTemplateDialog } from '@/components/facilitator/ChangeTemplateDialog';
import { UploadTranscript } from '@/components/facilitator/UploadTranscript';
import { PromoteCandidateDialog } from '@/components/facilitator/PromoteCandidateDialog';
import { AddExistingContextDialog } from '@/components/facilitator/AddExistingContextDialog';
import { IconButton } from '@/components/ui/IconButton';
import { TabButton } from '@/components/ui/Tabs';
import type {
  AgendaItemStatus,
  DecisionContext,
  Field,
  Candidate,
  SupplementaryItem,
  Template,
  DecisionMethod,
  OpenContextSummary,
  Tag,
  Relation,
  RelationType,
  TagCategory,
} from '@/lib/mock-data';

type AgendaItemModel = {
  id: string;
  title: string;
  status: AgendaItemStatus;
};

type SegmentSelectionPayload = {
  rowIds: string[];
  chunkIds: string[];
};

type CreateContextDraftPayload = {
  title?: string;
  summary?: string;
  relation?: {
    targetId: string;
    targetTitle: string;
    relationType: RelationType;
  };
};

type StreamState = 'idle' | 'connecting' | 'live' | 'stopped';
type RelatedMeeting = {
  id: string;
  title: string;
  date: string;
};
type SuggestedTag = {
  id: string;
  name: string;
  category: TagCategory;
  reason: string;
};

type ModalState =
  | null
  | { type: 'regenerate' }
  | { type: 'finalise' }
  | { type: 'create-context' }
  | { type: 'change-template' }
  | { type: 'upload' }
  | { type: 'promote'; candidateId: string }
  | { type: 'add-existing-context' }
  | { type: 'add-relation-context' }
  | { type: 'flag-later' };

const RELATION_TYPES: RelationType[] = ['related', 'blocks', 'blocked_by', 'supersedes', 'superseded_by'];
const TAG_CATEGORIES: TagCategory[] = ['topic', 'team', 'project'];

const MOCK_LLM_LOG = [
  { id: 'llm-1', at: '14:12', model: 'claude-opus-4-5', action: 'generate draft', note: 'Initial context generation pass.' },
  { id: 'llm-2', at: '14:24', model: 'claude-opus-4-5', action: 'regenerate options', note: 'Applied facilitator focus note.' },
  { id: 'llm-3', at: '14:31', model: 'claude-opus-4-5', action: 'regenerate rationale', note: 'Incorporated supplementary evidence.' },
];

const SUGGESTED_TAG_SEEDS: Array<Pick<SuggestedTag, 'name' | 'category' | 'reason'>> = [
  { name: 'timeline risk', category: 'topic', reason: 'Repeated delivery date references.' },
  { name: 'architecture', category: 'topic', reason: 'Core platform trade-offs were discussed.' },
  { name: 'finance committee', category: 'team', reason: 'Ownership and follow-up were assigned.' },
  { name: 'Q4 planning', category: 'project', reason: 'Discussion linked to current quarter planning.' },
  { name: 'dependencies', category: 'topic', reason: 'External blockers affected the decision path.' },
];

export function FacilitatorMeetingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeContext, setActiveContext] = useState<DecisionContext>(ACTIVE_CONTEXT);
  const [fields, setFields] = useState<Field[]>(ACTIVE_CONTEXT.fields);
  const [candidates, setCandidates] = useState<Candidate[]>(CANDIDATES);
  const [agendaItems, setAgendaItems] = useState<AgendaItemModel[]>(AGENDA_ITEMS);
  const [deferredItems, setDeferredItems] = useState<AgendaItemModel[]>([]);
  const [relatedMeetings, setRelatedMeetings] = useState<RelatedMeeting[]>([]);
  const [createContextDraft, setCreateContextDraft] = useState<CreateContextDraftPayload | null>(null);
  const [leftTab, setLeftTab] = useState<'candidates' | 'agenda'>('candidates');
  const [zoomedFieldId, setZoomedFieldId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [supplementary, setSupplementary] = useState<SupplementaryItem[]>(SUPPLEMENTARY_ITEMS);
  const [finalised, setFinalised] = useState(false);
  const [transcriptUploaded, setTranscriptUploaded] = useState(false);
  const [selectionToast, setSelectionToast] = useState<{ rows: number; chunks: number } | null>(null);
  const [contextSegmentRowCount, setContextSegmentRowCount] = useState(0);

  const [tagInput, setTagInput] = useState('');
  const [tagCategory, setTagCategory] = useState<TagCategory>('topic');
  const [relationType, setRelationType] = useState<RelationType>('related');

  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [newRowsSinceGeneration, setNewRowsSinceGeneration] = useState(0);

  const [flagLaterTitle, setFlagLaterTitle] = useState('');
  const [showLLMLog, setShowLLMLog] = useState(false);
  const [llmLog, setLlmLog] = useState(MOCK_LLM_LOG);
  const [leftPanelWidth, setLeftPanelWidth] = useState(288);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [dragState, setDragState] = useState<null | {
    side: 'left' | 'right';
    startX: number;
    startWidth: number;
  }>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(ACTIVE_CONTEXT.title);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(ACTIVE_CONTEXT.summary);
  const [suggestedTags, setSuggestedTags] = useState<SuggestedTag[]>([
    {
      id: 'st-1',
      name: 'Q4 planning',
      category: 'project',
      reason: 'The initial draft emphasized Q4 planning constraints.',
    },
    {
      id: 'st-2',
      name: 'architecture',
      category: 'topic',
      reason: 'The draft linked several points to architecture direction.',
    },
  ]);

  const activeCandidates = candidates.filter((c) => c.status === 'new');
  const isClosedContext = activeContext.status === 'logged';
  const unlockedCount = fields.filter((f) => f.status !== 'locked').length;
  const zoomedField = zoomedFieldId ? fields.find((f) => f.id === zoomedFieldId) ?? null : null;

  const promoteCandidate =
    modal?.type === 'promote' ? candidates.find((candidate) => candidate.id === modal.candidateId) ?? null : null;
  const currentMeeting = { id: 'mtg-1', title: 'Q4 Architecture Review', date: '2026-03-08' };
  const meetingFocusKey = `dl:meeting-focus:${currentMeeting.id}`;
  const meetingFieldKey = `dl:meeting-fields:${currentMeeting.id}`;
  const leftPanelWidthKey = `dl:fac:left-width:${currentMeeting.id}`;
  const rightPanelWidthKey = `dl:fac:right-width:${currentMeeting.id}`;
  const leftPanelCollapsedKey = `dl:fac:left-collapsed:${currentMeeting.id}`;
  const rightPanelCollapsedKey = `dl:fac:right-collapsed:${currentMeeting.id}`;

  const streamBadgeClass = useMemo(() => {
    if (streamState === 'live') return 'bg-settled';
    if (streamState === 'connecting') return 'bg-caution';
    if (streamState === 'stopped') return 'bg-danger';
    return 'bg-text-muted';
  }, [streamState]);

  useEffect(() => {
    if (!dragState) return;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - dragState.startX;

      if (dragState.side === 'left') {
        setLeftPanelWidth(clamp(dragState.startWidth + delta, 240, 460));
        return;
      }

      setRightPanelWidth(clamp(dragState.startWidth - delta, 260, 520));
    };

    const handleMouseUp = () => setDragState(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState]);

  useEffect(() => {
    try {
      const savedLeftWidth = Number(localStorage.getItem(leftPanelWidthKey));
      const savedRightWidth = Number(localStorage.getItem(rightPanelWidthKey));
      const savedLeftCollapsed = localStorage.getItem(leftPanelCollapsedKey);
      const savedRightCollapsed = localStorage.getItem(rightPanelCollapsedKey);

      if (!Number.isNaN(savedLeftWidth) && savedLeftWidth > 0) setLeftPanelWidth(savedLeftWidth);
      if (!Number.isNaN(savedRightWidth) && savedRightWidth > 0) setRightPanelWidth(savedRightWidth);
      if (savedLeftCollapsed === 'true') setLeftPanelCollapsed(true);
      if (savedRightCollapsed === 'true') setRightPanelCollapsed(true);
    } catch {
      // noop for prototype safety
    }
  }, [leftPanelCollapsedKey, leftPanelWidthKey, rightPanelCollapsedKey, rightPanelWidthKey]);

  useEffect(() => {
    try {
      localStorage.setItem(leftPanelWidthKey, String(leftPanelWidth));
      localStorage.setItem(rightPanelWidthKey, String(rightPanelWidth));
      localStorage.setItem(leftPanelCollapsedKey, String(leftPanelCollapsed));
      localStorage.setItem(rightPanelCollapsedKey, String(rightPanelCollapsed));
    } catch {
      // noop for prototype safety
    }
  }, [
    leftPanelCollapsed,
    leftPanelCollapsedKey,
    leftPanelWidth,
    leftPanelWidthKey,
    rightPanelCollapsed,
    rightPanelCollapsedKey,
    rightPanelWidth,
    rightPanelWidthKey,
  ]);

  // ── Process segment selection returned from transcript page ───────

  useEffect(() => {
    const state = location.state as { segmentSelection?: SegmentSelectionPayload } | null;
    if (!state?.segmentSelection) return;

    const { rowIds, chunkIds } = state.segmentSelection;
    setContextSegmentRowCount((prev) => prev + rowIds.length);
    setSelectionToast({ rows: rowIds.length, chunks: chunkIds.length });

    const timer = setTimeout(() => setSelectionToast(null), 3200);
    navigate(location.pathname, { replace: true, state: null });

    return () => clearTimeout(timer);
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const state = location.state as { createContextDraft?: CreateContextDraftPayload } | null;
    if (!state?.createContextDraft) return;

    setCreateContextDraft(state.createContextDraft);
    setModal({ type: 'create-context' });
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  // ── Simulate stream rows arriving while live ──────────────────────

  useEffect(() => {
    if (streamState !== 'live') return;

    const timer = setInterval(() => {
      setNewRowsSinceGeneration((prev) => prev + Math.floor(Math.random() * 3) + 1);
    }, 4500);

    return () => clearInterval(timer);
  }, [streamState]);

  // ── Broadcast focused field for shared-display sync ──────────────
  useEffect(() => {
    try {
      localStorage.setItem(
        meetingFocusKey,
        JSON.stringify({
          meetingId: currentMeeting.id,
          fieldId: zoomedFieldId,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // noop for prototype safety
    }
  }, [currentMeeting.id, meetingFocusKey, zoomedFieldId]);

  // ── Broadcast field values for shared-display sync ───────────────
  useEffect(() => {
    try {
      localStorage.setItem(
        meetingFieldKey,
        JSON.stringify({
          meetingId: currentMeeting.id,
          fields,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // noop for prototype safety
    }
  }, [currentMeeting.id, fields, meetingFieldKey]);

  // ── Field mutations ────────────────────────────────────────────────

  function updateField(id: string, patch: Partial<Field>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function handleLock(id: string) {
    if (isClosedContext) return;
    updateField(id, { status: 'locked' });
  }

  function handleUnlock(id: string) {
    if (isClosedContext) return;
    updateField(id, { status: 'idle' });
  }

  function handleSaveFieldValue(id: string, value: string) {
    if (isClosedContext) return;
    updateField(id, { value });
  }

  function handleGuidanceChange(id: string, guidance: string) {
    if (isClosedContext) return;
    updateField(id, { guidance });
  }

  function handleRegenerateSingleField(fieldId: string) {
    if (isClosedContext) return;
    updateField(fieldId, { status: 'generating' });

    setTimeout(() => {
      setFields((prev) =>
        prev.map((f) =>
          f.id !== fieldId || f.status === 'locked'
            ? f
            : {
                ...f,
                status: 'idle',
                value: f.value || `[Regenerated field] Updated content for ${f.label}.`,
              },
        ),
      );
    }, 1200);
  }

  // ── Candidate mutations ───────────────────────────────────────────

  function handleDismiss(id: string) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'dismissed' as const } : c)));
  }

  function handleAddFlagForLater() {
    if (!flagLaterTitle.trim()) return;

    const newCandidate: Candidate = {
      id: `cand-${Date.now()}`,
      title: flagLaterTitle.trim(),
      summary: 'Captured quickly for later review.',
      status: 'new',
      detectedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };

    setCandidates((prev) => [newCandidate, ...prev]);
    setFlagLaterTitle('');
    setLeftTab('candidates');
    setModal(null);
  }

  function handlePromoteConfirm(payload: {
    title: string;
    summary: string;
    template: Template;
    insertMode: 'append' | 'before';
    beforeIndex: number;
  }) {
    if (!promoteCandidate) return;

    const promotedContextId = `ctx-${Date.now()}`;
    const promotedItem: AgendaItemModel = {
      id: promotedContextId,
      title: payload.title,
      status: 'active',
    };

    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === promoteCandidate.id ? { ...candidate, status: 'dismissed' as const } : candidate,
      ),
    );

    setAgendaItems((prev) => {
      const demoted = prev.map((item) =>
        item.status === 'active' ? { ...item, status: 'drafted' as const } : item,
      );

      const next = [...demoted];
      const insertAt =
        payload.insertMode === 'append'
          ? next.length
          : Math.max(0, Math.min(next.length, payload.beforeIndex - 1));

      next.splice(insertAt, 0, promotedItem);
      return next;
    });

    const newFields = getMockFieldsForTemplate(payload.template.name);
    setFields(newFields);
    setActiveContext({
      ...ACTIVE_CONTEXT,
      id: promotedContextId,
      title: payload.title,
      summary: payload.summary,
      templateName: payload.template.name,
      status: 'active',
      fields: newFields,
      tags: [],
      relations: [],
    });
    refreshSuggestedTagsFromDraft({
      title: payload.title,
      summary: payload.summary,
      focus: 'initial draft',
      acceptedTags: [],
    });

    setLeftTab('agenda');
    setModal(null);
  }

  // ── Tag + relation mutations ──────────────────────────────────────

  function handleAddTag() {
    if (isClosedContext) return;
    const name = tagInput.trim();
    if (!name) return;
    const lower = name.toLowerCase();

    const exists = activeContext.tags.some((tag) => tag.name.toLowerCase() === lower);
    if (exists) {
      setTagInput('');
      return;
    }

    const tag: Tag = {
      id: `tag-${Date.now()}`,
      name,
      category: tagCategory,
    };

    setActiveContext((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    setTagInput('');
  }

  function handleRemoveTag(tagId: string) {
    if (isClosedContext) return;
    setActiveContext((prev) => ({ ...prev, tags: prev.tags.filter((tag) => tag.id !== tagId) }));
  }

  function handleRemoveRelation(relationId: string) {
    if (isClosedContext) return;
    setActiveContext((prev) => ({
      ...prev,
      relations: prev.relations.filter((relation) => relation.id !== relationId),
    }));
  }

  function refreshSuggestedTagsFromDraft(params: {
    title: string;
    summary: string;
    focus?: string;
    acceptedTags?: Tag[];
  }) {
    const accepted = params.acceptedTags ?? activeContext.tags;
    const existingAccepted = new Set(accepted.map((tag) => tag.name.toLowerCase()));
    const focusText = `${params.title} ${params.summary} ${params.focus ?? ''}`.toLowerCase();
    const ranked = [...SUGGESTED_TAG_SEEDS].sort((a, b) => {
      const aScore = focusText.includes(a.name.toLowerCase()) ? 1 : 0;
      const bScore = focusText.includes(b.name.toLowerCase()) ? 1 : 0;
      return bScore - aScore;
    });

    const next = ranked
      .filter((tag) => !existingAccepted.has(tag.name.toLowerCase()))
      .slice(0, 3)
      .map((tag) => ({ ...tag, id: `st-${Date.now()}-${tag.name.replace(/\s+/g, '-')}` }));

    setLlmLog((prev) => [
      {
        id: `llm-${Date.now()}`,
        at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        model: 'claude-opus-4-5',
        action: 'suggest tags',
        note:
          next.length > 0
            ? `Generated ${next.length} facilitator-review tags and replaced pending suggestions.`
            : 'No new tag suggestions generated; accepted tags already cover current draft.',
      },
      ...prev,
    ]);

    // Regeneration refreshes pending suggestions only. Accepted tags stay on the context.
    setSuggestedTags(next);
  }

  function handleApproveSuggestedTag(suggestedTagId: string) {
    if (isClosedContext) return;
    const match = suggestedTags.find((tag) => tag.id === suggestedTagId);
    if (!match) return;

    const exists = activeContext.tags.some((tag) => tag.name.toLowerCase() === match.name.toLowerCase());
    if (!exists) {
      const tag: Tag = {
        id: `tag-${Date.now()}`,
        name: match.name,
        category: match.category,
      };
      setActiveContext((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }

    setSuggestedTags((prev) => prev.filter((tag) => tag.id !== suggestedTagId));
  }

  function handleDismissSuggestedTag(suggestedTagId: string) {
    if (isClosedContext) return;
    setSuggestedTags((prev) => prev.filter((tag) => tag.id !== suggestedTagId));
  }

  function handleStartTitleEdit() {
    if (isClosedContext) return;
    setTitleDraft(activeContext.title);
    setEditingTitle(true);
  }

  function handleCancelTitleEdit() {
    setTitleDraft(activeContext.title);
    setEditingTitle(false);
  }

  function handleSaveTitleEdit() {
    if (isClosedContext) return;
    const next = titleDraft.trim();
    if (!next) return;
    setActiveContext((prev) => ({ ...prev, title: next }));
    setAgendaItems((prev) => prev.map((item) => (item.id === activeContext.id ? { ...item, title: next } : item)));
    setEditingTitle(false);
  }

  function handleStartSummaryEdit() {
    if (isClosedContext) return;
    setSummaryDraft(activeContext.summary);
    setEditingSummary(true);
  }

  function handleCancelSummaryEdit() {
    setSummaryDraft(activeContext.summary);
    setEditingSummary(false);
  }

  function handleSaveSummaryEdit() {
    if (isClosedContext) return;
    const next = summaryDraft.trim();
    if (!next) return;
    setActiveContext((prev) => ({ ...prev, summary: next }));
    setEditingSummary(false);
  }

  function ensureMeetingRelation(context: OpenContextSummary) {
    const isCrossMeeting =
      context.sourceMeetingDate !== currentMeeting.date || context.sourceMeetingTitle !== currentMeeting.title;
    if (!isCrossMeeting) return;

    setRelatedMeetings((prev) => {
      const exists = prev.some((meeting) => meeting.title === context.sourceMeetingTitle && meeting.date === context.sourceMeetingDate);
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `rel-mtg-${Date.now()}`,
          title: context.sourceMeetingTitle,
          date: context.sourceMeetingDate,
        },
      ];
    });

    setActiveContext((prev) => {
      const relationLabel = `Meeting: ${context.sourceMeetingTitle} (${context.sourceMeetingDate})`;
      const exists = prev.relations.some(
        (rel) => rel.relationType === 'related' && rel.targetTitle === relationLabel,
      );
      if (exists) return prev;
      return {
        ...prev,
        relations: [
          ...prev.relations,
          {
            id: `rel-${Date.now()}`,
            targetTitle: relationLabel,
            targetId: `meeting-${context.sourceMeetingDate}`,
            relationType: 'related',
          },
        ],
      };
    });
  }

  function handleAddRelationFromContext(context: OpenContextSummary) {
    if (isClosedContext) return;
    ensureMeetingRelation(context);

    const relation: Relation = {
      id: `rel-${Date.now()}`,
      targetTitle: context.title,
      targetId: context.id,
      relationType,
    };

    setActiveContext((prev) => {
      const exists = prev.relations.some((rel) => rel.targetId === context.id && rel.relationType === relationType);
      if (exists) return prev;
      return { ...prev, relations: [...prev.relations, relation] };
    });

    setModal(null);
  }

  // ── Supplementary content ────────────────────────────────────────

  function handleAddSupplementary(item: Omit<SupplementaryItem, 'id' | 'createdAt'>) {
    const newItem: SupplementaryItem = {
      ...item,
      id: `sc-${Date.now()}`,
      createdAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
    setSupplementary((prev) => [...prev, newItem]);
  }

  function handleRemoveSupplementary(id: string) {
    setSupplementary((prev) => prev.filter((s) => s.id !== id));
  }

  // ── Context / agenda actions ─────────────────────────────────────

  function handleDeferActiveContext() {
    if (isClosedContext) return;
    const target = agendaItems.find((item) => item.id === activeContext.id);
    if (!target) return;

    const deferredItem: AgendaItemModel = { ...target, status: 'deferred' };
    const remaining = agendaItems.filter((item) => item.id !== activeContext.id);

    const normalized = remaining.map((item, idx) =>
      idx === 0 ? { ...item, status: 'active' as const } : item.status === 'active' ? { ...item, status: 'drafted' as const } : item,
    );

    setDeferredItems((prev) => [...prev, deferredItem]);
    setAgendaItems(normalized);

    const nextActive = normalized.find((item) => item.status === 'active') ?? normalized[0] ?? null;

    if (nextActive) {
      setActiveContext((prev) => ({
        ...prev,
        id: nextActive.id,
        title: nextActive.title,
        summary: `Continued discussion context for ${nextActive.title}.`,
        status: nextActive.status,
      }));
    }

    setLeftTab('agenda');
  }

  function handleAddExistingContext(context: OpenContextSummary) {
    ensureMeetingRelation(context);

    const exists =
      agendaItems.some((item) => item.id === context.id) || deferredItems.some((item) => item.id === context.id);

    if (!exists) {
      setAgendaItems((prev) => [...prev, { id: context.id, title: context.title, status: 'pending' }]);
    }

    setLeftTab('agenda');
    setModal(null);
  }

  function handleReturnDeferredContext(contextId: string) {
    const target = deferredItems.find((item) => item.id === contextId);
    if (!target) return;

    setDeferredItems((prev) => prev.filter((item) => item.id !== contextId));

    const hasActiveAgendaItem = agendaItems.some((item) => item.status === 'active');
    const nextStatus: AgendaItemStatus = hasActiveAgendaItem ? 'pending' : 'active';

    setAgendaItems((prev) => {
      if (prev.some((item) => item.id === contextId)) return prev;
      return [...prev, { ...target, status: nextStatus }];
    });

    if (!hasActiveAgendaItem) {
      setActiveContext((prev) => ({
        ...prev,
        id: target.id,
        title: target.title,
        summary: `Continued discussion context for ${target.title}.`,
        status: 'active',
      }));
      setFinalised(false);
    }

    setLeftTab('agenda');
  }

  function handleSelectAgendaItem(itemId: string) {
    const target = agendaItems.find((item) => item.id === itemId);
    if (!target) return;

    if (target.status !== 'logged') {
      setAgendaItems((prev) =>
        prev.map((item) => {
          if (item.id === target.id) return { ...item, status: 'active' as const };
          if (item.status === 'active') return { ...item, status: 'drafted' as const };
          return item;
        }),
      );
    }

    setActiveContext((prev) => ({
      ...prev,
      id: target.id,
      title: target.title,
      summary:
        target.status === 'logged'
          ? `Reviewing logged decision context for ${target.title}.`
          : `Active discussion context for ${target.title}.`,
      status: target.status === 'logged' ? 'logged' : 'active',
    }));

    setFinalised(target.status === 'logged');
    setLeftTab('agenda');
  }

  function handleSelectDeferredItem(itemId: string) {
    const target = deferredItems.find((item) => item.id === itemId);
    if (!target) return;

    setActiveContext((prev) => ({
      ...prev,
      id: target.id,
      title: target.title,
      summary: `Deferred context review for ${target.title}.`,
      status: 'deferred',
    }));
    setFinalised(false);
    setLeftTab('agenda');
  }

  function handleMoveAgendaItem(itemId: string, direction: 'up' | 'down') {
    setAgendaItems((prev) => {
      const movable = prev
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.status !== 'logged');

      const current = movable.findIndex(({ item }) => item.id === itemId);
      if (current === -1) return prev;

      const target = direction === 'up' ? current - 1 : current + 1;
      if (target < 0 || target >= movable.length) return prev;

      const sourceIndex = movable[current]?.index;
      const targetIndex = movable[target]?.index;
      if (sourceIndex === undefined || targetIndex === undefined) return prev;

      const next = [...prev];
      [next[sourceIndex], next[targetIndex]] = [next[targetIndex]!, next[sourceIndex]!];
      return next;
    });
  }

  function openCreateContextDialog() {
    if (isClosedContext) {
      setCreateContextDraft({
        title: `Follow-up: ${activeContext.title}`,
        summary: `Follow-up context linked to closed decision \"${activeContext.title}\".`,
        relation: {
          targetId: activeContext.id,
          targetTitle: activeContext.title,
          relationType: 'related',
        },
      });
    } else {
      setCreateContextDraft(null);
    }
    setModal({ type: 'create-context' });
  }

  // ── Stream actions ────────────────────────────────────────────────

  function handleToggleStream() {
    if (streamState === 'live') {
      setStreamState('stopped');
      return;
    }

    setStreamState('connecting');
    setTimeout(() => setStreamState('live'), 700);
  }

  // ── Regenerate ───────────────────────────────────────────────────

  function handleRegenerate(focus: string) {
    if (isClosedContext) return;
    setModal(null);
    setNewRowsSinceGeneration(0);

    setFields((prev) => prev.map((f) => (f.status === 'locked' ? f : { ...f, status: 'generating' })));

    setTimeout(() => {
      setFields((prev) =>
        prev.map((f) =>
          f.status === 'generating'
            ? {
                ...f,
                status: 'idle',
                value: f.value || `[Regenerated${focus ? ` — focus: "${focus}"` : ''}] Sample content for ${f.label}.`,
              }
            : f,
        ),
      );
      refreshSuggestedTagsFromDraft({
        title: activeContext.title,
        summary: activeContext.summary,
        focus,
      });
    }, 2000);
  }

  // ── Finalise ─────────────────────────────────────────────────────

  function handleFinalise(_method: DecisionMethod, _actors: string[], _loggedBy: string) {
    if (isClosedContext) return;
    setModal(null);
    const currentContextId = activeContext.id;
    const nextAgendaItem = agendaItems.find(
      (item) => item.id !== currentContextId && item.status !== 'logged' && item.status !== 'deferred',
    );

    setAgendaItems((prev) =>
      prev.map((item) => {
        if (item.id === currentContextId) return { ...item, status: 'logged' as const };
        if (nextAgendaItem && item.id === nextAgendaItem.id) return { ...item, status: 'active' as const };
        if (item.id !== currentContextId && item.status === 'active') return { ...item, status: 'drafted' as const };
        return item;
      }),
    );

    if (nextAgendaItem) {
      setActiveContext((prev) => ({
        ...prev,
        id: nextAgendaItem.id,
        title: nextAgendaItem.title,
        summary: `Continued discussion context for ${nextAgendaItem.title}.`,
        status: 'active',
      }));
      setFinalised(false);
      setLeftTab('agenda');
      return;
    }

    setFinalised(true);
    setLeftTab('agenda');
  }

  // ── Create context ───────────────────────────────────────────────

  function handleCreateContext(
    title: string,
    summary: string,
    template: Template,
    relationTypeOverride?: RelationType,
  ) {
    const contextId = `ctx-${Date.now()}`;
    const newItem: AgendaItemModel = { id: contextId, title, status: 'active' };

    setAgendaItems((prev) => {
      const demoted = prev.map((item) =>
        item.status === 'active' ? { ...item, status: 'drafted' as const } : item,
      );
      return [newItem, ...demoted];
    });

    const newFields = getMockFieldsForTemplate(template.name);
    setFields(newFields);
    setActiveContext({
      ...ACTIVE_CONTEXT,
      id: contextId,
      title,
      summary,
      templateName: template.name,
      status: 'active',
      fields: newFields,
      tags: [],
      relations: createContextDraft?.relation
        ? [{
            id: `rel-${Date.now()}`,
            targetId: createContextDraft.relation.targetId,
            targetTitle: createContextDraft.relation.targetTitle,
            relationType: relationTypeOverride ?? createContextDraft.relation.relationType,
          }]
        : [],
    });
    refreshSuggestedTagsFromDraft({
      title,
      summary,
      focus: 'initial draft',
      acceptedTags: [],
    });

    setModal(null);
    setCreateContextDraft(null);
    setLeftTab('agenda');
  }

  function handleChangeTemplate(template: Template, nextFields: Field[]) {
    if (isClosedContext) return;

    setFields(nextFields);
    setActiveContext((prev) => ({
      ...prev,
      templateName: template.name,
      fields: nextFields,
    }));
    setZoomedFieldId(null);
    setModal(null);
  }

  // ── Upload transcript ────────────────────────────────────────────

  function handleUploadComplete(_filename: string, _rowCount: number) {
    setModal(null);
    setTranscriptUploaded(true);
    setLeftTab('candidates');
  }

  // ── Field zoom ───────────────────────────────────────────────────

  if (zoomedField) {
    return (
      <FieldZoom
        field={zoomedField}
        supplementaryItems={supplementary}
        meetingId="mtg-1"
        contextId={activeContext.id}
        onClose={() => setZoomedFieldId(null)}
        onSave={handleSaveFieldValue}
        onRegenerate={handleRegenerateSingleField}
        onLock={handleLock}
        onUnlock={handleUnlock}
        onGuidanceChange={handleGuidanceChange}
        onAddSupplementary={handleAddSupplementary}
        onRemoveSupplementary={handleRemoveSupplementary}
      />
    );
  }

  const movableAgendaIds = agendaItems.filter((item) => item.status !== 'logged').map((item) => item.id);

  return (
    <div className="density-facilitator min-h-screen bg-base flex flex-col relative">
      {selectionToast && (
        <div className="absolute right-4 top-16 z-30 px-3 py-2 rounded-card border border-settled/40 bg-settled-dim/20 text-fac-meta text-text-primary">
          Added {selectionToast.rows} transcript rows ({selectionToast.chunks} chunks) to this context.
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────── */}
      {modal?.type === 'regenerate' && (
        <RegenerateDialog
          unlockedCount={unlockedCount}
          onConfirm={handleRegenerate}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'finalise' && (
        <FinaliseDialog
          participants={['Alice Chen', 'Bob Marsh', 'Priya Nair']}
          onConfirm={handleFinalise}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'create-context' && (
        <CreateContextDialog
          onConfirm={handleCreateContext}
          onCancel={() => {
            setModal(null);
            setCreateContextDraft(null);
          }}
          initialTitle={createContextDraft?.title}
          initialSummary={createContextDraft?.summary}
          relationTargetTitle={createContextDraft?.relation?.targetTitle}
          initialRelationType={createContextDraft?.relation?.relationType}
        />
      )}
      {modal?.type === 'change-template' && (
        <ChangeTemplateDialog
          currentTemplateName={activeContext.templateName}
          currentFields={fields}
          onConfirm={handleChangeTemplate}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'promote' && promoteCandidate && (
        <PromoteCandidateDialog
          candidate={promoteCandidate}
          agendaTitles={agendaItems.map((item) => item.title)}
          onConfirm={handlePromoteConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'add-existing-context' && (
        <AddExistingContextDialog
          contexts={OPEN_CONTEXTS}
          currentMeeting={{ title: currentMeeting.title, date: currentMeeting.date }}
          onConfirm={handleAddExistingContext}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'add-relation-context' && (
        <AddExistingContextDialog
          contexts={OPEN_CONTEXTS}
          currentMeeting={{ title: currentMeeting.title, date: currentMeeting.date }}
          onConfirm={handleAddRelationFromContext}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'flag-later' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-border rounded-card shadow-xl p-5 flex flex-col gap-3">
            <h2 className="text-fac-field text-text-primary font-medium">Flag for later</h2>
            <input
              type="text"
              value={flagLaterTitle}
              onChange={(e) => setFlagLaterTitle(e.target.value)}
              placeholder="Decision title"
              className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFlagForLater}
                disabled={!flagLaterTitle.trim()}
                className="px-4 py-2 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header strip ────────────────────────────────────────── */}
      <header className="border-b border-border px-4 py-3 flex flex-wrap items-center gap-1.5 shrink-0">
        <span className="text-fac-field text-text-primary font-medium flex-1 truncate">
          Q4 Architecture Review — Facilitator
          {finalised && <span className="ml-2 text-settled text-fac-meta">✓ Logged</span>}
        </span>

        <Link
          to="/meetings/mtg-1"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
          title="Open shared view"
        >
          <ExternalLink size={13} />
          <span className="hidden xl:inline">Shared view</span>
        </Link>
        <Link
          to="/meetings/mtg-1/facilitator/home"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
          title="Open meeting home"
        >
          <Home size={13} />
          <span className="hidden xl:inline">Meeting home</span>
        </Link>

        <button
          onClick={handleToggleStream}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
          title={streamState === 'live' ? 'Stop stream' : 'Start stream'}
          aria-label={streamState === 'live' ? 'Stop stream' : 'Start stream'}
        >
          <Radio size={13} />
          <span className="hidden xl:inline">{streamState === 'live' ? 'Stop stream' : 'Start stream'}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${streamBadgeClass}`} />
        </button>

        <button
          onClick={() => setModal({ type: 'upload' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
          title="Upload transcript"
          aria-label="Upload transcript"
        >
          <Upload size={13} />
          <span className="hidden xl:inline">Upload transcript</span>
          {transcriptUploaded && <span className="w-1.5 h-1.5 rounded-full bg-settled" />}
        </button>

        <button
          onClick={() => setModal({ type: 'flag-later' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
          title="Flag for later"
          aria-label="Flag for later"
        >
          <Flag size={13} />
          <span className="hidden xl:inline">Flag for later</span>
        </button>

        <button
          onClick={openCreateContextDialog}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
          title="New decision"
          aria-label="New decision"
        >
          <FilePlus2 size={13} />
          <span className="hidden xl:inline">New decision</span>
        </button>

        <button
          onClick={() => setModal({ type: 'regenerate' })}
          disabled={unlockedCount === 0 || isClosedContext}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors disabled:opacity-30"
          title="Regenerate"
          aria-label="Regenerate"
        >
          <RefreshCw size={13} />
          <span className="hidden xl:inline">Regenerate</span>
          {newRowsSinceGeneration > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-badge bg-caution-dim text-caution border border-caution/30">
              {newRowsSinceGeneration} new
            </span>
          )}
        </button>

        <button
          onClick={handleDeferActiveContext}
          disabled={isClosedContext}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-caution hover:text-caution border border-caution/30 rounded transition-colors disabled:opacity-30"
          title="Defer"
          aria-label="Defer"
        >
          <PauseCircle size={13} />
          <span className="hidden xl:inline">Defer</span>
        </button>

        <button
          onClick={() => setModal({ type: 'finalise' })}
          disabled={isClosedContext}
          className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta bg-settled text-base rounded font-medium hover:bg-settled/90 transition-colors disabled:opacity-30"
          title="Finalise"
          aria-label="Finalise"
        >
          <CheckSquare size={13} />
          <span className="hidden xl:inline">Finalise</span>
        </button>
      </header>

      {/* ── Upload inline panel (if modal type upload) ───────────── */}
      {modal?.type === 'upload' && (
        <div className="px-4 py-3 border-b border-border">
          <UploadTranscript
            onComplete={handleUploadComplete}
            onCancel={() => setModal(null)}
          />
        </div>
      )}

      <div className="flex flex-1 min-h-0">

        {/* ── Left panel ──────────────────────────────────────────── */}
        {!leftPanelCollapsed ? (
          <aside
            className="shrink-0 border-r border-border flex flex-col bg-surface"
            style={{ width: `${leftPanelWidth}px` }}
          >
          <div className="flex border-b border-border">
            <TabButton active={leftTab === 'candidates'} onClick={() => setLeftTab('candidates')}>
              Suggested
              {activeCandidates.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-caution text-base font-bold">
                  {activeCandidates.length}
                </span>
              )}
            </TabButton>
            <TabButton active={leftTab === 'agenda'} onClick={() => setLeftTab('agenda')}>
              Agenda
            </TabButton>
            <button
              onClick={() => setLeftPanelCollapsed(true)}
              className="shrink-0 px-2 text-text-muted hover:text-text-primary border-l border-border"
              aria-label="Collapse agenda sidebar"
              title="Collapse agenda sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {leftTab === 'candidates' ? (
              <div className="flex flex-col gap-2">
                {activeCandidates.length === 0 ? (
                  <p className="text-fac-meta text-text-muted px-2 py-6 text-center">
                    {transcriptUploaded
                      ? 'All candidates reviewed.'
                      : 'Upload a transcript to detect candidates.'}
                  </p>
                ) : (
                  activeCandidates.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      onDismiss={handleDismiss}
                      onPromote={(id) => setModal({ type: 'promote', candidateId: id })}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-fac-meta text-text-muted px-2">
                  Click an agenda item to review or jump ahead. Reorder non-finalised items with arrows.
                </p>
                <AgendaList
                  items={agendaItems}
                  activeId={activeContext.id}
                  onSelectItem={handleSelectAgendaItem}
                  renderItemActions={(item) => {
                    if (item.status === 'logged') return null;

                    const index = movableAgendaIds.indexOf(item.id);
                    const canMoveUp = index > 0;
                    const canMoveDown = index >= 0 && index < movableAgendaIds.length - 1;

                    return (
                      <>
                        <IconButton
                          onClick={() => handleMoveAgendaItem(item.id, 'up')}
                          disabled={!canMoveUp}
                          className="w-7 h-7"
                          aria-label={`Move ${item.title} up`}
                        >
                          <ArrowUp size={12} />
                        </IconButton>
                        <IconButton
                          onClick={() => handleMoveAgendaItem(item.id, 'down')}
                          disabled={!canMoveDown}
                          className="w-7 h-7"
                          aria-label={`Move ${item.title} down`}
                        >
                          <ArrowDown size={12} />
                        </IconButton>
                      </>
                    );
                  }}
                />

                {deferredItems.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border">
                    <p className="text-fac-label text-text-muted uppercase tracking-wider px-2 pb-1">Deferred</p>
                    <AgendaList
                      items={deferredItems.map((item) => ({ ...item, status: 'deferred' as const }))}
                      activeId={activeContext.status === 'deferred' ? activeContext.id : undefined}
                      onSelectItem={handleSelectDeferredItem}
                      renderItemActions={(item) => (
                        <IconButton
                          onClick={() => handleReturnDeferredContext(item.id)}
                          className="w-7 h-7"
                          aria-label={`Return ${item.title} to agenda`}
                        >
                          <Undo2 size={12} />
                        </IconButton>
                      )}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-border flex flex-col gap-1.5">
                <button
                  onClick={() => setModal({ type: 'add-existing-context' })}
                  className="flex items-center gap-2 px-3 py-2 rounded text-fac-meta text-text-muted hover:text-text-primary hover:bg-overlay transition-colors w-full"
                >
              <Link2 size={14} />
              Add existing context
            </button>
            <Link
              to="/meetings/mtg-1/facilitator/transcript"
              className="flex items-center gap-2 px-3 py-2 rounded text-fac-meta text-text-muted hover:text-text-primary hover:bg-overlay transition-colors w-full"
            >
              <FilePlus2 size={14} />
              Select transcript segments
              {contextSegmentRowCount > 0 && (
                <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded-badge bg-accent-dim text-accent border border-accent/30">
                  {contextSegmentRowCount}
                </span>
              )}
            </Link>
          </div>
          </aside>
        ) : (
          <div className="w-8 shrink-0 border-r border-border bg-surface flex items-start justify-center pt-2">
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-overlay"
              aria-label="Expand agenda sidebar"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {!leftPanelCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize agenda sidebar"
            onMouseDown={(event) =>
              setDragState({
                side: 'left',
                startX: event.clientX,
                startWidth: leftPanelWidth,
              })}
            className={`w-1.5 shrink-0 cursor-col-resize bg-border/40 hover:bg-accent/40 transition-colors ${
              dragState?.side === 'left' ? 'bg-accent/50' : ''
            }`}
          />
        )}

        {/* ── Main workspace ──────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-5">

          {/* Context header */}
          <div className="mb-5">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="w-full max-w-2xl px-2.5 py-1.5 rounded border border-border bg-overlay text-fac-title text-text-primary focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleSaveTitleEdit}
                      disabled={!titleDraft.trim()}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-settled/40 text-settled hover:bg-settled/10 disabled:opacity-40"
                      aria-label="Save title"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelTitleEdit}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-border text-text-muted hover:text-text-primary"
                      aria-label="Cancel title edit"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-fac-title text-text-primary">{activeContext.title}</h1>
                    <button
                      onClick={handleStartTitleEdit}
                      disabled={isClosedContext}
                      className="inline-flex items-center gap-1 text-fac-meta text-text-muted hover:text-text-primary"
                      aria-label="Edit title"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  </div>
                )}
                {editingSummary ? (
                  <div className="mt-1 flex items-start gap-2">
                    <textarea
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                      rows={3}
                      className="w-full max-w-3xl px-2.5 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent resize-y"
                    />
                    <button
                      onClick={handleSaveSummaryEdit}
                      disabled={!summaryDraft.trim()}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-settled/40 text-settled hover:bg-settled/10 disabled:opacity-40 mt-0.5"
                      aria-label="Save summary"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelSummaryEdit}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-border text-text-muted hover:text-text-primary mt-0.5"
                      aria-label="Cancel summary edit"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-fac-meta text-text-secondary">{activeContext.summary}</p>
                    <button
                      onClick={handleStartSummaryEdit}
                      disabled={isClosedContext}
                      className="inline-flex items-center gap-1 text-fac-meta text-text-muted hover:text-text-primary"
                      aria-label="Edit summary"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <span className="shrink-0 text-fac-meta text-text-muted border border-border px-2 py-0.5 rounded-badge">
                {activeContext.templateName}
              </span>
              {!isClosedContext && (
                <button
                  onClick={() => setModal({ type: 'change-template' })}
                  className="shrink-0 text-fac-meta text-accent hover:text-accent/80"
                >
                  Change template
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 items-center">
              {activeContext.tags.map((tag) => (
                <span key={tag.id} className="inline-flex items-center gap-1">
                  <TagPill name={tag.name} category={tag.category} />
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    disabled={isClosedContext}
                    className="text-[11px] text-text-muted hover:text-danger"
                    aria-label={`Remove ${tag.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-2 rounded-card border border-border bg-overlay/30 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-fac-meta text-text-secondary">LLM suggested tags (review required)</p>
                {suggestedTags.length > 0 && (
                  <button
                    onClick={() => suggestedTags.forEach((tag) => handleApproveSuggestedTag(tag.id))}
                    className="text-fac-meta text-accent hover:text-accent/80"
                  >
                    Approve all
                  </button>
                )}
              </div>
              {suggestedTags.length === 0 ? (
                <p className="text-fac-meta text-text-muted mt-1">No pending suggestions.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-1.5">
                  {suggestedTags.map((tag) => (
                    <div key={tag.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5">
                      <TagPill name={tag.name} category={tag.category} />
                      <span className="text-fac-meta text-text-muted flex-1 truncate">{tag.reason}</span>
                      <button
                        onClick={() => handleApproveSuggestedTag(tag.id)}
                        className="text-fac-meta text-settled hover:text-settled/80"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDismissSuggestedTag(tag.id)}
                        className="text-fac-meta text-danger hover:text-danger/80"
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add tag"
                disabled={isClosedContext}
                className="w-44 px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
              />
              <select
                value={tagCategory}
                onChange={(e) => setTagCategory(e.target.value as TagCategory)}
                disabled={isClosedContext}
                className="px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
              >
                {TAG_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim() || isClosedContext}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-accent/30 text-accent text-fac-meta hover:bg-accent-dim transition-colors disabled:opacity-40"
              >
                <Plus size={12} />
                Add tag
              </button>
            </div>

            {isClosedContext && (
              <div className="mt-3 rounded-card border border-settled/35 bg-settled-dim/20 p-3 flex items-center justify-between gap-3">
                <p className="text-fac-meta text-text-primary">
                  This decision context is closed and read-only. Open a fresh context to continue the meeting.
                </p>
                <button
                  onClick={openCreateContextDialog}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-white text-fac-meta hover:bg-accent/90"
                >
                  <FilePlus2 size={13} />
                  Open fresh context
                </button>
              </div>
            )}

            <div className="mt-3">
              {relatedMeetings.length > 0 && (
                <div className="mb-2">
                  <p className="text-fac-meta text-text-muted">Related meetings</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {relatedMeetings.map((meeting) => (
                      <p key={meeting.id} className="text-fac-meta text-text-secondary">
                        {meeting.date} · {meeting.title}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value as RelationType)}
                  disabled={isClosedContext}
                  className="px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
                >
                  {RELATION_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button
                  onClick={() => setModal({ type: 'add-relation-context' })}
                  disabled={isClosedContext}
                  className="inline-flex items-center gap-1 text-fac-meta text-accent hover:text-accent/80 disabled:opacity-40"
                >
                  <Link2 size={13} />
                  Add relation
                </button>
              </div>

              {activeContext.relations.length > 0 && (
                <RelationsAccordion
                  relations={activeContext.relations}
                  className="mt-2"
                  onRemoveRelation={isClosedContext ? undefined : handleRemoveRelation}
                />
              )}
            </div>
          </div>

          {/* Hint */}
          <div className="flex items-start gap-2 p-3 rounded-card border border-accent/20 bg-accent-dim/10 mb-5">
            <Lightbulb size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-fac-meta text-text-secondary">
              Click the zoom icon on any field to edit content, regenerate the field, add guidance, or paste supplementary evidence.
            </p>
          </div>

          {/* Field cards */}
          <div className="flex flex-col gap-4">
            {fields.map((field) => (
              <FacilitatorFieldCard
                key={field.id}
                field={field}
                onLock={isClosedContext ? undefined : handleLock}
                onUnlock={isClosedContext ? undefined : handleUnlock}
                onZoom={isClosedContext ? undefined : setZoomedFieldId}
                supplementaryCount={
                  supplementary.filter((s) => s.scope === 'field' && s.fieldId === field.id).length
                }
              />
            ))}
          </div>
        </main>

        {!rightPanelCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize LLM log sidebar"
            onMouseDown={(event) =>
              setDragState({
                side: 'right',
                startX: event.clientX,
                startWidth: rightPanelWidth,
              })}
            className={`w-1.5 shrink-0 cursor-col-resize bg-border/40 hover:bg-accent/40 transition-colors ${
              dragState?.side === 'right' ? 'bg-accent/50' : ''
            }`}
          />
        )}

        {!rightPanelCollapsed ? (
          <aside
            className="shrink-0 border-l border-border bg-surface flex flex-col"
            style={{ width: `${rightPanelWidth}px` }}
          >
          <div className="flex items-center border-b border-border">
            <button
              onClick={() => setShowLLMLog((v) => !v)}
              className="flex-1 flex items-center gap-2 px-4 py-3 text-fac-meta text-text-secondary hover:text-text-primary"
            >
              {showLLMLog ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              LLM interaction log
            </button>
            <button
              onClick={() => setRightPanelCollapsed(true)}
              className="shrink-0 px-2 text-text-muted hover:text-text-primary border-l border-border"
              aria-label="Collapse LLM log sidebar"
              title="Collapse LLM log sidebar"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {showLLMLog && (
            <div className="p-3 flex flex-col gap-2 overflow-y-auto">
              {llmLog.map((entry) => (
                <article key={entry.id} className="rounded-card border border-border p-3 bg-overlay/30">
                  <div className="flex items-center justify-between">
                    <span className="text-fac-meta text-text-primary font-medium">{entry.action}</span>
                    <span className="text-fac-meta text-text-muted">{entry.at}</span>
                  </div>
                  <p className="text-fac-meta text-text-muted mt-1">{entry.model}</p>
                  <p className="text-fac-meta text-text-secondary mt-2">{entry.note}</p>
                </article>
              ))}
            </div>
          )}
          </aside>
        ) : (
          <div className="w-8 shrink-0 border-l border-border bg-surface flex items-start justify-center pt-2">
            <button
              onClick={() => setRightPanelCollapsed(false)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-overlay"
              aria-label="Expand LLM log sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
