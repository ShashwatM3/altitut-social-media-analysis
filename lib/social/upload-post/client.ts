import "server-only";

import { SocialPublishError } from "../errors";

const BASE =
  process.env.UPLOAD_POST_BASE_URL ?? "https://api.upload-post.com/api";

export async function uploadPostFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const { idempotencyKey, ...rest } = init;

  const headers: Record<string, string> = {
    Authorization: `Apikey ${process.env.UPLOAD_POST_API_KEY ?? ""}`,
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    ...(rest.headers as Record<string, string>),
  };

  // Do NOT set Content-Type when body is FormData — fetch must set the multipart boundary.
  if (rest.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json as Record<string, unknown>)?.success === false) {
    const raw = json as Record<string, unknown>;
    throw new SocialPublishError(
      {
        code: `UPLOADPOST_${res.status}`,
        message: String(raw?.error ?? raw?.message ?? res.statusText ?? "Upload-Post request failed"),
        retryable: res.status === 429 || res.status >= 500,
      },
      json,
    );
  }
  return json as T;
}
