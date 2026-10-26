-- Login email supports preparing a phone before the teammate first signs in.
-- This preference never grants dashboard or voice access.
CREATE TABLE voice_calling_phones (
 workspace_id uuid NOT NULL,
 line_id uuid NOT NULL,
 login_email text NOT NULL CHECK (login_email=lower(trim(login_email))),
 phone text NOT NULL CHECK (phone ~ '^\+1[0-9]{10}$'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,line_id,login_email),
 FOREIGN KEY(line_id,workspace_id) REFERENCES voice_lines(id,workspace_id) ON DELETE CASCADE
);
INSERT INTO voice_calling_phones(workspace_id,line_id,login_email,phone)
 SELECT l.workspace_id,l.id,lower(trim(u.email)),l.forward_phone
 FROM voice_lines l JOIN "user" u ON u.id=l.forward_user_id
 WHERE l.forward_phone IS NOT NULL;
