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
    status: "pending" | "success" | "failed";
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
