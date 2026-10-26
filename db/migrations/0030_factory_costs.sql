-- Cost receipts outlive deleted leads/jobs; they contain usage, never lead content.
CREATE TABLE factory_costs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  job_id uuid REFERENCES factory_jobs(id) ON DELETE SET NULL,
  request_key text NOT NULL UNIQUE,
  stage text NOT NULL CHECK(stage IN ('research','plan')),
  period date NOT NULL DEFAULT date_trunc('month',now() AT TIME ZONE 'UTC')::date,
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','settled','uncertain','released')),
  reserved_micros bigint NOT NULL CHECK(reserved_micros >= 0),
  actual_micros bigint CHECK(actual_micros >= 0),
  provider_id text,
  usage jsonb,
  attempted_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status <> 'settled' OR actual_micros IS NOT NULL)
);
CREATE INDEX factory_costs_workspace_period ON factory_costs(workspace_id,period,status);
