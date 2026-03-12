import type { CreateDecisionFeedback, DecisionFeedback, UpdateDecisionFeedback } from "@repo/schema";

export interface IFeedbackRepository {
  create(data: CreateDecisionFeedback): Promise<DecisionFeedback>;
  findByContext(decisionContextId: string): Promise<DecisionFeedback[]>;
  findByField(decisionContextId: string, fieldId: string): Promise<DecisionFeedback[]>;
  update(id: string, data: UpdateDecisionFeedback): Promise<DecisionFeedback | null>;
  delete(id: string): Promise<boolean>;
}
