import "server-only";

import { SocialPublishError } from "../errors";
import type { MediaInput, Provider, PublishAdapter, PublishInput, PublishResult } from "../types";
import { uploadPostFetch } from "./client";

export type UploadPostTarget = {
  platform: Provider;
  placement?: "feed" | "reel" | "story";
  visibility?: string;
  pageId?: string;
  firstComment?: string;
};

export type UploadPostResult = {
  platform: Provider;
  status: "pending" | "success" | "failed" | "skipped";
  postUrl?: string;
  platformPostId?: string;
  error?: string;
};

export type UploadPostPage = { id: string; name: string };

type RawResult = {
  platform?: string;
  success?: boolean;
  status?: string;
  // Upload-Post returns `url` (and sometimes legacy `post_url`) for the live post link.
  url?: string;
  post_url?: string;
  // Platform-specific IDs returned in different fields.
  platform_post_id?: string;
  post_id?: string;
  publish_id?: string;
  container_id?: string;
  video_id?: string;
  video_urn?: string;
  video_reel_id?: string;
  image_urns?: string[];
  post_ids?: string[];
  error?: string;
  message?: string;
};

// Upload-Post returns synchronous results as an object keyed by platform, or
// async results as an array under `results` / `platforms`.
type RawResults = Record<string, RawResult> | RawResult[];

type PublishResponse = {
  success?: boolean;
  request_id?: string;
  job_id?: string;
  results?: RawResults;
  platforms?: RawResults;
  available_pages?: UploadPostPage[];
  error?: string;
  message?: string;
};

function asProvider(value: string): Provider | undefined {
  if (value === "linkedin" || value === "facebook" || value === "instagram") {
    return value;
  }
  return undefined;
}

function rawResultsToArray(raw: RawResults | undefined): RawResult[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw).map(([platform, result]) => ({
    ...result,
    platform: result?.platform ?? platform,
  }));
}

function extractPostUrl(raw: RawResult): string | undefined {
  return raw.url ?? raw.post_url;
}

function extractPlatformPostId(raw: RawResult): string | undefined {
  return (
    raw.platform_post_id ??
    raw.publish_id ??
    raw.post_id ??
    raw.container_id ??
    raw.video_id ??
    raw.video_reel_id ??
    raw.video_urn ??
    raw.image_urns?.[0] ??
    raw.post_ids?.[0]
  );
}

function isTerminalMessage(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower === "published" || lower === "completed" || lower.startsWith("fail");
}

function mapRawResult(raw: RawResult): UploadPostResult | null {
  const platform = asProvider(raw.platform ?? "");
  if (!platform) return null;

  const statusLower = (raw.status ?? "").toLowerCase();
  const messageLower = (raw.message ?? "").toLowerCase();

  // `success: true` by itself is not enough: Upload-Post status responses can
  // return `success: true` with `message: "Queued"` while the top-level status
  // is still "in_progress". We must look at the explicit status/message first.
  const terminalStatus =
    statusLower === "completed" ||
    statusLower === "success" ||
    statusLower === "failed" ||
    statusLower === "error" ||
    messageLower === "published";
  const pendingStatus =
    statusLower === "pending" ||
    statusLower === "queued" ||
    statusLower === "processing" ||
    statusLower === "in_progress" ||
    messageLower === "queued";
  const failedStatus = statusLower === "failed" || statusLower === "error";
  const skippedStatus = statusLower === "skipped";

  let status: UploadPostResult["status"];
  if (failedStatus || raw.success === false) {
    status = "failed";
  } else if (skippedStatus) {
    status = "skipped";
  } else if (terminalStatus) {
    status = "success";
  } else if (pendingStatus) {
    status = "pending";
  } else if (raw.success === true && isTerminalMessage(raw.message)) {
    // Sync upload response with `success: true` and a terminal message.
    status = "success";
  } else if (raw.success === true && extractPostUrl(raw)) {
    // Sync upload response with `success: true` and a real URL.
    status = "success";
  } else if (raw.success === true) {
    // `success: true` but no terminal indicator and no URL yet — keep polling.
    status = "pending";
  } else {
    status = "pending";
  }

  // Only treat `message` as an error when the result actually failed.
  // "Queued" and "Published" are progress messages, not errors.
  const error =
    raw.error ?? (status === "failed" && raw.message ? raw.message : undefined);

  return {
    platform,
    status,
    postUrl: extractPostUrl(raw),
    platformPostId: extractPlatformPostId(raw),
    error,
  };
}

