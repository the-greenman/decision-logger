import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { DecisionLoggerApiClient } from './api-client.js';
import { formatEventPreviewLine, formatEventsAsSrt, formatEventsAsText } from './output-format.js';
import { createProviderFromEnv } from './providers/index.js';
import type { ITranscriptionProvider, TranscriptEvent } from './providers/interface.js';

export interface BatchTranscriptionOptions {
  audioFilePath: string;
  meetingId: string;
  language?: string;
  mode: 'upload' | 'stream';
  chunkStrategy: 'fixed' | 'semantic' | 'speaker' | 'streaming';
}

interface BatchTranscriptionDependencies {
  provider: ITranscriptionProvider;
  apiClient: {
    uploadWhisperJson: (
      meetingId: string,
      rawResponse: unknown,
      chunkStrategy: 'fixed' | 'semantic' | 'speaker' | 'streaming',
    ) => Promise<{ transcript: { id: string }; chunks: Array<{ id: string }> }>;
    postStreamEvent: (meetingId: string, event: TranscriptEvent) => Promise<void>;
    flushStream: (meetingId: string) => Promise<void>;
  };
  readAudioFile: (path: string) => Promise<Buffer>;
}

export interface LocalTranscriptionOptions {
  audioFilePath: string;
  language?: string;
  outputPath?: string;
  outputTextPath?: string;
  outputSrtPath?: string;
}

export interface UploadSmokeOptions {
  audioFilePath: string;
  meetingId?: string;
  language?: string;
  chunkStrategy: 'fixed' | 'semantic' | 'speaker' | 'streaming';
}

function buildBatchDependencies(deps?: Partial<BatchTranscriptionDependencies>): BatchTranscriptionDependencies {
  const apiUrl = process.env.DECISION_LOGGER_API_URL ?? 'http://localhost:3000';
  const apiKey = process.env.DECISION_LOGGER_API_KEY;
  return {
    provider: deps?.provider ?? createProviderFromEnv(),
    apiClient: deps?.apiClient ?? new DecisionLoggerApiClient(apiUrl, apiKey),
    readAudioFile: deps?.readAudioFile ?? readFile,
  };
}

export async function runBatchTranscription(
  options: BatchTranscriptionOptions,
  deps?: Partial<BatchTranscriptionDependencies>,
): Promise<void> {
  const { provider, apiClient, readAudioFile } = buildBatchDependencies(deps);
  const audioBuffer = await readAudioFile(options.audioFilePath);
  const transcribeOptions: { filename: string; language?: string } = {
    filename: basename(options.audioFilePath),
  };
  if (options.language !== undefined) {
    transcribeOptions.language = options.language;
  }

  const transcription = await provider.transcribe(audioBuffer, transcribeOptions);

  if (options.mode === 'upload') {
    const result = await apiClient.uploadWhisperJson(
      options.meetingId,
      transcription.rawResponse,
      options.chunkStrategy,
    );
    console.log(`Uploaded transcript ${result.transcript.id}; created ${result.chunks.length} chunks.`);
    return;
  }

  for (const event of transcription.events) {
    await apiClient.postStreamEvent(options.meetingId, event);
  }

  await apiClient.flushStream(options.meetingId);
  console.log(`Streamed ${transcription.events.length} transcript events and flushed stream.`);
}

export async function runLocalTranscription(options: LocalTranscriptionOptions): Promise<void> {
  const provider = createProviderFromEnv();
  const audioBuffer = await readFile(options.audioFilePath);

  const transcribeOptions: { filename: string; language?: string } = {
    filename: basename(options.audioFilePath),
  };
  if (options.language !== undefined) {
    transcribeOptions.language = options.language;
  }

  const transcription = await provider.transcribe(audioBuffer, transcribeOptions);
  const preview = transcription.events.slice(0, 10);

  console.log(`Transcription complete. Segments: ${transcription.events.length}`);
  for (const [index, event] of preview.entries()) {
    console.log(formatEventPreviewLine(index + 1, event));
  }

  if (transcription.events.length > preview.length) {
    console.log(`... ${transcription.events.length - preview.length} additional segments omitted`);
  }

  if (options.outputPath !== undefined) {
    await writeFile(options.outputPath, JSON.stringify(transcription, null, 2), 'utf8');
    console.log(`Saved raw transcription output to ${options.outputPath}`);
  }

  if (options.outputTextPath !== undefined) {
    await writeFile(options.outputTextPath, formatEventsAsText(transcription.events), 'utf8');
    console.log(`Saved plain text transcript to ${options.outputTextPath}`);
  }

  if (options.outputSrtPath !== undefined) {
    await writeFile(options.outputSrtPath, formatEventsAsSrt(transcription.events), 'utf8');
    console.log(`Saved SRT transcript to ${options.outputSrtPath}`);
  }
}

export async function runUploadSmoke(options: UploadSmokeOptions): Promise<void> {
  const apiUrl = process.env.DECISION_LOGGER_API_URL ?? 'http://localhost:3000';
  const apiKey = process.env.DECISION_LOGGER_API_KEY;
  const apiClient = new DecisionLoggerApiClient(apiUrl, apiKey);

  let meetingId = options.meetingId;
  if (!meetingId) {
    const createdMeeting = await apiClient.createMeeting({
      title: `Transcription Smoke ${new Date().toISOString()}`,
      date: new Date().toISOString(),
      participants: ['transcription-service'],
    });
    meetingId = createdMeeting.id;
    console.log(`Created smoke meeting: ${meetingId}`);
  }

  await runBatchTranscription({
    audioFilePath: options.audioFilePath,
    meetingId,
    mode: 'upload',
    chunkStrategy: options.chunkStrategy,
    ...(options.language === undefined ? {} : { language: options.language }),
  }, {
    apiClient,
  });

  const reading = await apiClient.getTranscriptReading(meetingId);
  console.log(`Smoke verification rows: ${reading.rows.length}`);
  const [first] = reading.rows;
  if (first) {
    console.log(`First row: ${first.startTime ?? 'n/a'} -> ${first.endTime ?? 'n/a'} | ${first.displayText}`);
  }
}
