import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { COLLECTIONS, db } from "../../lib/firebase";
import { uploadPostFetch } from "./upload-post/client";
import type { Provider } from "./types";

export type SocialAccount = {
  provider: Provider;
  vendor: "upload_post";
  uploadPostProfile: string;
  displayName: string;
  status: "active" | "needs_reauth";
  linkedinPageId?: string;
  facebookPageId?: string;
  instagramUserId?: string;
  connectedAt: string;
  updatedAt: string;
};

function now() {
  return new Date().toISOString();
}

function sanitizeForFirestore<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T;
}

export function getUploadPostProfile(): string | undefined {
  return process.env.UPLOAD_POST_PROFILE;
}

async function createUploadPostProfile(profile: string): Promise<void> {
  await uploadPostFetch("/uploadposts/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: profile }),
  });
}

async function getUploadPostUserProfile(profile: string): Promise<unknown> {
  try {
    return await uploadPostFetch<unknown>(
      `/uploadposts/users/${encodeURIComponent(profile)}`,
    );
  } catch (error) {
    const err = error as { normalized?: { code: string } };
    if (err.normalized?.code === "UPLOADPOST_404") {
      await createUploadPostProfile(profile);
      return uploadPostFetch<unknown>(
        `/uploadposts/users/${encodeURIComponent(profile)}`,
      );
    }
    throw error;
  }
}

function extractDisplayName(
  provider: Provider,
  socialAccounts: Record<string, unknown> | undefined,
): string {
  const raw = socialAccounts?.[provider];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return (
      (obj.display_name as string) ??
      (obj.username as string) ??
      (obj.name as string) ??
      provider
    );
  }
  return provider;
}

function isConnected(
  provider: Provider,
  socialAccounts: Record<string, unknown> | undefined,
): boolean {
  const raw = socialAccounts?.[provider];
  return Boolean(raw && typeof raw === "object" && Object.keys(raw).length > 0);
}

export function getSocialAccounts(userProfile: unknown): Record<string, unknown> | undefined {
  const asRecord = userProfile as Record<string, unknown> | undefined;
  // Upload-Post wraps the profile in `profile`, e.g. `{ success: true, profile: { social_accounts: {...} } }`.
  const profile = asRecord?.profile ?? asRecord;
  const socialAccounts = (profile as Record<string, unknown> | undefined)?.social_accounts;
  return socialAccounts && typeof socialAccounts === "object"
    ? (socialAccounts as Record<string, unknown>)
    : undefined;
}

async function listFacebookPages(profile: string) {
  const res = (await uploadPostFetch<unknown>(
    `/uploadposts/facebook/pages?profile=${encodeURIComponent(profile)}`,
  )) as Record<string, unknown>;
  const pages =
    (res.pages as Array<Record<string, unknown>> | undefined) ??
    (Array.isArray(res) ? (res as Array<Record<string, unknown>>) : []);
  return pages
    .map((p) => ({
      id: String(p.id ?? p.page_id ?? ""),
      name: String(p.name ?? p.page_name ?? p.title ?? ""),
    }))
    .filter((p) => p.id);
}

async function listLinkedInPages(profile: string) {
  const res = (await uploadPostFetch<unknown>(
    `/uploadposts/linkedin/pages?profile=${encodeURIComponent(profile)}`,
  )) as Record<string, unknown>;
  const pages =
    (res.pages as Array<Record<string, unknown>> | undefined) ??
    (res.linkedin_pages as Array<Record<string, unknown>> | undefined) ??
    (Array.isArray(res) ? (res as Array<Record<string, unknown>>) : []);
  return pages
    .map((p) => ({
      id: String(p.id ?? p.organization_id ?? ""),
      name: String(p.name ?? p.localizedName ?? ""),
    }))
    .filter((p) => p.id);
}

export async function getSocialAccount(
  provider: Provider,
): Promise<SocialAccount | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.socialAccounts, provider));
  if (!snap.exists()) return null;
  return snap.data() as SocialAccount;
}

export async function resolveSocialAccount(
  provider: Provider,
  profile: string,
): Promise<SocialAccount> {
  const existing = await getSocialAccount(provider);

  const userProfile = await getUploadPostUserProfile(profile);
  const socialAccounts = getSocialAccounts(userProfile);
  const connected = isConnected(provider, socialAccounts);
  const displayName = connected
    ? extractDisplayName(provider, socialAccounts)
    : `${provider} (${profile})`;

  const account: SocialAccount = {
    provider,
    vendor: "upload_post",
    uploadPostProfile: profile,
    displayName,
    status: connected ? "active" : "needs_reauth",
    connectedAt: existing?.connectedAt ?? now(),
    updatedAt: now(),
  };

  if (provider === "facebook" && connected) {
    if (!existing?.facebookPageId) {
      try {
        const pages = await listFacebookPages(profile);
        if (pages.length > 0) {
          account.facebookPageId = pages[0].id;
        }
      } catch {
        // No Facebook pages connected; validateStep will skip this platform.
      }
    } else {
      account.facebookPageId = existing.facebookPageId;
    }
  }

  if (provider === "linkedin" && connected) {
    if (!existing?.linkedinPageId) {
      try {
        const pages = await listLinkedInPages(profile);
        if (pages.length > 0) {
          account.linkedinPageId = pages[0].id;
        }
      } catch {
        // LinkedIn personal profiles do not require a page.
      }
    } else {
      account.linkedinPageId = existing.linkedinPageId;
    }
  }

  if (provider === "instagram" && connected) {
    const raw = socialAccounts?.instagram;
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const instagramUserId =
        (obj.user_id as string) ??
        (obj.id as string) ??
        existing?.instagramUserId;
      if (instagramUserId) {
        account.instagramUserId = instagramUserId;
      }
    }
  }

  const safeAccount = sanitizeForFirestore(account);

  if (existing) {
    await updateDoc(doc(db, COLLECTIONS.socialAccounts, provider), {
      ...safeAccount,
      connectedAt: existing.connectedAt ?? safeAccount.connectedAt,
    });
  } else {
    await setDoc(doc(db, COLLECTIONS.socialAccounts, provider), safeAccount);
  }

  return account;
}

export async function setSocialAccountPage(
  provider: "facebook" | "linkedin",
  pageId: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.socialAccounts, provider), {
    [`${provider}PageId`]: pageId,
    updatedAt: now(),
  });
}
