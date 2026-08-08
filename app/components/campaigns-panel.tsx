"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AutopostRequestError,
  publishCampaignPost,
  refreshCampaignPost,
  type AutopostResult,
  type AutopostState,
} from "../../lib/autopost-client";
import {
  composeCampaignCaption,
  deleteCampaign,
  deleteCampaignPost,
  duplicateCampaign,
  duplicateCampaignPost,
  generateCampaignId,
  listenToCampaignPosts,
  listenToCampaigns,
  saveCampaign,
  saveCampaignPost,
  type CampaignPlatform,
  type CampaignPost,
  type PostCampaign,
} from "../../lib/campaigns";
import { CampaignPostEditor } from "./campaign-post-editor";

function autopostStateForCampaignPost(
  post: CampaignPost,
  resultStatus: "pending" | "failed",
): AutopostState {
  const items: NonNullable<CampaignPost["media"]["items"]> =
    post.media.items ??
    post.media.urls.map((url, index) => ({
      url,
      path: post.media.storagePaths[index] ?? "",
      bytes: 0,
    }));
  const target: AutopostState["targets"][number] = {
    platform: post.platform,
    placement: "feed",
    visibility: post.platform === "linkedin" ? "PUBLIC" : undefined,
    pageId:
      post.platform === "linkedin" && post.linkedin?.destination === "page"
        ? post.linkedin.pageId
        : undefined,
    postToProfile:
      post.platform === "linkedin" && post.linkedin?.destination === "profile",
    collaborators:
      post.platform === "instagram"
        ? post.instagram?.collaborators
        : undefined,
    locationId:
      post.platform === "instagram" ? post.instagram?.locationId : undefined,
  };
  return {
    postId: post.publishKey ?? post.id,
    createdAt: post.createdAt,
    status: resultStatus === "failed" ? "failed" : "publishing",
    media: {
      kind: "image",
      urls: post.media.urls,
      storagePaths: post.media.storagePaths,
      width: items[0]?.width,
      height: items[0]?.height,
      bytes: items.reduce((total, item) => total + item.bytes, 0),
      items,
    },
    brief: post.title,
    copy: {
      [post.platform]: {
        caption: composeCampaignCaption(post.description, post.hashtags),
        firstComment: post.firstComment,
      },
    },
    targets: [target],
    scheduledFor: null,
    timezone: null,
    vendorRequestId: post.vendorRequestId,
    jobId: post.jobId,
    results: [
      {
        platform: post.platform,
        status: resultStatus,
        error: resultStatus === "failed" ? post.error : undefined,
      },
    ],
  };
}

function campaignStatusFromResult(
  result: AutopostResult | undefined,
): CampaignPost["status"] {
  if (result?.status === "success") return "published";
  if (result?.status === "failed" || result?.status === "skipped") {
    return "failed";
  }
  return "publishing";
}

async function persistCampaignPublishState(
  post: CampaignPost,
  state: AutopostState,
  showProcessingHint = false,
): Promise<void> {
  const result = state.results?.find(
    (candidate) => candidate.platform === post.platform,
  );
  const status = campaignStatusFromResult(result);
  await saveCampaignPost({
    ...post,
    status,
    updatedAt: new Date().toISOString(),
    publishedAt:
      status === "published"
        ? post.publishedAt ?? new Date().toISOString()
        : post.publishedAt,
    vendorRequestId: state.vendorRequestId ?? post.vendorRequestId,
    jobId: state.jobId ?? post.jobId,
    postUrl: result?.postUrl ?? post.postUrl,
    platformPostId: result?.platformPostId ?? post.platformPostId,
    error:
      result?.error ??
      (showProcessingHint && status === "publishing"
        ? "Upload-Post is still processing this image post. Check again shortly."
        : undefined),
  });
}

