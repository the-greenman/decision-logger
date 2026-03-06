# Decision Logger v2: Modular Subsystem Architecture

## Overview

The v2 architecture reorganizes the current flat service layer into four discrete subsystems with explicit public interfaces and clear data flow between them. The goal is to make each subsystem independently testable, replaceable, and eventually deployable as a separate process.

No new packages are required immediately. Subsystems live as named subdirectories within `packages/core/src/` with barrel `index.ts` exports that enforce the public API boundary. Extraction to separate packages is deferred until a concrete cross-process deployment need arises (e.g. standalone detection worker, separate MCP server).

This document defines a **directional target**, not a frozen implementation contract. During v1 completion, prioritize seam creation and decoupling over perfect subsystem shape.

### v1 Compatibility Guardrails

- v2 work must not block v1 milestone completion or working end-to-end workflows.
- Interface seams should be introduced incrementally with behavior parity tests.
- Keep public interfaces extensible where transcript processing may evolve (multiple chunking pipelines, graph relations, richer tagging/annotation models).
- Defer hard package extraction and cross-process deployment until there is an operational need.

---

## The Four Subsystems

### 1. Transcript Manager

**Responsibility**: All transcript data from raw upload through chunked retrieval and context windowing.

The key abstraction is `Timestream` — a queryable, subscribable view over transcript artifacts for a meeting. In early versions this can remain chunk-sequence oriented; later it may incorporate multiple chunking pipelines, graph edges, semantic annotations, and derived projections.

**Public interface**:

```typescript
interface ITranscriptManager {
  // Ingestion
  uploadTranscript(data: TranscriptUploadData): Promise<RawTranscript>
  processTranscript(rawId: string, options: ChunkCreationOptions): Promise<TranscriptChunk[]>
  processTranscriptWithPipeline(
    rawId: string,
    pipelineId: string,
    options: ChunkCreationOptions
  ): Promise<TranscriptChunk[]>
  addStreamEvent(meetingId: string, event: StreamEventData): Promise<void>
  flushStream(meetingId: string): Promise<TranscriptChunk[]>

  // Timestream access
  getTimestream(meetingId: string): Promise<Timestream>

  // Search
  searchChunks(meetingId: string, query: string): Promise<TranscriptChunk[]>

  // Context windowing (called by Decision Log Generator)
  buildContextWindow(
    decisionContextId: string,
    strategy: string, // e.g. recent|relevant|weighted, extensible
    usedFor: 'draft' | 'regenerate' | 'field-specific'
  ): Promise<ResolvedContextWindow>

  // Annotation (called by Decision Detector after flagging)
  annotateChunks(chunkIds: string[], tags: string[]): Promise<void>

  // Optional graph/index access (may be no-op in early versions)
  getGraphView?(meetingId: string): Promise<TranscriptGraphView>
}

interface Timestream {
  chunks(): Promise<TranscriptChunk[]>                              // ordered by sequenceNumber
  window(from: number, to: number): Promise<TranscriptChunk[]>
  since(sequenceNumber: number): Promise<TranscriptChunk[]>
  forDecision(decisionContextId: string): Promise<TranscriptChunk[]>
  forField(decisionContextId: string, fieldId: string): Promise<TranscriptChunk[]>
  subscribe(handler: (chunk: TranscriptChunk) => void): () => void  // live streaming
  totalTokens(): Promise<number>
  duration(): Promise<string | null>

  // Optional projection APIs for non-linear transcript representations
  byPipeline?(pipelineId: string): Promise<TranscriptChunk[]>
  neighbors?(chunkId: string, depth?: number): Promise<TranscriptChunk[]>
}

interface ResolvedContextWindow {
  chunks: TranscriptChunk[]
  totalTokens: number
  strategy: string
  pipelineId?: string
  relevanceScores: Record<string, number>
}

interface TranscriptGraphView {
  nodes: Array<{ id: string; type: string; refId: string }>
  edges: Array<{ from: string; to: string; type: string; weight?: number }>
}
```

**Owns**: `IRawTranscriptRepository`, `ITranscriptChunkRepository`, `IChunkRelevanceRepository`, `IDecisionContextWindowRepository`, `IMeetingRepository`

