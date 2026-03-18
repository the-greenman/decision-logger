import type { CanonicalTranscriptSegment, RawTranscript } from "@repo/schema";

export type { CanonicalTranscriptSegment };

export interface TranscriptPreprocessResult {
  processorId: string;
  processorVersion: string;
  segments: CanonicalTranscriptSegment[];
  warnings: string[];
  stats: {
    inputUnitCount: number;
    outputSegmentCount: number;
    durationMs: number;
  };
}

export interface TranscriptPreprocessor {
  id: string;
  version: string;
  canProcess(input: RawTranscript): boolean;
  process(input: RawTranscript): Promise<TranscriptPreprocessResult>;
}

/**
 * Normalise a raw timestamp value into stream-relative milliseconds.
 *
 * Supported input forms:
 *  - number (seconds float, Whisper)  → Math.round(value * 1000) when < 1000, else value as-is
 *  - "HH:MM:SS"                       → ms offset from 0
 *  - "HH:MM:SS,mmm" (SRT)            → ms offset from 0
 *  - "HH:MM:SS.mmm" (VTT)            → ms offset from 0
 *
 * Returns undefined for any value that cannot be normalised.
 */
export function normalizeTimestamp(value: unknown): number | undefined {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return value >= 1000 ? Math.round(value) : Math.round(value * 1000);
  }

  if (typeof value === "string") {
    return parseTimestampString(value);
  }

  return undefined;
}

function parseTimestampString(value: string): number | undefined {
  // HH:MM:SS,mmm  (SRT)
  // HH:MM:SS.mmm  (VTT)
  // HH:MM:SS      (plain)
  const withMs = value.match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  const plain  = value.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  const match  = withMs ?? plain;
  if (!match) return undefined;

  const hours   = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  const seconds = parseInt(match[3]!, 10);
  const msStr   = match[4];
  const ms      = msStr !== undefined ? parseInt(msStr.padEnd(3, "0"), 10) : 0;

  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + ms;
}

// ---------------------------------------------------------------------------
// Whisper / JSON preprocessor
// ---------------------------------------------------------------------------

type WhisperLikeSegment = {
  text?: string;
  speaker?: string | null;
  start?: number;
  end?: number;
  startTimeMs?: number;
  endTimeMs?: number;
  start_ms?: number;
  end_ms?: number;
  [key: string]: unknown;
};

class WhisperTranscriptPreprocessor implements TranscriptPreprocessor {
  id = "whisper_canonical";
  version = "1";

  canProcess(input: RawTranscript): boolean {
    if (input.format !== "json") {
      return false;
    }

    const parsed = this.tryParse(input.content);
    if (!parsed) {
      return false;
    }

    const segments = this.extractSegments(parsed);
    return (
      segments.length > 0 &&
      segments.every(
        (segment) => typeof segment.text === "string" && segment.text.trim().length > 0,
      )
    );
  }

  async process(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const startedAt = Date.now();
    const parsed = this.tryParse(input.content);
    if (!parsed) {
      throw new Error("Invalid JSON transcript payload");
    }

    const rawSegments = this.extractSegments(parsed);
    if (rawSegments.length === 0) {
      throw new Error("JSON transcript payload does not contain any transcript segments");
    }

    const segments = rawSegments
      .map((segment, index) => this.toCanonicalSegment(segment, index))
      .filter((segment): segment is CanonicalTranscriptSegment => segment !== null);

    if (segments.length === 0) {
      throw new Error("JSON transcript payload does not contain any non-empty transcript segments");
    }

    return {
      processorId: this.id,
      processorVersion: this.version,
      segments,
      warnings: [],
      stats: {
        inputUnitCount: rawSegments.length,
        outputSegmentCount: segments.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  private tryParse(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private extractSegments(parsed: unknown): WhisperLikeSegment[] {
    if (Array.isArray(parsed)) {
      return parsed as WhisperLikeSegment[];
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { segments?: unknown }).segments)
    ) {
      return (parsed as { segments: WhisperLikeSegment[] }).segments;
    }

    return [];
  }

  private toCanonicalSegment(
    segment: WhisperLikeSegment,
    index: number,
  ): CanonicalTranscriptSegment | null {
    const text = typeof segment.text === "string" ? segment.text.trim() : "";
    if (!text) {
      return null;
    }

    const startTimeMs = normalizeTimestamp(
      segment.startTimeMs ?? segment.start_ms ?? segment.start,
    );
    const endTimeMs = normalizeTimestamp(segment.endTimeMs ?? segment.end_ms ?? segment.end);

    const canonicalSegment: CanonicalTranscriptSegment = {
      sequenceNumber: index + 1,
      text,
      contentType: "speech",
      sourceMetadata: {
        originalIndex: index,
      },
    };

    if (typeof segment.speaker === "string" && segment.speaker.trim().length > 0) {
      canonicalSegment.speaker = segment.speaker.trim();
    }
    if (startTimeMs !== undefined) {
      canonicalSegment.startTimeMs = startTimeMs;
    }
    if (endTimeMs !== undefined) {
      canonicalSegment.endTimeMs = endTimeMs;
    }

    return canonicalSegment;
  }
}

// ---------------------------------------------------------------------------
// SRT preprocessor
// ---------------------------------------------------------------------------

/** Matches "00:00:01,000 --> 00:00:03,500" */
const SRT_TIMESTAMP_RE =
  /^(\d{2}:\d{2}:\d{2}[,.:]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.:]\d{1,3})/;

class SrtTranscriptPreprocessor implements TranscriptPreprocessor {
  id = "srt_canonical";
  version = "1";

