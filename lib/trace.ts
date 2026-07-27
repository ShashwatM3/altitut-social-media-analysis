"use client";

export const TRACE_ID_HEADER = "x-trace-id";

export function newTraceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class TraceableError extends Error {
  traceId: string | null;

  constructor(message: string, traceId?: string | null) {
    super(message);
    this.traceId = traceId ?? null;
  }
}

export async function parseApiError(
  response: Response,
  fallback: string,
): Promise<{ message: string; traceId: string | null }> {
  const traceId = response.headers.get(TRACE_ID_HEADER) ?? null;
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const candidate =
    (typeof body?.error === "object" && body.error !== null
      ? (body.error as Record<string, unknown>).message
      : undefined) ??
    body?.error ??
    body?.detail ??
    body?.message ??
    fallback;

  const message = typeof candidate === "string" ? candidate : fallback;
  return { message, traceId };
}

export async function raiseForTrace(
  response: Response,
  fallback: string,
): Promise<never> {
  const { message, traceId } = await parseApiError(response, fallback);
  throw new TraceableError(message, traceId);
}
