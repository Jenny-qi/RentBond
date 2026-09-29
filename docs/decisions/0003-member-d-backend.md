# ADR 0003: Member D backend and private-data boundary

Date: 2026-09-26. Scope: RB-08 and D's API/data/export handoffs.

## Decisions

- Keep the existing Next.js application. One Node.js catch-all delegates to independently testable server modules. No public endpoint accepts a payment-success flag, chain projection, resolver address override or user private key.
- PostgreSQL is the schema authority. PGlite 0.5.8 runs the same migration locally without cloud accounts or Docker. Its directory has one process owner; the local API runs persistent export/retention jobs in that process. Shared PostgreSQL uses pg 8.23.0 and an independent CLI worker.
- Default file storage is a private local directory outside public assets. Supabase private Storage is supported through its REST API. Browser credentials never get direct bucket access. Downloads pass through the API with a five-minute opaque grant, session binding, current ACL and SHA-256 verification.
- Sessions and nonces store token hashes only. Invitations may bind an existing wallet, or allow a new account to claim the single tenant slot. The landlord then reviews and freezes that address before deployment. Claiming is not accepting terms.
- All command POSTs except authentication require an Idempotency-Key scoped to session and path. Cached responses are encrypted with AES-256-GCM because invitation responses contain bearer tokens. Draft PATCH requests carry a version. The DB transaction lock serializes quota reservations and command races across processes.
- Prepared terms are frozen. A deployment is attached only from a confirmed event of the configured Factory and an exact comparison with the contract's immutable terms. RPC reads validate every configured endpoint's network. Private resolver access requires eligibility at both the current head and the configured confirmed head; revocation applies immediately.
- ABI files are generated from the actual Solidity sources with solc 0.8.24, or existing Foundry artifacts. No handwritten ABI is introduced.
- Correct the scaffold's SHA-256 terms commitment to the specified salted Keccak scheme. Canonical JSON sorts object keys, preserves arrays, requires schemaVersion, and rejects non-integer JSON numbers. Bytes are UTF-8("RentBond:private:v1\n") + raw 32-byte salt + canonical JSON. File hashes remain SHA-256. No deployed commitments existed in the input repository; consumers must use this shared implementation.
- The test sponsor sends only its own bounded native test MON to the authenticated participant. A real deployed lease qualifies; a joined/frozen draft additionally requires an explicitly configured test organizer. Signed transfer bytes are committed before broadcast and only the identical transaction is retried. An uncertain transaction blocks later sponsor nonces until reconciled.
- Export ZIPs include private terms/salt, versioned originals, claims/statements, case snapshots, canonical/noncanonical event labels and verification instructions. Draft content is distinguished from actual chain confirmation. Early deletion requires authenticated requests from both parties; normal original retention is 90 days after confirmed Closed.

## Consequences And Limits

Local mode is a single Node process with durable files. Use PostgreSQL for multiple API/worker processes; ephemeral serverless disks cannot host the local database or objects. No cloud vendor is mandatory: PostgreSQL, files and the Node services may all run locally or on one server.

The transaction lock favors straightforward, conservative correctness for the small test MVP. Exports and RPC work can delay other commands; this is not a measured production-scale design. Event sync is bounded to 1,000 blocks per job and starts at the recorded deployment, never genesis. E may call the provided synchronization function more frequently while catching up.

The existing EvidenceAcknowledged event omits bundleId and commitment. D reads getEvidence(submitter,bundleId,version) at the configured confirmed block rather than guessing which version was acknowledged. B/E should consider event completeness in future contract versions; this change does not alter contracts.

This ADR changes no allocation, beneficiary, deadline or resolver authority rule. B/C/E consumption changes are documented in the API and handoff files. Public Monad deployment, real-device passkey recovery, Supabase-account operation and independent review remain separate evidence requirements.