export function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<PostCampaign[]>([]);
  const [posts, setPosts] = useState<CampaignPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignBeingEdited, setCampaignBeingEdited] =
    useState<PostCampaign | null>(null);
  const [editorPost, setEditorPost] = useState<CampaignPost | null | undefined>(
    undefined,
  );
  const [duplicatingCampaignId, setDuplicatingCampaignId] = useState<string | null>(
    null,
  );
  const [duplicatingPostId, setDuplicatingPostId] = useState<string | null>(null);
  const [campaignBeingDuplicated, setCampaignBeingDuplicated] =
    useState<PostCampaign | null>(null);

  useEffect(() => {
    let campaignsReady = false;
    let postsReady = false;
    const markReady = () => {
      if (campaignsReady && postsReady) setLoading(false);
    };
    const unsubscribeCampaigns = listenToCampaigns(
      (next) => {
        campaignsReady = true;
        setCampaigns(next);
        markReady();
      },
      (error) => {
        setLoadError(error.message);
        campaignsReady = true;
        markReady();
      },
    );
    const unsubscribePosts = listenToCampaignPosts(
      (next) => {
        postsReady = true;
        setPosts(next);
        markReady();
      },
      (error) => {
        setLoadError(error.message);
        postsReady = true;
        markReady();
      },
    );
    return () => {
      unsubscribeCampaigns();
      unsubscribePosts();
    };
  }, []);

  const selectedCampaign = campaigns.find(
    (campaign) => campaign.id === selectedCampaignId,
  );
  const selectedPosts = useMemo(
    () => posts.filter((post) => post.campaignId === selectedCampaignId),
    [posts, selectedCampaignId],
  );

  function openNewCampaign() {
    setCampaignBeingEdited(null);
    setCampaignDialogOpen(true);
  }

  async function handleDeleteCampaign(campaign: PostCampaign) {
    const campaignPosts = posts.filter(
      (post) => post.campaignId === campaign.id,
    );
    const confirmed = window.confirm(
      `Delete “${campaign.name}” and its ${campaignPosts.length} dashboard post record${campaignPosts.length === 1 ? "" : "s"}? Live social posts will stay online.`,
    );
    if (!confirmed) return;
    try {
      await deleteCampaign(
        campaign.id,
        campaignPosts.map((post) => post.id),
      );
      setEditorPost(undefined);
      setCampaignDialogOpen(false);
      setSelectedCampaignId(null);
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Could not delete the campaign.",
      );
    }
  }

  async function handleDuplicateCampaign(
    campaign: PostCampaign,
    platform: CampaignPlatform,
  ) {
    setDuplicatingCampaignId(campaign.id);
    setLoadError(null);
    try {
      const duplicate = await duplicateCampaign(
        campaign,
        posts.filter((post) => post.campaignId === campaign.id),
        platform,
      );
      setCampaigns((current) => [
        duplicate.campaign,
        ...current.filter((item) => item.id !== duplicate.campaign.id),
      ]);
      const duplicatePostIds = new Set(duplicate.posts.map((post) => post.id));
      setPosts((current) => [
        ...duplicate.posts,
        ...current.filter((post) => !duplicatePostIds.has(post.id)),
      ]);
      setCampaignBeingDuplicated(null);
      setSelectedCampaignId(duplicate.campaign.id);
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Could not duplicate the campaign.",
      );
    } finally {
      setDuplicatingCampaignId(null);
    }
  }

  async function handleRemovePost(post: CampaignPost) {
    const confirmed = window.confirm(
      `Remove “${post.title || "this post"}” from the campaign? Live social posts stay online.`,
    );
    if (!confirmed) return;
    try {
      await deleteCampaignPost(post.id);
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Could not remove the post from the campaign.",
      );
    }
  }

  async function handleDuplicatePost(post: CampaignPost) {
    setDuplicatingPostId(post.id);
    setLoadError(null);
    try {
      const duplicate = await duplicateCampaignPost(post);
      setPosts((current) => [
        duplicate,
        ...current.filter((item) => item.id !== duplicate.id),
      ]);
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Could not duplicate the post.",
      );
    } finally {
      setDuplicatingPostId(null);
    }
  }

  async function handlePublish(post: CampaignPost) {
    const retryExisting = Boolean(
      post.status === "failed" && (post.vendorRequestId || post.jobId),
    );
    const publishingPost: CampaignPost = {
      ...post,
      status: "publishing",
      error: undefined,
      updatedAt: new Date().toISOString(),
    };
    await saveCampaignPost(publishingPost);

    const initialState = autopostStateForCampaignPost(
      post,
      retryExisting ? "failed" : "pending",
    );

    let latestState = initialState;
    try {
      const state = await publishCampaignPost(
        initialState,
        async (nextState) => {
          latestState = nextState;
          await persistCampaignPublishState(publishingPost, nextState);
        },
        retryExisting,
      );
      latestState = state;
      await persistCampaignPublishState(publishingPost, state, true);
    } catch (caught) {
      const detail =
        caught instanceof AutopostRequestError
          ? `${caught.message} (trace ${caught.traceId})`
          : caught instanceof Error
            ? caught.message
            : "Publishing failed.";
      await saveCampaignPost({
        ...publishingPost,
        status: "failed",
        vendorRequestId:
          latestState.vendorRequestId ?? publishingPost.vendorRequestId,
        jobId: latestState.jobId ?? publishingPost.jobId,
        error: detail,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async function handleRefresh(post: CampaignPost) {
    try {
      const state = await refreshCampaignPost(
        autopostStateForCampaignPost(post, "pending"),
      );
      await persistCampaignPublishState(post, state);
    } catch (caught) {
      const detail =
        caught instanceof AutopostRequestError
          ? `${caught.message} (trace ${caught.traceId})`
          : caught instanceof Error
            ? caught.message
            : "Could not refresh publishing status.";
      await saveCampaignPost({
        ...post,
        error: detail,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-b-deep-teal" />
        <p className="mt-3 text-sm text-gray-600">Loading campaigns…</p>
      </div>
    );
  }

  if (selectedCampaign) {
    return (
      <>
        {loadError ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600" role="alert">
            {loadError}
          </p>
        ) : null}
        <CampaignDetail
          campaign={selectedCampaign}
          posts={selectedPosts}
          onBack={() => setSelectedCampaignId(null)}
          onCreate={() => setEditorPost(null)}
          onEditCampaign={() => {
            setCampaignBeingEdited(selectedCampaign);
            setCampaignDialogOpen(true);
          }}
          onDeleteCampaign={() => void handleDeleteCampaign(selectedCampaign)}
          onDuplicateCampaign={() => setCampaignBeingDuplicated(selectedCampaign)}
          duplicating={duplicatingCampaignId === selectedCampaign.id}
          onEdit={(post) => setEditorPost(post)}
          onPublish={(post) => void handlePublish(post)}
          onRefresh={(post) => void handleRefresh(post)}
          onDuplicate={(post) => void handleDuplicatePost(post)}
          duplicatingPostId={duplicatingPostId}
          onRemove={(post) => void handleRemovePost(post)}
        />
        {editorPost !== undefined ? (
          <CampaignPostEditor
            campaign={selectedCampaign}
            post={editorPost ?? undefined}
            onClose={() => setEditorPost(undefined)}
            onPublish={(post) => void handlePublish(post)}
          />
        ) : null}
        {campaignDialogOpen ? (
          <NewCampaignDialog
            campaign={campaignBeingEdited ?? undefined}
            onClose={() => setCampaignDialogOpen(false)}
            onCreated={() => setCampaignDialogOpen(false)}
          />
        ) : null}
        {campaignBeingDuplicated ? (
          <DuplicateCampaignDialog
            campaign={campaignBeingDuplicated}
            saving={duplicatingCampaignId === campaignBeingDuplicated.id}
            onClose={() => setCampaignBeingDuplicated(null)}
            onConfirm={(platform) =>
              void handleDuplicateCampaign(campaignBeingDuplicated, platform)
            }
          />
        ) : null}
      </>
    );
  }

  return (
    <section aria-label="Post campaigns">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="max-w-2xl text-sm text-gray-600">
            Organize platform-specific series, prepare image carousels, and
            publish each post when it is ready.
          </p>
          {loadError ? (
            <p className="mt-2 text-xs text-red-600">{loadError}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openNewCampaign}
          className="inline-flex items-center gap-2 rounded-lg bg-deep-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-darker-teal"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          New campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyCampaigns onCreate={openNewCampaign} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              posts={posts.filter((post) => post.campaignId === campaign.id)}
              onOpen={() => setSelectedCampaignId(campaign.id)}
            />
          ))}
        </div>
      )}

      {campaignDialogOpen ? (
        <NewCampaignDialog
          campaign={campaignBeingEdited ?? undefined}
          onClose={() => setCampaignDialogOpen(false)}
          onCreated={(campaign) => {
            setCampaignDialogOpen(false);
            setSelectedCampaignId(campaign.id);
          }}
        />
      ) : null}
    </section>
  );
}

