import type {
  TranscriptChunk,
  DecisionField,
  SupplementaryContent,
  DecisionFeedback,
  PromptSegmentData,
} from "@repo/schema";

export type PromptSegment = PromptSegmentData;

export type BuiltPrompt = {
  segments: PromptSegment[];
  text: string;
};

export const DEFAULT_DRAFT_SYSTEM_PROMPT = `You are an expert at analyzing meeting transcripts and extracting structured decision information.
Your task is to extract field values from the provided transcript segments.
Only use information explicitly present in the transcript.
Do not hallucinate or infer beyond what is stated.
If a field cannot be determined from the transcript, return an empty string for that field.`;

/**
 * Constructs LLM prompts as a typed segment list, then serializes to a string.
 *
 * The segment list is stored per LLM interaction for full auditability.
 * Guidance is visually and semantically distinct from transcript content.
 */
export class PromptBuilder {
  private segments: PromptSegment[] = [];

  addSystem(content: string): this {
    this.segments.push({ type: "system", content });
    return this;
  }

  addTranscriptChunk(chunk: TranscriptChunk): this {
    const segment: PromptSegment = {
      type: "transcript",
      text: chunk.text,
      tags: chunk.contexts,
    };

    if (chunk.speaker) {
      segment.speaker = chunk.speaker;
    }

    this.segments.push(segment);
    return this;
  }

  addSupplementaryContent(item: SupplementaryContent): this {
    const segment: PromptSegment = {
      type: "supplementary",
      content: item.body,
      tags: item.contexts,
    };

    if (item.label !== undefined) {
      segment.label = item.label;
    }

    this.segments.push(segment);
    return this;
  }

  addTemplateGuidance(templateId: string, field: DecisionField): this {
    this.segments.push({
      type: "template_guidance",
      scope: "field",
      templateId,
      fieldId: field.id,
      label: field.name,
      content: field.extractionPrompt,
    });

    return this;
  }

  addFeedbackChain(items: DecisionFeedback[]): this {
    for (const item of items) {
      if (item.excludeFromRegeneration) {
        continue;
      }

      this.segments.push({
        type: "feedback",
        id: item.id,
        decisionContextId: item.decisionContextId,
        fieldId: item.fieldId,
        draftVersionNumber: item.draftVersionNumber,
        fieldVersionId: item.fieldVersionId,
        rating: item.rating,
        source: item.source,
        authorId: item.authorId,
        comment: item.comment,
        textReference: item.textReference,
        referenceId: item.referenceId,
        referenceUrl: item.referenceUrl,
        excludeFromRegeneration: item.excludeFromRegeneration,
        createdAt: item.createdAt,
      });
    }

    return this;
  }

  addTemplateFields(fields: DecisionField[]): this {
    this.segments.push({
      type: "template_fields",
      fields: fields.map((f) => ({
        id: f.id,
        displayName: f.name,
        description: f.description,
        extractionPrompt: f.extractionPrompt,
      })),
    });
    return this;
  }

  buildSegments(): PromptSegment[] {
    return [...this.segments];
  }

  buildString(): string {
    const parts: string[] = [];

    const transcriptLines: string[] = [];
    const supplementaryLines: string[] = [];
    const templateGuidanceByField = new Map<string | null, string[]>();
    const feedbackByField = new Map<string | null, string[]>();
    const fieldLines: string[] = [];

    for (const seg of this.segments) {
      if (seg.type === "system") {
        parts.push(seg.content);
      } else if (seg.type === "transcript") {
        const prefix = seg.speaker ? `[${seg.speaker}]: ` : "";
        transcriptLines.push(`${prefix}${seg.text}`);
      } else if (seg.type === "supplementary") {
        const label = seg.label ? `[${seg.label}]\n` : "";
        supplementaryLines.push(`${label}${seg.content}`);
      } else if (seg.type === "template_guidance") {
        const key = seg.fieldId;
        const existing = templateGuidanceByField.get(key) ?? [];
        existing.push(`[${seg.label}] ${seg.content}`);
        templateGuidanceByField.set(key, existing);
      } else if (seg.type === "feedback") {
        const key = seg.fieldId;
        const existing = feedbackByField.get(key) ?? [];
        const quote = seg.textReference ? `\n  > "${seg.textReference}"` : "";
        existing.push(`[${seg.rating} | ${seg.source} | ${seg.authorId}] ${seg.comment}${quote}`);
        feedbackByField.set(key, existing);
      } else if (seg.type === "template_fields") {
        seg.fields.forEach((f, i) => {
          fieldLines.push(
            `${i + 1}. ${f.displayName}: ${f.description}\n   Extraction guidance: ${f.extractionPrompt}`,
          );
        });
      }
    }

    if (transcriptLines.length > 0) {
      parts.push("=== TRANSCRIPT ===");
      parts.push(transcriptLines.join("\n"));
    }

    if (supplementaryLines.length > 0) {
      parts.push("=== SUPPLEMENTARY EVIDENCE ===");
      parts.push(supplementaryLines.join("\n\n"));
    }

    for (const [fieldId, lines] of templateGuidanceByField.entries()) {
      if (fieldId !== null) {
        parts.push(`=== TEMPLATE GUIDANCE (applies to field: ${fieldId}) ===`);
        parts.push(lines.join("\n"));
      }
    }

    const wholeDraftFeedback = feedbackByField.get(null);
    if (wholeDraftFeedback && wholeDraftFeedback.length > 0) {
      parts.push("=== FEEDBACK ON PREVIOUS DRAFT ===");
      parts.push(wholeDraftFeedback.join("\n\n"));
    }

    for (const [fieldId, lines] of feedbackByField.entries()) {
      if (fieldId !== null) {
        parts.push(`=== FEEDBACK (applies to: ${fieldId}) ===`);
        parts.push(lines.join("\n"));
      }
    }

    if (fieldLines.length > 0) {
      parts.push("=== FIELDS TO EXTRACT ===");
      parts.push(fieldLines.join("\n"));
    }

    return parts.join("\n\n");
  }
}

