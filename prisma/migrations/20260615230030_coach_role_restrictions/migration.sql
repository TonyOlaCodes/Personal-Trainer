-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'SEEN');

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "workout_notes" DROP CONSTRAINT "workout_notes_coachId_fkey";

-- DropForeignKey
ALTER TABLE "workout_notes" DROP CONSTRAINT "workout_notes_workoutLogId_fkey";

-- AlterTable
ALTER TABLE "access_codes" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN     "coachLastSeenAt" TIMESTAMP(3),
ADD COLUMN     "coachVideoUrl" TEXT,
ADD COLUMN     "lastUpdatedByClientAt" TIMESTAMP(3),
ALTER COLUMN "feedback" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mentions" TEXT[],
ADD COLUMN     "replyToId" TEXT,
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'SENT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "defaultCheckInDay" INTEGER,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "notifyOnCheckIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnMetricUpdate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnWorkout" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "workout_logs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepGoal" INTEGER,
    "calorieGoal" INTEGER,
    "weightGoalKg" DOUBLE PRECISION,

    CONSTRAINT "client_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reactions_messageId_userId_emoji_key" ON "reactions"("messageId", "userId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "client_goals_userId_key" ON "client_goals"("userId");

-- CreateIndex
CREATE INDEX "messages_replyToId_idx" ON "messages"("replyToId");

-- AddForeignKey
ALTER TABLE "workout_notes" ADD CONSTRAINT "workout_notes_workoutLogId_fkey" FOREIGN KEY ("workoutLogId") REFERENCES "workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_notes" ADD CONSTRAINT "workout_notes_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_goals" ADD CONSTRAINT "client_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
