/*
  Warnings:

  - You are about to drop the column `address` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `domain` on the `Lead` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "place_id" TEXT,
    "name" TEXT,
    "full_address" TEXT,
    "phone" TEXT,
    "site" TEXT,
    "type" TEXT,
    "emailsJson" TEXT,
    "socialsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Lead" ("createdAt", "emailsJson", "full_address", "id", "name", "phone", "place_id", "site", "updatedAt") SELECT "createdAt", "emailsJson", "full_address", "id", "name", "phone", "place_id", "site", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_place_id_key" ON "Lead"("place_id");
CREATE INDEX "Lead_name_idx" ON "Lead"("name");
CREATE INDEX "Lead_type_idx" ON "Lead"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