export function buildDraftPrompt(
  transcriptChunks: TranscriptChunk[],
  supplementaryItems: SupplementaryContent[],
  templateId: string,
  templateFields: DecisionField[],
  feedbackChain: DecisionFeedback[] = [],
  currentDraftText?: string,
  templatePrompt?: string | null,
): BuiltPrompt {
  const builder = new PromptBuilder();
  const systemContent = templatePrompt
    ? `${DEFAULT_DRAFT_SYSTEM_PROMPT}\n\nDecision type context: ${templatePrompt}`
    : DEFAULT_DRAFT_SYSTEM_PROMPT;
  builder.addSystem(systemContent);

  for (const chunk of transcriptChunks) {
    builder.addTranscriptChunk(chunk);
  }

  for (const item of supplementaryItems) {
    builder.addSupplementaryContent(item);
  }

  if (currentDraftText && currentDraftText.trim().length > 0) {
    builder.addSupplementaryContent({
      id: "current-draft-context",
      meetingId: transcriptChunks[0]?.meetingId ?? "unknown-meeting",
      body: currentDraftText,
      sourceType: "manual",
      contexts: ["draft:current"],
      createdAt: new Date(0).toISOString(),
      label: "Current draft text",
    });
  }

  builder.addFeedbackChain(feedbackChain);

  for (const field of templateFields) {
    builder.addTemplateGuidance(templateId, field);
  }

  builder.addTemplateFields(templateFields);

  return {
    segments: builder.buildSegments(),
    text: builder.buildString(),
  };
}

export function buildFieldRegenerationPrompt(
  transcriptChunks: TranscriptChunk[],
  supplementaryItems: SupplementaryContent[],
  templateId: string,
  field: DecisionField,
  feedbackChain: DecisionFeedback[] = [],
  currentDraftText?: string | null,
): BuiltPrompt {
  const builder = new PromptBuilder();
  builder.addSystem(DEFAULT_DRAFT_SYSTEM_PROMPT);

  for (const chunk of transcriptChunks) {
    builder.addTranscriptChunk(chunk);
  }

  for (const item of supplementaryItems) {
    builder.addSupplementaryContent(item);
  }

  if (currentDraftText && currentDraftText.trim().length > 0) {
    builder.addSupplementaryContent({
      id: "current-draft-context",
      meetingId: transcriptChunks[0]?.meetingId ?? "unknown-meeting",
      body: currentDraftText,
      sourceType: "manual",
      contexts: ["draft:current"],
      createdAt: new Date(0).toISOString(),
      label: "Current decision draft (reference only — other fields already locked or filled)",
    });
  }

  builder.addFeedbackChain(feedbackChain);
  builder.addTemplateGuidance(templateId, field);

  builder.addTemplateFields([field]);

  return {
    segments: builder.buildSegments(),
    text: builder.buildString(),
  };
}

export async function buildDraftPromptFromTemplate(
  transcriptChunks: TranscriptChunk[],
  supplementaryItems: SupplementaryContent[],
  templateId: string,
  templateFields: DecisionField[],
  feedbackChain: DecisionFeedback[] = [],
  meetingId?: string,
  decisionTitle?: string,
  contextSummary?: string,
  currentDraftText?: string | null,
  templatePrompt?: string | null,
): Promise<BuiltPrompt> {
  // Read the prompt template
  const fs = await import("fs/promises");
  const path = await import("path");
  const templatePath = path.resolve(__dirname, "../../../../prompts/draft-generation.md");
  let promptTemplate = await fs.readFile(templatePath, "utf-8");

  // Build field list section
  const fieldListItems = templateFields
    .map((field) => {
      return `**${field.name}** (ID: ${field.id})\n${field.description || "No description"}\nExtraction prompt: ${field.extractionPrompt || "Extract the value for this field"}`;
    })
    .join("\n\n");

  const templateGuidanceText = templateFields
    .map((field) => `- ${field.name}: ${field.extractionPrompt}`)
    .join("\n");

  // Replace placeholders
  promptTemplate = promptTemplate
    .replace("{GUIDANCE_SECTION}", templateGuidanceText || "No template guidance provided.")
    .replace("{MEETING_ID}", meetingId || "Not specified")
    .replace("{DECISION_TITLE}", decisionTitle || "Not specified")
    .replace("{CONTEXT_SUMMARY}", contextSummary || "Not specified")
    .replace("{FIELD_LIST}", fieldListItems);

  const builder = new PromptBuilder();
  const systemContent = templatePrompt
    ? `${promptTemplate}\n\nDecision type context: ${templatePrompt}`
    : promptTemplate;
  builder.addSystem(systemContent);

  for (const chunk of transcriptChunks) {
    builder.addTranscriptChunk(chunk);
  }

  for (const item of supplementaryItems) {
    builder.addSupplementaryContent(item);
  }

  if (currentDraftText && currentDraftText.trim().length > 0) {
    builder.addSupplementaryContent({
      id: "current-draft-context",
      meetingId: meetingId ?? "unknown-meeting",
      body: currentDraftText,
      sourceType: "manual",
      contexts: ["draft:current"],
      createdAt: new Date(0).toISOString(),
      label: "Current draft text",
    });
  }

  builder.addFeedbackChain(feedbackChain);

  for (const field of templateFields) {
    builder.addTemplateGuidance(templateId, field);
  }

  builder.addTemplateFields(templateFields);

  return {
    segments: builder.buildSegments(),
    text: builder.buildString(),
  };
}
