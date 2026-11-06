-- A second outreach campaign; retain insurance/general links and their history.
ALTER TABLE smart_cards DROP CONSTRAINT smart_cards_campaign_check;
ALTER TABLE smart_cards ADD CONSTRAINT smart_cards_campaign_check
 CHECK (campaign IS NULL OR campaign IN ('commercial-insurance','freight-automation'));
ALTER TABLE smart_card_events DROP CONSTRAINT smart_card_events_campaign_check;
ALTER TABLE smart_card_events ADD CONSTRAINT smart_card_events_campaign_check
 CHECK (campaign IS NULL OR campaign IN ('commercial-insurance','freight-automation'));

INSERT INTO smart_cards(code,workspace_id,profile_slug,label,kind,campaign)
SELECT 'freight-'||slug,workspace_id,slug,display_name||' · Freight & 3PL flyer',
 'giveaway','freight-automation'
FROM smart_card_profiles
WHERE workspace_id='00000000-0000-4000-8000-000000000001'
 AND slug IN ('austin','jeffrey','devon');