**Migration from current code**: `TranscriptService` becomes `TranscriptManagerImpl`. `buildContextWindow()` absorbs the ad-hoc chunk-fetching logic currently in `DraftGenerationService.fetchChunks()`.

`TranscriptManagerImpl` may start as a thin facade over existing repositories/services, then accumulate richer pipeline/graph capabilities later without changing consuming subsystem contracts.

---

### 2. Decision Log Generator

**Responsibility**: The full draft lifecycle — context creation, content generation, field locking, finalization, and export.

The key addition is `IContentCreator` — a unified interface for both AI and human content creation. The generator accepts either without branching, and field values carry explicit provenance metadata.

**Content creator interface**:

```typescript
interface FieldValue {
  fieldId: string
  value: string
  source: 'ai_generated' | 'human_edited' | 'ai_assisted_human'
  confidence?: number   // AI only
  provenance?: string   // LLM interactionId for AI; undefined for human
}

interface ContentCreationRequest {
  decisionContextId: string
  targetFields: string[]           // field IDs to populate; empty = all unlocked
  contextWindow: ResolvedContextWindow
  guidance?: GuidanceSegment[]
}

interface ContentCreationResult {
  fieldValues: FieldValue[]
  interactionId?: string           // set by AI path; records to llm_interactions
}

interface IContentCreator {
  readonly source: 'ai' | 'human'
  createContent(request: ContentCreationRequest): Promise<ContentCreationResult>
  createFieldContent(
    decisionContextId: string,
    fieldId: string,
    contextWindow: ResolvedContextWindow,
    guidance?: GuidanceSegment[]
  ): Promise<FieldValue>
}
```

Implementations:
- `AIContentCreator` — wraps the current `DraftGenerationService` + `VercelAILLMService` path
- `HumanContentCreator` — accepts `Record<string, string>`, no LLM dependency
- `AIAssistedHumanContentCreator` (future) — presents AI suggestions to a human UI for confirmation

**Generator interface**:

```typescript
interface IDecisionLogGenerator {
  // Context lifecycle
  createContext(data: CreateDecisionContext): Promise<DecisionContext>
  getContext(id: string): Promise<DecisionContext | null>
  getContextsForMeeting(meetingId: string): Promise<DecisionContext[]>

  // Content creation (AI or human via IContentCreator)
  generateDraft(
    decisionContextId: string,
    creator: IContentCreator,
    options?: { guidance?: GuidanceSegment[] }
  ): Promise<DecisionContext>

  // Field management
  lockField(decisionContextId: string, fieldId: string): Promise<DecisionContext | null>
  unlockField(decisionContextId: string, fieldId: string): Promise<DecisionContext | null>
  setActiveField(decisionContextId: string, fieldId: string | null): Promise<DecisionContext | null>
  setFieldValue(decisionContextId: string, fieldId: string, value: FieldValue): Promise<DecisionContext>

  // Finalization
  logDecision(decisionContextId: string, options: LogDecisionOptions): Promise<DecisionLog | null>

  // Field/template library (read-only from other subsystems)
  getTemplate(templateId: string): Promise<DecisionTemplate | null>
  getTemplateFields(templateId: string): Promise<DecisionField[]>

  // Export
  exportToMarkdown(decisionContextId: string): Promise<string>
}
```

The generator accepts an optional `ICoachObserverHook` constructor parameter and publishes coaching observations after state changes. This keeps it independent of the Expert System implementation.

```typescript
// Defined in decision-log-generator namespace, implemented by expert system
interface ICoachObserverHook {
  onObservation(observation: CoachingObservation): Promise<CoachingAdvice[]>
}
```

**Owns**: `IDecisionContextRepository`, `IDecisionLogRepository`, `IDecisionFieldRepository`, `IDecisionTemplateRepository`, `ITemplateFieldAssignmentRepository`, `ILLMInteractionRepository`

---

### 3. Decision Detector

**Responsibility**: Analyze a `Timestream` to identify decision candidates (explicit and implicit). Produce `FlaggedDecision` records. Does not own transcript data — consumes `ITranscriptManager` interfaces only.

