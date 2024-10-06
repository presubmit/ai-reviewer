/*
  Warnings:

  - A unique constraint covering the columns `[githubId]` on the table `Team` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "githubId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_githubId_key" ON "Team"("githubId");
