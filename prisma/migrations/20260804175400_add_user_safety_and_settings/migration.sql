-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('BUG', 'TECHNICAL', 'PAYMENT', 'PROFILE', 'ACCOUNT', 'ABUSE', 'FEATURE_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- DropIndex
DROP INDEX "Otp_email_idx";

-- AlterTable
ALTER TABLE "Otp" DROP COLUMN "attempts";

-- AlterTable
ALTER TABLE "SuccessStory" ADD COLUMN     "partnerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "matchAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pushNotificationEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "drinking" TEXT,
ADD COLUMN     "smoking" TEXT,
ADD COLUMN     "successStory" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReportProblem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "appVersion" TEXT,
    "deviceInfo" TEXT,
    "osVersion" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "adminRemark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedUser" (
    "id" SERIAL NOT NULL,
    "blockerId" INTEGER NOT NULL,
    "blockedId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportedUser" (
    "id" SERIAL NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "reportedId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockedUser_blockerId_idx" ON "BlockedUser"("blockerId");

-- CreateIndex
CREATE INDEX "BlockedUser_blockedId_idx" ON "BlockedUser"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedUser_blockerId_blockedId_key" ON "BlockedUser"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "ReportedUser_reporterId_idx" ON "ReportedUser"("reporterId");

-- CreateIndex
CREATE INDEX "ReportedUser_reportedId_idx" ON "ReportedUser"("reportedId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportedUser_reporterId_reportedId_reason_key" ON "ReportedUser"("reporterId", "reportedId", "reason");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Otp_otp_idx" ON "Otp"("otp");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_refreshToken_idx" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "SuccessStory_partnerId_idx" ON "SuccessStory"("partnerId");

-- CreateIndex
CREATE INDEX "UserPhoto_userId_idx" ON "UserPhoto"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_gender_idx" ON "UserProfile"("gender");

-- CreateIndex
CREATE INDEX "UserProfile_lookingFor_idx" ON "UserProfile"("lookingFor");

-- CreateIndex
CREATE INDEX "UserProfile_maritalStatus_idx" ON "UserProfile"("maritalStatus");

-- CreateIndex
CREATE INDEX "UserProfile_dateOfBirth_idx" ON "UserProfile"("dateOfBirth");

-- CreateIndex
CREATE INDEX "UserProfile_createdAt_idx" ON "UserProfile"("createdAt");

-- CreateIndex
CREATE INDEX "UserProfile_successStory_idx" ON "UserProfile"("successStory");

-- AddForeignKey
ALTER TABLE "ReportProblem" ADD CONSTRAINT "ReportProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportedUser" ADD CONSTRAINT "ReportedUser_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportedUser" ADD CONSTRAINT "ReportedUser_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