Detection logic is implemented as an expert persona (per `docs/decision-detection-architecture.md`) by delegating to `IExpertSystem.consultStructured()` with the detection prompt and a typed output schema.

**Interface**:

```typescript
interface DetectionRequest {
  meetingId: string
  timestream: Timestream
  detectImplicit: boolean
  confidenceThreshold: number       // 0–1, default 0.7
  fromSequenceNumber?: number       // for incremental detection
}

interface DetectionResult {
  flaggedDecisions: FlaggedDecision[]
  processedChunks: number
  detectionDurationMs: number
  modelUsed: string
}

interface IDecisionDetector {
  detect(request: DetectionRequest): Promise<DetectionResult>
  detectIncremental(meetingId: string, fromSequenceNumber: number): Promise<DetectionResult>
  getFlaggedDecisions(meetingId: string): Promise<FlaggedDecision[]>
  updateDecisionStatus(id: string, status: FlaggedDecision['status']): Promise<FlaggedDecision | null>
  dismissDecision(id: string, reason: string): Promise<void>
}
```

Implementation: `DetectorExpertFacade` calls `ExpertSystem.consultStructured()` with a `FlaggedDecision[]` output schema.

**Owns**: `IFlaggedDecisionRepository`

---

### 4. Expert System / Decision Coach

**Responsibility**: Expert personas, MCP connections, advice history, and live coaching of in-progress decision drafts.

The key addition over the current stub implementation is `IDecisionCoach` — an observation-driven interface that lets the expert system participate in the drafting lifecycle without polling.

**Coaching interface**:

```typescript
interface CoachingObservation {
  type: 'field_populated' | 'field_locked' | 'draft_generated' | 'all_fields_locked' | 'decision_logged'
  decisionContextId: string
  fieldId?: string
  currentState: DecisionContextSnapshot
}

interface DecisionContextSnapshot {
  context: DecisionContext
  fields: DecisionField[]
  unlockedFields: string[]
  lockedFields: string[]
  draftCompleteness: number          // 0–1
}

interface CoachingAdvice {
  id: string
  decisionContextId: string
  expertId: string
  advice: {
    type: 'suggestion' | 'concern' | 'question' | 'commendation'
    message: string
    fieldId?: string
    actionable?: boolean
    suggestedValues?: string[]
  }
  generatedAt: string
}

interface IDecisionCoach {
  observe(observation: CoachingObservation): Promise<CoachingAdvice[]>   // push model
  requestAdvice(
    decisionContextId: string,
    request: string,
    snapshot: DecisionContextSnapshot
  ): Promise<CoachingAdvice>                                             // pull model
  getAdviceHistory(decisionContextId: string): Promise<CoachingAdvice[]>
  dismissAdvice(adviceId: string): Promise<void>
}
```

**Expert system interface**:

```typescript
interface IExpertSystem {
  getActiveExperts(): Promise<ExpertTemplate[]>
  getExpert(id: string): Promise<ExpertTemplate | null>
  consultStructured<T>(
    expertId: string,
    decisionContextId: string,
    request: string,
    outputSchema: z.ZodType<T>,
    context?: Record<string, any>
  ): Promise<T>
  getCoach(expertId: string): IDecisionCoach
  getMCPServers(): Promise<MCPServer[]>
  getMCPServerStatus(): Promise<Record<string, boolean>>
}
```

The coach observes state by being wired as the `ICoachObserverHook` in the service factory. Initial implementation: proactively generates advice on `draft_generated` and `all_fields_locked` observations; suppresses advice for locked fields.

"Live" at this stage means synchronous request/response — the API endpoint calls `onObservation()` and returns advice in the same response. WebSocket/SSE push is a future concern; the interface supports it without changes.

**Owns**: `IExpertTemplateRepository`, `IExpertAdviceHistoryRepository`, `IMCPServerRepository`

---

## Cross-Subsystem Communication

### Dependency graph

```
Decision Detector  -->  Transcript Manager  (reads Timestream)
Decision Detector  -->  Expert System       (consultStructured for detection)
Decision Log Gen.  -->  Transcript Manager  (buildContextWindow)
Expert System      -->  Decision Log Gen.   (reads snapshots via ICoachObserverHook)
All subsystems     -->  packages/schema     (types only, no business logic)
Apps               -->  All four subsystem public interfaces
```

