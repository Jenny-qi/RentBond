/**
 * API input and lease structure schemas.
 *
 * E maintains; D reviews server-side schemas; C reviews consumer compatibility.
 * All schemas use stable field ordering and include schemaVersion.
 */

export const SCHEMA_VERSION = '1.0.0';

/** RFC 7807 error shape used across all API routes */
export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

/** HTTP status codes used */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
