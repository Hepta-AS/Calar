-- Migration: display_name on tenant_users + campaigns table
-- Run against Neon (or any Postgres) after baseline schema exists.

ALTER TABLE tenant_users
  ADD COLUMN display_name text;

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  name text NOT NULL,
  image_url text,
  utm_link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
