-- Human-reviewed work uses the existing CRM task queue, including general callers.
ALTER TABLE crm_tasks ALTER COLUMN opportunity_id DROP NOT NULL;
ALTER TABLE crm_tasks ADD COLUMN conversation_source_id uuid;
ALTER TABLE crm_tasks ADD COLUMN completion_outcome text CHECK(length(completion_outcome)<=2000);
ALTER TABLE crm_tasks ADD UNIQUE(id,workspace_id);
ALTER TABLE crm_tasks ADD FOREIGN KEY(conversation_source_id,workspace_id) REFERENCES crm_conversation_sources(id,workspace_id);
ALTER TABLE crm_tasks ADD CHECK((opportunity_id IS NOT NULL AND conversation_source_id IS NULL) OR (opportunity_id IS NULL AND conversation_source_id IS NOT NULL));
CREATE INDEX crm_tasks_conversation_source ON crm_tasks(workspace_id,conversation_source_id,due_at);
CREATE TABLE voice_follow_up_tasks (
 workspace_id uuid NOT NULL,recording_id uuid NOT NULL,suggestion_index integer NOT NULL CHECK(suggestion_index BETWEEN 0 AND 4),
 task_id uuid NOT NULL UNIQUE,created_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,recording_id,suggestion_index),
 FOREIGN KEY(recording_id,workspace_id) REFERENCES voice_call_recordings(id,workspace_id),
 FOREIGN KEY(task_id,workspace_id) REFERENCES crm_tasks(id,workspace_id) ON DELETE CASCADE
);

-- Extend the original sales retention body; later Mail/SMS/Inbox wrappers remain intact.
-- Some older databases applied sales before its retention wrapper existed.
-- Preserve that original reporting implementation before adding the sales body.
DO $call_task_retention_upgrade$
BEGIN
 IF to_regprocedure('perform_reporting_retention_before_agency_sales()') IS NULL THEN
  ALTER FUNCTION perform_reporting_retention_before_inbox() RENAME TO perform_reporting_retention_before_agency_sales;
 END IF;
END $call_task_retention_upgrade$;
CREATE OR REPLACE FUNCTION perform_reporting_retention_before_inbox() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  expired_business_ids uuid[];
  inactivity_cutoff timestamp with time zone := now() - interval '24 months';
