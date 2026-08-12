/*
  Warnings:

  - You are about to drop the column `pdfUrl` on the `Biodata` table. All the data in the column will be lost.
  - Changed the type of `biodataType` on the `Biodata` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `gender` on the `UserProfile` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `lookingFor` on the `UserProfile` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `maritalStatus` on the `UserProfile` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "LookingFor" AS ENUM ('BRIDE', 'GROOM');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('NEVER_MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "BiodataType" AS ENUM ('GENERATED', 'UPLOADED');

-- CreateEnum
CREATE TYPE "PreferenceOption" AS ENUM ('YES', 'NO', 'DOESNT_MATTER');

-- AlterTable
ALTER TABLE "Biodata" DROP COLUMN "pdfUrl",
ADD COLUMN     "biodataUrl" TEXT,
ADD COLUMN     "isGenerated" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "biodataType",
ADD COLUMN     "biodataType" "BiodataType" NOT NULL;

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "isUsed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "deviceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLogin" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserPhoto" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "country" TEXT,
ADD COLUMN     "state" TEXT,
DROP COLUMN "gender",
ADD COLUMN     "gender" "Gender" NOT NULL,
DROP COLUMN "lookingFor",
ADD COLUMN     "lookingFor" "LookingFor" NOT NULL,
DROP COLUMN "maritalStatus",
ADD COLUMN     "maritalStatus" "MaritalStatus" NOT NULL;

-- CreateTable
CREATE TABLE "PartnerPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "minHeight" INTEGER,
    "maxHeight" INTEGER,
    "maritalStatuses" "MaritalStatus"[],
    "educations" TEXT[],
    "professions" TEXT[],
    "countries" TEXT[],
    "states" TEXT[],
    "cities" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPreference_userId_key" ON "PartnerPreference"("userId");

-- AddForeignKey
ALTER TABLE "PartnerPreference" ADD CONSTRAINT "PartnerPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
