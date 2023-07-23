/*
  Warnings:

  - You are about to drop the column `userId` on the `ActiveOrder` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `StarkKey` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[accountId]` on the table `StarkKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountId` to the `ActiveOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accountId` to the `StarkKey` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ActiveOrder" DROP CONSTRAINT "ActiveOrder_userId_fkey";

-- DropForeignKey
ALTER TABLE "StarkKey" DROP CONSTRAINT "StarkKey_userId_fkey";

-- DropIndex
DROP INDEX "ActiveOrder_marketId_key";

-- DropIndex
DROP INDEX "StarkKey_userId_key";

-- AlterTable
ALTER TABLE "ActiveOrder" DROP COLUMN "userId",
ADD COLUMN     "accountId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StarkKey" DROP COLUMN "userId",
ADD COLUMN     "accountId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_key" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StarkKey_accountId_key" ON "StarkKey"("accountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarkKey" ADD CONSTRAINT "StarkKey_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveOrder" ADD CONSTRAINT "ActiveOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
