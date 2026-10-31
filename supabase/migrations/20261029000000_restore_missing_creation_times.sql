-- Convex supplied _creationTime automatically. These two migrated tables were
-- missing it, which breaks ordered reads in the Supabase backend adapter.
ALTER TABLE public."notificationClears"
  ADD COLUMN IF NOT EXISTS "_creationTime" double precision;

UPDATE public."notificationClears"
SET "_creationTime" = COALESCE("clearedAt", extract(epoch from clock_timestamp()) * 1000)
WHERE "_creationTime" IS NULL;

ALTER TABLE public."notificationClears"
  ALTER COLUMN "id" SET DEFAULT 'notificationClears:' || gen_random_uuid()::text,
  ALTER COLUMN "_creationTime" SET DEFAULT (extract(epoch from clock_timestamp()) * 1000),
  ALTER COLUMN "_creationTime" SET NOT NULL;

ALTER TABLE public."soundUsageEvents"
  ADD COLUMN IF NOT EXISTS "_creationTime" double precision;

UPDATE public."soundUsageEvents"
SET "_creationTime" = COALESCE("usedAt", extract(epoch from clock_timestamp()) * 1000)
WHERE "_creationTime" IS NULL;

ALTER TABLE public."soundUsageEvents"
  ALTER COLUMN "id" SET DEFAULT 'soundUsageEvents:' || gen_random_uuid()::text,
  ALTER COLUMN "_creationTime" SET DEFAULT (extract(epoch from clock_timestamp()) * 1000),
  ALTER COLUMN "_creationTime" SET NOT NULL;
