# SMS setup


## Customer-text notifications (October 26, 2026)

Settings > **Customer text alerts** selects one teammate with business SMS access and one personal US mobile number. These recipients are independent of **Lead SMS alerts**: new Facebook/Instagram leads can continue alerting the whole team while incoming customer texts alert only the selected teammate. No existing messages are replayed when enabled. Personal numbers are configured in the authenticated app, not committed in source.

After the signed Twilio inbound webhook saves a message, it durably queues an alert in the same transaction. The post-response worker sends immediately; the existing authenticated cron drains interrupted work. The short ASCII alert contains the customer's number and an authenticated Inbox link, with no message body. On the production origin it fits in one SMS segment. Opening the link resolves the permitted current conversation, including merged history; unavailable/revoked/deleted sources remain inaccessible.

Only the first message in a two-minute conversation window alerts. Messages from the alert recipient and configured new-lead alert numbers never trigger alerts, preventing loops. Recipients must retain active workspace membership and SMS access; sends respect recipient opt-outs. Disabling or changing settings cancels queued old-recipient jobs, deleted conversations are cancelled, and unsent jobs expire after one hour. Failed or uncertain provider sends are not blindly retried; check Recent text alerts and Twilio logs. Signed delivery callbacks verify account, business sender, recipient and provider SID. Migration 0025 adds separate settings/outbox tables. No Twilio webhook changes are needed.
