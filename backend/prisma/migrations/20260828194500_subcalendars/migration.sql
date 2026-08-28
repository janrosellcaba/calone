-- CreateTable
CREATE TABLE "SubCalendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubCalendar_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CalendarAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SubCalendar_accountId_idx" ON "SubCalendar"("accountId");

-- CreateIndex
CREATE INDEX "SubCalendar_isActive_idx" ON "SubCalendar"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubCalendar_accountId_remoteId_key" ON "SubCalendar"("accountId", "remoteId");
