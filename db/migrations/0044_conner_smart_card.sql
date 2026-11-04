-- Conner's public card details and supplied portrait requested November 4, 2026.
-- Add only the new teammate; preserve existing profiles and their dashboard edits.
INSERT INTO smart_card_profiles(slug,workspace_id,display_name,title,email,phone,login_email,intro,published)
VALUES ('conner','00000000-0000-4000-8000-000000000001','Conner Mooney',
 'Partner & CFO | Business Development','conner@tailoredagents.com','+16785417725',
 'conner@tailoredagents.com','Have a business idea or a challenge to solve? Let’s talk about how Tailored Agents can help.',true);

INSERT INTO smart_cards(code,workspace_id,profile_slug,label,kind)
SELECT p.slug||'-'||kind,p.workspace_id,p.slug,
 p.display_name||CASE WHEN kind='personal' THEN ' · reusable card' ELSE ' · giveaway batch' END,kind
FROM smart_card_profiles p CROSS JOIN unnest(ARRAY['personal','giveaway']) kind
WHERE p.workspace_id='00000000-0000-4000-8000-000000000001' AND p.slug='conner';

-- Use the team's existing daily 8 AM–7 PM Eastern consultation schedule.
INSERT INTO booking_schedules(workspace_id,profile_slug)
SELECT workspace_id,slug FROM smart_card_profiles
WHERE workspace_id='00000000-0000-4000-8000-000000000001' AND slug='conner';