One-way only. No cycles. The generator never imports the expert system — the hook inversion handles the coaching dependency.

### In-process event bus

Decouples subsystems from side effects without introducing a message broker:

```typescript
type DecisionEvent =
  | { type: 'transcript.chunked'; meetingId: string; chunkCount: number; rawTranscriptId: string }
  | { type: 'transcript.chunk_annotated'; chunkId: string; tags: string[] }
  | { type: 'detection.decisions_flagged'; meetingId: string; flaggedDecisionIds: string[] }
  | { type: 'draft.generated'; decisionContextId: string; fieldCount: number }
  | { type: 'draft.field_locked'; decisionContextId: string; fieldId: string }
  | { type: 'draft.field_populated'; decisionContextId: string; fieldId: string; source: 'ai' | 'human' }
  | { type: 'draft.all_fields_locked'; decisionContextId: string }
  | { type: 'decision.logged'; decisionContextId: string; decisionLogId: string }

interface IEventBus {
  publish(event: DecisionEvent): void
  subscribe<T extends DecisionEvent['type']>(
    eventType: T,
    handler: (event: Extract<DecisionEvent, { type: T }>) => void | Promise<void>
  ): () => void  // returns unsubscribe
}
```

Key wiring:
- `transcript.chunked` → Decision Detector triggers `detectIncremental()`
- `draft.field_populated` / `draft.field_locked` → Coach observes, may produce advice

Direct calls (not events) for synchronous data retrieval: `buildContextWindow()`, `getTimestream()`, `onObservation()`.

---

## Directory Structure

```
packages/core/src/
├── transcript-manager/
│   ├── i-transcript-manager.ts
│   ├── transcript-manager.ts       # TranscriptManagerImpl (wraps TranscriptService)
│   ├── timestream.ts               # MeetingTimestream
│   └── index.ts                    # exports: ITranscriptManager, Timestream, types
│
├── decision-log-generator/
│   ├── i-decision-log-generator.ts
│   ├── i-content-creator.ts        # IContentCreator, FieldValue, ContentCreationRequest
│   ├── ai-content-creator.ts       # refactored from DraftGenerationService
│   ├── human-content-creator.ts
│   ├── decision-log-generator.ts   # orchestrator, accepts ICoachObserverHook
│   └── index.ts
│
├── decision-detector/
│   ├── i-decision-detector.ts
│   ├── detector-expert-facade.ts   # calls ExpertSystem.consultStructured()
│   └── index.ts
│
├── expert-system/
│   ├── i-expert-system.ts
│   ├── i-decision-coach.ts
│   ├── expert-decision-coach.ts    # per-expert IDecisionCoach implementation
│   ├── expert-system.ts            # IExpertSystem implementation
│   └── index.ts
│
├── events/
│   ├── decision-events.ts
│   ├── i-event-bus.ts
│   └── in-process-event-bus.ts     # ~20 lines, trivially testable
│
├── interfaces/                     # existing repository interfaces, unchanged
├── services/                       # existing services (hollowed out incrementally)
├── llm/                            # unchanged
└── service-factory.ts              # wires subsystem factories + event bus + coach hook
```

---

## Data Flow: Transcript to Logged Decision

```
transcript upload
  |
  v
TranscriptManager.processTranscript()
  |  creates TranscriptChunk[]
  |  publishes: transcript.chunked
  |
  +--> [event] DecisionDetector.detectIncremental()
         |  calls: ITranscriptManager.getTimestream()
         |  calls: ExpertSystem.consultStructured(detectionExpert, timestream)
         |  creates: FlaggedDecision[]
         |  publishes: detection.decisions_flagged
         v
       User reviews FlaggedDecision list
         |
         v
       DecisionLogGenerator.createContext(flaggedDecisionId, templateId)
         |
         v
       DecisionLogGenerator.generateDraft(contextId, AIContentCreator)
         |  calls: ITranscriptManager.buildContextWindow()
         |  calls: AIContentCreator.createContent(request)
         |    --> ILLMService.generateDraft(chunks, fields, guidance)
         |    --> records LLMInteraction
         |  merges with locked fields
         |  publishes: draft.generated
         |  calls: ICoachObserverHook.onObservation(draft_generated)
         |    --> ExpertDecisionCoach.observe()
         |    --> LLM generates coaching advice
         |    --> returns CoachingAdvice[]
         v
       [API includes advice in response / CLI displays inline]
         |
         v
       User locks fields iteratively
         |  DecisionLogGenerator.lockField()
         |  publishes: draft.field_locked
         v
       DecisionLogGenerator.logDecision()
         |  creates: DecisionLog (immutable)
         |  publishes: decision.logged
```

