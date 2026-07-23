import { NextResponse } from "next/server";
import { saveSocialPost, deleteSocialPost, type Provider, type SocialPost } from "../../../lib/social-posts";
import { getUploadPostProfile, resolveSocialAccount } from "../../../lib/social/accounts";
import {
  checkUploadPostStatus,
  publishToUploadPost,
  unpublishOnUploadPost,
  type UploadPostResult,
  type UploadPostTarget,
} from "../../../lib/social/upload-post/adapter";
import { SocialPublishError } from "../../../lib/social/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

export type AutoPostStepId = "validate" | "publish" | "poll" | "save" | "delete";

export type AutopostState = {
  postId: string;
  status?: SocialPost["status"];
  media: {
    kind: "video" | "image" | "none";
    urls: string[];
    storagePaths: string[];
    width?: number;
    height?: number;
    durationSec?: number;
    bytes?: number;
  };
  brief?: string;
  copy: Partial<Record<Provider, { caption: string; firstComment?: string }>>;
  targets: Array<{
    platform: Provider;
    placement: "feed" | "reel" | "story";
    visibility?: string;
    pageId?: string;
  }>;
  scheduledFor: string | null;
  timezone: string | null;
  vendorRequestId?: string;
  jobId?: string;
  results?: UploadPostResult[];
  warnings?: string[];
  done?: boolean;
  availablePages?: Array<{ id: string; name: string }>;
};

function computeStatus(results: UploadPostResult[]): SocialPost["status"] {
  const statuses = results.map((r) => r.status);
  if (statuses.every((s) => s === "success")) return "published";
  if (statuses.every((s) => s === "failed" || s === "skipped")) return "failed";
  if (statuses.some((s) => s === "success")) return "partial";
  if (statuses.some((s) => s === "pending")) return "publishing";
  return "failed";
}

async function mediaUrlReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function validateLimits(state: AutopostState): string | null {
  for (const target of state.targets) {
    const copy = state.copy[target.platform];
    if (!copy || !copy.caption.trim()) {
      return `${target.platform} caption is empty.`;
    }
    if (target.platform === "linkedin" && copy.caption.length > 3000) {
      return "LinkedIn caption exceeds 3,000 characters.";
    }
    if (target.platform === "instagram" && copy.caption.length > 2200) {
      return "Instagram caption exceeds 2,200 characters.";
    }
  }
  return null;
}

