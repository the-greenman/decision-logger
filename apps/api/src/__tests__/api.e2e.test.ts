import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../index';
import {
  createDecisionFieldService,
  createDecisionTemplateService,
} from '@repo/core';

describe('API E2E Tests', () => {
  let createdMeetingId: string;
  let createdFieldId: string;
  let createdTemplateId: string;
  let createdChunkId: string;
  let createdDecisionId: string;
  let createdContextId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }

    const fieldService = createDecisionFieldService();
    const templateService = createDecisionTemplateService();

    const field = await fieldService.createField({
      namespace: 'test',
      name: `decision_statement_${Date.now()}`,
      description: 'Decision statement for API E2E tests',
      category: 'outcome',
      extractionPrompt: 'Extract the main decision statement',
      fieldType: 'textarea',
      placeholder: 'Decision statement',
    });
    createdFieldId = field.id;

    const template = await templateService.createTemplate({
      name: `API E2E Template ${Date.now()}`,
      description: 'Template for API E2E tests',
      category: 'standard',
      fields: [
        {
          fieldId: field.id,
          order: 0,
          required: true,
          customLabel: 'Decision Statement',
          customDescription: 'Primary decision statement',
        },
      ],
    });
    createdTemplateId = template.id;
  });

  it('POST /api/meetings - should create a meeting', async () => {
    const response = await app.request('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Meeting',
        date: '2026-02-27T10:00:00Z',
        participants: ['Alice', 'Bob'],
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe('Test Meeting');
    expect(data.participants).toEqual(['Alice', 'Bob']);
    expect(data.status).toBe('active');
    
    createdMeetingId = data.id;
  });

  it('GET /api/meetings - should list all meetings', async () => {
    const response = await app.request('/api/meetings');
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.meetings).toBeInstanceOf(Array);
    expect(data.meetings.length).toBeGreaterThan(0);
  });

  it('POST /api/meetings/:id/transcripts/upload - should upload and chunk a transcript', async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/transcripts/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Alice: We should approve the migration. Bob: Agreed, let us move forward this quarter.',
        format: 'txt',
        chunkStrategy: 'fixed',
        chunkSize: 20,
        overlap: 0,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.transcript.id).toBeDefined();
    expect(data.transcript.meetingId).toBe(createdMeetingId);
    expect(data.chunks).toBeInstanceOf(Array);
    expect(data.chunks.length).toBeGreaterThan(0);
    expect(data.chunks[0].meetingId).toBe(createdMeetingId);

    createdChunkId = data.chunks[0].id;
  });

  it('POST /api/meetings/:id/flagged-decisions - should create a flagged decision', async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/flagged-decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestedTitle: 'Approve migration',
        contextSummary: 'Team aligned on completing the migration this quarter.',
        confidence: 1,
        chunkIds: [createdChunkId],
        suggestedTemplateId: createdTemplateId,
        templateConfidence: 1,
        priority: 1,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.meetingId).toBe(createdMeetingId);
    expect(data.chunkIds).toContain(createdChunkId);
    expect(data.suggestedTemplateId).toBe(createdTemplateId);

    createdDecisionId = data.id;
  });

  it('POST /api/decision-contexts - should create a decision context', async () => {
    const response = await app.request('/api/decision-contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingId: createdMeetingId,
        flaggedDecisionId: createdDecisionId,
        title: 'Approve migration',
        templateId: createdTemplateId,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.meetingId).toBe(createdMeetingId);
    expect(data.flaggedDecisionId).toBe(createdDecisionId);
    expect(data.templateId).toBe(createdTemplateId);
    expect(data.lockedFields).toEqual([]);

    createdContextId = data.id;
  });

  it('PUT /api/decision-contexts/:id/lock-field - should lock a field', async () => {
    const response = await app.request(`/api/decision-contexts/${createdContextId}/lock-field`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldId: createdFieldId,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.lockedFields).toContain(createdFieldId);
  });

  it('DELETE /api/decision-contexts/:id/lock-field - should unlock a field', async () => {
    const response = await app.request(`/api/decision-contexts/${createdContextId}/lock-field`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldId: createdFieldId,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.lockedFields).not.toContain(createdFieldId);
  });

  it('GET /api/decision-contexts/:id/export/markdown - should export markdown', async () => {
    const response = await app.request(`/api/decision-contexts/${createdContextId}/export/markdown`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(typeof data.markdown).toBe('string');
    expect(data.markdown).toContain('# Decision:');
    expect(data.markdown).toContain('##');
  });

  it('GET /api/decision-contexts/:id/llm-interactions - should return interactions array', async () => {
    const response = await app.request(`/api/decision-contexts/${createdContextId}/llm-interactions`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.interactions).toBeInstanceOf(Array);
  });

  it('GET /api/meetings/:id - should get a specific meeting', async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}`);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdMeetingId);
    expect(data.title).toBe('Test Meeting');
  });

  it('GET /api/meetings/:id - should return 404 for non-existent meeting', async () => {
    const response = await app.request('/api/meetings/11111111-1111-4111-8111-111111111111');
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Meeting not found');
  });

  it('GET /health - should return health status', async () => {
    const response = await app.request('/health');
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  it('GET /openapi.json - should return OpenAPI spec', async () => {
    const response = await app.request('/openapi.json');
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.openapi).toBe('3.0.0');
    expect(data.paths).toHaveProperty('/api/meetings');
    expect(data.paths).toHaveProperty('/api/meetings/{id}/transcripts/upload');
    expect(data.paths).toHaveProperty('/api/decision-contexts/{id}/llm-interactions');
  });
});
