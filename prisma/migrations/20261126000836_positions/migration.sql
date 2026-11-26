-- CreateEnum
CREATE TYPE "PositionLevel" AS ENUM ('EXECUTIVE', 'SENIOR', 'DEPARTMENT');

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" "PositionLevel" NOT NULL DEFAULT 'DEPARTMENT',
    "scope" TEXT,
    "parentId" TEXT,
    "holderId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Position_title_key" ON "Position"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Position_holderId_key" ON "Position"("holderId");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

