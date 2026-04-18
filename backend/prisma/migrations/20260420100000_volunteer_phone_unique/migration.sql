-- v3.3: Volunteer.phone becomes a login identifier. Add @unique so two
-- volunteers can't share a phone number (and so tri-modal login isn't
-- ambiguous).
--
-- Strategy:
--   1. Normalize empty strings to NULL so they don't all clash on the new
--      unique index. Postgres treats multiple NULLs as distinct.
--   2. Add the unique constraint.
--
-- Existing data in this sandbox: checked manually, 0 rows with non-null
-- phone, so no dedup work needed. If the migration were run against a
-- dataset that already has duplicate phones, the unique constraint would
-- fail — fix data first, re-run.

UPDATE "volunteers" SET "phone" = NULL WHERE "phone" = '';

ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_phone_key" UNIQUE ("phone");
