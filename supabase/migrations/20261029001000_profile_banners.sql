ALTER TABLE public."users"
  ADD COLUMN IF NOT EXISTS "bannerStorageId" text;
