/** D -> C/E contract. Timestamps on chain are UTC seconds; session/link times are epoch milliseconds. */
export interface NonceChallenge {
  nonce: string;
  domain: string;
  uri: string;
  chainId: number;
  statement: string;
  issuedAt: string;
  expirationTime: string;
}
export interface SessionInfo {
  wallet: string;
  expiresAt: number;
}
export interface DocumentReference {
  documentId: string;
  version: number;
}
export interface UploadIntent {
  documentId: string;
  version: number;
  uploadId: string;
  expiresAt: number;
  method: "PUT";
  uploadUrl: string;
}
export interface AccessLink {
  url: string;
  expiresAt: number;
}
export interface WalletAction {
  functionName: string;
  args: unknown[];
  requiresWalletConfirmation: true;
}
export interface PrivateCommitment<T> {
  manifest: T;
  salt: string;
  commitment: string;
  onChain: boolean;
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export type ExportState =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "purged";
export type GasState =
  | "queued"
  | "prepared"
  | "broadcast"
  | "confirmed"
  | "failed";
