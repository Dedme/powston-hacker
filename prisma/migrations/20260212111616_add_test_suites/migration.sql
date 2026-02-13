-- CreateTable
CREATE TABLE "RuleTestSuite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userParamsOverride" TEXT,
    "aiTunablesOverride" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuleTestSuite_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleTestSuiteRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suiteId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "userParamsSnapshot" TEXT,
    "aiTunablesSnapshot" TEXT,
    "passCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleTestSuiteRun_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "RuleTestSuite" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleTestSuiteRun_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RuleTestCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "suiteId" TEXT,
    "name" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "expectedAction" TEXT,
    "expectedDescription" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuleTestCase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleTestCase_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleTestCase_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "RuleTestSuite" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RuleTestCase" ("createdAt", "expectedAction", "expectedDescription", "id", "inputJson", "name", "templateId", "templateVersionId", "updatedAt") SELECT "createdAt", "expectedAction", "expectedDescription", "id", "inputJson", "name", "templateId", "templateVersionId", "updatedAt" FROM "RuleTestCase";
DROP TABLE "RuleTestCase";
ALTER TABLE "new_RuleTestCase" RENAME TO "RuleTestCase";
CREATE TABLE "new_RuleTestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "suiteRunId" TEXT,
    "inputJson" TEXT NOT NULL,
    "expectedAction" TEXT,
    "expectedDescription" TEXT,
    "actualAction" TEXT,
    "actualDescription" TEXT,
    "actualReasons" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleTestRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleTestRun_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleTestRun_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "RuleTestCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleTestRun_suiteRunId_fkey" FOREIGN KEY ("suiteRunId") REFERENCES "RuleTestSuiteRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RuleTestRun" ("actualAction", "actualDescription", "actualReasons", "createdAt", "expectedAction", "expectedDescription", "id", "inputJson", "status", "templateId", "templateVersionId", "testCaseId") SELECT "actualAction", "actualDescription", "actualReasons", "createdAt", "expectedAction", "expectedDescription", "id", "inputJson", "status", "templateId", "templateVersionId", "testCaseId" FROM "RuleTestRun";
DROP TABLE "RuleTestRun";
ALTER TABLE "new_RuleTestRun" RENAME TO "RuleTestRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