  canProcess(input: RawTranscript): boolean {
    return input.format === "srt";
  }

  async process(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const startedAt = Date.now();
    const blocks = input.content
      .split(/\n\s*\n+/)
      .map((b) => b.trim())
      .filter(Boolean);
    const segments: CanonicalTranscriptSegment[] = [];

    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map((l) => l.trim());
      let startTimeMs: number | undefined;
      let endTimeMs: number | undefined;
      const textLines: string[] = [];

      for (const line of lines) {
        if (/^\d+$/.test(line)) {
          // sequence number line — skip
          continue;
        }
        const tsMatch = SRT_TIMESTAMP_RE.exec(line);
        if (tsMatch) {
          startTimeMs = normalizeTimestamp(tsMatch[1]!);
          endTimeMs = normalizeTimestamp(tsMatch[2]!);
          continue;
        }
        if (line.length > 0) {
          textLines.push(line);
        }
      }

      const text = textLines.join(" ").trim();
      if (!text) continue;

      const seg: CanonicalTranscriptSegment = {
        sequenceNumber: segments.length + 1,
        text,
        contentType: "speech",
      };
      if (startTimeMs !== undefined) seg.startTimeMs = startTimeMs;
      if (endTimeMs !== undefined) seg.endTimeMs = endTimeMs;
      segments.push(seg);
    }

    if (segments.length === 0) {
      throw new Error("SRT transcript contains no usable segments");
    }

