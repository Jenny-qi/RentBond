export class ApiFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  constructor(
    status: number,
    code: string,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}
export function requireThat(
  value: unknown,
  status: number,
  code: string,
  message: string,
): asserts value {
  if (!value) throw new ApiFailure(status, code, message);
}
export const unavailable = (message = "Service temporarily unavailable.") =>
  new ApiFailure(503, "SERVICE_UNAVAILABLE", message, true);
