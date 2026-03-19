/**
 * Unit tests for transcript preprocessors — Phase 1c
 *
 * Acceptance criteria:
 * - normalizeTimestamp is exported and handles all timestamp formats
 * - All preprocessors produce startTimeMs/endTimeMs where source data allows
 * - All preprocessors set contentType: "speech" on segments
 * - SRT/VTT formats parse their embedded timestamps
 */

import { describe, it, expect } from "vitest";
import {
  normalizeTimestamp,
  createDefaultTranscriptPreprocessorRegistry,
} from "../transcript-preprocessing.js";
import type { RawTranscript } from "@repo/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawTranscript(overrides: Partial<RawTranscript>): RawTranscript {
  return {
    id: "test-id",
    meetingId: "meeting-id",
    source: "upload",
    format: "txt",
    content: "",
    metadata: undefined,
    streamRelationship: "equivalent",
    uploadedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeTimestamp utility
// ---------------------------------------------------------------------------

describe("normalizeTimestamp", () => {
  it("converts seconds float (Whisper) to milliseconds", () => {
    expect(normalizeTimestamp(1.5)).toBe(1500);
    expect(normalizeTimestamp(0.5)).toBe(500);
    expect(normalizeTimestamp(0)).toBe(0);
  });

  it("rounds fractional seconds to nearest ms", () => {
    expect(normalizeTimestamp(1.2345)).toBe(1235);
  });

  it("passes through values >= 1000 as already-ms", () => {
    expect(normalizeTimestamp(1200)).toBe(1200);
    expect(normalizeTimestamp(5000)).toBe(5000);
  });

  it("returns undefined for non-numeric input", () => {
    expect(normalizeTimestamp("bad")).toBeUndefined();
    expect(normalizeTimestamp(null)).toBeUndefined();
    expect(normalizeTimestamp(undefined)).toBeUndefined();
    expect(normalizeTimestamp(Infinity)).toBeUndefined();
    expect(normalizeTimestamp(NaN)).toBeUndefined();
  });

  it("converts HH:MM:SS string to ms offset from 0 when no streamEpochMs", () => {
    expect(normalizeTimestamp("00:01:30")).toBe(90_000);
    expect(normalizeTimestamp("01:00:00")).toBe(3_600_000);
    expect(normalizeTimestamp("00:00:05")).toBe(5_000);
  });

  it("converts HH:MM:SS,mmm (SRT style) to ms", () => {
    expect(normalizeTimestamp("00:00:01,500")).toBe(1500);
    expect(normalizeTimestamp("00:01:02,030")).toBe(62_030);
  });

  it("converts HH:MM:SS.mmm (VTT style) to ms", () => {
    expect(normalizeTimestamp("00:00:01.500")).toBe(1500);
    expect(normalizeTimestamp("00:01:02.030")).toBe(62_030);
  });
});

// ---------------------------------------------------------------------------
// WhisperTranscriptPreprocessor (JSON format)
// ---------------------------------------------------------------------------

describe("WhisperTranscriptPreprocessor", () => {
  const registry = createDefaultTranscriptPreprocessorRegistry();

  it("sets contentType: speech on every segment", async () => {
    const transcript = makeRawTranscript({
      format: "json",
      content: JSON.stringify([
        { text: "Hello there", start: 0, end: 1 },
        { text: "General Kenobi", start: 1, end: 2 },
      ]),
    });

    const result = await registry.preprocess(transcript);

    expect(result.segments.every((s) => s.contentType === "speech")).toBe(true);
  });

  it("produces startTimeMs and endTimeMs from start/end seconds", async () => {
    const transcript = makeRawTranscript({
      format: "json",
      content: JSON.stringify([{ text: "Hello", start: 1.5, end: 3.0 }]),
    });

    const result = await registry.preprocess(transcript);

    expect(result.segments[0]!.startTimeMs).toBe(1500);
    expect(result.segments[0]!.endTimeMs).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// SRT format
// ---------------------------------------------------------------------------

describe("SRT preprocessor", () => {
  const registry = createDefaultTranscriptPreprocessorRegistry();

  const srtContent = `1
00:00:01,000 --> 00:00:03,500
Alice: Good morning everyone.

2
00:00:04,200 --> 00:00:06,800
Bob: Let's get started.

3
00:00:07,000 --> 00:00:09,000
Alice: I want to discuss the proposal.
`;

  it("parses SRT timestamps into startTimeMs and endTimeMs", async () => {
    const transcript = makeRawTranscript({ format: "srt", content: srtContent });

    const result = await registry.preprocess(transcript);

    expect(result.segments.length).toBeGreaterThanOrEqual(3);
    expect(result.segments[0]!.startTimeMs).toBe(1000);
    expect(result.segments[0]!.endTimeMs).toBe(3500);
    expect(result.segments[1]!.startTimeMs).toBe(4200);
    expect(result.segments[1]!.endTimeMs).toBe(6800);
  });

  it("sets contentType: speech on SRT segments", async () => {
    const transcript = makeRawTranscript({ format: "srt", content: srtContent });

    const result = await registry.preprocess(transcript);

    expect(result.segments.every((s) => s.contentType === "speech")).toBe(true);
  });

  it("extracts text without the timestamp lines", async () => {
    const transcript = makeRawTranscript({ format: "srt", content: srtContent });

    const result = await registry.preprocess(transcript);

    expect(result.segments[0]!.text).toBe("Alice: Good morning everyone.");
    expect(result.segments[0]!.text).not.toContain("00:00:01,000");
  });
});

// ---------------------------------------------------------------------------
// VTT format
// ---------------------------------------------------------------------------

describe("VTT preprocessor", () => {
  const registry = createDefaultTranscriptPreprocessorRegistry();

  const vttContent = `WEBVTT

00:00:01.000 --> 00:00:03.500
Alice: Hello world.

00:00:04.000 --> 00:00:06.200
Bob: How are you?
`;

  it("parses VTT timestamps into startTimeMs and endTimeMs", async () => {
    const transcript = makeRawTranscript({ format: "vtt", content: vttContent });

    const result = await registry.preprocess(transcript);

    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    expect(result.segments[0]!.startTimeMs).toBe(1000);
    expect(result.segments[0]!.endTimeMs).toBe(3500);
    expect(result.segments[1]!.startTimeMs).toBe(4000);
    expect(result.segments[1]!.endTimeMs).toBe(6200);
  });

  it("sets contentType: speech on VTT segments", async () => {
    const transcript = makeRawTranscript({ format: "vtt", content: vttContent });

    const result = await registry.preprocess(transcript);

    expect(result.segments.every((s) => s.contentType === "speech")).toBe(true);
  });

  it("extracts text without timestamp lines", async () => {
    const transcript = makeRawTranscript({ format: "vtt", content: vttContent });

    const result = await registry.preprocess(transcript);

    expect(result.segments[0]!.text).toBe("Alice: Hello world.");
    expect(result.segments[0]!.text).not.toContain("00:00:01.000");
  });
});

// ---------------------------------------------------------------------------
// Plain text (TXT) — no timestamps available, contentType still set
// ---------------------------------------------------------------------------

describe("PlainTextTranscriptPreprocessor (txt)", () => {
  const registry = createDefaultTranscriptPreprocessorRegistry();

  it("sets contentType: speech even when no timestamps are available", async () => {
    const transcript = makeRawTranscript({
      format: "txt",
      content: "First block.\n\nSecond block.",
    });

    const result = await registry.preprocess(transcript);

    expect(result.segments.every((s) => s.contentType === "speech")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// chat-txt format
// ---------------------------------------------------------------------------

describe("chat-txt preprocessor", () => {
  const registry = createDefaultTranscriptPreprocessorRegistry();

  const chatTxt = `Alice: Good morning everyone.
Bob: Let's get started.
Alice: I want to discuss the proposal.`;

  it("produces one segment per non-empty line with speaker prefix split into speaker field", async () => {
    const transcript = makeRawTranscript({ format: "chat-txt", content: chatTxt });

    const result = await registry.preprocess(transcript);

    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]!.speaker).toBe("Alice");
    expect(result.segments[0]!.text).toBe("Good morning everyone.");
    expect(result.segments[1]!.speaker).toBe("Bob");
    expect(result.segments[1]!.text).toBe("Let's get started.");
    expect(result.segments[2]!.speaker).toBe("Alice");
    expect(result.segments[2]!.text).toBe("I want to discuss the proposal.");
  });

  it("sets contentType: message on all segments", async () => {
    const transcript = makeRawTranscript({ format: "chat-txt", content: chatTxt });

    const result = await registry.preprocess(transcript);

    expect(result.segments.every((s) => s.contentType === "message")).toBe(true);
  });

  it("preserves line as text with no speaker when no colon prefix is present", async () => {
    const transcript = makeRawTranscript({
      format: "chat-txt",
      content: "No prefix here.",
    });

    const result = await registry.preprocess(transcript);

    expect(result.segments[0]!.speaker).toBeUndefined();
    expect(result.segments[0]!.text).toBe("No prefix here.");
  });

  it("skips blank lines", async () => {
    const transcript = makeRawTranscript({
      format: "chat-txt",
      content: "Alice: Hello.\n\nBob: World.\n",
    });

    const result = await registry.preprocess(transcript);

    expect(result.segments).toHaveLength(2);
  });

  it("assigns stable ascending sequenceNumbers", async () => {
    const transcript = makeRawTranscript({ format: "chat-txt", content: chatTxt });

    const result = await registry.preprocess(transcript);

    expect(result.segments.map((s) => s.sequenceNumber)).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// chat-json format
// ---------------------------------------------------------------------------

describe("chat-json preprocessor", () => {
  const registry = createDefaultTranscriptPreprocessorRegistry();

  const chatJson = JSON.stringify([
    { sender: "Alice", text: "Good morning everyone.", timestamp: "2024-01-01T10:00:00Z" },
    { sender: "Bob",   text: "Let's get started.",    timestamp: "2024-01-01T10:00:05Z" },
    { sender: "Alice", text: "I want alignment.",     timestamp: "2024-01-01T10:00:10Z" },
  ]);

  it("produces one segment per message object", async () => {
    const transcript = makeRawTranscript({ format: "chat-json", content: chatJson });

    const result = await registry.preprocess(transcript);

    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]!.text).toBe("Good morning everyone.");
    expect(result.segments[1]!.text).toBe("Let's get started.");
  });

  it("sets contentType: message on all segments", async () => {
    const transcript = makeRawTranscript({ format: "chat-json", content: chatJson });

    const result = await registry.preprocess(transcript);

    expect(result.segments.every((s) => s.contentType === "message")).toBe(true);
  });

  it("maps sender field to speaker", async () => {
    const transcript = makeRawTranscript({ format: "chat-json", content: chatJson });

    const result = await registry.preprocess(transcript);

    expect(result.segments[0]!.speaker).toBe("Alice");
    expect(result.segments[1]!.speaker).toBe("Bob");
  });

  it("derives startTimeMs from ISO 8601 timestamp relative to streamEpochMs when provided", async () => {
    const epochMs = new Date("2024-01-01T10:00:00Z").getTime();
    const transcript = makeRawTranscript({
      format: "chat-json",
      content: chatJson,
      streamEpochMs: epochMs,
    });

    const result = await registry.preprocess(transcript);

    // first message is at epoch, so startTimeMs = 0
    expect(result.segments[0]!.startTimeMs).toBe(0);
    // second message is 5 seconds after epoch
    expect(result.segments[1]!.startTimeMs).toBe(5000);
  });

  it("assigns stable ascending sequenceNumbers", async () => {
    const transcript = makeRawTranscript({ format: "chat-json", content: chatJson });

    const result = await registry.preprocess(transcript);

    expect(result.segments.map((s) => s.sequenceNumber)).toEqual([1, 2, 3]);
  });

  it("throws on invalid JSON", async () => {
    const transcript = makeRawTranscript({ format: "chat-json", content: "not json" });

    await expect(registry.preprocess(transcript)).rejects.toThrow();
  });
});
