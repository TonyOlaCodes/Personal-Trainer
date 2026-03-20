-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FREE', 'PREMIUM', 'COACH', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('GAIN_MUSCLE', 'LOSE_WEIGHT', 'RECOMPOSITION', 'STRENGTH');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "TrainingLocation" AS ENUM ('GYM', 'HOME');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('COACH_ASSIGNED', 'USER_CREATED', 'PREBUILT');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'FREE',
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "goal" "Goal",
    "trainingDaysPerWeek" INTEGER,
    "experienceLevel" "ExperienceLevel",
    "trainingLocation" "TrainingLocation",
    "equipment" TEXT[],
    "hasInjuries" BOOLEAN,
    "injuryDetails" TEXT,
    "age" INTEGER,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "targetWeightKg" DOUBLE PRECISION,
    "sessionLengthMin" INTEGER,
    "likedExercises" TEXT[],
    "dislikedExercises" TEXT[],
    "weakMuscles" TEXT[],
    "benchPressKg" DOUBLE PRECISION,
    "squatKg" DOUBLE PRECISION,
    "deadliftKg" DOUBLE PRECISION,
    "ohpKg" DOUBLE PRECISION,
    "cardioPreference" TEXT,
    "dietAwareness" BOOLEAN,
    "preferredSplit" TEXT,
    "coachId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PlanType" NOT NULL DEFAULT 'USER_CREATED',
    "creatorId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeks" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "weightTargetKg" DOUBLE PRECISION,
    "restSeconds" INTEGER,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "videoUrl" TEXT,
    "muscleGroup" TEXT,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "notes" TEXT,
    "feeling" INTEGER,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_sets" (
    "id" TEXT NOT NULL,
    "workoutLogId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "rpe" INTEGER,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "isPR" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "log_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "bodyweightKg" DOUBLE PRECISION,
    "feedback" TEXT NOT NULL,
    "notes" TEXT,
    "frontImageUrl" TEXT,
    "sideImageUrl" TEXT,
    "coachResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT,
    "content" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isGeneral" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "planId" TEXT,
    "generatedBy" TEXT NOT NULL,
    "usedById" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "upgradesTo" "Role" NOT NULL DEFAULT 'PREMIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_plans_userId_planId_key" ON "user_plans"("userId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "weeks_planId_weekNumber_key" ON "weeks"("planId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "workouts_weekId_dayNumber_key" ON "workouts"("weekId", "dayNumber");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_receiverId_idx" ON "messages"("receiverId");

-- CreateIndex
CREATE INDEX "messages_isGeneral_idx" ON "messages"("isGeneral");

-- CreateIndex
CREATE UNIQUE INDEX "access_codes_code_key" ON "access_codes"("code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_sets" ADD CONSTRAINT "log_sets_workoutLogId_fkey" FOREIGN KEY ("workoutLogId") REFERENCES "workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_sets" ADD CONSTRAINT "log_sets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
