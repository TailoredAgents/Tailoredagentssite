-- Website mockups are now requested explicitly by a teammate. Keep the legacy
-- column for rolling deployments; older intake code will read false and skip.
UPDATE factory_settings SET auto_research=false,updated_at=now() WHERE auto_research;
ALTER TABLE factory_settings ADD CONSTRAINT factory_research_on_demand CHECK (auto_research=false);

-- Existing projects, queued/running work, approvals, spending and previews are
-- deliberately retained. This changes future intake, not previously saved work.
