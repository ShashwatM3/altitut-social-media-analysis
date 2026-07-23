import "server-only";

export type NormalizedError = {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
};

export class SocialPublishError extends Error {
  constructor(public normalized: NormalizedError, public raw?: unknown) {
    super(normalized.message);
    this.name = "SocialPublishError";
  }
}

/** Exponential backoff with full jitter. */
export function backoffMs(attempt: number): number {
  return Math.floor(Math.random() * Math.min(1000 * 2 ** attempt, 60_000));
}
