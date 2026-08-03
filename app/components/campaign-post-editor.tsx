"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  composeCampaignCaption,
  generateCampaignId,
  normalizeHashtag,
  saveCampaignPost,
  UPLOAD_POST_BANNED_INSTAGRAM_HASHTAGS,
  type CampaignPost,
  type PostCampaign,
} from "../../lib/campaigns";
import { MediaDropzone, type MediaFile } from "./media-dropzone";
import { parseApiError } from "../../lib/trace";

type LinkedInPage = { id: string; name: string };
type SocialAccount = {
  provider: "linkedin" | "instagram";
  displayName: string;
  status: "active" | "needs_reauth";
  linkedinPageId?: string;
  availablePages?: LinkedInPage[];
  pagesError?: string;
};

type Props = {
  campaign: PostCampaign;
  post?: CampaignPost;
  onClose: () => void;
  onPublish: (post: CampaignPost) => void;
};

const FIELD_CLASS =
  "mt-1.5 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-teal-500";

function mediaFilesFromPost(post?: CampaignPost): MediaFile[] {
  if (!post) return [];
  const items = post.media.items;
  if (items?.length) {
    return items.map((item, index) => ({
      id: `${post.id}-media-${index}`,
      kind: "image",
      url: item.url,
      path: item.path,
      width: item.width,
      height: item.height,
      bytes: item.bytes,
      progress: 100,
      status: "done",
    }));
  }
  return post.media.urls.map((url, index) => ({
    id: `${post.id}-media-${index}`,
    kind: "image",
    url,
    path: post.media.storagePaths[index] ?? "",
    bytes: 0,
    progress: 100,
    status: "done",
  }));
}

function normalizeCollaborators(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().replace(/^@/, ""))
    .filter(Boolean);
}

