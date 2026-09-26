-- A new passkey account may not exist when an invitation is issued.
-- The first authenticated claimant takes the single tenant slot; the landlord
-- must review and freeze that address before deployment or pre-deployment gas.
ALTER TABLE invites ALTER COLUMN expected_wallet DROP NOT NULL;
