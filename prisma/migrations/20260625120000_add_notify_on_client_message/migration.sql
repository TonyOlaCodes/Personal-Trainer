-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnClientMessage" BOOLEAN NOT NULL DEFAULT true;
