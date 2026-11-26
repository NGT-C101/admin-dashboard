-- CreateEnum
CREATE TYPE "LetterDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'REVIEWED', 'RETURNED', 'APPROVED', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "letterId" TEXT;

-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL,
    "direction" "LetterDirection" NOT NULL,
    "year" INTEGER,
    "seq" INTEGER,
    "status" "LetterStatus" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "party" TEXT NOT NULL,
    "partyRef" TEXT,
    "letterDate" DATE,
    "receivedAt" DATE,
    "hideLogo" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "actionDone" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterEvent" (
    "id" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LetterEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LetterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Letter_verifyToken_key" ON "Letter"("verifyToken");

-- CreateIndex
CREATE INDEX "Letter_status_idx" ON "Letter"("status");

-- CreateIndex
CREATE INDEX "Letter_clientId_idx" ON "Letter"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Letter_direction_year_seq_key" ON "Letter"("direction", "year", "seq");

-- CreateIndex
CREATE INDEX "LetterEvent_letterId_idx" ON "LetterEvent"("letterId");

-- CreateIndex
CREATE UNIQUE INDEX "LetterTemplate_name_key" ON "LetterTemplate"("name");

-- CreateIndex
CREATE INDEX "Document_letterId_idx" ON "Document"("letterId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterEvent" ADD CONSTRAINT "LetterEvent_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterEvent" ADD CONSTRAINT "LetterEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

