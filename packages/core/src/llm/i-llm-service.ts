import type { TranscriptChunk, DecisionField } from "@repo/schema";

export type GenerateDraftParams = {
  transcriptChunks: TranscriptChunk[];
  templateFields: DecisionField[];
  promptText?: string;
};

export type RegenerateFieldParams = GenerateDraftParams & { fieldId: string };

export type DraftResult = {
  fields: Record<string, string>; // fieldId → value
  suggestedTags: string[];
};

export interface ILLMService {
  generateDraft(params: GenerateDraftParams): Promise<DraftResult>;
  regenerateField(params: RegenerateFieldParams): Promise<string>;
}
