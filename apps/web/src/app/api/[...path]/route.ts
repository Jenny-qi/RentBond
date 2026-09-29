import { randomUUID } from "node:crypto";
import { getApp } from "@/server/runtime";
import { handleApi } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  try {
    return await handleApi(await getApp(), request);
  } catch {
    return Response.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Backend is not configured or unavailable.",
          requestId: randomUUID(),
          retryable: true,
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
export {
  handler as GET,
  handler as POST,
  handler as PATCH,
  handler as PUT,
  handler as DELETE,
};
