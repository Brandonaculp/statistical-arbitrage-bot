-- CreateEnum
CREATE TYPE "ActiveOrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP', 'TRAILING_STOP', 'TAKE_PROFIT', 'LIQUIDATED', 'LIQUIDATION');

-- CreateEnum
CREATE TYPE "ActiveOrderStatus" AS ENUM ('PENDING', 'OPEN', 'UNTRIGGERED');

-- CreateEnum
CREATE TYPE "ActiveOrderSide" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "ActiveOrder" (
    "id" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "remainingSize" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "type" "ActiveOrderType" NOT NULL,
    "status" "ActiveOrderStatus" NOT NULL,
    "side" "ActiveOrderSide" NOT NULL,
    "marketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ActiveOrder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ActiveOrder" ADD CONSTRAINT "ActiveOrder_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveOrder" ADD CONSTRAINT "ActiveOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
