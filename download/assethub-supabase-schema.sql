-- ============================================================
-- AssetHub - Supabase PostgreSQL Schema
-- Pegar esto completo en el SQL Editor de Supabase
-- ============================================================

-- Enable UUID extension for CUID compatibility
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. SUPER_ADMIN
-- ============================================================
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- ============================================================
-- 2. PLAN
-- ============================================================
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "priceMonthly" DOUBLE PRECISION NOT NULL,
    "priceYearly" DOUBLE PRECISION,
    "maxAssets" INTEGER NOT NULL,
    "maxUsers" INTEGER NOT NULL,
    "maxLocations" INTEGER NOT NULL,
    "features" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- ============================================================
-- 3. TENANT
-- ============================================================
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'private',
    "country" TEXT NOT NULL DEFAULT 'Trinidad and Tobago',
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "logo" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- ============================================================
-- 4. TENANT_SETTINGS
-- ============================================================
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "secondaryColor" TEXT NOT NULL DEFAULT '#14b8a6',
    "accentColor" TEXT NOT NULL DEFAULT '#f59e0b',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "customDomain" TEXT,
    "loginBackground" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappApiUrl" TEXT,
    "whatsappApiToken" TEXT,
    "whatsappPhoneNumber" TEXT,
    "whatsappTemplateLang" TEXT NOT NULL DEFAULT 'en',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "aiApiKey" TEXT,
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "aiTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "aiSystemPrompt" TEXT NOT NULL DEFAULT 'You are a helpful asset management assistant for {tenantName}. Help users manage their assets, run inventory checks, and generate reports.',
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inAppNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lowStockAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warrantyAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultDepreciationMethod" TEXT NOT NULL DEFAULT 'straight_line',
    "defaultUsefulLifeYears" INTEGER NOT NULL DEFAULT 5,
    "autoGenerateQRCodes" BOOLEAN NOT NULL DEFAULT true,
    "requirePhotoOnCreate" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "requireTwoFactor" BOOLEAN NOT NULL DEFAULT false,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireUpper" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireSpecial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantSettings_tenantId_key" UNIQUE ("tenantId")
);

-- ============================================================
-- 5. SUBSCRIPTION
-- ============================================================
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "nextBillingDate" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_tenantId_key" UNIQUE ("tenantId")
);

-- ============================================================
-- 6. USER
-- ============================================================
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "avatar" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "jobTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "User_email_tenantId_key" ON "User"("email", "tenantId");

-- ============================================================
-- 7. REFRESH_TOKEN
-- ============================================================
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- ============================================================
-- 8. CATEGORY
-- ============================================================
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT NOT NULL DEFAULT 'Package',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Category_name_tenantId_key" ON "Category"("name", "tenantId");
CREATE UNIQUE INDEX "Category_code_tenantId_key" ON "Category"("code", "tenantId");

-- ============================================================
-- 9. LOCATION
-- ============================================================
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "parentId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Location_name_tenantId_key" ON "Location"("name", "tenantId");

-- ============================================================
-- 10. ASSET
-- ============================================================
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qrCode" TEXT NOT NULL,
    "tagNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serialNumber" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "residualValue" DOUBLE PRECISION,
    "warrantyExpiry" TIMESTAMP(3),
    "usefulLifeYears" INTEGER,
    "depreciationMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "condition" TEXT NOT NULL DEFAULT 'good',
    "assignedTo" TEXT,
    "notes" TEXT,
    "photo" TEXT,
    "categoryId" TEXT,
    "locationId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Asset_qrCode_tenantId_key" ON "Asset"("qrCode", "tenantId");
CREATE UNIQUE INDEX "Asset_tagNumber_tenantId_key" ON "Asset"("tagNumber", "tenantId");
CREATE INDEX "Asset_tenantId_status_idx" ON "Asset"("tenantId", "status");
CREATE INDEX "Asset_tenantId_categoryId_idx" ON "Asset"("tenantId", "categoryId");

-- ============================================================
-- 11. AUDIT_LOG
-- ============================================================
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "assetId" TEXT,
    "userId" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- ============================================================
-- 12. INVENTORY_SESSION
-- ============================================================
CREATE TABLE "InventorySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "locationId" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalExpected" INTEGER NOT NULL DEFAULT 0,
    "totalScanned" INTEGER NOT NULL DEFAULT 0,
    "totalMissing" INTEGER NOT NULL DEFAULT 0,
    "totalExtra" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 13. INVENTORY_ITEM
-- ============================================================
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qrCode" TEXT,
    "assetId" TEXT,
    "sessionId" TEXT NOT NULL,
    "discrepancyType" TEXT,
    "discrepancyNote" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced" BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- 14. SYNC_QUEUE
-- ============================================================
CREATE TABLE "SyncQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operation" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SyncQueue_tenantId_status_idx" ON "SyncQueue"("tenantId", "status");

-- ============================================================
-- 15. NOTIFICATION
-- ============================================================
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Notification_tenantId_userId_isRead_createdAt_idx" ON "Notification"("tenantId", "userId", "isRead", "createdAt");

-- ============================================================
-- 16. PAYMENT
-- ============================================================
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "method" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 17. INVOICE
-- ============================================================
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- ============================================================
-- 18. MAINTENANCE
-- ============================================================
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'preventive',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "vendor" TEXT,
    "vendorContact" TEXT,
    "performedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Maintenance_tenantId_assetId_status_idx" ON "Maintenance"("tenantId", "assetId", "status");
