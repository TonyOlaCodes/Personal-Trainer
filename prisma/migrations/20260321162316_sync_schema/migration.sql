/*
  Warnings:

  - A unique constraint covering the columns `[shareCode]` on the table `plans` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `workout_logs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('PENDING', 'REVIEWED');

-- DropForeignKey
ALTER TABLE "log_sets" DROP CONSTRAINT "log_sets_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "workout_logs" DROP CONSTRAINT "workout_logs_workoutId_fkey";

-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN     "dietRating" INTEGER,
ADD COLUMN     "energyRating" INTEGER,
ADD COLUMN     "injuryRating" INTEGER,
ADD COLUMN     "intensityRating" INTEGER,
ADD COLUMN     "sleepRating" INTEGER,
ADD COLUMN     "status" "CheckInStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "stressRating" INTEGER,
ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "log_sets" ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "reps" DROP NOT NULL;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "shareCode" TEXT;

-- AlterTable
ALTER TABLE "workout_logs" ADD COLUMN     "status" "LogStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "dayOfWeek" INTEGER;

-- CreateTable
CREATE TABLE "global_exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "videoUrl" TEXT,
    "muscleGroup" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "global_exercises_name_key" ON "global_exercises"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plans_shareCode_key" ON "plans"("shareCode");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_sets" ADD CONSTRAINT "log_sets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
