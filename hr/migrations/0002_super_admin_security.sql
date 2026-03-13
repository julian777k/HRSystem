ALTER TABLE "super_admins" ADD COLUMN "mustChangePassword" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "super_admins" ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "super_admins" ADD COLUMN "lockedUntil" TEXT;
ALTER TABLE "super_admins" ADD COLUMN "lastLoginAt" TEXT;
