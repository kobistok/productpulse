-- CreateTable
CREATE TABLE "ZendeskConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZendeskConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZendeskConfig_orgId_key" ON "ZendeskConfig"("orgId");

-- AddForeignKey
ALTER TABLE "ZendeskConfig" ADD CONSTRAINT "ZendeskConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ContentOutput" ADD COLUMN "zendeskArticles" TEXT;
