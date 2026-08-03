"use client";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export function api(path: string): string {
  return `${API_BASE}${path}`;
}

export class ApiConnectionError extends Error {
  readonly baseUrl: string;

  constructor(baseUrl = API_BASE) {
    super(
      `The Altitut API is not reachable at ${baseUrl}. Stop the old dev server, then restart the full app with npm run dev.`,
    );
    this.name = "ApiConnectionError";
    this.baseUrl = baseUrl;
  }
}

/**
 * Fetch a FastAPI route and turn browser-level connection failures into a
 * consistent, actionable message. HTTP errors remain responses so each
 * workflow can preserve its trace ID and server-provided detail.
 */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(api(path), init);
  } catch {
    throw new ApiConnectionError();
  }
}
