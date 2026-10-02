ALTER TABLE document_uploads
  ADD COLUMN scan_state text NOT NULL DEFAULT 'pending'
    CHECK (scan_state IN ('pending','scanning','clean','rejected','error')),
  ADD COLUMN scan_engine text,
  ADD COLUMN scan_digest text,
  ADD COLUMN scanned_at bigint,
  ADD COLUMN scan_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN scan_next_at bigint NOT NULL DEFAULT 0,
  ADD COLUMN scan_token uuid,
  ADD COLUMN scan_lock_until bigint,
  ADD COLUMN scan_error text;
ALTER TABLE document_uploads ADD COLUMN scan_source text NOT NULL DEFAULT 'quarantine'
  CHECK (scan_source IN ('quarantine','legacy'));
UPDATE document_uploads SET scan_source='legacy' WHERE uploaded_at IS NOT NULL;
CREATE INDEX upload_scan_queue ON document_uploads(scan_state,scan_next_at);

ALTER TABLE exports ADD COLUMN scan_policy text;
UPDATE exports SET state='failed',error_code='SCAN_UPGRADE_REQUIRED' WHERE state='ready';
DELETE FROM access_grants WHERE resource_type='export';

CREATE TABLE worker_tasks (
  id uuid PRIMARY KEY, lease_id uuid NOT NULL REFERENCES leases(id),
  kind text NOT NULL, case_id numeric(78,0), due_at numeric(78,0) NOT NULL,
  source_block numeric(78,0) NOT NULL, source_hash text NOT NULL,
  dedupe_key text NOT NULL UNIQUE, payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','running','prepared','broadcast','confirmed','failed','cancelled','reconcile')),
  attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at bigint NOT NULL DEFAULT 0, lock_token uuid, locked_until bigint,
  tx_hash text, raw_transaction text, error_code text, receipt jsonb,
  created_at bigint NOT NULL, updated_at bigint NOT NULL
);
CREATE INDEX worker_task_queue ON worker_tasks(state,next_attempt_at,due_at);
ALTER TABLE worker_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE worker_tasks FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE worker_tasks FROM %I',role_name);
    END IF;
  END LOOP;
END;
$$;