    return {
      processorId: this.id,
      processorVersion: this.version,
      segments,
      warnings: [],
      stats: {
        inputUnitCount: blocks.length,
        outputSegmentCount: segments.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// VTT preprocessor
// ---------------------------------------------------------------------------

/** Matches "00:00:01.000 --> 00:00:03.500" */
const VTT_TIMESTAMP_RE =
  /^(\d{2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{1,3})/;

class VttTranscriptPreprocessor implements TranscriptPreprocessor {
  id = "vtt_canonical";
  version = "1";

  canProcess(input: RawTranscript): boolean {
    return input.format === "vtt";
  }

  async process(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const startedAt = Date.now();
    // Strip the WEBVTT header line
    const body = input.content.replace(/^WEBVTT[^\n]*\n?/, "");
    const blocks = body
      .split(/\n\s*\n+/)
      .map((b) => b.trim())
      .filter(Boolean);
    const segments: CanonicalTranscriptSegment[] = [];

    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map((l) => l.trim());
      let startTimeMs: number | undefined;
      let endTimeMs: number | undefined;
      const textLines: string[] = [];

      for (const line of lines) {
        const tsMatch = VTT_TIMESTAMP_RE.exec(line);
        if (tsMatch) {
          startTimeMs = normalizeTimestamp(tsMatch[1]!);
          endTimeMs = normalizeTimestamp(tsMatch[2]!);
          continue;
        }
        // Skip cue identifier lines (appear before timestamp, no spaces)
        if (startTimeMs === undefined && /^[a-zA-Z0-9_-]+$/.test(line)) {
          continue;
        }
        if (line.length > 0) {
          textLines.push(line);
        }
      }

      const text = textLines.join(" ").trim();
      if (!text) continue;

      const seg: CanonicalTranscriptSegment = {
        sequenceNumber: segments.length + 1,
        text,
        contentType: "speech",
      };
      if (startTimeMs !== undefined) seg.startTimeMs = startTimeMs;
      if (endTimeMs !== undefined) seg.endTimeMs = endTimeMs;
      segments.push(seg);
    }

    if (segments.length === 0) {
      throw new Error("VTT transcript contains no usable segments");
    }

    return {
      processorId: this.id,
      processorVersion: this.version,
      segments,
      warnings: [],
      stats: {
        inputUnitCount: blocks.length,
        outputSegmentCount: segments.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Plain text preprocessor (TXT only — no timestamps available)
// ---------------------------------------------------------------------------

class PlainTextTranscriptPreprocessor implements TranscriptPreprocessor {
  id = "plain_text_blocks";
  version = "1";
  private readonly maxCharactersPerSegment = 420;
  private readonly minCharactersPerSegment = 80;

  canProcess(input: RawTranscript): boolean {
    return input.format === "txt";
  }

  async process(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    const blocks = input.content
      .split(/\n\s*\n+/)
      .map((block) => this.normalizeWhitespace(block))
      .filter((block) => block.length > 0);

    const sourceBlocks =
      blocks.length > 0 ? blocks : [this.normalizeWhitespace(input.content)].filter(Boolean);
    const segments = sourceBlocks.flatMap((block, index) => this.splitBlock(block, index));

    if (segments.length === 0) {
      throw new Error("Transcript content is empty after normalization");
    }

    if (segments.length > sourceBlocks.length) {
      warnings.push("Oversized transcript blocks were split into multiple normalized segments");
    }

    return {
      processorId: this.id,
      processorVersion: this.version,
      segments,
      warnings,
      stats: {
        inputUnitCount: sourceBlocks.length,
        outputSegmentCount: segments.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  private splitBlock(block: string, blockIndex: number): CanonicalTranscriptSegment[] {
    if (block.length <= this.maxCharactersPerSegment) {
      return [
        {
          sequenceNumber: blockIndex + 1,
          text: block,
          contentType: "speech",
          sourceMetadata: {
            sourceBlockIndex: blockIndex,
          },
        },
      ];
    }

    const sentences = block
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => this.normalizeWhitespace(sentence))
      .filter(Boolean);

    if (sentences.length <= 1) {
      return this.splitByLength(block, blockIndex);
    }

    const segments: CanonicalTranscriptSegment[] = [];
    let current = "";
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (
        candidate.length <= this.maxCharactersPerSegment ||
        current.length < this.minCharactersPerSegment
      ) {
        current = candidate;
        continue;
      }

      segments.push({
        sequenceNumber: segments.length + 1,
        text: current,
        contentType: "speech",
        sourceMetadata: {
          sourceBlockIndex: blockIndex,
          splitStrategy: "sentence",
          chunkIndex,
        },
      });
      current = sentence;
      chunkIndex += 1;
    }

    if (current) {
      segments.push({
        sequenceNumber: segments.length + 1,
        text: current,
        contentType: "speech",
        sourceMetadata: {
          sourceBlockIndex: blockIndex,
          splitStrategy: "sentence",
          chunkIndex,
        },
      });
    }

    return segments;
  }

  private splitByLength(block: string, blockIndex: number): CanonicalTranscriptSegment[] {
    const words = block.split(/\s+/).filter(Boolean);
    const segments: CanonicalTranscriptSegment[] = [];
    let currentWords: string[] = [];
    let chunkIndex = 0;

    for (const word of words) {
      const candidate = [...currentWords, word].join(" ");
      if (candidate.length <= this.maxCharactersPerSegment || currentWords.length === 0) {
        currentWords.push(word);
        continue;
      }

      segments.push({
        sequenceNumber: segments.length + 1,
        text: currentWords.join(" "),
        contentType: "speech",
        sourceMetadata: {
          sourceBlockIndex: blockIndex,
          splitStrategy: "length",
          chunkIndex,
        },
      });
      currentWords = [word];
      chunkIndex += 1;
    }

    if (currentWords.length > 0) {
      segments.push({
        sequenceNumber: segments.length + 1,
        text: currentWords.join(" "),
        contentType: "speech",
        sourceMetadata: {
          sourceBlockIndex: blockIndex,
          splitStrategy: "length",
          chunkIndex,
        },
      });
    }

    return segments;
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }
}

// ---------------------------------------------------------------------------
// Chat-TXT preprocessor — one message per line, contentType: message
// ---------------------------------------------------------------------------

class ChatTxtTranscriptPreprocessor implements TranscriptPreprocessor {
  id = "chat_txt";
  version = "1";

  canProcess(input: RawTranscript): boolean {
    return input.format === "chat-txt";
  }

  async process(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const startedAt = Date.now();
    const lines = input.content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new Error("chat-txt transcript contains no messages");
    }

    const segments: CanonicalTranscriptSegment[] = lines.map((line, index) => ({
      sequenceNumber: index + 1,
      text: line,
      contentType: "message",
    }));

    return {
      processorId: this.id,
      processorVersion: this.version,
      segments,
      warnings: [],
      stats: {
        inputUnitCount: lines.length,
        outputSegmentCount: segments.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Chat-JSON preprocessor — array of {sender, text, timestamp?} objects
// ---------------------------------------------------------------------------

type ChatJsonMessage = {
  text?: string;
  sender?: string;
  author?: string;
  displayName?: string;
  timestamp?: string;
  [key: string]: unknown;
};

class ChatJsonTranscriptPreprocessor implements TranscriptPreprocessor {
  id = "chat_json";
  version = "1";

  canProcess(input: RawTranscript): boolean {
    return input.format === "chat-json";
  }

  async process(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const startedAt = Date.now();
    let messages: ChatJsonMessage[];
    try {
      const parsed = JSON.parse(input.content);
      if (!Array.isArray(parsed)) {
        throw new Error("chat-json content must be a JSON array");
      }
      messages = parsed as ChatJsonMessage[];
    } catch (err) {
      throw new Error(
        `Invalid chat-json transcript: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (messages.length === 0) {
      throw new Error("chat-json transcript contains no messages");
    }

    const streamEpochMs = input.streamEpochMs;
    const segments: CanonicalTranscriptSegment[] = [];

    for (const msg of messages) {
      const text = typeof msg.text === "string" ? msg.text.trim() : "";
      if (!text) continue;

      const speaker =
        typeof msg.sender === "string"      ? msg.sender.trim()      :
        typeof msg.author === "string"      ? msg.author.trim()      :
        typeof msg.displayName === "string" ? msg.displayName.trim() :
        undefined;

      const seg: CanonicalTranscriptSegment = {
        sequenceNumber: segments.length + 1,
        text,
        contentType: "message",
      };

      if (speaker) seg.speaker = speaker;

      // Convert ISO 8601 wall-clock to stream-relative ms when epoch is known
      if (typeof msg.timestamp === "string" && streamEpochMs !== undefined && streamEpochMs !== null) {
        const wallClockMs = Date.parse(msg.timestamp);
        if (Number.isFinite(wallClockMs)) {
          seg.startTimeMs = Math.max(0, wallClockMs - streamEpochMs);
        }
      }

      segments.push(seg);
    }

    if (segments.length === 0) {
      throw new Error("chat-json transcript contains no non-empty messages");
    }

    return {
      processorId: this.id,
      processorVersion: this.version,
      segments,
      warnings: [],
      stats: {
        inputUnitCount: messages.length,
        outputSegmentCount: segments.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class TranscriptPreprocessorRegistry {
  constructor(private preprocessors: TranscriptPreprocessor[]) {}

  preprocess(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const preprocessor = this.preprocessors.find((candidate) => candidate.canProcess(input));
    if (!preprocessor) {
      throw new Error(`No transcript preprocessor available for format ${input.format}`);
    }

    return preprocessor.process(input);
  }
}

export function createDefaultTranscriptPreprocessorRegistry(): TranscriptPreprocessorRegistry {
  return new TranscriptPreprocessorRegistry([
    new WhisperTranscriptPreprocessor(),
    new SrtTranscriptPreprocessor(),
    new VttTranscriptPreprocessor(),
    new ChatJsonTranscriptPreprocessor(),
    new ChatTxtTranscriptPreprocessor(),
    new PlainTextTranscriptPreprocessor(),
  ]);
}
