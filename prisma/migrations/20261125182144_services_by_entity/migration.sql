-- DropIndex
DROP INDEX "ServiceType_name_key";

-- AlterTable
ALTER TABLE "ServiceType" ADD COLUMN     "govEntityId" TEXT;

-- CreateTable
CREATE TABLE "AppMeta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppMeta_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ServiceType_govEntityId_idx" ON "ServiceType"("govEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceType_name_govEntityId_key" ON "ServiceType"("name", "govEntityId");

-- AddForeignKey
ALTER TABLE "ServiceType" ADD CONSTRAINT "ServiceType_govEntityId_fkey" FOREIGN KEY ("govEntityId") REFERENCES "GovEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

