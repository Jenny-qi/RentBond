import { z } from "zod";

export const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .refine((v) => !/^0x0{40}$/i.test(v))
  .transform((v) => v.toLowerCase());
export const hash = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .refine((v) => !/^0x0{64}$/i.test(v))
  .transform((v) => v.toLowerCase());
export const uuid = z.string().uuid();
export const amount = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,77})$/)
  .pipe(z.string().refine((v) => BigInt(v) > 0n && BigInt(v) % 10000n === 0n));
export const timestamp = z.number().int().positive().max(8640000000000);
export const loginSchema = z
  .object({
    message: z.string().min(1).max(8192),
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
  })
  .strict();
export const draftFields = z
  .object({
    title: z.string().trim().min(1).max(160),
    termsText: z.string().min(20).max(30000),
    depositAmount: amount.pipe(
      z
        .string()
        .refine((v) => BigInt(v) >= 1000000n && BigInt(v) <= 10000000000n),
    ),
    leaseStartAt: timestamp,
    leaseEndAt: timestamp,
    acceptDeadline: timestamp,
    tenant: address.optional(),
    serviceProfileId: z.string().min(1).max(200).optional(),
  })
  .strict();
export const patchDraft = draftFields
  .partial()
  .extend({ version: z.number().int().positive() })
  .strict();
export const inviteSchema = z
  .object({
    wallet: address.optional(),
    expiresInSeconds: z.number().int().min(60).max(604800).default(86400),
  })
  .strict();
export const claimInvite = z.object({ confirm: z.literal(true) }).strict();
export const uploadSchema = z
  .object({
    leaseId: uuid,
    caseId: uuid.optional(),
    documentId: uuid.optional(),
    purpose: z.enum([
      "terms",
      "move-in",
      "repair",
      "move-out",
      "claim",
      "case",
    ]),
    mime: z.enum(["image/jpeg", "image/png", "application/pdf"]),
    size: z.number().int().min(1).max(10485760),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const submitSchema = z.object({ uploadId: uuid }).strict();
export const documentRef = z
  .object({ documentId: uuid, version: z.number().int().positive() })
  .strict();
export const bundleSchema = z
  .object({
    leaseId: uuid,
    bundleId: hash.optional(),
    stage: z.enum(["move-in", "repair", "move-out", "case"]),
    items: z
      .array(
        z
          .object({
            roomKey: z.string().min(1).max(100),
            description: z.string().min(1).max(2000),
            documents: z.array(documentRef).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export const claimsSchema = z
  .object({
    leaseId: uuid,
    items: z
      .array(
        z
          .object({
            category: z.enum([
              "cleaning",
              "damage",
              "unpaid-rent",
              "utilities",
              "other",
            ]),
            amount,
            reason: z.string().min(20).max(2000),
            clause: z.string().min(1).max(1000),
            documents: z.array(documentRef).max(20),
            noEvidenceReason: z.string().min(1).max(2000).optional(),
          })
          .strict()
          .refine((v) => v.documents.length > 0 || !!v.noEvidenceReason),
      )
      .min(1)
      .max(10),
  })
  .strict();
export const exportSchema = z
  .object({ leaseId: uuid, caseId: uuid.optional() })
  .strict();
export const gasSchema = z.object({ leaseId: uuid }).strict();
export type DraftFields = z.infer<typeof draftFields>;
