INSERT INTO assistant_clients(id,name,redirect_uris) VALUES('ta_native_background','Dashboard assistant background work','[]') ON CONFLICT DO NOTHING;
ALTER TABLE assistant_grants ADD COLUMN authority text NOT NULL DEFAULT 'session' CHECK(authority IN ('session','background'));
ALTER TABLE assistant_grants ADD COLUMN identity_kind text CHECK(identity_kind IN ('mail','password'));
ALTER TABLE assistant_grants ADD COLUMN identity_credential text;
ALTER TABLE assistant_grants ADD COLUMN consented_session_id text;
ALTER TABLE assistant_grants ADD CONSTRAINT assistant_background_identity CHECK(authority='session' OR (client_id='ta_native_background' AND session_id IS NULL AND identity_kind IS NOT NULL AND identity_credential IS NOT NULL AND consented_session_id IS NOT NULL));
CREATE UNIQUE INDEX assistant_background_owner ON assistant_grants(workspace_id,user_id) WHERE authority='background' AND revoked_at IS NULL;

CREATE FUNCTION assistant_revoke_password_delegation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD."password" IS DISTINCT FROM NEW."password" THEN
  UPDATE assistant_grants SET revoked_at=now() WHERE user_id=OLD."userId" AND authority='background' AND identity_kind='password' AND revoked_at IS NULL;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER assistant_password_changed AFTER UPDATE OF "password" OR DELETE ON "account" FOR EACH ROW EXECUTE FUNCTION assistant_revoke_password_delegation();
CREATE FUNCTION assistant_revoke_membership_delegation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.status<>'active' THEN
  UPDATE assistant_grants SET revoked_at=now() WHERE user_id=OLD.user_id AND workspace_id=OLD.workspace_id AND authority='background' AND revoked_at IS NULL;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER assistant_membership_changed AFTER UPDATE OF status OR DELETE ON workspace_memberships FOR EACH ROW EXECUTE FUNCTION assistant_revoke_membership_delegation();
CREATE FUNCTION assistant_revoke_workspace_delegation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'active' THEN UPDATE assistant_grants SET revoked_at=now() WHERE workspace_id=NEW.id AND authority='background' AND revoked_at IS NULL; END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER assistant_workspace_changed AFTER UPDATE OF status ON workspaces FOR EACH ROW EXECUTE FUNCTION assistant_revoke_workspace_delegation();
