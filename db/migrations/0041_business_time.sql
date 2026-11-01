-- Business calendar boundaries follow Georgia's EST/EDT. Stored instants and
-- existing cost receipts are preserved; this does not reset any allowance.
CREATE FUNCTION business_time_zone() RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT 'America/New_York'::text $$;

CREATE FUNCTION business_day(instant timestamptz DEFAULT now()) RETURNS date
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT (instant AT TIME ZONE business_time_zone())::date
$$;

CREATE FUNCTION business_month(instant timestamptz DEFAULT now()) RETURNS date
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT date_trunc('month', instant AT TIME ZONE business_time_zone())::date
$$;

ALTER TABLE seo_costs ALTER COLUMN period SET DEFAULT business_month();
ALTER TABLE factory_costs ALTER COLUMN period SET DEFAULT business_month();
ALTER TABLE factory_build_costs ALTER COLUMN period SET DEFAULT business_month();
