WITH "ranked_open_reports" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "reporter_profile_id", "target_type", "target_id"
			ORDER BY "created_at", "id"
		) AS "duplicate_rank"
	FROM "reports"
	WHERE "status" = 'open' AND "reporter_profile_id" IS NOT NULL
)
UPDATE "reports"
SET
	"status" = 'dismissed',
	"reviewed_at" = coalesce("reviewed_at", now()),
	"updated_at" = now()
WHERE "id" IN (
	SELECT "id"
	FROM "ranked_open_reports"
	WHERE "duplicate_rank" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_reporter_target_unique" ON "reports" USING btree ("reporter_profile_id","target_type","target_id") WHERE "reports"."status" = 'open';
