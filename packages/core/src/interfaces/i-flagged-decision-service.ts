/**
 * Service interface for Flagged Decision operations
 * Follows dependency injection pattern
 */

export interface IFlaggedDecisionService {
  /**
   * Create a new flagged decision
   */
  createFlaggedDecision(data: CreateFlaggedDecision): Promise<FlaggedDecision>;

  /**
   * Get all flagged decisions for a meeting, ordered by priority
   */
  getDecisionsForMeeting(meetingId: string): Promise<FlaggedDecision[]>;

  /**
   * Update the status of a flagged decision
   */
  updateDecisionStatus(
    decisionId: string,
    status: FlaggedDecision['status']
  ): Promise<FlaggedDecision>;

  /**
   * Update priorities for multiple decisions
   */
  prioritizeDecisions(
    decisionIds: string[],
    priorities: number[]
  ): Promise<void>;
}

// Import types
import type { FlaggedDecision, CreateFlaggedDecision } from '@repo/schema';