async function validateStep(
  state: AutopostState,
): Promise<{ state: AutopostState; error?: string }> {
  const profile = getUploadPostProfile();
  if (!process.env.UPLOAD_POST_API_KEY) {
    return { state, error: "UPLOAD_POST_API_KEY is not set." };
  }
  if (!profile) {
    return { state, error: "UPLOAD_POST_PROFILE is not set." };
  }
  if (state.targets.length === 0) {
    return { state, error: "Select at least one platform." };
  }

  const limitError = validateLimits(state);
  if (limitError) return { state, error: limitError };

  const hasVideo = state.media.kind === "video";
  const hasImage = state.media.kind === "image";

  if (state.targets.some((t) => t.platform === "instagram") && state.media.kind === "none") {
    return { state, error: "Instagram requires a photo or video." };
  }
  if (state.media.urls.length === 0 && state.media.kind !== "none") {
    return { state, error: "Media is missing a public URL. Re-upload the file." };
  }

  if (hasImage && state.media.urls.length > 10) {
    return { state, error: "Instagram carousels are limited to 10 images." };
  }

  // Mixed photo+video carousels are only supported for Instagram.
  const nonInstagramTargets = state.targets.filter((t) => t.platform !== "instagram");
  if (hasVideo && hasImage && nonInstagramTargets.length > 0) {
    return {
      state,
      error: "Mixed photo+video posts are only supported on Instagram.",
    };
  }

  for (const url of state.media.urls) {
    if (!(await mediaUrlReachable(url))) {
      return { state, error: `Media URL is not reachable: ${url.slice(0, 80)}...` };
    }
  }

  if (state.scheduledFor) {
    const scheduled = new Date(state.scheduledFor);
    const now = new Date();
    if (Number.isNaN(scheduled.getTime())) {
      return { state, error: "Invalid scheduled date." };
    }
    if (scheduled <= now) {
      return { state, error: "Scheduled date must be in the future." };
    }
    const days = (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 365) {
      return { state, error: "Scheduled date must be within 365 days." };
    }
  }

  // Resolve and cache connected account / page IDs. If a platform is not
  // configured, skip it gracefully so the others can still publish.
  const nextState: AutopostState = {
    ...state,
    availablePages: undefined,
    warnings: state.warnings ? [...state.warnings] : [],
    results: state.results ? [...state.results] : [],
  };
  const readyTargets: AutopostState["targets"] = [];

  function setResult(platform: Provider, result: UploadPostResult) {
    const idx = nextState.results?.findIndex((r) => r.platform === platform);
    if (idx !== undefined && idx >= 0 && nextState.results) {
      nextState.results[idx] = result;
    } else {
      nextState.results?.push(result);
    }
  }

  for (const target of state.targets) {
    try {
      const account = await resolveSocialAccount(target.platform, profile);
      if (account.status === "needs_reauth") {
        nextState.warnings?.push(
          `${target.platform} is not connected and will be skipped.`,
        );
        setResult(target.platform, {
          platform: target.platform,
          status: "skipped",
          error: "Account not connected in Upload-Post.",
        });
        continue;
      }
      if (target.platform === "facebook" && !account.facebookPageId) {
        nextState.warnings?.push(
          `${target.platform}: no Facebook Page found; skipped.`,
        );
        setResult(target.platform, {
          platform: target.platform,
          status: "skipped",
          error: "No Facebook Page connected to this profile.",
        });
        continue;
      }
      target.pageId =
        target.platform === "facebook"
          ? account.facebookPageId
          : target.platform === "linkedin"
            ? account.linkedinPageId
            : undefined;
      readyTargets.push(target);
    } catch (error) {
      console.error(`[autopost] resolve ${target.platform}:`, error);
      nextState.warnings?.push(
        `${target.platform}: ${error instanceof Error ? error.message : "could not resolve account"}; skipped.`,
      );
      setResult(target.platform, {
        platform: target.platform,
        status: "skipped",
        error:
          error instanceof Error
            ? error.message
            : `Could not resolve ${target.platform} account.`,
      });
    }
  }

  nextState.targets = readyTargets;

  if (nextState.targets.length === 0) {
    return {
      state: nextState,
      error: "None of the selected platforms are connected. Check AUTOPOST_SETUP.md.",
    };
  }

  if (nextState.warnings?.length) {
    console.log("[autopost] validate warnings:", nextState.warnings);
  }

  return { state: nextState };
}

async function publishStep(
  state: AutopostState,
): Promise<{ state: AutopostState; error?: string }> {
  const profile = getUploadPostProfile();
  if (!profile) return { state, error: "UPLOAD_POST_PROFILE is not set." };

  const media: {
    kind: "image" | "video" | "document";
    publicUrl: string;
    mimeType: string;
    width?: number;
    height?: number;
    durationSec?: number;
  }[] = state.media.urls.map((url, index) => ({
    kind: state.media.kind === "none" ? "image" : state.media.kind,
    publicUrl: url,
    mimeType: state.media.kind === "video" ? "video/mp4" : "image/jpeg",
    width: state.media.width,
    height: state.media.height,
    durationSec: state.media.durationSec,
  }));

  const targets: UploadPostTarget[] = state.targets.map((t) => ({
    platform: t.platform,
    placement: t.placement,
    visibility: t.visibility,
    pageId: t.pageId,
    firstComment: state.copy[t.platform]?.firstComment,
  }));

  try {
    const res = await publishToUploadPost({
      profile,
      postId: state.postId,
      targets,
      copy: state.copy,
      media,
      scheduledFor: state.scheduledFor ?? undefined,
      timezone: state.timezone ?? undefined,
    });

    if (res.availablePages && res.availablePages.length > 0) {
      return {
        state: { ...state, availablePages: res.availablePages },
        error:
          "Multiple Facebook Pages are connected. Pick one and retry.",
      };
    }

    // Merge new results with any pre-existing skipped-platform results.
    const nextResults: UploadPostResult[] = [...(state.results ?? [])];
    if (res.results) {
      for (const r of res.results) {
        const idx = nextResults.findIndex((x) => x.platform === r.platform);
        if (idx >= 0) nextResults[idx] = r;
        else nextResults.push(r);
      }
    }
    for (const t of state.targets) {
      if (!nextResults.some((r) => r.platform === t.platform)) {
        nextResults.push({ platform: t.platform, status: "pending" });
      }
    }

    const nextState: AutopostState = {
      ...state,
      vendorRequestId: res.requestId,
      jobId: res.jobId,
      results: nextResults,
      done: computeStatus(nextResults) !== "publishing",
    };
    nextState.status = nextState.done
      ? computeStatus(nextResults)
      : state.scheduledFor
        ? "scheduled"
        : "publishing";
    return { state: nextState };
  } catch (error) {
    console.error("[autopost] publish failed:", error);
    return {
      state,
      error:
        error instanceof SocialPublishError
          ? error.normalized.message
          : error instanceof Error
            ? error.message
            : "Publish failed.",
    };
  }
}

