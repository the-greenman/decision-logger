import { describe, expect, it, vi } from 'vitest';
import { runBatchTranscription } from '../session.js';
import type { ITranscriptionProvider } from '../providers/interface.js';

describe('runBatchTranscription', () => {
  it('uses upload mode to send raw whisper json once', async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [{ text: 'hello', sequenceNumber: 1 }],
        rawResponse: { segments: [{ id: 1, text: 'hello' }] },
      }),
    };

    const apiClient = {
      uploadWhisperJson: vi.fn().mockResolvedValue({
        transcript: { id: 'raw-1' },
        chunks: [{ id: 'chunk-1' }],
      }),
      postStreamEvent: vi.fn(),
      flushStream: vi.fn(),
    };

    const readAudioFile = vi.fn().mockResolvedValue(Buffer.from('audio'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runBatchTranscription(
      {
        audioFilePath: '/tmp/example.wav',
        meetingId: 'meeting-1',
        mode: 'upload',
        chunkStrategy: 'speaker',
      },
      {
        provider,
        apiClient,
        readAudioFile,
      },
    );

    expect(readAudioFile).toHaveBeenCalledWith('/tmp/example.wav');
    expect(provider.transcribe).toHaveBeenCalledTimes(1);
    expect(apiClient.uploadWhisperJson).toHaveBeenCalledWith(
      'meeting-1',
      { segments: [{ id: 1, text: 'hello' }] },
      'speaker',
    );
    expect(apiClient.postStreamEvent).not.toHaveBeenCalled();
    expect(apiClient.flushStream).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('uses stream mode to send each event then flush', async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [
          { text: 'first', sequenceNumber: 1 },
          { text: 'second', sequenceNumber: 2 },
        ],
        rawResponse: { ignored: true },
      }),
    };

    const apiClient = {
      uploadWhisperJson: vi.fn(),
      postStreamEvent: vi.fn().mockResolvedValue(undefined),
      flushStream: vi.fn().mockResolvedValue(undefined),
    };

    const readAudioFile = vi.fn().mockResolvedValue(Buffer.from('audio'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runBatchTranscription(
      {
        audioFilePath: '/tmp/example.wav',
        meetingId: 'meeting-2',
        mode: 'stream',
        chunkStrategy: 'speaker',
      },
      {
        provider,
        apiClient,
        readAudioFile,
      },
    );

    expect(apiClient.uploadWhisperJson).not.toHaveBeenCalled();
    expect(apiClient.postStreamEvent).toHaveBeenCalledTimes(2);
    expect(apiClient.postStreamEvent).toHaveBeenNthCalledWith(
      1,
      'meeting-2',
      { text: 'first', sequenceNumber: 1 },
    );
    expect(apiClient.postStreamEvent).toHaveBeenNthCalledWith(
      2,
      'meeting-2',
      { text: 'second', sequenceNumber: 2 },
    );
    expect(apiClient.flushStream).toHaveBeenCalledWith('meeting-2');

    logSpy.mockRestore();
  });
});
