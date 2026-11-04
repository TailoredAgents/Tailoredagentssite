-- Campaign links reuse public contacts, booking calendars and the shared AI cap.
ALTER TABLE smart_cards ADD COLUMN campaign text
 CHECK (campaign IS NULL OR campaign='commercial-insurance');
ALTER TABLE smart_card_events ADD COLUMN campaign text
 CHECK (campaign IS NULL OR campaign='commercial-insurance');
ALTER TABLE smart_card_events DROP CONSTRAINT smart_card_events_event_name_check;
ALTER TABLE smart_card_events ADD CONSTRAINT smart_card_events_event_name_check
 CHECK (event_name IN ('visit','contact_download','phone_click','email_click',
 'assistant_open','inquiry_open','work_click','demo_open','calculator_use'));
CREATE INDEX smart_card_campaign_events ON smart_card_events(workspace_id,campaign,created_at)
 WHERE campaign IS NOT NULL;
INSERT INTO smart_cards(code,workspace_id,profile_slug,label,kind,campaign)
SELECT 'insurance-'||slug,workspace_id,slug,display_name||' · Commercial insurance flyer',
 'giveaway','commercial-insurance'
FROM smart_card_profiles
WHERE workspace_id='00000000-0000-4000-8000-000000000001' AND slug IN ('austin','jeffrey');
