-- Existing connections retain their reviewed-proposal authority. The owner opts
-- in once through consent or the authenticated connection controls.
ALTER TABLE assistant_grants ADD COLUMN direct_actions boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_actions ADD COLUMN execution_authority text NOT NULL DEFAULT 'dashboard'
 CHECK (execution_authority IN ('dashboard','delegated'));
