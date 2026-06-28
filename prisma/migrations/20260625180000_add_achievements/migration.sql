-- CreateTable
CREATE TABLE IF NOT EXISTS "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_userId_achievementId_key"
ON "user_achievements"("userId", "achievementId");

CREATE INDEX IF NOT EXISTS "user_achievements_userId_idx"
ON "user_achievements"("userId");

ALTER TABLE "user_achievements"
ADD CONSTRAINT "user_achievements_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "profile_views" (
    "viewerId" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_views_pkey" PRIMARY KEY ("viewerId", "profileUserId")
);

ALTER TABLE "profile_views"
ADD CONSTRAINT "profile_views_viewerId_fkey"
FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "profile_views"
ADD CONSTRAINT "profile_views_profileUserId_fkey"
FOREIGN KEY ("profileUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
