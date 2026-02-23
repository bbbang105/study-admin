CREATE TABLE IF NOT EXISTS "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"round_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "config" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"title" varchar(500) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"published_at" timestamp with time zone,
	"category" varchar(50) NOT NULL,
	"tags" text[],
	"relevance_score" real DEFAULT 0,
	"is_shared" boolean DEFAULT false,
	"shared_at" timestamp with time zone,
	"collected_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "curation_items_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curation_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" varchar(500) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "curation_sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"round_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar(20) DEFAULT 'unpaid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" varchar(100) NOT NULL,
	"frequency" integer DEFAULT 1,
	"last_updated" timestamp with time zone DEFAULT now(),
	CONSTRAINT "keywords_keyword_unique" UNIQUE("keyword")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" varchar(20) NOT NULL,
	"discord_username" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"part" varchar(50) NOT NULL,
	"blog_url" varchar(500) NOT NULL,
	"rss_url" varchar(500),
	"profile_image_url" varchar(500),
	"bio" varchar(200),
	"interests" text[],
	"resolution" varchar(300),
	"onboarding_completed" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"dormant_start_round" integer,
	"dormant_used" boolean DEFAULT false,
	"joined_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "members_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"round_id" integer,
	"title" varchar(500) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"description" text,
	"collected_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "posts_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"round_number" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"grace_end_date" date NOT NULL,
	"is_current" boolean DEFAULT false,
	CONSTRAINT "rounds_round_number_unique" UNIQUE("round_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false,
	"email_verify_token" varchar(255),
	"email_verify_expires" timestamp with time zone,
	"member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance" ADD CONSTRAINT "attendance_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance" ADD CONSTRAINT "attendance_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curation_items" ADD CONSTRAINT "curation_items_source_id_curation_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."curation_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fines" ADD CONSTRAINT "fines_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fines" ADD CONSTRAINT "fines_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_member_round_unique" ON "attendance" USING btree ("member_id","round_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attendance_round_id" ON "attendance" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_curation_items_is_shared" ON "curation_items" USING btree ("is_shared");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fines_member_round_unique" ON "fines" USING btree ("member_id","round_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fines_status" ON "fines" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_members_status" ON "members" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_posts_member_id" ON "posts" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_posts_round_id" ON "posts" USING btree ("round_id");