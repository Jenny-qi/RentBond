CREATE TABLE users (
  wallet text PRIMARY KEY CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  created_at bigint NOT NULL
);
CREATE TABLE siwe_nonces (
  nonce_hash text PRIMARY KEY, binding_hash text NOT NULL, origin text NOT NULL,
  chain_id bigint NOT NULL, issued_at bigint NOT NULL, expires_at bigint NOT NULL,
  consumed_at bigint, CHECK (expires_at > issued_at)
);
CREATE INDEX siwe_nonces_expiry ON siwe_nonces(expires_at);
CREATE TABLE sessions (
  session_hash text PRIMARY KEY, wallet text NOT NULL REFERENCES users(wallet),
  created_at bigint NOT NULL, expires_at bigint NOT NULL, last_seen_at bigint NOT NULL,
  revoked_at bigint, CHECK (expires_at > created_at)
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE rate_limits (
  scope text PRIMARY KEY, count integer NOT NULL CHECK (count > 0), expires_at bigint NOT NULL
);
CREATE TABLE service_profiles (
  id text PRIMARY KEY, chain_id bigint NOT NULL, registry_address text NOT NULL,
  profile_id text NOT NULL, manifest jsonb NOT NULL, salt text NOT NULL, commitment text NOT NULL,
  reviewed boolean NOT NULL DEFAULT false, created_at bigint NOT NULL,
  UNIQUE (chain_id, registry_address, profile_id)
);
CREATE TABLE leases (
  id uuid PRIMARY KEY, landlord text NOT NULL REFERENCES users(wallet), tenant text REFERENCES users(wallet),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  terms jsonb NOT NULL, salt text NOT NULL, commitment text NOT NULL,
  chain_id bigint NOT NULL, contract_address text, chain_lease_id text,
  projection jsonb, synced_at bigint, sync_block numeric(78,0), sync_block_hash text,
  created_at bigint NOT NULL, prepared_at bigint, closed_at bigint, purged_at bigint,
  UNIQUE(chain_id, contract_address),
  CHECK (tenant IS NULL OR tenant <> landlord)
);
CREATE TABLE lease_members (
  lease_id uuid NOT NULL REFERENCES leases(id), wallet text NOT NULL,
  role text NOT NULL CHECK (role IN ('T','L','R','F')), accepted_tx text,
  PRIMARY KEY(lease_id, role), UNIQUE(lease_id, wallet)
);
CREATE INDEX lease_members_wallet ON lease_members(wallet, lease_id);
CREATE TABLE invites (
  token_hash text PRIMARY KEY, lease_id uuid NOT NULL REFERENCES leases(id),
  expected_wallet text NOT NULL, expires_at bigint NOT NULL, claimed_at bigint, claimed_by text,
  created_at bigint NOT NULL
);
CREATE INDEX invites_lease ON invites(lease_id);
CREATE TABLE cases (
  id uuid PRIMARY KEY, lease_id uuid NOT NULL REFERENCES leases(id),
  chain_case_id text NOT NULL, snapshot jsonb NOT NULL, synced_at bigint NOT NULL,
  UNIQUE(lease_id, chain_case_id)
);
CREATE TABLE documents (
  id uuid PRIMARY KEY, lease_id uuid NOT NULL REFERENCES leases(id), case_id uuid REFERENCES cases(id),
  author text NOT NULL, purpose text NOT NULL, next_version integer NOT NULL DEFAULT 1
);
CREATE INDEX documents_scope ON documents(lease_id, case_id);
CREATE TABLE document_uploads (
  id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES documents(id),
  version integer NOT NULL CHECK (version > 0), storage_key text NOT NULL UNIQUE,
  expected_size integer NOT NULL CHECK (expected_size BETWEEN 1 AND 10485760),
  mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png','application/pdf')),
  expected_hash text NOT NULL CHECK(expected_hash ~ '^[0-9a-f]{64}$'),
  expires_at bigint NOT NULL, uploaded_at bigint, submitted_at bigint, cleaned_at bigint,
  UNIQUE(document_id, version)
);
CREATE TABLE document_versions (
  document_id uuid NOT NULL REFERENCES documents(id), version integer NOT NULL,
  storage_key text NOT NULL UNIQUE, content_hash text NOT NULL,
  size integer NOT NULL CHECK (size BETWEEN 1 AND 10485760), mime text NOT NULL,
  submitted_at bigint NOT NULL, PRIMARY KEY(document_id, version)
);
CREATE TABLE evidence_bundles (
  id uuid PRIMARY KEY, lease_id uuid NOT NULL REFERENCES leases(id), case_id uuid REFERENCES cases(id),
  author text NOT NULL, bundle_id text NOT NULL, version integer NOT NULL CHECK (version > 0),
  manifest jsonb NOT NULL, salt text NOT NULL, commitment text NOT NULL, created_at bigint NOT NULL,
  UNIQUE(lease_id, author, bundle_id, version)
);
CREATE TABLE claim_drafts (
  id uuid PRIMARY KEY, lease_id uuid NOT NULL REFERENCES leases(id), author text NOT NULL,
  manifest jsonb NOT NULL, salt text NOT NULL, commitment text NOT NULL, created_at bigint NOT NULL
);
CREATE TABLE chain_events (
  chain_id bigint NOT NULL, tx_hash text NOT NULL, log_index integer NOT NULL CHECK(log_index >= 0),
  block_hash text NOT NULL, block_number numeric(78,0) NOT NULL, contract_address text NOT NULL,
  lease_id uuid REFERENCES leases(id), event_name text NOT NULL, payload jsonb NOT NULL,
  canonical boolean NOT NULL DEFAULT true,
  PRIMARY KEY(chain_id, tx_hash, log_index)
);
CREATE TABLE statements (
  id uuid PRIMARY KEY, lease_id uuid NOT NULL REFERENCES leases(id), case_id uuid REFERENCES cases(id),
  author text NOT NULL, kind text NOT NULL, manifest jsonb NOT NULL,
  salt text NOT NULL, commitment text NOT NULL, created_at bigint NOT NULL
);
CREATE INDEX chain_events_lease_block ON chain_events(lease_id, block_number);
CREATE TABLE chain_checkpoints (
  chain_id bigint NOT NULL, contract_address text NOT NULL, block_number numeric(78,0) NOT NULL,
  block_hash text NOT NULL, PRIMARY KEY(chain_id, contract_address)
);
CREATE TABLE idempotency_keys (
  scope text PRIMARY KEY, body_hash text NOT NULL, response_sealed text NOT NULL, expires_at bigint NOT NULL
);
CREATE TABLE access_grants (
  token_hash text PRIMARY KEY, session_hash text NOT NULL REFERENCES sessions(session_hash),
  resource_type text NOT NULL CHECK(resource_type IN ('document','export')), resource_id text NOT NULL,
  version integer, case_id uuid REFERENCES cases(id), expires_at bigint NOT NULL
);
CREATE INDEX access_grants_expiry ON access_grants(expires_at);
CREATE TABLE exports (
  id uuid PRIMARY KEY, lease_id uuid NOT NULL REFERENCES leases(id), case_id uuid REFERENCES cases(id),
  actor text NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','ready','failed','purged')),
  storage_key text, content_hash text, size integer, attempts integer NOT NULL DEFAULT 0,
  next_attempt_at bigint NOT NULL, created_at bigint NOT NULL, completed_at bigint, error_code text
);
CREATE INDEX exports_queue ON exports(state, next_attempt_at);
CREATE TABLE test_gas_requests (
  id uuid PRIMARY KEY, lease_id uuid NOT NULL REFERENCES leases(id), wallet text NOT NULL,
  amount numeric(78,0) NOT NULL CHECK(amount > 0), chain_id bigint NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','prepared','broadcast','confirmed','failed')),
  tx_hash text UNIQUE, raw_transaction text, attempts integer NOT NULL DEFAULT 0,
  next_attempt_at bigint NOT NULL, created_at bigint NOT NULL, completed_at bigint,
  error_code text, gas_used numeric(78,0), effective_gas_price numeric(78,0)
);
CREATE INDEX test_gas_quota ON test_gas_requests(wallet, lease_id, created_at);
CREATE TABLE notifications (
  id uuid PRIMARY KEY, dedupe_key text NOT NULL UNIQUE, object_id text NOT NULL,
  recipient text NOT NULL, type text NOT NULL, attempts integer NOT NULL DEFAULT 0,
  next_attempt_at bigint NOT NULL, delivered_at bigint
);
CREATE TABLE audit_log (
  id uuid PRIMARY KEY, actor text, action text NOT NULL, resource_id text,
  occurred_at bigint NOT NULL, request_id text NOT NULL
);
CREATE INDEX audit_log_resource ON audit_log(resource_id, occurred_at);

CREATE FUNCTION reject_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable record'; END;
$$;
CREATE TRIGGER immutable_document_version BEFORE UPDATE OR DELETE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER immutable_evidence_bundle BEFORE UPDATE OR DELETE ON evidence_bundles
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER immutable_claim_draft BEFORE UPDATE OR DELETE ON claim_drafts
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER immutable_statement BEFORE UPDATE OR DELETE ON statements
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER immutable_service_profile BEFORE UPDATE OR DELETE ON service_profiles
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE FUNCTION protect_deployed_lease() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.contract_address IS NOT NULL AND
    (NEW.terms, NEW.salt, NEW.commitment, NEW.landlord, NEW.tenant, NEW.chain_id, NEW.contract_address, NEW.chain_lease_id)
    IS DISTINCT FROM
    (OLD.terms, OLD.salt, OLD.commitment, OLD.landlord, OLD.tenant, OLD.chain_id, OLD.contract_address, OLD.chain_lease_id)
  THEN RAISE EXCEPTION 'deployed lease terms are immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER deployed_lease_immutable BEFORE UPDATE ON leases
  FOR EACH ROW EXECUTE FUNCTION protect_deployed_lease();

-- App sessions are not Supabase JWTs. No anonymous/authenticated role gets table access.
-- The server database owner bypasses RLS and MUST run the application ACL.
DO $$
DECLARE item text; role_name text;
BEGIN
  FOREACH item IN ARRAY ARRAY['users','siwe_nonces','sessions','rate_limits','service_profiles','leases',
    'lease_members','invites','cases','documents','document_uploads','document_versions','evidence_bundles',
    'claim_drafts','statements','chain_events','chain_checkpoints','idempotency_keys','access_grants','exports',
    'test_gas_requests','notifications','audit_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', item);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', item);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', item, role_name);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
