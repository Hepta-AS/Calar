-- Migration: admin dashboard fields
ALTER TABLE tenants ADD COLUMN logo_url text;
ALTER TABLE tenant_users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE tenant_users ADD COLUMN smtp_email text;
ALTER TABLE tenant_users ADD COLUMN report_notify_email text;
