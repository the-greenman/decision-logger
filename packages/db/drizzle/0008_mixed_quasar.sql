DO $$ BEGIN
 CREATE TYPE "feedback_rating" AS ENUM('approved', 'needs_work', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "feedback_source" AS ENUM('user', 'expert_agent', 'peer_user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_context_id" uuid NOT NULL,
	"field_id" uuid,
	"draft_version_number" integer,
	"field_version_id" uuid,
	"rating" "feedback_rating" NOT NULL,
	"source" "feedback_source" NOT NULL,
	"author_id" text NOT NULL,
	"comment" text NOT NULL,
	"text_reference" text,
	"reference_id" text,
	"reference_url" text,
	"exclude_from_regeneration" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decision_contexts"
	ALTER COLUMN "locked_fields" SET DATA TYPE uuid[]
	USING "locked_fields"::uuid[];--> statement-breakpoint
ALTER TABLE "decision_contexts" ALTER COLUMN "locked_fields" SET DEFAULT '{}'::uuid[];--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_feedback_context" ON "decision_feedback" ("decision_context_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_feedback_field" ON "decision_feedback" ("field_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_feedback_context_field" ON "decision_feedback" ("decision_context_id","field_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_feedback" ADD CONSTRAINT "decision_feedback_decision_context_id_decision_contexts_id_fk" FOREIGN KEY ("decision_context_id") REFERENCES "decision_contexts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_feedback" ADD CONSTRAINT "decision_feedback_field_id_decision_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "decision_fields"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
