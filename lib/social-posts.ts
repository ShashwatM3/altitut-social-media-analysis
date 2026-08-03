import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { COLLECTIONS, db } from "./firebase";

export type Provider = "linkedin" | "facebook" | "instagram";

export type SocialPost = {
  id: string;
  createdAt: string;
  status:
    | "draft"
    | "publishing"
    | "published"
    | "partial"
    | "failed"
    | "scheduled";
  /** Human-readable warnings, e.g. a skipped platform that was not connected. */
  warnings?: string[];
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
  vendor: "upload_post";
  vendorRequestId?: string;
  jobId?: string;
  results: Array<{
    platform: Provider;
    status: "pending" | "success" | "failed" | "skipped";
    postUrl?: string;
    platformPostId?: string;
    error?: string;
  }>;
};

export async function saveSocialPost(post: SocialPost): Promise<void> {
  // Firestore rejects `undefined` values — strip them via JSON round-trip.
  const sanitized = JSON.parse(JSON.stringify(post));
  await setDoc(doc(db, COLLECTIONS.socialPosts, post.id), sanitized);
}

type AutopostHistoryState = Omit<
  SocialPost,
  "id" | "createdAt" | "status" | "vendor" | "results"
> & {
  postId: string;
  createdAt?: string;
  status?: SocialPost["status"];
  results?: SocialPost["results"];
};

/** Mirror publish state from the browser so Post history works locally even
 * when the FastAPI process has no Firebase Admin service-account credential. */
export async function saveAutopostHistory(
  state: AutopostHistoryState,
): Promise<void> {
  await saveSocialPost({
    id: state.postId,
    createdAt: state.createdAt ?? new Date().toISOString(),
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
  });
}

export function listenToSocialPosts(
  onChange: (posts: SocialPost[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, COLLECTIONS.socialPosts), orderBy("createdAt", "desc")),
    (snapshot) => {
      onChange(snapshot.docs.map((document) => document.data() as SocialPost));
    },
    (error) => onError?.(error),
  );
}

export async function deleteSocialPost(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.socialPosts, id));
}
