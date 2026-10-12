import { randomUUID } from "node:crypto";

type StartupStage = "configuration" | "database" | "migrations" | "services";
type FailureCategory =
  | "configuration_invalid"
  | "database_unavailable"
  | "database_authentication"
  | "database_permission"
  | "migration_required"
  | "services_initialization"
  | "backend_unknown";

// Only fixed labels leave this boundary. Driver messages, causes, connection
// strings, request URLs and private file paths never enter logs or responses.
export class BackendStartupError extends Error {
  readonly stage: StartupStage;
  readonly category: FailureCategory;

  constructor(stage: StartupStage, error: unknown) {
    super("Backend initialization failed.");
    this.name = "BackendStartupError";
    this.stage = stage;
    const code = (error as { code?: unknown } | null)?.code;
    this.category =
      stage === "configuration" ? "configuration_invalid" :
      code === "28P01" || code === "28000" ? "database_authentication" :
      code === "42501" ? "database_permission" :
      ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH", "3D000", "53300", "57P03"].includes(String(code)) ? "database_unavailable" :
      stage === "database" ? "database_unavailable" :
      stage === "migrations" ? "migration_required" : "services_initialization";
  }
}

export function backendUnavailableResponse(
  error: unknown,
  log: (line: string) => void = console.error,
): Response {
  const requestId = randomUUID();
  log(JSON.stringify({
    event: "backend.unavailable",
    requestId,
    stage: error instanceof BackendStartupError ? error.stage : "unknown",
    category: error instanceof BackendStartupError ? error.category : "backend_unknown",
  }));
  return Response.json({
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Backend is not configured or unavailable.",
      requestId,
      retryable: true,
    },
  }, { status: 503, headers: { "cache-control": "no-store" } });
}