function CampaignCard({
  campaign,
  posts,
  onOpen,
}: {
  campaign: PostCampaign;
  posts: CampaignPost[];
  onOpen: () => void;
}) {
  const published = posts.filter((post) => post.status === "published").length;
  const drafts = posts.filter((post) => post.status === "draft").length;
  const cover = posts.find((post) => post.media.urls.length)?.media.urls[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-modern"
      aria-label={`Open ${campaign.name} campaign`}
    >
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-teal-50 via-white to-coral-50">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-75 transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <PlatformIcon platform={campaign.platform} large />
          </div>
        )}
        <div className="absolute left-4 top-4">
          <PlatformPill platform={campaign.platform} />
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-gray-900">
              {campaign.name}
            </h3>
            <p className="mt-1 line-clamp-2 min-h-10 text-sm text-gray-600">
              {campaign.objective || "No campaign objective added yet."}
            </p>
          </div>
          <svg className="mt-1 flex-none text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-deep-teal" width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="mt-5 flex items-center gap-4 border-t border-gray-100 pt-4 text-xs text-gray-600">
          <span><strong className="text-gray-900">{posts.length}</strong> posts</span>
          <span><strong className="text-green-700">{published}</strong> published</span>
          <span><strong className="text-gray-900">{drafts}</strong> drafts</span>
        </div>
      </div>
    </button>
  );
}

