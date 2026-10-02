import type { Data } from "./client.ts";

export async function finalizeUpload(
  request: (path: string, body?: unknown) => Promise<Data>,
  intent: Data,
  current: () => boolean,
  wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
) {
  const path = `/api/documents/${intent.documentId}/uploads/${intent.uploadId}`;
  if (intent.statusUrl !== path) throw new Error("Invalid upload status URL");
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!current())
      throw new Error("Upload paused because the account or page changed.");
    const status = await request(path);
    if (!current())
      throw new Error("Upload paused because the account or page changed.");
    if (status.submitted)
      return { documentId: intent.documentId, version: intent.version };
    if (status.scanStatus === "rejected")
      throw new Error("Security checks rejected this file.");
    if (!status.uploaded) throw new Error("The file upload has not completed.");
    if (status.scanStatus === "clean")
      return request(`/api/documents/${intent.documentId}/submit`, {
        uploadId: intent.uploadId,
      });
    if (status.scanStatus === "error" && !status.retryable)
      throw new Error(
        "Security scanning failed. This version cannot be submitted.",
      );
    await wait(2000);
  }
  throw new Error(
    "Security scanning is still pending. Check this upload again shortly.",
  );
}
