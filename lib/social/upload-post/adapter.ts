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
  status: "pending" | "success" | "failed";
  postUrl?: string;
  platformPostId?: string;
  error?: string;
};

export type UploadPostPage = { id: string; name: string };

type RawResult = {
  platform?: string;
  success?: boolean;
  status?: string;
  post_url?: string;
  platform_post_id?: string;
  post_id?: string;
  error?: string;
  message?: string;
};

type PublishResponse = {
  success?: boolean;
  request_id?: string;
  job_id?: string;
  results?: RawResult[];
  platforms?: RawResult[];
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

function mapRawResult(raw: RawResult): UploadPostResult | null {
  const platform = asProvider(raw.platform ?? "");
  if (!platform) return null;
  const statusLower = (raw.status ?? "").toLowerCase();
  const success =
    raw.success === true ||
    statusLower === "completed" ||
    statusLower === "success";
  const failed =
    raw.success === false ||
    statusLower === "failed" ||
    statusLower === "error";
  return {
    platform,
    status: success ? "success" : failed ? "failed" : "pending",
    postUrl: raw.post_url,
    platformPostId: raw.platform_post_id ?? raw.post_id,
    error: raw.error ?? raw.message,
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
  fd.append("request_id", input.postId);
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
    fd.append(
      "description",
      input.copy.linkedin?.caption ?? input.copy.facebook?.caption ?? fallbackText,
    );
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

    const rawResults = res.results ?? res.platforms ?? [];
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
  const rawResults =
    (s.results as RawResult[] | undefined) ??
    (s.platforms as RawResult[] | undefined) ??
    [];
  const topStatus = String(s.status ?? "").toLowerCase();
  const terminalTop =
    topStatus === "completed" ||
    topStatus === "failed" ||
    topStatus === "not_found";
  const done =
    terminalTop ||
    (rawResults.length > 0 &&
      rawResults.every((r) => {
        const st = String(r.status ?? "").toLowerCase();
        return (
          r.success !== undefined ||
          st === "completed" ||
          st === "failed" ||
          st === "error"
        );
      }));

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
  await uploadPostFetch("/uploadposts/unpublish", {
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
