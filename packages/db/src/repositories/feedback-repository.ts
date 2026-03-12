import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import { decisionFeedback } from "../schema.js";
import type {
  CreateDecisionFeedback,
  DecisionFeedback,
  UpdateDecisionFeedback,
} from "@repo/schema";

function isMissingDecisionFeedbackTableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("relation \"decision_feedback\" does not exist");
}

export class DrizzleFeedbackRepository {
  async create(data: CreateDecisionFeedback): Promise<DecisionFeedback> {
    const [row] = await db
      .insert(decisionFeedback)
      .values({
        decisionContextId: data.decisionContextId,
        fieldId: data.fieldId,
        draftVersionNumber: data.draftVersionNumber,
        fieldVersionId: data.fieldVersionId,
        rating: data.rating,
        source: data.source,
        authorId: data.authorId,
        comment: data.comment,
        textReference: data.textReference,
        referenceId: data.referenceId,
        referenceUrl: data.referenceUrl,
        excludeFromRegeneration: data.excludeFromRegeneration ?? false,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create feedback item");
    }

    return this.toSchema(row);
  }

  async findByContext(decisionContextId: string): Promise<DecisionFeedback[]> {
    try {
      const rows = await db
        .select()
        .from(decisionFeedback)
        .where(eq(decisionFeedback.decisionContextId, decisionContextId))
        .orderBy(decisionFeedback.createdAt);

      return rows.map((row) => this.toSchema(row));
    } catch (error) {
      if (isMissingDecisionFeedbackTableError(error)) {
        return [];
      }

      throw error;
    }
  }

  async findByField(decisionContextId: string, fieldId: string): Promise<DecisionFeedback[]> {
    try {
      const rows = await db
        .select()
        .from(decisionFeedback)
        .where(
          and(
            eq(decisionFeedback.decisionContextId, decisionContextId),
            eq(decisionFeedback.fieldId, fieldId),
          ),
        )
        .orderBy(decisionFeedback.createdAt);

      return rows.map((row) => this.toSchema(row));
    } catch (error) {
      if (isMissingDecisionFeedbackTableError(error)) {
        return [];
      }

      throw error;
    }
  }

  async update(id: string, data: UpdateDecisionFeedback): Promise<DecisionFeedback | null> {
    const [row] = await db
      .update(decisionFeedback)
      .set({
        ...(data.fieldId !== undefined ? { fieldId: data.fieldId } : {}),
        ...(data.draftVersionNumber !== undefined
          ? { draftVersionNumber: data.draftVersionNumber }
          : {}),
        ...(data.fieldVersionId !== undefined ? { fieldVersionId: data.fieldVersionId } : {}),
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.authorId !== undefined ? { authorId: data.authorId } : {}),
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
        ...(data.textReference !== undefined ? { textReference: data.textReference } : {}),
        ...(data.referenceId !== undefined ? { referenceId: data.referenceId } : {}),
        ...(data.referenceUrl !== undefined ? { referenceUrl: data.referenceUrl } : {}),
        ...(data.excludeFromRegeneration !== undefined
          ? { excludeFromRegeneration: data.excludeFromRegeneration }
          : {}),
      })
      .where(eq(decisionFeedback.id, id))
      .returning();

    return row ? this.toSchema(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await db.delete(decisionFeedback).where(eq(decisionFeedback.id, id)).returning();

    return rows.length > 0;
  }

  private toSchema(row: typeof decisionFeedback.$inferSelect): DecisionFeedback {
    return {
      id: row.id,
      decisionContextId: row.decisionContextId,
      fieldId: row.fieldId ?? null,
      draftVersionNumber: row.draftVersionNumber ?? null,
      fieldVersionId: row.fieldVersionId ?? null,
      rating: row.rating,
      source: row.source,
      authorId: row.authorId,
      comment: row.comment,
      textReference: row.textReference ?? null,
      referenceId: row.referenceId ?? null,
      referenceUrl: row.referenceUrl ?? null,
      excludeFromRegeneration: row.excludeFromRegeneration,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
