-- Migration: add spending_per_month to campaigns
ALTER TABLE campaigns ADD COLUMN spending_per_month text;
