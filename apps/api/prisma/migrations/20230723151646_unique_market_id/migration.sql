/*
  Warnings:

  - A unique constraint covering the columns `[marketId]` on the table `ActiveOrder` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ActiveOrder_marketId_key" ON "ActiveOrder"("marketId");
