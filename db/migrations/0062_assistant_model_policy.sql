-- Additive: preserve existing budgets, explicit assignment limits, and routine ceilings.
ALTER TABLE assistant_chat_settings ADD COLUMN uncapped boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_chat_turns ADD COLUMN budget_managed boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_chat_requests ADD COLUMN model text NOT NULL DEFAULT 'gpt-6.1-sol';
ALTER TABLE assistant_chat_requests ADD COLUMN effort text NOT NULL DEFAULT 'low';
