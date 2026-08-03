import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { COLLECTIONS, db } from "./firebase";

export type CampaignPlatform = "linkedin" | "instagram";
export type CampaignPostStatus =
  | "draft"
  | "publishing"
  | "published"
  | "failed";

export type PostCampaign = {
  id: string;
  name: string;
  platform: CampaignPlatform;
  objective: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignPost = {
  id: string;
  campaignId: string;
  platform: CampaignPlatform;
  title: string;
  description: string;
  hashtags: string[];
  firstComment: string;
  media: {
    urls: string[];
    storagePaths: string[];
    items?: Array<{
      url: string;
      path: string;
      width?: number;
      height?: number;
      bytes: number;
    }>;
  };
  linkedin?: {
    destination: "profile" | "page";
    pageId?: string;
    pageName?: string;
  };
  instagram?: {
    collaborators: string[];
    locationId?: string;
  };
  status: CampaignPostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  /** Stable Upload-Post idempotency key for this saved content revision. */
  publishKey?: string;
  vendorRequestId?: string;
  jobId?: string;
  postUrl?: string;
  platformPostId?: string;
  error?: string;
};

function toFirestoreData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function generateCampaignId(): string {
  return (
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export async function saveCampaign(campaign: PostCampaign): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.postCampaigns, campaign.id),
    toFirestoreData(campaign),
  );
}

export async function saveCampaignPost(post: CampaignPost): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.campaignPosts, post.id),
    toFirestoreData(post),
  );
}

export function listenToCampaigns(
  onChange: (campaigns: PostCampaign[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.postCampaigns),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => {
      onChange(
        snapshot.docs.map((document) => document.data() as PostCampaign),
      );
    },
    (error) => onError?.(error),
  );
}

export function listenToCampaignPosts(
  onChange: (posts: CampaignPost[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.campaignPosts),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => {
      onChange(
        snapshot.docs.map((document) => document.data() as CampaignPost),
      );
    },
    (error) => onError?.(error),
  );
}

export async function deleteCampaignPost(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.campaignPosts, id));
}

export async function deleteCampaign(
  campaignId: string,
  postIds: string[],
): Promise<void> {
  const targets = [
    ...postIds.map((postId) =>
      doc(db, COLLECTIONS.campaignPosts, postId),
    ),
    doc(db, COLLECTIONS.postCampaigns, campaignId),
  ];
  for (let offset = 0; offset < targets.length; offset += 500) {
    const batch = writeBatch(db);
    for (const target of targets.slice(offset, offset + 500)) {
      batch.delete(target);
    }
    await batch.commit();
  }
}

export function buildCampaignDuplicate(
  campaign: PostCampaign,
  posts: CampaignPost[],
): { campaign: PostCampaign; posts: CampaignPost[] } {
  const now = Date.now();
  const campaignId = generateCampaignId();
  const duplicatedCampaign: PostCampaign = {
    ...campaign,
    id: campaignId,
    name: `${campaign.name} (Copy)`,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  const duplicatedPosts = posts.map((post, index): CampaignPost => {
    const timestamp = new Date(now - index).toISOString();
    return {
      id: generateCampaignId(),
      campaignId,
      platform: post.platform,
      title: post.title,
      description: post.description,
      hashtags: [...post.hashtags],
      firstComment: post.firstComment,
      media: {
        urls: [...post.media.urls],
        storagePaths: [...post.media.storagePaths],
        items: post.media.items?.map((item) => ({ ...item })),
      },
      linkedin: post.linkedin ? { ...post.linkedin } : undefined,
      instagram: post.instagram
        ? {
            ...post.instagram,
            collaborators: [...post.instagram.collaborators],
          }
        : undefined,
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
  return { campaign: duplicatedCampaign, posts: duplicatedPosts };
}

export async function duplicateCampaign(
  campaign: PostCampaign,
  posts: CampaignPost[],
): Promise<{ campaign: PostCampaign; posts: CampaignPost[] }> {
  const duplicate = buildCampaignDuplicate(campaign, posts);
  await saveCampaign(duplicate.campaign);
  for (let offset = 0; offset < duplicate.posts.length; offset += 500) {
    const batch = writeBatch(db);
    for (const post of duplicate.posts.slice(offset, offset + 500)) {
      batch.set(
        doc(db, COLLECTIONS.campaignPosts, post.id),
        toFirestoreData(post),
      );
    }
    await batch.commit();
  }
  return duplicate;
}

export function normalizeHashtag(value: string): string {
  return value.trim().replace(/^#+/, "").replace(/\s+/g, "");
}

export function composeCampaignCaption(
  description: string,
  hashtags: string[],
): string {
  const tags = hashtags
    .map(normalizeHashtag)
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(" ");
  return [description.trim(), tags].filter(Boolean).join("\n\n");
}

// Upload-Post currently rejects these Instagram hashtags before reaching Meta.
// Keep this guard in the editor so a team member gets an actionable error first.
export const UPLOAD_POST_BANNED_INSTAGRAM_HASHTAGS = new Set(
  `anorexia alone a$$ antivax abdl addmysc adulting always armparty asiagirl
  beautyblogger bikinibody boho blogladrona brain besties bikinibod costumes
  curvygirls cancer date dating desk dm elevator edm endme followtrain
  followtrains graffitiigers girlsonly gloves hardworkpaysoff happythanksgiving
  humpday hustler hotgirls iphonegraphy italiano ifb kansas killingit kissing
  kill killme killyourself kys master models mustfollow milf midget nasty
  newyearsday petite petitegirls pushups payme saltwater shit shower single
  singlelife skype snap snapchat snapchatme snowstorm sopretty stranger
  streetphoto sunbathing swole suicide suicideawareness tag4like tanlines teens
  teen thought todayimwearing undies unbalanced valentinesday workflow youngmodel
  yolo`
    .split(/\s+/)
    .filter(Boolean),
);
