// D-owned, server-only persistence boundary. E supplies confirmed RPC timestamps
// and receipts; this adapter never signs, broadcasts or holds a role key.
export { createTaskStore } from "../../../web/src/server/worker-tasks.ts";
export { syncLease } from "../../../web/src/server/projections.ts";
