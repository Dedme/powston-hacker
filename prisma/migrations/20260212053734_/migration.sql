-- CreateTable
CREATE TABLE "RuleTestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "expectedAction" TEXT,
    "expectedDescription" TEXT,
    "actualAction" TEXT,
    "actualDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleTestRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleTestRun_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
