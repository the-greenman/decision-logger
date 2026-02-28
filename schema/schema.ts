/**
 * Decision Logger Database Schema
 * 
 * This is the canonical source of truth for the database schema.
 * - Type-safe with TypeScript
 * - Generates migrations automatically
 * - Testable and validatable
 * - Version controlled
 */

import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, index, uniqueIndex, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// MEETINGS
// ============================================================================

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  date: timestamp('date', { mode: 'date' }).notNull(),
  participants: text('participants').array().notNull(),
  status: text('status', { enum: ['active', 'completed'] }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_meetings_status').on(table.status),
  dateIdx: index('idx_meetings_date').on(table.date),
}));

// ============================================================================
// RAW TRANSCRIPTS
// ============================================================================

export const rawTranscripts = pgTable('raw_transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['upload', 'stream', 'api'] }).notNull(),
  format: text('format'), // 'txt', 'vtt', 'srt', 'json'
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  uploadedBy: text('uploaded_by'),
}, (table) => ({
  meetingIdx: index('idx_raw_transcripts_meeting').on(table.meetingId),
}));

// ============================================================================
// STREAMING BUFFER
// ============================================================================

export const streamingBuffer = pgTable('streaming_buffer', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  sequenceNumber: integer('sequence_number').notNull(),
  timestamp: text('timestamp'),
  speaker: text('speaker').notNull(),
  text: text('text').notNull(),
  tokenCount: integer('token_count'),
  bufferedAt: timestamp('buffered_at', { withTimezone: true }).notNull().defaultNow(),
  processed: boolean('processed').notNull().default(false),
}, (table) => ({
  meetingIdx: index('idx_buffer_meeting').on(table.meetingId),
  unprocessedIdx: index('idx_buffer_unprocessed').on(table.meetingId).where(table.processed.eq(false)),
  uniqueSequence: uniqueIndex('unique_buffer_meeting_sequence').on(table.meetingId, table.sequenceNumber),
}));

// ============================================================================
// TRANSCRIPT CHUNKS
// ============================================================================

export const transcriptChunks = pgTable('transcript_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  rawTranscriptId: uuid('raw_transcript_id').references(() => rawTranscripts.id),
  text: text('text').notNull(),
  speaker: text('speaker'),
  sequenceNumber: integer('sequence_number').notNull(),
  startTime: integer('start_time'), // Seconds from meeting start
  endTime: integer('end_time'), // Seconds from meeting start
  chunkStrategy: text('chunk_strategy', { enum: ['semantic', 'fixed-time', 'speaker-turn', 'sentence', 'streaming'] }).notNull(),
  tokenCount: integer('token_count'),
  wordCount: integer('word_count'),
  embedding: text('embedding'), // Vector embedding (will use pgvector extension, dim e.g. 1536)
  summary: text('summary'),
  topics: text('topics').array(),
  contexts: text('contexts').array().notNull().default([]),
  overlapPrev: uuid('overlap_prev').references((): any => transcriptChunks.id),
  overlapNext: uuid('overlap_next').references((): any => transcriptChunks.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  meetingIdx: index('idx_chunks_meeting').on(table.meetingId),
  sequenceIdx: index('idx_chunks_sequence').on(table.meetingId, table.sequenceNumber),
  timeIdx: index('idx_chunks_time').on(table.startTime, table.endTime),
  contextsIdx: index('idx_chunks_contexts').using('gin', table.contexts),
}));

// ============================================================================
// CHUNK RELEVANCE (Field-Specific Tagging)
// ============================================================================

export const chunkRelevance = pgTable('chunk_relevance', {
  id: uuid('id').primaryKey().defaultRandom(),
  chunkId: uuid('chunk_id').notNull().references(() => transcriptChunks.id, { onDelete: 'cascade' }),
  decisionContextId: uuid('decision_context_id').notNull().references(() => decisionContexts.id, { onDelete: 'cascade' }),
  fieldId: text('field_id').notNull(),
  relevance: integer('relevance').notNull(), // 0-100
  taggedBy: text('tagged_by', { enum: ['llm', 'user', 'system'] }).notNull(),
  taggedAt: timestamp('tagged_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  chunkIdx: index('idx_relevance_chunk').on(table.chunkId),
  decisionFieldIdx: index('idx_relevance_decision_field').on(table.decisionContextId, table.fieldId, table.relevance),
  uniqueChunkField: uniqueIndex('unique_chunk_decision_field').on(table.chunkId, table.decisionContextId, table.fieldId),
}));

// ============================================================================
// DECISION CONTEXT WINDOWS
// ============================================================================

