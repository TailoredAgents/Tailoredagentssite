-- Align the existing internal site with the owner's chosen public hostname.
-- Keep the site ID, Google Domain property, credentials and historical URLs.
UPDATE sites
SET url = 'https://www.tailoredagents.com', updated_at = now()
WHERE id = '00000000-0000-4000-8000-000000000002'
  AND workspace_id = '00000000-0000-4000-8000-000000000001'
  AND url IN ('https://tailoredagents.com', 'https://tailoredagents.com/');