---

## Migration Phases

Each phase is a validated, committable unit. Existing tests remain green throughout.

| Phase | Work | Checkpoint |
|-------|------|------------|
| **A** | Create all `i-*.ts` interface files + `decision-events.ts` + `i-event-bus.ts`. Pure TypeScript, no behavior change. | No tests change. Compiles. |
| **B** | Implement `MeetingTimestream`. Wrap `TranscriptService` as `TranscriptManagerImpl`. Migrate `DraftGenerationService.fetchChunks()` to `buildContextWindow()`. | Existing tests pass. New timestream tests pass. |
| **C** | Extract `AIContentCreator` from `DraftGenerationService`. Implement `HumanContentCreator`. Create `DecisionLogGeneratorImpl` accepting `IContentCreator`. Update CLI commands. | `draft-generation-service.test.ts` passes against new structure. |
| **D** | Implement `InProcessEventBus`. Add event publishing to `TranscriptManagerImpl` and `DecisionLogGeneratorImpl`. Wire no-op `ICoachObserverHook` in factory. | Event bus unit tests pass. Existing behavior unchanged. |
| **E** | Implement `ExpertSystemImpl.consultStructured()`. Implement `ExpertDecisionCoach`. Wire as `ICoachObserverHook`. Add `GET /api/decision-contexts/:id/coaching-advice`. | Coach produces advice when draft generated. |
| **F** | Implement `DetectorExpertFacade`. Subscribe to `transcript.chunked`. Wire `POST /api/meetings/:id/detect`. | Detection integration tests pass. |

### Foundation-First Rule

If a phase risks delaying v1 deliverables, split it into:
- `foundation`: interfaces, adapters, no-op wiring, parity tests
- `activation`: behavior switch-over after relevant v1 milestone exit criteria pass

For transcript evolution features (multi-pipeline chunking, graph queries, advanced tagging), foundation can land during v1; activation is explicitly post-v1 unless required by an active milestone.

### When to extract packages

Extract `packages/transcript-manager/` etc. when:
- `apps/mcp` needs to import subsystem interfaces without pulling `@repo/db` transitively
- A subsystem runs as a separate process (e.g. detection worker)
- Independent versioning is needed

The subdirectory structure with clean `index.ts` barrels makes this extraction a mechanical rename with no interface changes.

---

## Key Design Decisions

**Why IContentCreator instead of method overloading?**
A separate interface allows human and AI paths to be tested in isolation, extended without touching the generator (open/closed), and composed (future `AIAssistedHumanContentCreator` adds human review step between AI suggestion and commit).

**Why coaching via observer hook instead of direct import?**
The Decision Log Generator and Expert System are peers. Neither should import the other. The hook interface is defined in the generator's namespace, implemented by the expert system, and wired by the service factory. This avoids circular imports and keeps each subsystem independently testable with a no-op stub.

**Why in-process event bus instead of direct calls for detection?**
The Transcript Manager should not know the Decision Detector exists. Events allow the detector to subscribe without the manager importing it. The `IEventBus` interface is the seam that, when needed, can be backed by Redis Pub/Sub with no changes to publishers or subscribers.

**Why not new packages now?**
Separate packages add `package.json`, `tsup.config.ts`, and workspace resolution overhead without benefit at current scale. Logical isolation via subdirectory `index.ts` barrels provides the same boundary enforcement. The migration is a mechanical `mv` when the time comes.
