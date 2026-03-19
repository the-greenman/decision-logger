DO $$ BEGIN
 CREATE TYPE "content_type" AS ENUM('speech', 'message');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "derivation_type" AS ENUM('synthesis', 'translation', 'cleanup', 'interpretation');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "stream_relationship" AS ENUM('equivalent', 'parallel', 'derived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "transcript_format" ADD VALUE 'chat-json';--> statement-breakpoint
ALTER TYPE "transcript_format" ADD VALUE 'chat-txt';--> statement-breakpoint
ALTER TABLE "raw_transcripts" ADD COLUMN "stream_relationship" "stream_relationship" DEFAULT 'equivalent' NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_transcripts" ADD COLUMN "stream_epoch_ms" bigint;--> statement-breakpoint
ALTER TABLE "raw_transcripts" ADD COLUMN "audio_uri" text;--> statement-breakpoint
ALTER TABLE "raw_transcripts" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "raw_transcripts" ADD COLUMN "derivation_type" "derivation_type";--> statement-breakpoint
ALTER TABLE "raw_transcripts" ADD COLUMN "derived_from_chunk_ids" uuid[];--> statement-breakpoint
ALTER TABLE "raw_transcripts" ADD COLUMN "deriving_agent_id" text;--> statement-breakpoint
ALTER TABLE "transcript_chunks" ADD COLUMN "content_type" "content_type" DEFAULT 'speech' NOT NULL;--> statement-breakpoint
ALTER TABLE "transcript_chunks" ADD COLUMN "start_time_ms" integer;--> statement-breakpoint
ALTER TABLE "transcript_chunks" ADD COLUMN "end_time_ms" integer;--> statement-breakpoint
ALTER TABLE "transcript_chunks" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "transcript_chunks" ADD COLUMN "thread_id" text;