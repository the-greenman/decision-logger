CREATE TABLE IF NOT EXISTS "supplementary_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"label" text,
	"body" text NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"contexts" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supcontent_meeting" ON "supplementary_content" ("meeting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supcontent_contexts" ON "supplementary_content" USING gin ("contexts");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplementary_content" ADD CONSTRAINT "supplementary_content_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
