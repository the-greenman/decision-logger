import { createRoute, z } from '@hono/zod-openapi';
import {
  DecisionContextSchema,
  FlaggedDecisionSchema,
  LLMInteractionSchema,
  RawTranscriptSchema,
  TranscriptChunkSchema,
} from '@repo/schema';

const ErrorResponseSchema = z.object({
  error: z.string(),
});

const GuidanceSegmentSchema = z.object({
  fieldId: z.string().optional(),
  content: z.string(),
  source: z.enum(['user_text', 'tagged_transcript']),
});

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const MeetingIdParamSchema = z.object({
  id: z.string().uuid(),
});

const TranscriptUploadRequestSchema = z.object({
  content: z.string().min(1),
  format: z.enum(['json', 'txt', 'vtt', 'srt']).default('txt'),
  metadata: z.record(z.any()).optional(),
  uploadedBy: z.string().optional(),
  chunkStrategy: z.enum(['fixed', 'semantic', 'speaker', 'streaming']).default('fixed'),
  chunkSize: z.number().int().positive().optional(),
  overlap: z.number().int().min(0).optional(),
}).openapi('TranscriptUploadRequest');

const TranscriptUploadResponseSchema = z.object({
  transcript: RawTranscriptSchema,
  chunks: z.array(TranscriptChunkSchema),
}).openapi('TranscriptUploadResponse');

const CreateFlaggedDecisionRequestSchema = FlaggedDecisionSchema.omit({
  id: true,
  meetingId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  confidence: z.number().min(0).max(1).default(1),
  priority: z.number().int().default(0),
}).openapi('CreateFlaggedDecisionRequest');

const CreateDecisionContextRequestSchema = DecisionContextSchema.omit({
  id: true,
  lockedFields: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).openapi('CreateDecisionContextRequest');

const GenerateDraftRequestSchema = z.object({
  guidance: z.array(GuidanceSegmentSchema).optional(),
}).openapi('GenerateDraftRequest');

const MarkdownExportQuerySchema = z.object({
  includeMetadata: z.coerce.boolean().optional(),
  includeTimestamps: z.coerce.boolean().optional(),
  includeParticipants: z.coerce.boolean().optional(),
  fieldOrder: z.enum(['template', 'alphabetical']).optional(),
  lockedFieldIndicator: z.enum(['prefix', 'suffix', 'none']).optional(),
});

const MarkdownExportResponseSchema = z.object({
  markdown: z.string(),
}).openapi('MarkdownExportResponse');

const LockFieldRequestSchema = z.object({
  fieldId: z.string(),
}).openapi('LockFieldRequest');

const LLMInteractionsResponseSchema = z.object({
  interactions: z.array(LLMInteractionSchema),
}).openapi('LLMInteractionsResponse');

export const uploadTranscriptRoute = createRoute({
  method: 'post',
  path: '/api/meetings/:id/transcripts/upload',
  tags: ['transcripts'],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: TranscriptUploadRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: TranscriptUploadResponseSchema,
        },
      },
      description: 'Transcript uploaded and chunked successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const createFlaggedDecisionRoute = createRoute({
  method: 'post',
  path: '/api/meetings/:id/flagged-decisions',
  tags: ['flagged-decisions'],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: CreateFlaggedDecisionRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: FlaggedDecisionSchema,
        },
      },
      description: 'Flagged decision created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const createDecisionContextRoute = createRoute({
  method: 'post',
  path: '/api/decision-contexts',
  tags: ['decision-contexts'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateDecisionContextRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Decision context created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const generateDraftRoute = createRoute({
  method: 'post',
  path: '/api/decision-contexts/:id/generate-draft',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: GenerateDraftRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Draft generated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision context not found',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const exportMarkdownRoute = createRoute({
  method: 'get',
  path: '/api/decision-contexts/:id/export/markdown',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    query: MarkdownExportQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MarkdownExportResponseSchema,
        },
      },
      description: 'Markdown export generated successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision context not found',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const lockFieldRoute = createRoute({
  method: 'put',
  path: '/api/decision-contexts/:id/lock-field',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: LockFieldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Field locked successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision context not found',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const unlockFieldRoute = createRoute({
  method: 'delete',
  path: '/api/decision-contexts/:id/lock-field',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: LockFieldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Field unlocked successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision context not found',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const listLLMInteractionsRoute = createRoute({
  method: 'get',
  path: '/api/decision-contexts/:id/llm-interactions',
  tags: ['decision-contexts', 'observability'],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LLMInteractionsResponseSchema,
        },
      },
      description: 'LLM interactions for the decision context',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});