export const decisionContextWindows = pgTable('decision_context_windows', {
  id: uuid('id').primaryKey().defaultRandom(),
  decisionContextId: uuid('decision_context_id').notNull().references(() => decisionContexts.id, { onDelete: 'cascade' }),
  chunkIds: uuid('chunk_ids').array().notNull(),
  selectionStrategy: text('selection_strategy', { enum: ['manual', 'semantic', 'temporal', 'hybrid'] }).notNull(),
  totalTokens: integer('total_tokens').notNull(),
  totalChunks: integer('total_chunks').notNull(),
  timeSpanSeconds: integer('time_span_seconds'),
  relevanceScores: jsonb('relevance_scores').$type<Record<string, number>>(),
  usedFor: text('used_for').array(), // ['draft-generation', 'field-regeneration', 'expert-advice']
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
  decisionIdx: index('idx_context_windows_decision').on(table.decisionContextId),
}));

// ============================================================================
// FLAGGED DECISIONS
// ============================================================================

export const flaggedDecisions = pgTable('flagged_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  suggestedTitle: text('suggested_title').notNull(),
  contextSummary: text('context_summary'),
  confidence: real('confidence'), // 0-1 float
  segmentIds: uuid('segment_ids').array().notNull(),
  status: text('status', { enum: ['pending', 'active', 'logged', 'dismissed'] }).notNull().default('pending'),
  source: text('source', { enum: ['ai', 'manual'] }).notNull().default('ai'),
  priority: integer('priority').default(0), // Higher = more important
  createdBy: text('created_by'), // User who manually created it
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  meetingIdx: index('idx_flagged_meeting').on(table.meetingId),
  statusIdx: index('idx_flagged_status').on(table.status).where(table.status.eq('pending')),
  priorityIdx: index('idx_flagged_priority').on(table.priority).where(table.status.eq('pending')),
}));

// ============================================================================
// DECISION TEMPLATES
// ============================================================================

export const decisionTemplates = pgTable('decision_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  version: integer('version').notNull().default(1),
  fields: jsonb('fields').notNull().$type<TemplateField[]>(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueNameVersion: uniqueIndex('unique_template_name_version').on(table.name, table.version),
  defaultIdx: uniqueIndex('idx_templates_default').on(table.isDefault).where(table.isDefault.eq(true)),
}));

export type TemplateField = {
  id: string;
  name: string;
  label: string;
  description?: string;
  required: boolean;
  order: number;
};

// ============================================================================
// DECISION CONTEXTS
// ============================================================================

export const decisionContexts = pgTable('decision_contexts', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  flaggedDecisionId: uuid('flagged_decision_id').references(() => flaggedDecisions.id),
  title: text('title').notNull(),
  templateId: uuid('template_id').notNull().references(() => decisionTemplates.id),
  activeField: text('active_field'),
  lockedFields: jsonb('locked_fields').notNull().default({}).$type<Record<string, LockedField>>(),
  draftData: jsonb('draft_data').notNull().default({}).$type<Record<string, string>>(),
  status: text('status', { enum: ['drafting', 'ready', 'logged'] }).notNull().default('drafting'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  meetingIdx: index('idx_contexts_meeting').on(table.meetingId),
  statusIdx: index('idx_contexts_status').on(table.status),
}));

export type LockedField = {
  value: string;
  lockedAt: Date;
};

// ============================================================================
// DECISION LOGS
// ============================================================================

export const decisionLogs = pgTable('decision_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id),
  decisionContextId: uuid('decision_context_id').notNull().references(() => decisionContexts.id),
  templateId: uuid('template_id').notNull(),
  templateVersion: integer('template_version').notNull(),
  fields: jsonb('fields').notNull().$type<Record<string, string>>(),
  decisionMethod: jsonb('decision_method').notNull().$type<DecisionMethod>(),
  sourceSegmentIds: uuid('source_segment_ids').array().notNull(),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
  loggedBy: text('logged_by').notNull(),
}, (table) => ({
  meetingIdx: index('idx_logs_meeting').on(table.meetingId),
  contextIdx: index('idx_logs_context').on(table.decisionContextId),
}));

export type DecisionMethod = {
  type: string;
  details: string;
  actors: string[];
};

// ============================================================================
// EXPERT TEMPLATES
// ============================================================================

export const expertTemplates = pgTable('expert_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  type: text('type', { enum: ['core', 'custom'] }).notNull(),
  promptTemplate: text('prompt_template').notNull(),
  mcpAccess: jsonb('mcp_access').notNull().default({ servers: [], allowedTools: null, allowedResources: null }).$type<MCPAccess>(),
  outputSchema: jsonb('output_schema').$type<Record<string, any>>(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  createdBy: text('created_by'),
}, (table) => ({
  typeIdx: index('idx_experts_type').on(table.type),
  activeIdx: index('idx_experts_active').on(table.isActive).where(table.isActive.eq(true)),
}));

