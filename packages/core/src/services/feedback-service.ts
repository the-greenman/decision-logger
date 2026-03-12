import {
  CreateDecisionFeedbackSchema,
  UpdateDecisionFeedbackSchema,
} from "@repo/schema";
import type {
  CreateDecisionFeedback,
  DecisionFeedback,
  UpdateDecisionFeedback,
} from "@repo/schema";
import type { IFeedbackRepository } from "../interfaces/i-feedback-repository.js";

export class FeedbackService {
  constructor(private repository: IFeedbackRepository) {}

  async addFeedback(data: CreateDecisionFeedback): Promise<DecisionFeedback> {
    const validatedData = CreateDecisionFeedbackSchema.parse(data);
    return this.repository.create(validatedData);
  }

  async getFeedbackChain(decisionContextId: string, fieldId?: string): Promise<DecisionFeedback[]> {
    if (!decisionContextId.trim()) {
      throw new Error("Decision context ID is required");
    }

    if (fieldId !== undefined) {
      if (!fieldId.trim()) {
        throw new Error("Field ID is required");
      }

      return this.repository.findByField(decisionContextId, fieldId);
    }

    return this.repository.findByContext(decisionContextId);
  }

  async updateFeedback(id: string, data: UpdateDecisionFeedback): Promise<DecisionFeedback> {
    if (!id.trim()) {
      throw new Error("Feedback ID is required");
    }

    const validatedData = UpdateDecisionFeedbackSchema.parse(data);
    const updated = await this.repository.update(id, validatedData);
    if (!updated) {
      throw new Error("Feedback item not found");
    }

    return updated;
  }

  async toggleExclude(id: string, excludeFromRegeneration: boolean): Promise<DecisionFeedback> {
    if (!id.trim()) {
      throw new Error("Feedback ID is required");
    }

    const updated = await this.repository.update(id, { excludeFromRegeneration });
    if (!updated) {
      throw new Error("Feedback item not found");
    }

    return updated;
  }

  async deleteFeedback(id: string): Promise<void> {
    if (!id.trim()) {
      throw new Error("Feedback ID is required");
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new Error("Feedback item not found");
    }
  }
}