BEGIN
  PERFORM perform_reporting_retention_before_agency_sales();

  SELECT array_agg(candidate.id) INTO expired_business_ids
  FROM (
    SELECT business.id
    FROM crm_businesses business
    WHERE business.client_id IS NULL
      AND business.anonymized_at IS NULL
      AND business.retained_until <= now()
      AND business.updated_at <= inactivity_cutoff
      AND NOT EXISTS (SELECT 1 FROM clients client WHERE client.business_id = business.id)
      AND NOT EXISTS (SELECT 1 FROM contacts contact WHERE contact.business_id = business.id AND contact.client_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM crm_opportunities opportunity
        WHERE opportunity.business_id = business.id
          AND (opportunity.stage = 'won' OR opportunity.client_id IS NOT NULL
            OR opportunity.project_id IS NOT NULL OR opportunity.updated_at > inactivity_cutoff)
      )
      AND NOT EXISTS (
        SELECT 1 FROM crm_activities activity WHERE activity.business_id = business.id
          AND (activity.created_at > inactivity_cutoff OR activity.occurred_at > inactivity_cutoff)
      )
      AND NOT EXISTS (
        SELECT 1 FROM crm_tasks task JOIN crm_opportunities opportunity ON opportunity.id = task.opportunity_id
        WHERE opportunity.business_id = business.id
          AND (task.updated_at > inactivity_cutoff OR task.due_at > inactivity_cutoff)
      )
      AND NOT EXISTS (
        SELECT 1 FROM crm_tasks task
        JOIN crm_conversation_sources source ON source.id=task.conversation_source_id AND source.workspace_id=task.workspace_id
        JOIN crm_conversations conversation ON conversation.id=source.conversation_id AND conversation.workspace_id=source.workspace_id
        LEFT JOIN contacts person ON person.id=conversation.contact_id AND person.workspace_id=conversation.workspace_id
        WHERE COALESCE(conversation.business_id,person.business_id)=business.id
          AND (task.updated_at>inactivity_cutoff OR task.due_at>inactivity_cutoff)
      )
      AND NOT EXISTS (
        SELECT 1 FROM crm_mockups mockup JOIN crm_opportunities opportunity ON opportunity.id = mockup.opportunity_id
        WHERE opportunity.business_id = business.id AND mockup.updated_at > inactivity_cutoff
      )
      -- Use the same workspace lock as the sales mutation service. Busy
      -- workspaces wait for a later maintenance run instead of racing edits.
      AND pg_try_advisory_xact_lock(hashtextextended('agency-sales:' || business.workspace_id::text, 0))
    ORDER BY business.retained_until, business.id
    LIMIT 500
    FOR UPDATE OF business SKIP LOCKED
  ) candidate;

  IF expired_business_ids IS NULL THEN RETURN; END IF;

  -- Keep only the minimum suppression tuple needed to honor an existing block.
  -- Addresses remain canonical plaintext because future communication checks
  -- must enforce opt-outs. Free-text evidence and actor attribution are removed.
  WITH addresses AS (
    SELECT workspace_id, normalized_phone AS address FROM crm_businesses WHERE id = ANY(expired_business_ids)
    UNION SELECT workspace_id, normalized_email FROM crm_businesses WHERE id = ANY(expired_business_ids)
    UNION SELECT workspace_id, lower(trim(email)) FROM contacts WHERE business_id = ANY(expired_business_ids) AND client_id IS NULL
    UNION SELECT workspace_id, crm_normalized_phone(contact.phone)
      FROM contacts contact
      WHERE contact.business_id = ANY(expired_business_ids) AND contact.client_id IS NULL
  ), sanitized_blocks AS (
    UPDATE crm_channel_preferences preference
    SET evidence = 'Opt-out retained after expired prospect content was removed.', actor_user_id = NULL
    FROM addresses address
    WHERE preference.workspace_id = address.workspace_id AND preference.normalized_address = address.address
      AND preference.status = 'blocked'
    RETURNING preference.workspace_id
  )
  DELETE FROM crm_channel_preferences preference USING addresses address
  WHERE preference.workspace_id = address.workspace_id AND preference.normalized_address = address.address
    AND preference.status <> 'blocked';

  UPDATE contacts SET name = 'Expired prospect contact', email = NULL, phone = NULL, title = NULL, updated_at = now()
  WHERE business_id = ANY(expired_business_ids) AND client_id IS NULL;
  UPDATE crm_activities SET body = '[Expired prospect content removed]', outcome = NULL
  WHERE business_id = ANY(expired_business_ids);
  UPDATE crm_tasks task SET title = 'Expired follow-up', location = NULL, notes = NULL,
    status = CASE WHEN task.status = 'open' THEN 'cancelled' ELSE task.status END, updated_at = now()
  FROM crm_opportunities opportunity
  WHERE task.opportunity_id = opportunity.id AND opportunity.business_id = ANY(expired_business_ids);
  UPDATE crm_tasks task SET title='Expired follow-up',location=NULL,notes=NULL,completion_outcome=NULL,
    status=CASE WHEN task.status='open' THEN 'cancelled' ELSE task.status END,updated_at=now()
  FROM crm_conversation_sources source JOIN crm_conversations conversation ON conversation.id=source.conversation_id AND conversation.workspace_id=source.workspace_id
  LEFT JOIN contacts person ON person.id=conversation.contact_id AND person.workspace_id=conversation.workspace_id
  WHERE task.conversation_source_id=source.id AND task.workspace_id=source.workspace_id
    AND COALESCE(conversation.business_id,person.business_id)=ANY(expired_business_ids);
  UPDATE crm_mockups mockup SET brief = '[Expired prospect content removed]', preview_url = NULL,
    repository_url = NULL, project_path = NULL, qa_notes = NULL, updated_at = now()
  FROM crm_opportunities opportunity
  WHERE mockup.opportunity_id = opportunity.id AND opportunity.business_id = ANY(expired_business_ids);
  UPDATE crm_list_members SET research_data = '{}'::jsonb WHERE business_id = ANY(expired_business_ids);
  UPDATE crm_opportunities SET title = 'Expired prospect opportunity', stage = 'archived',
    closed_at = coalesce(closed_at, now()), updated_at = now()
  WHERE business_id = ANY(expired_business_ids);
  UPDATE crm_businesses SET name = 'Expired prospect', website_url = NULL, normalized_domain = NULL,
    normalized_phone = NULL, normalized_email = NULL, industry = NULL, state = NULL,
    website_status = 'unknown', score = NULL, research_url = NULL, research_notes = NULL,
    anonymized_at = now(), updated_at = now()
  WHERE id = ANY(expired_business_ids);
END $$;
