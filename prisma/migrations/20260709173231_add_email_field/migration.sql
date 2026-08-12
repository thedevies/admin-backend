/*
  Warnings:

  - You are about to drop the column `isUsed` on the `Otp` table. All the data in the column will be lost.
  - Made the column `otp` on table `Otp` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Otp" DROP COLUMN "isUsed",
ALTER COLUMN "mobile" DROP NOT NULL,
ALTER COLUMN "otp" SET NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;