CREATE INDEX "Maintenance_tenantId_status_scheduledDate_idx" ON "Maintenance"("tenantId", "status", "scheduledDate");

-- ============================================================
-- 19. DOCUMENT
-- ============================================================
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Document_tenantId_assetId_idx" ON "Document"("tenantId", "assetId");

-- ============================================================
-- 20. DEPRECIATION
-- ============================================================
CREATE TABLE "Depreciation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "periodNumber" INTEGER NOT NULL DEFAULT 1,
    "method" TEXT NOT NULL,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "residualValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usefulLifeYears" INTEGER NOT NULL,
    "depreciationRate" DOUBLE PRECISION NOT NULL,
    "periodDepreciation" DOUBLE PRECISION NOT NULL,
    "accumulatedDepreciation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bookValue" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'calculated',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "journalEntryId" TEXT
);
CREATE UNIQUE INDEX "Depreciation_assetId_fiscalYear_periodNumber_key" ON "Depreciation"("assetId", "fiscalYear", "periodNumber");
CREATE INDEX "Depreciation_tenantId_fiscalYear_idx" ON "Depreciation"("tenantId", "fiscalYear");

-- ============================================================
-- 21. DATA_MIGRATION
-- ============================================================
CREATE TABLE "DataMigration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mappingConfig" TEXT NOT NULL,
    "errors" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DataMigration_tenantId_status_idx" ON "DataMigration"("tenantId", "status");

-- ============================================================
-- 22. LEDGER_ACCOUNT
-- ============================================================
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "LedgerAccount_code_tenantId_key" ON "LedgerAccount"("code", "tenantId");

-- ============================================================
-- 23. JOURNAL_ENTRY
-- ============================================================
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- ============================================================
-- 24. LEDGER_ENTRY
-- ============================================================
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalEntryId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- FOREIGN KEYS (todas las relaciones)
-- ============================================================

-- TenantSettings -> Tenant
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscription -> Tenant
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscription -> Plan
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" 
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- User -> Tenant
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RefreshToken -> User
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Category -> Tenant
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Location self-referencing hierarchy
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" 
    FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Location -> Tenant
ALTER TABLE "Location" ADD CONSTRAINT "Location_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Asset -> Category (optional)
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Asset -> Location (optional)
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_locationId_fkey" 
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Asset -> Tenant
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLog -> Asset (optional, SET NULL)
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_assetId_fkey" 
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuditLog -> User (optional, SET NULL)
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InventorySession -> Location (optional)
ALTER TABLE "InventorySession" ADD CONSTRAINT "InventorySession_locationId_fkey" 
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InventorySession -> Tenant
ALTER TABLE "InventorySession" ADD CONSTRAINT "InventorySession_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- InventorySession -> User (optional)
ALTER TABLE "InventorySession" ADD CONSTRAINT "InventorySession_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InventoryItem -> Asset (optional)
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_assetId_fkey" 
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InventoryItem -> InventorySession
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "InventorySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment -> Subscription
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" 
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment -> Tenant
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invoice -> Subscription
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" 
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invoice -> Tenant
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notification -> Tenant
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notification -> User (optional, SET NULL)
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Maintenance -> Tenant
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Maintenance -> Asset
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_assetId_fkey" 
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Document -> Tenant
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Document -> Asset (optional, SET NULL)
ALTER TABLE "Document" ADD CONSTRAINT "Document_assetId_fkey" 
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Depreciation -> Tenant
ALTER TABLE "Depreciation" ADD CONSTRAINT "Depreciation_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Depreciation -> Asset
ALTER TABLE "Depreciation" ADD CONSTRAINT "Depreciation_assetId_fkey" 
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration -> Tenant
ALTER TABLE "DataMigration" ADD CONSTRAINT "DataMigration_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LedgerAccount -> Tenant (optional, SET NULL)
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- JournalEntry -> Tenant (optional, SET NULL)
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LedgerEntry -> JournalEntry
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_journalEntryId_fkey" 
    FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LedgerEntry -> LedgerAccount
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_ledgerAccountId_fkey" 
    FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- UPDATED AT TRIGGERS (auto-update updatedAt on every row change)
-- ============================================================

CREATE OR REPLACE FUNCTION "updateUpdatedAtColumn"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT table_name FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name IN (
                   'SuperAdmin', 'Plan', 'Tenant', 'TenantSettings', 
                   'Subscription', 'User', 'Category', 'Location', 
                   'Asset', 'InventorySession', 'SyncQueue', 
                   'Payment', 'Invoice', 'Maintenance', 
                   'Document', 'DataMigration', 
                   'LedgerAccount', 'JournalEntry'
               )
    LOOP
        EXECUTE format('
            CREATE TRIGGER "update_%s_updatedAt" 
                BEFORE UPDATE ON "%I" 
                FOR EACH ROW EXECUTE FUNCTION "updateUpdatedAtColumn"();
        ', tbl, tbl);
    END LOOP;
END;
$$;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (RLS) - recomendado por Supabase
-- ============================================================

ALTER TABLE "SuperAdmin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventorySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Maintenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Depreciation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataMigration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;

-- NOTA: RLS está habilitado pero sin políticas restrictivas.
-- El servicio backend (API routes) usa el DATABASE_URL de conexión directa
-- (service_role) que BYPASSEA RLS, así que la app funciona normalmente.
-- Si en el futuro quieres acceso directo desde el cliente Supabase,
-- agrega políticas RLS específicas por tenantId.

-- ============================================================
-- LISTO ✅ - Todas las 20 tablas creadas con relaciones, índices y triggers
-- ============================================================
