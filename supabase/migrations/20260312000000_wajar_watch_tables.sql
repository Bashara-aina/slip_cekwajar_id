-- WAJAR_WATCH Supabase migration
-- Run: supabase db push  OR  paste into Supabase SQL editor
-- Created: 2026-03-12

-- Table 1: Source of truth for all regulation constants
CREATE TABLE IF NOT EXISTS regulation_constants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key              TEXT NOT NULL UNIQUE,
  description      TEXT,
  value            NUMERIC NOT NULL,
  unit             TEXT DEFAULT 'rupiah_per_month',
  effective_date   DATE,
  legal_basis      TEXT,
  legal_basis_url  TEXT,
  verified_by      TEXT DEFAULT 'WAJAR_WATCH_AUTO',
  verified_at      TIMESTAMPTZ DEFAULT now(),
  confidence       TEXT CHECK (confidence IN ('HIGH','MEDIUM','LOW','MANUAL')),
  is_active        BOOLEAN DEFAULT true,
  previous_value   NUMERIC,
  pr_url           TEXT,
  pr_number        INTEGER,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Table 2: Content hash store for change detection
CREATE TABLE IF NOT EXISTS regulation_page_hashes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      TEXT NOT NULL,
  url            TEXT NOT NULL,
  content_hash   TEXT NOT NULL,
  last_checked   TIMESTAMPTZ DEFAULT now(),
  last_changed   TIMESTAMPTZ,
  snippet        TEXT,
  UNIQUE(source_id, url)
);

-- Table 3: Full audit trail of every detected change
CREATE TABLE IF NOT EXISTS regulation_change_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL,
  old_value       NUMERIC,
  new_value       NUMERIC,
  delta_pct       NUMERIC,
  confidence      TEXT,
  routing         TEXT,
  pr_url          TEXT,
  pr_number       INTEGER,
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','auto_merged','human_approved','rejected','dismissed')),
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  legal_basis     TEXT,
  legal_basis_url TEXT,
  verbatim_quote  TEXT,
  pipeline_run_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Table 4: Pipeline run telemetry
CREATE TABLE IF NOT EXISTS pipeline_run_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              TEXT UNIQUE NOT NULL,
  started_at          TIMESTAMPTZ DEFAULT now(),
  finished_at         TIMESTAMPTZ,
  trigger             TEXT DEFAULT 'cron' CHECK (trigger IN ('cron','manual','telegram')),
  sources_checked     INTEGER DEFAULT 0,
  changes_detected    INTEGER DEFAULT 0,
  auto_applied        INTEGER DEFAULT 0,
  alerted_human       INTEGER DEFAULT 0,
  blocked             INTEGER DEFAULT 0,
  skipped             INTEGER DEFAULT 0,
  errors              JSONB DEFAULT '[]',
  status              TEXT DEFAULT 'running'
    CHECK (status IN ('running','completed','failed'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_change_log_key ON regulation_change_log(key);
CREATE INDEX IF NOT EXISTS idx_change_log_status ON regulation_change_log(status);
CREATE INDEX IF NOT EXISTS idx_change_log_created ON regulation_change_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_hashes_source ON regulation_page_hashes(source_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_log_run_id ON pipeline_run_log(run_id);
