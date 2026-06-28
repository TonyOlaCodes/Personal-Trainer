ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accessLiaisonId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accessRequestSentAt" TIMESTAMP(3);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_accessLiaisonId_fkey'
    ) THEN
        ALTER TABLE "users"
        ADD CONSTRAINT "users_accessLiaisonId_fkey"
        FOREIGN KEY ("accessLiaisonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