async function pollStep(
  state: AutopostState,
): Promise<{ state: AutopostState; error?: string }> {
  const id = state.jobId ?? state.vendorRequestId;
  if (!id) {
    return { state, error: "No vendor request ID to poll." };
  }

  try {
    const { done, results } = await checkUploadPostStatus(
      id,
      state.jobId ? "job" : "request",
    );
    // Merge polled results with any pre-existing skipped-platform results.
    const nextResults: UploadPostResult[] = [...(state.results ?? [])];
    if (results) {
      for (const r of results) {
        const idx = nextResults.findIndex((x) => x.platform === r.platform);
        if (idx >= 0) nextResults[idx] = r;
        else nextResults.push(r);
      }
    }
    const nextState: AutopostState = {
      ...state,
      results: nextResults,
      done,
    };
    if (done) {
      nextState.status = computeStatus(nextResults);
    }
    return { state: nextState };
  } catch (error) {
    console.error("[autopost] poll failed:", error);
    return {
      state,
      error:
        error instanceof SocialPublishError
          ? error.normalized.message
          : error instanceof Error
            ? error.message
            : "Status poll failed.",
    };
  }
}

async function saveStep(state: AutopostState): Promise<{ state: AutopostState; error?: string }> {
  try {
    const post: SocialPost = {
      id: state.postId,
      createdAt: new Date().toISOString(),
      status: state.status ?? "publishing",
      warnings: state.warnings,
      media: state.media,
      brief: state.brief,
      copy: state.copy,
      targets: state.targets,
      scheduledFor: state.scheduledFor,
      timezone: state.timezone,
      vendor: "upload_post",
      vendorRequestId: state.vendorRequestId,
      jobId: state.jobId,
      results: state.results ?? [],
    };
    await saveSocialPost(post);
    return { state };
  } catch (error) {
    console.error("[autopost] save failed:", error);
    return {
      state,
      error:
        error instanceof Error ? error.message : "Could not save the post.",
    };
  }
}

async function deleteStep(
  state: AutopostState,
): Promise<{ state: AutopostState; error?: string }> {
  const profile = getUploadPostProfile();
  if (!profile) return { state, error: "UPLOAD_POST_PROFILE is not set." };

  const errors: string[] = [];
  for (const result of state.results ?? []) {
    if (result.platform === "instagram" || !result.platformPostId) continue;
    try {
      await unpublishOnUploadPost(
        result.platform,
        result.platformPostId,
        profile,
      );
    } catch (error) {
      console.error(`[autopost] unpublish ${result.platform}:`, error);
      errors.push(
        `${result.platform}: ${error instanceof Error ? error.message : "failed"}`,
      );
    }
  }

  try {
    await deleteSocialPost(state.postId);
  } catch (error) {
    console.error("[autopost] delete doc failed:", error);
    return {
      state,
      error:
        error instanceof Error ? error.message : "Could not delete the post.",
    };
  }

  if (errors.length > 0) {
    return { state, error: errors.join("; ") };
  }
  return { state };
}

export async function POST(request: Request) {
  let step: AutoPostStepId;
  let state: AutopostState;
  try {
    const body = await request.json();
    step = body.step;
    state = body.state;
    if (!step || !state || typeof state.postId !== "string") {
      throw new Error("Body must be { step, state: { postId, ... } }.");
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body." },
      { status: 400 },
    );
  }

  let result: { state: AutopostState; error?: string };
  try {
    switch (step) {
      case "validate":
        result = await validateStep(state);
        break;
      case "publish":
        result = await publishStep(state);
        break;
      case "poll":
        result = await pollStep(state);
        break;
      case "save":
        result = await saveStep(state);
        break;
      case "delete":
        result = await deleteStep(state);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown step "${step}".` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error(`[autopost] step "${step}" failed:`, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Autopost step failed.",
      },
      { status: 500 },
    );
  }

  if (result.error) {
    return NextResponse.json(
      { state: result.state, error: result.error },
      { status: 400 },
    );
  }
  return NextResponse.json({ state: result.state });
}
