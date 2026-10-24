-- Keep monitoring independent from paid work; approval follows the real pilot.
ALTER TABLE seo_managers ADD COLUMN ai_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE seo_managers ADD COLUMN pilot_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE seo_managers ADD COLUMN ai_reviewed_at timestamptz;
ALTER TABLE seo_managers ADD COLUMN last_worker_success_at timestamptz;
ALTER TABLE seo_managers ALTER COLUMN monthly_limit_micros SET DEFAULT 10000000;
UPDATE seo_managers SET monthly_limit_micros=LEAST(monthly_limit_micros,10000000);
ALTER TABLE seo_managers ADD CONSTRAINT seo_budget_ten_dollars CHECK(monthly_limit_micros<=10000000);
-- Existing costs, publications and contexts are intentionally retained.