export type PublishToUploadPostInput = {
  profile: string;
  postId: string;
  targets: UploadPostTarget[];
  copy: Partial<Record<Provider, { caption: string; firstComment?: string }>>;
  media: MediaInput[];
  scheduledFor?: Date | string;
  timezone?: string;
};

export async function publishToUploadPost(
  input: PublishToUploadPostInput,
): Promise<{
  requestId?: string;
  jobId?: string;
  results?: UploadPostResult[];
  availablePages?: UploadPostPage[];
}> {
  if (!process.env.UPLOAD_POST_API_KEY) {
    throw new SocialPublishError(
      { code: "CONFIG", message: "UPLOAD_POST_API_KEY is not set.", retryable: false },
      {},
    );
  }
  if (!input.profile) {
    throw new SocialPublishError(
      { code: "CONFIG", message: "UPLOAD_POST_PROFILE is not set.", retryable: false },
      {},
    );
  }

  const fd = new FormData();
  fd.append("user", input.profile);
  fd.append("async_upload", "true");

  for (const target of input.targets) {
    fd.append("platform[]", target.platform);
  }

  if (input.scheduledFor) {
    const date =
      input.scheduledFor instanceof Date
        ? input.scheduledFor
        : new Date(input.scheduledFor);
    fd.append("scheduled_date", date.toISOString());
    fd.append("timezone", input.timezone ?? "UTC");
  }

  const firstTarget = input.targets[0];
  const firstCopy = firstTarget ? input.copy[firstTarget.platform] : undefined;
  const fallbackText = firstCopy?.caption ?? "";
  const fallbackTitle = fallbackText.slice(0, 200);

  // Endpoint selection by media shape.
  const hasVideo = input.media.some((m) => m.kind === "video");
  const hasImage = input.media.some((m) => m.kind === "image");
  let path: string;

  if (hasVideo && hasImage) {
    // Mixed carousels are only supported for Instagram via /upload_photos.
    path = "/upload_photos";
    for (const m of input.media) {
      if (m.publicUrl) fd.append("photos[]", m.publicUrl);
    }
  } else if (hasVideo) {
    path = "/upload";
    const video = input.media.find((m) => m.kind === "video");
    if (video?.publicUrl) fd.append("video", video.publicUrl);
  } else if (hasImage) {
    path = "/upload_photos";
    for (const m of input.media) {
      if (m.publicUrl) fd.append("photos[]", m.publicUrl);
    }
  } else {
    path = "/upload_text";
  }

  // Generic fallbacks; per-platform params below override where the vendor supports them.
  fd.append("title", fallbackTitle);
  if (fallbackText) {
    // The generic `description` is used as the Facebook description and as the
    // LinkedIn commentary fallback. Prefer the Facebook caption when Facebook is
    // selected, otherwise the LinkedIn caption, then any available caption.
    const description =
      input.copy.facebook?.caption ??
      input.copy.linkedin?.caption ??
      fallbackText;
    fd.append("description", description);
  }

  for (const target of input.targets) {
    const platformCopy = input.copy[target.platform];
    const caption = platformCopy?.caption ?? fallbackText;
    const firstComment = platformCopy?.firstComment ?? "";

    if (target.platform === "linkedin") {
      fd.append("linkedin_description", caption);
      fd.append("linkedin_title", caption);
      fd.append("visibility", target.visibility ?? "PUBLIC");
      if (target.pageId) fd.append("target_linkedin_page_id", target.pageId);
      if (firstComment) fd.append("linkedin_first_comment", firstComment);
    }

    if (target.platform === "facebook") {
      if (!target.pageId) {
        throw new SocialPublishError(
          {
            code: "VALIDATION",
            message: "Facebook requires a target Page. Connect a Page in Upload-Post and run setup.",
            retryable: false,
          },
          {},
        );
      }
      fd.append("facebook_page_id", target.pageId);
      fd.append("facebook_title", caption);

      // facebook_media_type differs for photos vs videos.
      if (hasVideo) {
        const mediaType =
          target.placement === "story"
            ? "STORIES"
            : target.placement === "reel"
              ? "REELS"
              : "VIDEO";
        fd.append("facebook_media_type", mediaType);
      } else if (hasImage) {
        const mediaType =
          target.placement === "story" ? "STORIES" : "POSTS";
        fd.append("facebook_media_type", mediaType);
      }
      if (firstComment) fd.append("facebook_first_comment", firstComment);
    }

    if (target.platform === "instagram") {
      fd.append("instagram_title", caption);
      if (hasVideo) {
        if (target.placement === "reel") fd.append("media_type", "REELS");
        if (target.placement === "story") fd.append("media_type", "STORIES");
        // feed video intentionally omits media_type so Upload-Post uses its default.
      } else if (hasImage) {
        if (target.placement === "story") fd.append("media_type", "STORIES");
        // feed photo intentionally omits media_type to default to IMAGE.
      }
      if (firstComment) fd.append("instagram_first_comment", firstComment);
    }
  }

  try {
    const res = await uploadPostFetch<PublishResponse>(path, {
      method: "POST",
      body: fd,
      idempotencyKey: input.postId,
    });

    const rawResults = rawResultsToArray(res.results ?? res.platforms);
    return {
      requestId: res.request_id,
      jobId: res.job_id,
      results: rawResults
        .map(mapRawResult)
        .filter((r): r is UploadPostResult => r !== null),
    };
  } catch (error) {
    if (error instanceof SocialPublishError && error.raw) {
      const raw = error.raw as Record<string, unknown>;
      const pages = Array.isArray(raw.available_pages)
        ? (raw.available_pages as UploadPostPage[])
        : undefined;
      if (pages && pages.length > 0) {
        return { availablePages: pages };
      }
    }
    throw error;
  }
}

