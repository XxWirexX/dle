ALTER TABLE "users" ADD COLUMN "discord_id" varchar(32);--> statement-breakpoint
CREATE UNIQUE INDEX "users_discord_id_idx" ON "users" USING btree ("discord_id");