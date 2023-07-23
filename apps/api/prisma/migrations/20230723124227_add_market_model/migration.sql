-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "indexPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_name_key" ON "Market"("name");
