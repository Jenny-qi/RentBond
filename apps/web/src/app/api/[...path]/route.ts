import { getApp } from "@/server/runtime";
import { handleApi } from "@/server/api";
import { backendUnavailableResponse } from "@/server/startup-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  try {
    return await handleApi(await getApp(), request);
  } catch (error) {
    return backendUnavailableResponse(error);
  }
}
export {
  handler as GET,
  handler as POST,
  handler as PATCH,
  handler as PUT,
  handler as DELETE,
};
