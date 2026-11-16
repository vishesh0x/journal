-- Lets sign-out (and any future password change) revoke every session token issued before it.
ALTER TABLE users ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 0;
