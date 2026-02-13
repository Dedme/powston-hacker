-- CreateTable
CREATE TABLE "HelperSnippet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "tags" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "authorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HelperSnippetReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snippetId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "authorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HelperSnippetReview_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "HelperSnippet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_HelperSnippetToTemplateVersion" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_HelperSnippetToTemplateVersion_A_fkey" FOREIGN KEY ("A") REFERENCES "HelperSnippet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_HelperSnippetToTemplateVersion_B_fkey" FOREIGN KEY ("B") REFERENCES "TemplateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "currentVersionId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "authorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Template_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "TemplateVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Template" ("createdAt", "currentVersionId", "description", "id", "name", "slug", "updatedAt") SELECT "createdAt", "currentVersionId", "description", "id", "name", "slug", "updatedAt" FROM "Template";
DROP TABLE "Template";
ALTER TABLE "new_Template" RENAME TO "Template";
CREATE UNIQUE INDEX "Template_slug_key" ON "Template"("slug");
CREATE UNIQUE INDEX "Template_currentVersionId_key" ON "Template"("currentVersionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "_HelperSnippetToTemplateVersion_AB_unique" ON "_HelperSnippetToTemplateVersion"("A", "B");

-- CreateIndex
CREATE INDEX "_HelperSnippetToTemplateVersion_B_index" ON "_HelperSnippetToTemplateVersion"("B");
