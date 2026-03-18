-- CreateTable
CREATE TABLE "OrgSkill" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAgent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specificContext" TEXT,
    "outputTypes" TEXT[],
    "productLineIds" TEXT[],
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "shareToken" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentOutput" (
    "id" TEXT NOT NULL,
    "contentAgentId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isoWeek" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentAgent_shareToken_key" ON "ContentAgent"("shareToken");

-- AddForeignKey
ALTER TABLE "OrgSkill" ADD CONSTRAINT "OrgSkill_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAgent" ADD CONSTRAINT "ContentAgent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentOutput" ADD CONSTRAINT "ContentOutput_contentAgentId_fkey" FOREIGN KEY ("contentAgentId") REFERENCES "ContentAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
