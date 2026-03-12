import type { DecisionContext } from "@repo/schema";
import type { MarkdownExportOptions } from "../services/markdown-export-service";

export interface IContentCreator {
  generateDraft(decisionContextId: string): Promise<DecisionContext>;
  regenerateField(decisionContextId: string, fieldId: string): Promise<string>;
  exportMarkdown(decisionContextId: string, options?: MarkdownExportOptions): Promise<string>;
}
