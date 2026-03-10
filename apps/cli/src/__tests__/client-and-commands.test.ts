import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
const stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

describe('CLI client request shapes', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    stderrWriteSpy.mockClear();
  });

  it('api.delete sends a JSON body when provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const { api } = await import('../client.js');
    await api.delete('/api/decision-contexts/ctx/lock-field', { fieldId: 'field-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/decision-contexts/ctx/lock-field',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId: 'field-1' }),
      },
    );
  });

  it('api throws the server error string for non-ok responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Invalid request data' }),
    });

    const { api } = await import('../client.js');

    await expect(api.post('/api/test', {})).rejects.toThrow('Invalid request data');
  });

  it('api emits verbose HTTP logs when verbose mode is enabled', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const { api } = await import('../client.js');
    const { setCliVerbose } = await import('../runtime.js');

    setCliVerbose(true);
    await api.get('/api/context');
    setCliVerbose(false);

    expect(stderrWriteSpy).toHaveBeenCalled();
  });
});

describe('CLI command request shapes', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    stderrWriteSpy.mockClear();
  });

  it('draft unlock-field sends fieldId in the DELETE body', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: 'meeting-1', activeDecisionContextId: 'ctx-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'ctx-1', lockedFields: [] }),
      });

    const { draftCommand } = await import('../commands/draft.js');
    await draftCommand.parseAsync(['node', 'draft', 'unlock-field', '--field-id', 'field-1'], { from: 'node' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/context',
      { method: 'GET' },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/decision-contexts/ctx-1/lock-field',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId: 'field-1' }),
      },
    );
  });

  it('draft lock-field sends fieldId in the PUT body', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: 'meeting-1', activeDecisionContextId: 'ctx-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'ctx-1', lockedFields: ['field-1'] }),
      });

    const { draftCommand } = await import('../commands/draft.js');
    await draftCommand.parseAsync(['node', 'draft', 'lock-field', '--field-id', 'field-1'], { from: 'node' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/decision-contexts/ctx-1/lock-field',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId: 'field-1' }),
      },
    );
  });

  it('context set-decision posts the flaggedDecisionId and optional templateId', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: 'meeting-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: 'meeting-1', activeDecisionId: 'decision-1', activeDecisionContextId: 'ctx-1' }),
      });

    const { contextCommand } = await import('../commands/context.js');
    await contextCommand.parseAsync(
      ['node', 'context', 'set-decision', 'decision-1', '--template-id', 'template-1'],
      { from: 'node' },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/context',
      { method: 'GET' },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/meetings/meeting-1/context/decision',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flaggedDecisionId: 'decision-1', templateId: 'template-1' }),
      },
    );
  });

  it('context clear-meeting deletes the active meeting context when confirmed with --yes', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ activeMeetingId: undefined, activeDecisionId: undefined, activeDecisionContextId: undefined }),
    });

    const { contextCommand } = await import('../commands/context.js');
    await contextCommand.parseAsync(['node', 'context', 'clear-meeting', '--yes'], { from: 'node' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/context/meeting',
      { method: 'DELETE' },
    );
  });

  it('context clear-decision deletes the active decision context when confirmed with --yes', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: 'meeting-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: 'meeting-1', activeDecisionId: undefined, activeDecisionContextId: undefined }),
      });

    const { contextCommand } = await import('../commands/context.js');
    await contextCommand.parseAsync(['node', 'context', 'clear-decision', '--yes'], { from: 'node' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/meetings/meeting-1/context/decision',
      { method: 'DELETE' },
    );
  });

  it('context clear-field deletes the active field focus when confirmed with --yes', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: 'meeting-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: 'meeting-1', activeField: undefined }),
      });

    const { contextCommand } = await import('../commands/context.js');
    await contextCommand.parseAsync(['node', 'context', 'clear-field', '--yes'], { from: 'node' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/meetings/meeting-1/context/field',
      { method: 'DELETE' },
    );
  });

  it('decisions list honors an explicit meeting-id option without fetching active context', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ decisions: [] }),
    });

    const { decisionsCommand } = await import('../commands/decisions.js');
    await decisionsCommand.parseAsync(
      ['node', 'decisions', 'list', '--meeting-id', 'meeting-1'],
      { from: 'node' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/meetings/meeting-1/flagged-decisions',
      { method: 'GET' },
    );
  });

  it('decisions flag honors an explicit meeting-id option without fetching active context', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'decision-1',
        meetingId: 'meeting-1',
        suggestedTitle: 'Approve migration',
        confidence: 1,
        priority: 0,
        status: 'pending',
        createdAt: 'now',
      }),
    });

    const { decisionsCommand } = await import('../commands/decisions.js');
    await decisionsCommand.parseAsync(
      ['node', 'decisions', 'flag', '--meeting-id', 'meeting-1', '--title', 'Approve migration'],
      { from: 'node' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/meetings/meeting-1/flagged-decisions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestedTitle: 'Approve migration',
          contextSummary: '',
          confidence: 1,
          priority: 0,
          chunkIds: [],
        }),
      },
    );
  });

  it('draft log posts the decision method payload', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: 'meeting-1', activeDecisionContextId: 'ctx-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'log-1', decisionMethod: { type: 'manual' }, loggedBy: 'Tester', loggedAt: 'now' }),
      });

    const { draftCommand } = await import('../commands/draft.js');
    await draftCommand.parseAsync(
      ['node', 'draft', 'log', '--type', 'manual', '--by', 'Tester', '--details', 'Confirmed in review', '--yes'],
      { from: 'node' },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/decision-contexts/ctx-1/log',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loggedBy: 'Tester',
          decisionMethod: { type: 'manual', details: 'Confirmed in review' },
        }),
      },
    );
  });
});