export async function checkUploadPostStatus(
  id: string,
  kind: "request" | "job" = "request",
): Promise<{ done: boolean; results?: UploadPostResult[] }> {
  const query =
    kind === "job"
      ? `job_id=${encodeURIComponent(id)}`
      : `request_id=${encodeURIComponent(id)}`;
  const s = await uploadPostFetch<Record<string, unknown>>(
    `/uploadposts/status?${query}`,
  );

  // Defensive parser — the exact response shape is not fully specified in the public
  // docs, so we accept several likely keys. Verified against live response when tested.
  const rawResults = rawResultsToArray(
    (s.results ?? s.platforms) as RawResults | undefined,
  );
  const topStatus = String(s.status ?? "").toLowerCase();
  const terminalTop =
    topStatus === "completed" ||
    topStatus === "failed" ||
    topStatus === "not_found";

  // A result is terminal when it has an explicit completed/failed/error status,
  // or a terminal message. We cannot trust `success: true` alone because Upload-Post
  // returns `success: true` + `message: "Queued"` while the job is still running.
  const isTerminalResult = (r: RawResult): boolean => {
    const st = String(r.status ?? "").toLowerCase();
    const msg = (r.message ?? "").toLowerCase();
    return (
      st === "completed" ||
      st === "success" ||
      st === "failed" ||
      st === "error" ||
      msg === "published" ||
      msg === "completed"
    );
  };

  const done =
    terminalTop ||
    (rawResults.length > 0 && rawResults.every(isTerminalResult));

  return {
    done,
    results: rawResults
      .map(mapRawResult)
      .filter((r): r is UploadPostResult => r !== null),
  };
}

export async function unpublishOnUploadPost(
  provider: Provider,
  providerPostId: string,
  profile: string,
): Promise<void> {
  await uploadPostFetch("/uploadposts/posts/unpublish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform: provider,
      user: profile,
      post_id: providerPostId,
    }),
  });
}

export const uploadPostAdapter: PublishAdapter = {
  vendor: "upload_post",

  async publish(provider, input): Promise<PublishResult> {
    const target: UploadPostTarget = {
      platform: provider,
      placement: (input.options?.placement as UploadPostTarget["placement"]) ?? "feed",
      visibility: input.options?.visibility as string | undefined,
      pageId: input.options?.pageId as string | undefined,
      firstComment: input.options?.firstComment as string | undefined,
    };
    const res = await publishToUploadPost({
      profile: input.accountId,
      postId: input.idempotencyKey,
      targets: [target],
      copy: {
        [provider]: { caption: input.text, firstComment: target.firstComment },
      },
      media: input.media,
      scheduledFor: input.scheduledFor,
      timezone: input.options?.timezone as string | undefined,
    });
    if (res.results && res.results.length > 0) {
      const hit = res.results[0];
      return {
        providerPostId: hit.platformPostId,
        permalink: hit.postUrl,
        pendingRequestId: res.requestId,
      };
    }
    return { pendingRequestId: res.requestId };
  },

  async checkStatus(requestId) {
    const { done, results } = await checkUploadPostStatus(requestId, "request");
    const hit = results?.[0];
    return {
      done,
      providerPostId: hit?.platformPostId,
      permalink: hit?.postUrl,
    };
  },

  async delete(provider, providerPostId, accountId) {
    await unpublishOnUploadPost(provider, providerPostId, accountId);
  },
};
