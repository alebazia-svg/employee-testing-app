-- Existing employees keep live scanning. Individual exceptions are set by ADMIN.
ALTER TABLE "User" ADD COLUMN "qrScanMode" TEXT NOT NULL DEFAULT 'SCAN';
ALTER TABLE "User" ADD CONSTRAINT "User_qrScanMode_check" CHECK ("qrScanMode" IN ('SCAN', 'PHOTO'));