function CampaignDetail({
  campaign,
  posts,
  onBack,
  onCreate,
  onEditCampaign,
  onDeleteCampaign,
  onDuplicateCampaign,
  duplicating,
  onEdit,
  onPublish,
  onRefresh,
  onDuplicate,
  duplicatingPostId,
  onRemove,
}: {
  campaign: PostCampaign;
  posts: CampaignPost[];
  onBack: () => void;
  onCreate: () => void;
  onEditCampaign: () => void;
  onDeleteCampaign: () => void;
  onDuplicateCampaign: () => void;
  duplicating: boolean;
  onEdit: (post: CampaignPost) => void;
  onPublish: (post: CampaignPost) => void;
  onRefresh: (post: CampaignPost) => void;
  onDuplicate: (post: CampaignPost) => void;
  duplicatingPostId: string | null;
  onRemove: (post: CampaignPost) => void;
}) {
  const published = posts.filter((post) => post.status === "published").length;
  const progress = posts.length ? Math.round((published / posts.length) * 100) : 0;

  return (
    <section aria-label={`${campaign.name} campaign`}>
      <header className="mb-6 flex flex-wrap items-start gap-4 md:mb-8">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to all campaigns"
          className="rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200"
        >
          <span aria-hidden="true">←</span>
        </button>
        <div className="min-w-0 flex-1">
          <PlatformPill platform={campaign.platform} />
          <h3 className="mt-2 font-display text-2xl font-semibold text-gray-900 md:text-3xl">
            {campaign.name}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {campaign.objective || "Add focused posts to build this campaign."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDeleteCampaign}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            Delete campaign
          </button>
          <button
            type="button"
            onClick={onDuplicateCampaign}
            disabled={duplicating}
            className="rounded-lg border border-teal-200 px-4 py-2 text-sm font-semibold text-deep-teal transition-colors hover:bg-teal-50 disabled:cursor-wait disabled:opacity-60"
          >
            {duplicating ? "Duplicating…" : "Duplicate campaign"}
          </button>
          <button
            type="button"
            onClick={onEditCampaign}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Edit campaign
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            <span className="text-lg leading-none">+</span> New post
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Campaign progress</span>
              <span>{published} of {posts.length} published</span>
            </div>
            <progress
              aria-label="Campaign publishing progress"
              value={progress}
              max={100}
              className="mt-2 h-2 w-full accent-bright-coral"
            />
          </div>
          <span className="text-sm font-semibold text-gray-900">{progress}%</span>
        </div>
      </div>

      <div className="mt-6">
        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-deep-teal">
              <span className="text-2xl">+</span>
            </div>
            <h4 className="mt-3 font-semibold text-gray-900">Build the first post</h4>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
              Upload a single image or carousel, write the platform copy, and keep it as a draft until it is ready.
            </p>
            <button type="button" onClick={onCreate} className="mt-5 rounded-lg bg-deep-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-darker-teal">
              Create post
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {posts.map((post, index) => (
              <CampaignPostCard
                key={post.id}
                post={post}
                sequence={posts.length - index}
                onEdit={() => onEdit(post)}
                onPublish={() => onPublish(post)}
                onRefresh={() => onRefresh(post)}
                onDuplicate={() => onDuplicate(post)}
                duplicating={duplicatingPostId === post.id}
                onRemove={() => onRemove(post)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CampaignPostCard({
  post,
  sequence,
  onEdit,
  onPublish,
  onRefresh,
  onDuplicate,
  duplicating,
  onRemove,
}: {
  post: CampaignPost;
  sequence: number;
  onEdit: () => void;
  onPublish: () => void;
  onRefresh: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
      <div className="grid gap-5 md:grid-cols-[8rem_1fr_auto] md:items-center">
        <div className="relative h-32 overflow-hidden rounded-lg bg-gray-100">
          {post.media.urls[0] ? (
            <img src={post.media.urls[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-500">No images yet</div>
          )}
          {post.media.urls.length > 1 ? (
            <span className="absolute bottom-2 right-2 rounded-full bg-gray-900/75 px-2 py-1 text-[11px] font-semibold text-white">
              {post.media.urls.length} images
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-400">Post {sequence}</span>
            <StatusBadge status={post.status} />
          </div>
          <h4 className="mt-2 truncate font-semibold text-gray-900">{post.title}</h4>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {post.description || "No description yet."}
          </p>
          {post.hashtags.length ? (
            <p className="mt-2 truncate text-xs text-deep-teal">
              {post.hashtags.map((tag) => `#${tag}`).join(" ")}
            </p>
          ) : null}
          {post.error ? (
            <p className="mt-2 line-clamp-2 text-xs text-red-600" title={post.error}>
              {post.error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:w-32 md:flex-col md:items-stretch">
          {post.status === "published" && post.postUrl ? (
            <a href={post.postUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-4 py-2 text-center text-xs font-semibold text-white hover:bg-green-700">
              View live post
            </a>
          ) : null}
          {post.status === "draft" || post.status === "failed" ? (
            <>
              <button type="button" onClick={onPublish} className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-700">
                {post.status === "failed" ? "Try again" : "Publish"}
              </button>
              <button type="button" onClick={onEdit} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                Edit
              </button>
            </>
          ) : null}
          {post.status === "publishing" ? (
            <button
              type="button"
              onClick={post.vendorRequestId || post.jobId ? onRefresh : onPublish}
              className="rounded-lg bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              {post.vendorRequestId || post.jobId
                ? "Check status"
                : "Resume publish"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDuplicate}
            disabled={duplicating}
            aria-label="Duplicate post"
            title="Duplicate post"
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-deep-teal disabled:cursor-wait disabled:opacity-60"
          >
            <DuplicateIcon />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove from campaign"
            title="Remove from campaign"
            className="inline-flex items-center justify-center rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

function DuplicateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="5.5"
        y="5.5"
        width="8"
        height="8"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10.5 5.5V3.75A1.25 1.25 0 0 0 9.25 2.5H3.75A1.25 1.25 0 0 0 2.5 3.75v5.5A1.25 1.25 0 0 0 3.75 10.5H5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 4.5h9M6 4.5V3.25A.75.75 0 0 1 6.75 2.5h2.5a.75.75 0 0 1 .75.75V4.5m1.5 0V12.5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 7v4M9.5 7v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({ status }: { status: CampaignPost["status"] }) {
  const style = {
    draft: "bg-gray-100 text-gray-700",
    publishing: "bg-amber-50 text-amber-700",
    published: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
  }[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${style}`}>
      {status}
    </span>
  );
}

function PlatformPill({
  platform,
}: {
  platform: CampaignPlatform;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
      platform === "linkedin"
        ? "bg-blue-50 text-blue-600"
        : "bg-pink-50 text-pink-600"
    }`}>
      <PlatformIcon platform={platform} />
      {platform === "linkedin" ? "LinkedIn" : "Instagram"}
    </span>
  );
}

function PlatformIcon({
  platform,
  large = false,
}: {
  platform: CampaignPlatform;
  large?: boolean;
}) {
  const size = large ? 44 : 14;
  if (platform === "linkedin") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-blue-600" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-pink-600" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4z" />
    </svg>
  );
}

function EmptyCampaigns({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-deep-teal">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13z" />
          <path d="M8 8h8M8 12h5M8 16h7" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-gray-900">Create your first post campaign</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
        Keep LinkedIn and Instagram work separate, then move every post from draft to published with its own copy and carousel.
      </p>
      <button type="button" onClick={onCreate} className="mt-6 rounded-lg bg-deep-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-darker-teal">
        New campaign
      </button>
    </div>
  );
}

function DuplicateCampaignDialog({
  campaign,
  saving,
  onClose,
  onConfirm,
}: {
  campaign: PostCampaign;
  saving: boolean;
  onClose: () => void;
  onConfirm: (platform: CampaignPlatform) => void;
}) {
  const [platform, setPlatform] = useState<CampaignPlatform>(campaign.platform);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/55 p-4 backdrop-blur-subtle"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-campaign-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-modern-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="duplicate-campaign-title" className="text-xl font-semibold text-gray-900">
              Duplicate campaign
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Copy “{campaign.name}” and its posts as drafts. You can keep the
              same platform or switch it for the new campaign.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close duplicate campaign dialog"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-800">
            Platform for the copy
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["instagram", "linkedin"] as CampaignPlatform[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={platform === candidate}
                disabled={saving}
                onClick={() => setPlatform(candidate)}
                className={`rounded-xl border p-4 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                  platform === candidate
                    ? "border-deep-teal bg-teal-50 ring-2 ring-teal-500/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <PlatformPill platform={candidate} />
                <p className="mt-2 text-xs text-gray-600">
                  {candidate === "instagram"
                    ? "Carousels, hashtags, collaborators"
                    : "Profile or company-page posts"}
                </p>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(platform)}
            disabled={saving}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Duplicating…" : "Duplicate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewCampaignDialog({
  campaign,
  onClose,
  onCreated,
}: {
  campaign?: PostCampaign;
  onClose: () => void;
  onCreated: (campaign: PostCampaign) => void;
}) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [objective, setObjective] = useState(campaign?.objective ?? "");
  const [platform, setPlatform] = useState<CampaignPlatform>(
    campaign?.platform ?? "instagram",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) {
      setError("Give the campaign a name.");
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const nextCampaign: PostCampaign = {
      id: campaign?.id ?? generateCampaignId(),
      name: name.trim(),
      objective: objective.trim(),
      platform,
      createdAt: campaign?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await saveCampaign(nextCampaign);
      onCreated(nextCampaign);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the campaign.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/55 p-4 backdrop-blur-subtle" role="dialog" aria-modal="true" aria-labelledby="new-campaign-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-modern-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-campaign-title" className="text-xl font-semibold text-gray-900">{campaign ? "Edit campaign" : "New post campaign"}</h2>
            <p className="mt-1 text-sm text-gray-600">{campaign ? "Update the campaign name or objective." : "Choose one platform so every post gets the right fields and safeguards."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close campaign dialog" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">×</button>
        </div>

        <div className="mt-6 grid gap-5">
          <div>
            <label htmlFor="campaign-name" className="text-sm font-medium text-gray-800"><span className="text-red-500">*</span> Campaign name</label>
            <input id="campaign-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Founder validation stories" className="mt-1.5 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-transparent focus:ring-2 focus:ring-teal-500" />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-gray-800">Platform</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(["instagram", "linkedin"] as CampaignPlatform[]).map((candidate) => (
                <button key={candidate} type="button" aria-pressed={platform === candidate} disabled={Boolean(campaign)} onClick={() => setPlatform(candidate)} className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${platform === candidate ? "border-deep-teal bg-teal-50 ring-2 ring-teal-500/20" : "border-gray-200 hover:border-gray-300"}`}>
                  <PlatformPill platform={candidate} />
                  <p className="mt-2 text-xs text-gray-600">{candidate === "instagram" ? "Carousels, hashtags, collaborators" : "Profile or company-page posts"}</p>
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="campaign-objective" className="text-sm font-medium text-gray-800">Objective <span className="font-normal text-gray-500">(optional)</span></label>
            <textarea id="campaign-objective" value={objective} onChange={(event) => setObjective(event.target.value)} rows={3} placeholder="What should this campaign help Altitut achieve?" className="mt-1.5 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-transparent focus:ring-2 focus:ring-teal-500" />
          </div>
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={() => void create()} disabled={saving} className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50">{saving ? "Saving…" : campaign ? "Save changes" : "Create campaign"}</button>
        </div>
      </div>
    </div>
  );
}
