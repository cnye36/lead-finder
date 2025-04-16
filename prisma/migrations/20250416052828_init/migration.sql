-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "place_id" TEXT,
    "name" TEXT,
    "full_address" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "site" TEXT,
    "domain" TEXT,
    "emailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_place_id_key" ON "Lead"("place_id");

-- CreateIndex
CREATE INDEX "Lead_name_idx" ON "Lead"("name");
