-- Migration: Add Intelligence Features
-- This migration adds support for lead scoring, enrichment, signals, and embeddings

-- Enable pgvector extension for embeddings (requires Neon pgvector support)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add intelligence columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_breakdown JSONB,
ADD COLUMN IF NOT EXISTS enriched_company TEXT,
ADD COLUMN IF NOT EXISTS enriched_industry TEXT,
ADD COLUMN IF NOT EXISTS enriched_employee_count TEXT,
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Create signals table for threshold notifications
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  delivered_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create embeddings table for semantic search
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  source_text TEXT NOT NULL,
  embedding vector(1536),
  model TEXT DEFAULT 'text-embedding-ada-002',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(tenant_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_tenant ON signals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signals_lead ON signals(lead_id);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_embeddings_tenant ON embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_lead ON embeddings(lead_id);

-- Create HNSW index for fast vector similarity search (if pgvector supports it)
-- Note: This may need to be run separately depending on your Neon plan
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
USING hnsw (embedding vector_cosine_ops);
