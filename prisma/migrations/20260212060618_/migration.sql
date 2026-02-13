/*
  Warnings:

  - Added the required column `testCaseId` to the `RuleTestRun` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "RuleTestCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "expectedAction" TEXT,
    "expectedDescription" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuleTestCase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleTestCase_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
DELETE FROM "RuleTestRun";
CREATE TABLE "new_RuleTestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
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
    CONSTRAINT "RuleTestRun_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "RuleTestCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RuleTestRun" ("actualAction", "actualDescription", "createdAt", "expectedAction", "expectedDescription", "id", "inputJson", "status", "templateId", "templateVersionId") SELECT "actualAction", "actualDescription", "createdAt", "expectedAction", "expectedDescription", "id", "inputJson", "status", "templateId", "templateVersionId" FROM "RuleTestRun";
DROP TABLE "RuleTestRun";
ALTER TABLE "new_RuleTestRun" RENAME TO "RuleTestRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