export function CampaignPostEditor({
  campaign,
  post,
  onClose,
  onPublish,
}: Props) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [draftId] = useState(() => post?.id ?? generateCampaignId());
  const [description, setDescription] = useState(post?.description ?? "");
  const [hashtags, setHashtags] = useState<string[]>(post?.hashtags ?? []);
  const [hashtagDraft, setHashtagDraft] = useState("");
  const [firstComment, setFirstComment] = useState(post?.firstComment ?? "");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>(
    mediaFilesFromPost(post),
  );
  const [linkedinDestination, setLinkedinDestination] = useState<
    "profile" | "page"
  >(post?.linkedin?.destination ?? "profile");
  const [linkedinPageId, setLinkedinPageId] = useState(
    post?.linkedin?.pageId ?? "",
  );
  const [collaborators, setCollaborators] = useState(
    post?.instagram?.collaborators.join(", ") ?? "",
  );
  const [locationId, setLocationId] = useState(
    post?.instagram?.locationId ?? "",
  );
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);
  const explicitSaveRef = useRef(false);
  const metadataReadsRef = useRef(new Set<string>());
  const [error, setError] = useState<string | null>(null);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  useEffect(() => {
    for (const file of mediaFiles) {
      if (
        file.kind !== "image" ||
        (file.width && file.height) ||
        metadataReadsRef.current.has(file.id)
      ) {
        continue;
      }
      metadataReadsRef.current.add(file.id);
      const image = new Image();
      image.onload = () => {
        setMediaFiles((current) =>
          current.map((candidate) =>
            candidate.id === file.id
              ? {
                  ...candidate,
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                }
              : candidate,
          ),
        );
      };
      image.src = file.url;
    }
  }, [mediaFiles]);

  useEffect(() => {
    let cancelled = false;
    async function loadAccount() {
      setAccountLoading(true);
      setAccountError(null);
      try {
        const response = await apiFetch("/api/autopost/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platforms: [campaign.platform],
            includePages: campaign.platform === "linkedin",
          }),
        });
        if (!response.ok) {
          const parsed = await parseApiError(
            response,
            "Could not check the connected social account.",
          );
          throw new Error(parsed.message);
        }
        const json = (await response.json().catch(() => ({}))) as {
          accounts?: SocialAccount[];
        };
        if (!cancelled) setAccount(json.accounts?.[0] ?? null);
      } catch (caught) {
        if (!cancelled) {
          setAccount(null);
          setAccountError(
            caught instanceof Error
              ? caught.message
              : "Could not check the connected social account.",
          );
        }
      } finally {
        if (!cancelled) setAccountLoading(false);
      }
    }
    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [campaign.platform]);

  const composedCaption = useMemo(
    () => composeCampaignCaption(description, hashtags),
    [description, hashtags],
  );
  const captionLimit = campaign.platform === "instagram" ? 2200 : 3000;
  const commentLimit = campaign.platform === "instagram" ? 2196 : 1250;
  const pages = useMemo(
    () => account?.availablePages ?? [],
    [account?.availablePages],
  );

  useEffect(() => {
    if (
      campaign.platform === "linkedin" &&
      linkedinDestination === "page" &&
      !linkedinPageId &&
      pages.length === 1
    ) {
      setLinkedinPageId(pages[0].id);
    }
  }, [campaign.platform, linkedinDestination, linkedinPageId, pages]);

  function addHashtag(raw: string) {
    const values = raw.split(/[\s,]+/).map(normalizeHashtag).filter(Boolean);
    if (!values.length) return;
    setHashtags((current) =>
      [...current, ...values].filter(
        (value, index, all) =>
          all.findIndex(
            (candidate) => candidate.toLowerCase() === value.toLowerCase(),
          ) === index,
      ),
    );
    markDirty();
    setHashtagDraft("");
  }

  function validateForPublish(): string | null {
    if (!title.trim()) return "Give this post an internal title.";
    if (!description.trim()) return "Write the post description before publishing.";
    if (mediaFiles.length === 0) return "Upload at least one image.";
    if (mediaFiles.length > 10) return "A carousel can contain at most 10 images.";
    if (mediaFiles.some((file) => file.status === "uploading")) {
      return "Wait for every image to finish uploading.";
    }
    const failed = mediaFiles.find((file) => file.status === "error");
    if (failed) return failed.error ?? "One of the images failed to upload.";
    const oversized = mediaFiles.find((file) => file.bytes > 8 * 1024 * 1024);
    if (oversized) return "Each image must be 8 MB or smaller.";
    if (composedCaption.length > captionLimit) {
      return `${campaign.platform === "instagram" ? "Instagram" : "LinkedIn"} allows ${captionLimit.toLocaleString()} characters including hashtags.`;
    }
    if (firstComment.length > commentLimit) {
      return `The first comment must be ${commentLimit.toLocaleString()} characters or fewer.`;
    }
    if (campaign.platform === "instagram") {
      const missingDimensions = mediaFiles.find(
        (file) => !file.width || !file.height,
      );
      if (missingDimensions) {
        return "Wait for every image's dimensions to be read before publishing.";
      }
      const invalidRatio = mediaFiles.find((file) => {
        if (!file.width || !file.height) return false;
        const ratio = file.width / file.height;
        return ratio < 0.8 || ratio > 1.91;
      });
      if (invalidRatio) {
        return "Instagram feed images must be between 4:5 and 1.91:1. Crop the highlighted media before publishing.";
      }
      const banned = hashtags.find((hashtag) =>
        UPLOAD_POST_BANNED_INSTAGRAM_HASHTAGS.has(hashtag.toLowerCase()),
      );
      if (banned) return `#${banned} is rejected by Upload-Post for Instagram.`;
      const invalidCollaborator = normalizeCollaborators(collaborators).find(
        (username) => !/^[A-Za-z0-9._]+$/.test(username),
      );
      if (invalidCollaborator) {
          return `“${invalidCollaborator}” is not a valid Instagram username. Use public usernames without @.`;
      }
      if (locationId.trim() && !/^\d+$/.test(locationId.trim())) {
        return "Use a numeric Instagram location ID, not a place name.";
      }
    }
    if (
      campaign.platform === "linkedin" &&
      linkedinDestination === "page" &&
      account?.pagesError
    ) {
      return `Could not load LinkedIn company pages: ${account.pagesError}`;
    }
    if (
      campaign.platform === "linkedin" &&
      linkedinDestination === "page" &&
      !linkedinPageId
    ) {
      return "Choose the LinkedIn company page to publish to.";
    }
    if (account?.status === "needs_reauth") {
      return `Reconnect ${campaign.platform === "instagram" ? "Instagram" : "LinkedIn"} in Upload-Post before publishing.`;
    }
    if (!accountLoading && !account) {
      return "Could not verify the Upload-Post connection. Retry after the backend is reachable.";
    }
    return null;
  }

  const buildPost = useCallback((): CampaignPost => {
    const now = new Date().toISOString();
    const selectedPage = pages.find((page) => page.id === linkedinPageId);
    return {
      id: draftId,
      campaignId: campaign.id,
      platform: campaign.platform,
      title: title.trim(),
      description: description.trim(),
      hashtags,
      firstComment: firstComment.trim(),
      media: {
        urls: mediaFiles.map((file) => file.url),
        storagePaths: mediaFiles.map((file) => file.path),
        items: mediaFiles.map((file) => ({
          url: file.url,
          path: file.path,
          width: file.width,
          height: file.height,
          bytes: file.bytes,
        })),
      },
      linkedin:
        campaign.platform === "linkedin"
          ? {
              destination: linkedinDestination,
              pageId:
                linkedinDestination === "page" ? linkedinPageId : undefined,
              pageName:
                linkedinDestination === "page"
                  ? selectedPage?.name ?? post?.linkedin?.pageName
                  : undefined,
            }
          : undefined,
      instagram:
        campaign.platform === "instagram"
          ? {
              collaborators: normalizeCollaborators(collaborators),
              locationId: locationId.trim() || undefined,
            }
          : undefined,
      status: "draft",
      createdAt: post?.createdAt ?? now,
      updatedAt: now,
      // A content edit is a new idempotent publishing revision.
      publishKey: generateCampaignId(),
    };
  }, [
    campaign.id,
    campaign.platform,
    collaborators,
    description,
    draftId,
    firstComment,
    hashtags,
    linkedinDestination,
    linkedinPageId,
    locationId,
    mediaFiles,
    pages,
    post?.createdAt,
    post?.linkedin?.pageName,
    title,
  ]);

  const saveDraftIfReady = useCallback(async () => {
    if (
      !title.trim() ||
      !dirtyRef.current ||
      explicitSaveRef.current ||
      mediaFiles.some(
        (file) => file.status === "uploading" || file.status === "error",
      )
    ) {
      return;
    }
    try {
      const next = buildPost();
      await saveCampaignPost(next);
      dirtyRef.current = false;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not auto-save the draft.",
      );
    }
  }, [buildPost, mediaFiles, title]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void saveDraftIfReady();
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [saveDraftIfReady]);

  const saveDraftRef = useRef(saveDraftIfReady);
  useEffect(() => {
    saveDraftRef.current = saveDraftIfReady;
  }, [saveDraftIfReady]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void saveDraftRef.current();
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [hashtags, mediaFiles]);

  async function handleSave(publish: boolean) {
    setError(null);
    if (!title.trim()) {
      setError("Give this post an internal title before saving.");
      return;
    }
    if (mediaFiles.some((file) => file.status === "uploading")) {
      setError("Wait for every image to finish uploading before saving.");
      return;
    }
    const failedUpload = mediaFiles.find((file) => file.status === "error");
    if (failedUpload) {
      setError(failedUpload.error ?? "Remove the image that failed to upload before saving.");
      return;
    }
    if (publish) {
      const validationError = validateForPublish();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    explicitSaveRef.current = true;
    dirtyRef.current = false;
    setSaving(true);
    try {
      const next = buildPost();
      await saveCampaignPost(next);
      if (publish) onPublish(next);
      onClose();
    } catch (caught) {
      dirtyRef.current = true;
      setError(caught instanceof Error ? caught.message : "Could not save the post.");
    } finally {
      explicitSaveRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/55 p-4 backdrop-blur-subtle"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-post-title"
    >
      <div className="mx-auto my-4 w-full max-w-4xl rounded-2xl bg-gray-50 shadow-modern-lg md:my-8">
        <header className="flex items-start justify-between gap-4 rounded-t-2xl bg-white px-5 py-4 md:px-7">
          <div>
            <div className="flex items-center gap-2">
              <PlatformBadge platform={campaign.platform} />
              <span className="text-xs font-medium text-gray-500">
                {campaign.name}
              </span>
            </div>
            <h2
              id="campaign-post-title"
              className="mt-2 text-xl font-semibold text-gray-900"
            >
              {post ? "Edit campaign post" : "Create campaign post"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close post editor"
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="grid gap-6 p-5 md:p-7">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-5">
              <div>
                <label htmlFor="post-title" className="text-sm font-medium text-gray-800">
                  <span className="text-red-500">*</span> Internal post title
                </label>
                <input
                  id="post-title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    markDirty();
                  }}
                  onBlur={() => window.setTimeout(() => void saveDraftIfReady(), 0)}
                  placeholder="e.g. Founder interview carousel"
                  className={FIELD_CLASS}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Used only inside this dashboard; it is not sent to the platform. Draft changes auto-save.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800">
                  <span className="text-red-500">*</span> Post images
                </label>
                <div className="mt-2">
                  <MediaDropzone
                    files={mediaFiles}
                    onChange={(next) => {
                      setMediaFiles(next);
                      markDirty();
                    }}
                    onError={setError}
                    acceptedKinds={["image"]}
                    acceptedMimeTypes={["image/jpeg", "image/png"]}
                    maxFiles={10}
                    storageFolder={`autopost/campaigns/${campaign.id}`}
                    title="Drop JPG or PNG images here, or click to browse"
                    hint="Up to 10 images · 8 MB each · drag to reorder"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Post copy</h3>
            <div className="mt-4 grid gap-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="post-description" className="text-sm font-medium text-gray-800">
                    <span className="text-red-500">*</span>{" "}
                    {campaign.platform === "linkedin" ? "Commentary" : "Description"}
                  </label>
                  <span
                    className={`text-xs ${composedCaption.length > captionLimit ? "font-semibold text-red-600" : "text-gray-500"}`}
                  >
                    {composedCaption.length.toLocaleString()} / {captionLimit.toLocaleString()}
                  </span>
                </div>
                <textarea
                  id="post-description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    markDirty();
                  }}
                  onBlur={() => window.setTimeout(() => void saveDraftIfReady(), 0)}
                  rows={7}
                  placeholder={
                    campaign.platform === "instagram"
                      ? "Lead with the hook, then give the reader a reason to save or share…"
                      : "Share the insight and give founders a clear next step…"
                  }
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="hashtags" className="text-sm font-medium text-gray-800">
                  Hashtags
                </label>
                <div className="mt-1.5 flex min-h-12 flex-wrap items-center gap-2 rounded-lg border border-gray-300 bg-white p-2 focus-within:ring-2 focus-within:ring-teal-500">
                  {hashtags.map((hashtag) => (
                    <span
                      key={hashtag.toLowerCase()}
                      className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-deep-teal"
                    >
                      #{hashtag}
                      <button
                        type="button"
                        aria-label={`Remove hashtag ${hashtag}`}
                          onClick={() =>
                          {
                            setHashtags((current) =>
                              current.filter((value) => value !== hashtag),
                            );
                            markDirty();
                          }
                        }
                        className="text-teal-700 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    id="hashtags"
                    value={hashtagDraft}
                    onChange={(event) => setHashtagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addHashtag(hashtagDraft);
                      }
                    }}
                    onBlur={() => addHashtag(hashtagDraft)}
                    className="min-w-32 flex-1 border-0 p-1.5 text-sm outline-none"
                    placeholder="Type a tag, then Enter"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Hashtags are appended to the description and count toward its limit.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="first-comment" className="text-sm font-medium text-gray-800">
                    First comment <span className="font-normal text-gray-500">(optional)</span>
                  </label>
                  <span className={`text-xs ${firstComment.length > commentLimit ? "font-semibold text-red-600" : "text-gray-500"}`}>
                    {firstComment.length.toLocaleString()} / {commentLimit.toLocaleString()}
                  </span>
                </div>
                <textarea
                  id="first-comment"
                  value={firstComment}
                  onChange={(event) => {
                    setFirstComment(event.target.value);
                    markDirty();
                  }}
                  onBlur={() => window.setTimeout(() => void saveDraftIfReady(), 0)}
                  rows={3}
                  placeholder="Add a source, CTA, or conversation starter…"
                  className={FIELD_CLASS}
                />
              </div>
            </div>
          </section>

          <PlatformOptions
            campaign={campaign}
            account={account}
            accountLoading={accountLoading}
            accountError={accountError}
            linkedinDestination={linkedinDestination}
            linkedinPageId={linkedinPageId}
            pages={pages}
            collaborators={collaborators}
            locationId={locationId}
            onLinkedinDestination={(value) => {
              setLinkedinDestination(value);
              markDirty();
            }}
            onLinkedinPageId={(value) => {
              setLinkedinPageId(value);
              markDirty();
            }}
            onCollaborators={(value) => {
              setCollaborators(value);
              markDirty();
            }}
            onLocationId={(value) => {
              setLocationId(value);
              markDirty();
            }}
          />

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <footer className="sticky bottom-0 flex flex-wrap justify-end gap-3 rounded-b-2xl border-t border-gray-200 bg-white px-5 py-4 md:px-7">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave(false)}
            disabled={saving}
            className="rounded-lg border border-deep-teal px-5 py-2.5 text-sm font-semibold text-deep-teal transition hover:bg-teal-50 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave(true)}
            disabled={saving || mediaFiles.some((file) => file.status === "uploading")}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save & publish
          </button>
        </footer>
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: PostCampaign["platform"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        platform === "linkedin"
          ? "bg-blue-50 text-blue-600"
          : "bg-pink-50 text-pink-600"
      }`}
    >
      {platform === "linkedin" ? "LinkedIn" : "Instagram"}
    </span>
  );
}

function PlatformOptions({
  campaign,
  account,
  accountLoading,
  accountError,
  linkedinDestination,
  linkedinPageId,
  pages,
  collaborators,
  locationId,
  onLinkedinDestination,
  onLinkedinPageId,
  onCollaborators,
  onLocationId,
}: {
  campaign: PostCampaign;
  account: SocialAccount | null;
  accountLoading: boolean;
  accountError: string | null;
  linkedinDestination: "profile" | "page";
  linkedinPageId: string;
  pages: LinkedInPage[];
  collaborators: string;
  locationId: string;
  onLinkedinDestination: (value: "profile" | "page") => void;
  onLinkedinPageId: (value: string) => void;
  onCollaborators: (value: string) => void;
  onLocationId: (value: string) => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            {campaign.platform === "linkedin" ? "LinkedIn destination" : "Instagram options"}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Optional platform controls supported directly by Upload-Post.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className={`h-2 w-2 rounded-full ${
              accountLoading
                ? "bg-gray-300"
                : account?.status === "active"
                  ? "bg-green-500"
                  : "bg-amber-500"
            }`}
          />
          {accountLoading
            ? "Checking connection…"
            : account?.status === "active"
              ? account.displayName
              : "Needs reconnect"}
        </span>
      </div>

      {accountError ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
          {accountError}
        </p>
      ) : null}

      {campaign.platform === "linkedin" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="linkedin-destination" className="text-sm font-medium text-gray-800">
              Publish as
            </label>
            <select
              id="linkedin-destination"
              value={linkedinDestination}
              onChange={(event) =>
                onLinkedinDestination(event.target.value as "profile" | "page")
              }
              className={FIELD_CLASS}
            >
              <option value="profile">Personal profile</option>
              <option value="page">Company page</option>
            </select>
          </div>
          {linkedinDestination === "page" ? (
            <div>
              <label htmlFor="linkedin-page" className="text-sm font-medium text-gray-800">
                Company page
              </label>
              <select
                id="linkedin-page"
                value={linkedinPageId}
                onChange={(event) => onLinkedinPageId(event.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Choose a page</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
              {!accountLoading && account?.pagesError ? (
                <p className="mt-1 text-xs text-red-600">
                  Could not load company pages: {account.pagesError}
                </p>
              ) : !accountLoading && pages.length === 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  No administered company pages were returned for this profile.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              The post will use the connected member profile. Image posts use PUBLIC visibility.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="collaborators" className="text-sm font-medium text-gray-800">
              Collaborators <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              id="collaborators"
              value={collaborators}
              onChange={(event) => onCollaborators(event.target.value)}
              placeholder="altitut, founder_handle"
              className={FIELD_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">
              Comma-separated public usernames, without @.
            </p>
          </div>
          <div>
            <label htmlFor="location-id" className="text-sm font-medium text-gray-800">
              Location ID <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              id="location-id"
              value={locationId}
              onChange={(event) => onLocationId(event.target.value)}
              placeholder="Instagram location ID"
              className={FIELD_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">
              Use the numeric Instagram location ID, not a place name.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
