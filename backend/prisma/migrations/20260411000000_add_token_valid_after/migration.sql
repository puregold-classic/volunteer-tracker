-- Add tokenValidAfter column for lightweight JWT revocation.
-- Any token with iat (issued-at) earlier than this timestamp is rejected by
-- the authenticate middleware. Updated on logout / password change.
ALTER TABLE "accounts" ADD COLUMN "tokenValidAfter" TIMESTAMP(3);
