/*
  Warnings:

  - You are about to drop the column `maxHeight` on the `PartnerPreference` table. All the data in the column will be lost.
  - You are about to drop the column `minHeight` on the `PartnerPreference` table. All the data in the column will be lost.
  - Added the required column `height` to the `UserProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PartnerPreference" DROP COLUMN "maxHeight",
DROP COLUMN "minHeight";

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "height" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "interest" TEXT[];

ALTER TABLE "UserProfile" ALTER COLUMN "height" DROP DEFAULT;
