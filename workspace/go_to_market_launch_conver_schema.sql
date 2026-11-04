-- ============================================================================
-- 🗄️ Auto-Synthesized SQL Schema by Dr. Kaelen Thorne (Ex-ApexAuto AI)
-- Tool: sql_schema_architect • Mission: Build, price, and launch a multi-tenant AI document & workflow automation platform targeting SMBs to reach $50k MRR.
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'growth',
  mrr_cents INTEGER NOT NULL DEFAULT 14900,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS go_to_market_launch_conver_executions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  latency_ms INTEGER NOT NULL DEFAULT 14,
  token_cost_usd NUMERIC(10, 5) NOT NULL DEFAULT 0.00120,
  payload_json TEXT NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_go_to_market_launch_conver_org_status ON go_to_market_launch_conver_executions(org_id, status);
