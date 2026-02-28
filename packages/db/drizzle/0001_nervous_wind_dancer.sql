ALTER TYPE "chunk_strategy" ADD VALUE 'streaming';--> statement-breakpoint
ALTER TABLE "flagged_decisions" ADD COLUMN "updated_at" timestamp with time zone;