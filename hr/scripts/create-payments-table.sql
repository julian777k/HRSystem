CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT,
  "orderId" TEXT NOT NULL UNIQUE,
  "paymentKey" TEXT,
  "plan" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "method" TEXT,
  "receiptUrl" TEXT,
  "failureReason" TEXT,
  "guestData" TEXT,
  "approvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_payments_tenantId" ON "payments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_payments_orderId" ON "payments" ("orderId");
CREATE INDEX IF NOT EXISTS "idx_payments_status" ON "payments" ("status");
