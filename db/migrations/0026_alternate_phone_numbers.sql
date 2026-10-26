ALTER TABLE leads ADD COLUMN alternate_phones jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(alternate_phones)='array');
ALTER TABLE contacts ADD COLUMN alternate_phones jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(alternate_phones)='array');

CREATE FUNCTION crm_phone_matches(primary_phone text, alternate_phones jsonb, destination text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(crm_normalized_phone(primary_phone)=destination,false)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(alternate_phones,'[]')) p WHERE p->>'phone'=destination)
$$;

CREATE FUNCTION erase_alternate_phones() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='leads' THEN
   NEW.alternate_phones='[]';
 ELSE
   UPDATE contacts SET alternate_phones='[]' WHERE workspace_id=NEW.workspace_id AND business_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER anonymize_lead_phones BEFORE UPDATE OF anonymized_at ON leads
FOR EACH ROW WHEN(NEW.anonymized_at IS NOT NULL) EXECUTE FUNCTION erase_alternate_phones();
CREATE TRIGGER anonymize_business_phones BEFORE UPDATE OF anonymized_at ON crm_businesses
FOR EACH ROW WHEN(NEW.anonymized_at IS NOT NULL) EXECUTE FUNCTION erase_alternate_phones();
