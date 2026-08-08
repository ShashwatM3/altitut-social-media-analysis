"use client";

import { apiFetch } from "./api";
import { newTraceId, TRACE_ID_HEADER } from "./trace";
import type { CampaignPlatform } from "./campaigns";
import { saveAutopostHistory } from "./social-posts";

export type AutopostResult = {
  platform: CampaignPlatform;
  status: "pending" | "success" | "failed" | "skipped";
  postUrl?: string;
  platformPostId?: string;
  error?: string;
};

export type AutopostState = {
  postId: string;
  createdAt?: string;
  status?:
    | "draft"
    | "publishing"
    | "published"
    | "partial"
    | "failed"
    | "scheduled";
  media: {
    kind: "image";
    urls: string[];
    storagePaths: string[];
    width?: number;
    height?: number;
    bytes?: number;
    items?: Array<{
      url: string;
      path: string;
      width?: number;
      height?: number;
      bytes: number;
    }>;
  };
  brief?: string;
  copy: Partial<
    Record<CampaignPlatform, { caption: string; firstComment?: string }>
  >;
  targets: Array<{
    platform: CampaignPlatform;
    placement: "feed";
    visibility?: "PUBLIC";
    pageId?: string;
    postToProfile?: boolean;
    collaborators?: string[];
    locationId?: string;
  }>;
  scheduledFor: null;
  timezone: null;
  vendorRequestId?: string;
  jobId?: string;
  results?: AutopostResult[];
  warnings?: string[];
  done?: boolean;
};

export class AutopostRequestError extends Error {
  constructor(
    message: string,
    readonly traceId: string,
  ) {
    super(message);
    this.name = "AutopostRequestError";
  }
}

async function callAutopost(
  step: "validate" | "publish" | "poll" | "retry" | "save",
  state: AutopostState,
  traceId: string,
): Promise<AutopostState> {
  const response = await apiFetch("/api/autopost", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [TRACE_ID_HEADER]: traceId,
    },
    body: JSON.stringify({ step, state }),
  });
  const returnedTraceId = response.headers.get(TRACE_ID_HEADER) ?? traceId;
  const json = (await response.json().catch(() => ({}))) as {
    state?: AutopostState;
    detail?: string;
    error?: string | { message?: string };
  };

  if (!response.ok || !json.state) {
    const error =
      json.detail ??
      (typeof json.error === "string" ? json.error : json.error?.message) ??
      `Publishing step “${step}” failed.`;
    throw new AutopostRequestError(error, returnedTraceId);
  }
  return json.state;
}

async function persistAutopostState(
  state: AutopostState,
  traceId: string,
): Promise<void> {
  const [browserResult, serverResult] = await Promise.allSettled([
    saveAutopostHistory(state),
    callAutopost("save", state, traceId),
  ]);
  if (browserResult.status === "rejected" && serverResult.status === "rejected") {
    throw browserResult.reason;
  }
}

export async function publishCampaignPost(
  initialState: AutopostState,
  onState?: (state: AutopostState) => void | Promise<void>,
  retryExisting = false,
): Promise<AutopostState> {
  const traceId = newTraceId();
  let state: AutopostState;
  if (retryExisting) {
    // Upload-Post retains the original media snapshot and retries only failed
    // platforms, so a vendor retry must not create a second upload request.
    state = await callAutopost("retry", initialState, traceId);
  } else {
    state = await callAutopost("validate", initialState, traceId);
    await onState?.(state);
    state = await callAutopost("publish", state, traceId);
  }
  await onState?.(state);
  await persistAutopostState(state, traceId);

  if (!state.done) {
    // Upload-Post recommends 5–10 second intervals and a two-minute ceiling for
    // image uploads. The request remains "publishing" if that window elapses.
    for (let attempt = 0; attempt < 23 && !state.done; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
      state = await callAutopost("poll", state, traceId);
      await onState?.(state);
    }
  }

  await persistAutopostState(state, traceId);
  return state;
}

export async function refreshCampaignPost(
  initialState: AutopostState,
): Promise<AutopostState> {
  const traceId = newTraceId();
  const state = await callAutopost("poll", initialState, traceId);
  await persistAutopostState(state, traceId);
  return state;
}
