"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteSocialPost,
  listenToSocialPosts,
  type Provider,
  type SocialPost,
} from "../../lib/social-posts";

export function AutoPostHistory() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = listenToSocialPosts(
      (next) => {
        setPosts(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-deep-teal" />
        <p className="mt-3 text-sm text-gray-600">Loading post history…</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-600">No posts yet. Publish one from the composer above.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h3 className="text-base font-semibold text-gray-900">Post history</h3>
        <p className="text-xs text-gray-500">Live status from Firestore.</p>
      </div>
      <div className="hidden lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500">
            <tr>
              <th className="px-5 py-3">Media</th>
              <th className="px-5 py-3">Platforms</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Links</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts.map((post) => (
              <HistoryRow key={post.id} post={post} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid divide-y divide-gray-100 lg:hidden">
        {posts.map((post) => (
          <HistoryCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SocialPost["status"] }) {
  const styles = {
    draft: "bg-gray-100 text-gray-700",
    publishing: "bg-amber-50 text-amber-700",
    scheduled: "bg-blue-50 text-blue-700",
    published: "bg-green-50 text-green-700",
    partial: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

function PlatformResult({ result }: { result: SocialPost["results"][number] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium capitalize text-gray-700">{result.platform}</span>
      {result.postUrl ? (
        <a
          href={result.postUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-deep-teal underline hover:text-darker-teal"
        >
          View
        </a>
      ) : result.status === "failed" ? (
        <span className="text-xs text-bright-coral" title={result.error}>
          Failed
        </span>
      ) : (
        <span className="text-xs text-gray-500">{result.status}</span>
      )}
    </div>
  );
}

function MediaPreview({ post }: { post: SocialPost }) {
  const url = post.media.urls[0];
  if (post.media.kind === "video") {
    return (
      <video src={url} muted playsInline className="h-12 w-12 rounded-md object-cover" />
    );
  }
  if (post.media.kind === "image") {
    return (
      <img
        src={url}
        alt=""
        className="h-12 w-12 rounded-md object-cover"
      />
    );
  }
  return <span className="text-xs text-gray-500">Text</span>;
}

function DeleteButton({ post }: { post: SocialPost }) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    try {
      await fetch("/api/autopost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "delete", state: post }),
      });
      await deleteSocialPost(post.id);
    } catch (error) {
      console.error("[history] delete failed:", error);
    }
  }

  const hasDeletableResult = post.results?.some(
    (r) => r.platform !== "instagram" && r.platformPostId,
  );
  const canDelete =
    post.status === "scheduled" ||
    post.status === "publishing" ||
    post.status === "failed" ||
    post.status === "partial" ||
    post.status === "published";

  if (!canDelete || (post.results && !hasDeletableResult && post.status !== "scheduled")) {
    return (
      <span className="text-xs text-gray-400" title="Instagram posts cannot be deleted via API">
        —
      </span>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDelete}
          className="text-xs font-semibold text-red-600 hover:underline"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs font-medium text-red-600 hover:text-red-700"
    >
      Delete
    </button>
  );
}

function HistoryRow({ post }: { post: SocialPost }) {
  const when = useMemo(() => {
    const date = post.scheduledFor
      ? new Date(post.scheduledFor)
      : new Date(post.createdAt);
    return date.toLocaleString();
  }, [post]);

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-5 py-3">
        <MediaPreview post={post} />
      </td>
      <td className="px-5 py-3">
        <div className="grid gap-1">
          {post.targets.map((t) => (
            <span key={t.platform} className="capitalize text-gray-700">
              {t.platform} · {t.placement}
            </span>
          ))}
        </div>
      </td>
      <td className="px-5 py-3">
        <StatusBadge status={post.status} />
      </td>
      <td className="px-5 py-3 text-gray-600">{when}</td>
      <td className="px-5 py-3">
        <div className="grid gap-1">
          {post.results?.map((r) => <PlatformResult key={r.platform} result={r} />)}
        </div>
      </td>
      <td className="px-5 py-3">
        <DeleteButton post={post} />
      </td>
    </tr>
  );
}

function HistoryCard({ post }: { post: SocialPost }) {
  const when = useMemo(() => {
    const date = post.scheduledFor
      ? new Date(post.scheduledFor)
      : new Date(post.createdAt);
    return date.toLocaleString();
  }, [post]);

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <MediaPreview post={post} />
          <div>
            <StatusBadge status={post.status} />
            <p className="mt-1 text-xs text-gray-500">{when}</p>
          </div>
        </div>
        <DeleteButton post={post} />
      </div>
      <div className="mt-3 grid gap-1">
        {post.targets.map((t) => (
          <span key={t.platform} className="text-xs text-gray-700">
            {t.platform} · {t.placement}
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-1">
        {post.results?.map((r) => <PlatformResult key={r.platform} result={r} />)}
      </div>
    </div>
  );
}