export type MCPAccess = {
  servers: string[];
  allowedTools?: string[] | null;
  allowedResources?: string[] | null;
};

// ============================================================================
// MCP SERVERS
// ============================================================================

export const mcpServers = pgTable('mcp_servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  type: text('type', { enum: ['postgresql', 'sqlite', 'http', 'custom'] }).notNull(),
  connectionConfig: jsonb('connection_config').notNull().$type<Record<string, any>>(),
  capabilities: jsonb('capabilities').notNull().$type<MCPCapabilities>(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
  statusIdx: index('idx_mcp_status').on(table.status),
}));

export type MCPCapabilities = {
  resources: string[];
  tools: MCPTool[];
};

export type MCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
};

// ============================================================================
// EXPERT ADVICE HISTORY
// ============================================================================

export const expertAdviceHistory = pgTable('expert_advice_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  decisionContextId: uuid('decision_context_id').notNull().references(() => decisionContexts.id),
  expertId: uuid('expert_id').notNull().references(() => expertTemplates.id),
  expertName: text('expert_name').notNull(),
  request: jsonb('request').notNull().$type<Record<string, any>>(),
  response: jsonb('response').notNull().$type<Record<string, any>>(),
  mcpToolsUsed: text('mcp_tools_used').array(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  contextIdx: index('idx_advice_context').on(table.decisionContextId),
  expertIdx: index('idx_advice_expert').on(table.expertId),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const meetingsRelations = relations(meetings, ({ many }: { many: any }) => ({
  rawTranscripts: many(rawTranscripts),
  streamingBuffer: many(streamingBuffer),
  transcriptChunks: many(transcriptChunks),
  flaggedDecisions: many(flaggedDecisions),
  decisionContexts: many(decisionContexts),
  decisionLogs: many(decisionLogs),
}));

export const rawTranscriptsRelations = relations(rawTranscripts, ({ one, many }: { one: any, many: any }) => ({
  meeting: one(meetings, {
    fields: [rawTranscripts.meetingId],
    references: [meetings.id],
  }),
  chunks: many(transcriptChunks),
}));

export const streamingBufferRelations = relations(streamingBuffer, ({ one }: { one: any }) => ({
  meeting: one(meetings, {
    fields: [streamingBuffer.meetingId],
    references: [meetings.id],
  }),
}));

export const transcriptChunksRelations = relations(transcriptChunks, ({ one }: { one: any }) => ({
  meeting: one(meetings, {
    fields: [transcriptChunks.meetingId],
    references: [meetings.id],
  }),
  rawTranscript: one(rawTranscripts, {
    fields: [transcriptChunks.rawTranscriptId],
    references: [rawTranscripts.id],
  }),
}));

export const flaggedDecisionsRelations = relations(flaggedDecisions, ({ one, many }: { one: any, many: any }) => ({
  meeting: one(meetings, {
    fields: [flaggedDecisions.meetingId],
    references: [meetings.id],
  }),
  decisionContexts: many(decisionContexts),
}));

export const decisionContextsRelations = relations(decisionContexts, ({ one, many }: { one: any, many: any }) => ({
  meeting: one(meetings, {
    fields: [decisionContexts.meetingId],
    references: [meetings.id],
  }),
  flaggedDecision: one(flaggedDecisions, {
    fields: [decisionContexts.flaggedDecisionId],
    references: [flaggedDecisions.id],
  }),
  template: one(decisionTemplates, {
    fields: [decisionContexts.templateId],
    references: [decisionTemplates.id],
  }),
  decisionLog: many(decisionLogs),
  expertAdvice: many(expertAdviceHistory),
}));

export const decisionLogsRelations = relations(decisionLogs, ({ one }: { one: any }) => ({
  meeting: one(meetings, {
    fields: [decisionLogs.meetingId],
    references: [meetings.id],
  }),
  decisionContext: one(decisionContexts, {
    fields: [decisionLogs.decisionContextId],
    references: [decisionContexts.id],
  }),
}));

export const expertAdviceHistoryRelations = relations(expertAdviceHistory, ({ one }: { one: any }) => ({
  decisionContext: one(decisionContexts, {
    fields: [expertAdviceHistory.decisionContextId],
    references: [decisionContexts.id],
  }),
  expert: one(expertTemplates, {
    fields: [expertAdviceHistory.expertId],
    references: [expertTemplates.id],
  }),
}));
