ALTER TABLE "connection" ADD COLUMN "profile_picture" text;--> statement-breakpoint
GRANT UPDATE (profile_picture) ON connection TO app_worker;
