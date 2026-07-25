# 00 — SHARED FOUNDATION

**Read this first.** `01-LINKEDIN.md`, `02-FACEBOOK.md`, `03-INSTAGRAM.md` assume everything here exists.
**Criterion driving every recommendation:** working auto-post from a Next.js + Firestore app **within 30 minutes**.
**Compiled:** 2026-07-23

---

## 1. Why native platform APIs are excluded

| Path | Blocking gate | Realistic time to first post |
|---|---|---|
| LinkedIn Posts API (native) | Developer app + access request; identity verification; company-page posting needs Community Management API review | Days to weeks |
| Meta Graph API (native, FB + IG) | Meta App Review **per permission** + Business Verification (legal docs, domain verification) | 2–4 weeks per submission |
| **Unified API with managed credentials** | **None. Sign up → connect account → copy key.** | **Minutes** |

The decisive feature is **managed (system) credentials**: the vendor has already completed
LinkedIn's and Meta's approval processes at *their* app level and lets you publish under it. Any
service that requires you to "bring your own developer credentials" fails the 30-minute bar by
definition.

Both recommended services support **both** modes. Start on managed credentials. Move to your own
credentials later if you want your own brand on the OAuth consent screen — that is a config change,
not a rewrite.

---

## 2. The two recommended services

| | **Upload-Post** | **Post for Me** |
|---|---|---|
| **Rank** | **#1 — fastest + broadest** | **#2 — best API design** |
| Time to first post | ~10–20 min | ~20–30 min |
| Cost to start | **Free — 10 uploads/mo, no credit card** | **$10/mo — no free tier** |
| Managed credentials | Yes (default) | Yes ("Quickstart Project") |
| Platforms | ~13 for media, more for text-only | 9 |
| Media input | **Multipart file bytes OR URL** | URL, or their signed-upload staging |
| API style | `multipart/form-data`, flat per-platform params | JSON, nested `platform_configurations` |
| Idempotency | **Built in (`Idempotency-Key` header)** | Not documented — guard yourself |
| Async + status | `async_upload=true` → poll `/uploadposts/status` | Webhooks + post results |
| Scheduling | `scheduled_date` + `timezone`, plus a slot queue | `scheduled_at` |
| Retry failed platforms | `POST /uploadposts/retry` — reuses stored media | Re-issue the post |
| Open source | SDKs + MCP server (MIT) | **Whole API server open source** |
| Node SDK | `upload-post` (npm) | Official TS SDK |
| MCP server | `https://mcp.upload-post.com/mcp` | Yes |
| Docs for coding agents | **`https://docs.upload-post.com/llm.txt`** — entire API in one file | `https://api.postforme.dev/docs` |

### Pick this one if…

| Situation | Service |
|---|---|
| Working today, spending nothing | **Upload-Post** |
| Keep media private (no public bucket URLs) | **Upload-Post** (multipart) or **Post for Me** (signed staging) |
| Need >13 platforms, or Discord / Telegram / Google Business | **Upload-Post** |
| Want a clean JSON API and a typed SDK | **Post for Me** |
| Vendor risk matters; you want to audit or self-host the server | **Post for Me** (open source) |
| Need per-account overrides inside one call | **Post for Me** (`account_configurations`) |
| Need LinkedIn **document/PDF carousel** posts | **Upload-Post** (`/api/upload_document`) |

**Build against Upload-Post first**, behind the adapter in §7. Post for Me then becomes a
one-file swap.

### Rejected, and why

| Service | Verdict |
|---|---|
| **Ayrshare** | Most mature vendor in the category — excellent docs, real SDKs, 99.99% uptime claims, proven at scale. **But the free tier is gone.** Entry is Premium **$149/mo billed at signup with no free trial**; the Launch plan ($299/mo) carries a 28-day free trial with no credit card. Ayrshare's own GitHub READMEs and many third-party articles still say "get started with a free plan" — **that is stale, do not rely on it**. Right choice at scale; wrong choice for a 30-minute zero-spend start. https://www.ayrshare.com/pricing/ |
| **Zernio** | Genuinely close. Free for the first 2 social accounts with unlimited posts, no credit card, no platform developer apps, 15 platforms, SOC 2 + GDPR, MCP server. **Keep as the #3 fallback** if Upload-Post's 10/month free tier is too tight and $10/mo is not available. https://docs.zernio.com |
| **Postiz** | Open source and 30+ platforms, but self-hosting is not a 30-minute task and cloud is $29/mo. |
| **Buffer API** | Free tier and a real company, but bound to Buffer's account/channel model rather than being a pure publishing backend. |

---

## 3. Stack assumptions

> **These are the real conventions of the Altitut Social Media Command Center repo**, verified
> against the codebase on 2026-07-23. Do not substitute generic Next.js/Firebase patterns.

| Layer | Actual choice in this repo |
|---|---|
| Framework | Next.js 15.3.4, App Router, Route Handlers at `app/api/**/route.ts` |
| Language | TypeScript 5, `strict: true` |
| Styling | Tailwind CSS 3.4.19 + brand tokens in `tailwind.config.js` |
| Database | **Firebase Firestore via the CLIENT SDK** (`firebase/firestore`), exported as `db` from `lib/firebase.ts`. Rules are open; the same client SDK is used from the browser **and** from API routes |
| Storage | Firebase Storage — bucket `altitut-sma-dashboard.firebasestorage.app` already exists in the config but is **not yet used by any code**. This feature introduces it |
| AI | `openai` v6 via `lib/openai.ts` (`getOpenAI`, `CHAT_MODEL`, `completeJson`), plus Vercel AI SDK v7 for streaming chat |
| Imports | **Relative paths** (`../../lib/firebase`). A `@/*` alias exists in `tsconfig.json` but the codebase does not use it — match the existing style |
| Tests | None. Do not invent a test framework |

> **There is no `firebase-admin` in this project and you must not add it.** There is no service
> account, no `FIREBASE_PRIVATE_KEY`, and no security-rule enforcement to work around. Use `db`
> from `lib/firebase.ts` exactly as `lib/packs.ts` does.

Every Route Handler that talks to a vendor declares, matching `app/api/scout/route.ts`:
```ts
export const runtime = "nodejs";
export const maxDuration = 300;   // Vercel Fluid Compute
```

### Directory layout
```
app/api/
  social/
    accounts/route.ts              # list connected destinations
    publish/route.ts               # single publish entrypoint
    webhooks/post-for-me/route.ts  # only if SOCIAL_PROVIDER=post_for_me
  cron/
    publish-scheduled/route.ts
    poll-upload-status/route.ts    # only if SOCIAL_PROVIDER=upload_post
lib/
  firebase/admin.ts
  media/fromStorage.ts
  social/
    types.ts  errors.ts  registry.ts  publish.ts
    upload-post/{client.ts,adapter.ts}
    post-for-me/{client.ts,adapter.ts}
```

---

## 4. Environment variables

Append to the existing `.env` / `.env.example`. **No Firebase credentials are needed** — the web
config is already hard-coded in `lib/firebase.ts`.

```bash
# ---- Auto-post: Upload-Post (primary) ----
UPLOAD_POST_API_KEY=
UPLOAD_POST_BASE_URL=https://api.upload-post.com/api
UPLOAD_POST_PROFILE=            # the Upload-Post profile name, e.g. "altitut"

# ---- Auto-post: Post for Me (fallback vendor, optional) ----
POST_FOR_ME_API_KEY=
POST_FOR_ME_BASE_URL=https://api.postforme.dev/v1

# ---- Switch ----
SOCIAL_PROVIDER=upload_post      # "upload_post" | "post_for_me"
```

Already present in this repo and reused by this feature: `OPENAI_API_KEY`, `OPENAI_MODEL`,
`OPENAI_BASE_URL`. None of the new vars carry a `NEXT_PUBLIC_` prefix.

---

## 5. Media: the one architectural decision

Instagram's underlying Meta API cannot accept raw bytes — it fetches a URL. Both vendors hide
this, but *how* determines whether you need a public bucket.

### The hard constraint: you cannot upload a video through a Next.js Route Handler

Vercel serverless functions cap the **request body at roughly 4.5 MB**. Any real video blows
through that. So the browser must **never** POST the file to your own API. This kills the
"multipart straight through the API route" design.

### The architecture that works here

```
Browser ──uploadBytesResumable()──> Firebase Storage      (direct, no size limit, free progress %)
   │
   └──getDownloadURL()──> https://firebasestorage.googleapis.com/...?alt=media&token=…
                                    │
                          POST /api/autopost  { step, state:{ mediaUrl } }
                                    │
                          Route Handler ──> Upload-Post  (URL mode)
                                             └─> LinkedIn / Facebook / Instagram
```

**Why `getDownloadURL()` is exactly what these vendors need.** It returns a permanent
`https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media&token=<uuid>` URL that:
- is HTTPS,
- serves the raw bytes with the correct `Content-Type`,
- needs **no `Authorization` header** — the `token` query param is the credential,
- does not redirect,
- does not expire.

That is the exact contract Upload-Post (and Meta underneath it) requires. **Do not use
`getBytes()`, and do not build signed URLs** — `getDownloadURL()` already satisfies it.

Client upload with progress:
```ts
"use client";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { firebaseApp } from "../../lib/firebase";

export function uploadToStorage(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ url: string; path: string }> {
  const path = `autopost/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const task = uploadBytesResumable(ref(getStorage(firebaseApp), path), file, {
    contentType: file.type,
  });
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (s) => onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      reject,
      async () => resolve({ url: await getDownloadURL(task.snapshot.ref), path }),
    );
  });
}
```

> **Firebase Storage rules must allow this.** The Firestore rules on this project are already open;
> Storage rules are separate and default to authenticated-only. For an internal dashboard, set them
> to open in the Firebase console (Storage → Rules) or the upload fails with
> `storage/unauthorized`. This is the single most likely first-run failure.

Upload-Post also accepts real multipart bytes for small files, which is useful for images under
4 MB, but **use the Storage URL path uniformly** so video and image behave identically.

**Post for Me — two options.** Pass a public URL in `media[].url`, or stage privately:
`POST /v1/media/create-upload-url` returns a signed `upload_url` plus a public `media_url`; `PUT`
the bytes to `upload_url`, then reference `media_url` in the post. Their storage is ephemeral —
assets are deleted immediately once the post publishes, when a scheduled post holding them is
deleted, or after 24 hours if never attached to a post.
Reference: https://www.postforme.dev/resources/posting-media

**If you do publish public Firebase URLs:** they must be `https`, require no auth header, must not
redirect, and must outlive processing (budget ≥24h). Prefer `file.makePublic()` over signed URLs —
an expired signed URL on a scheduled post fails in a way that is very hard to diagnose. Note that
`makePublic()` throws if the bucket has uniform bucket-level access enabled.

### Normalize once, at upload time
Instagram is the strictest consumer; satisfy it and the others follow. Both vendors transcode
non-compliant media automatically, but validating first saves a wasted call and a confusing error.

| Constraint | Value |
|---|---|
| Image format | JPEG (safest across all three) |
| Image aspect | between 4:5 and 1.91:1 |
| Video | MP4, H.264 video, AAC audio |
| Reels | 9:16, 5–90s to be Reels-tab eligible |

Persist `width`, `height`, `durationSec`, `mimeType`, `bytes` on the `mediaAssets` doc so publish
can validate before spending an API call.

---

## 6. Firestore schema

### `socialAccounts/{accountId}`
```ts
{
  provider: "linkedin" | "facebook" | "instagram";
  vendor: "upload_post" | "post_for_me";

  // Upload-Post: the profile username (the "user" param). One profile holds many networks.
  uploadPostProfile?: string;
  // Post for Me: the social account id, e.g. "sa_1234".
  postForMeAccountId?: string;

  // Destination IDs — see each platform doc for how to obtain them
  linkedinPageId?: string;      // numeric org id; omit for a personal profile
  facebookPageId?: string;      // REQUIRED on every Facebook publish
  instagramUserId?: string;

  displayName: string;
  avatarUrl?: string | null;
  status: "active" | "needs_reauth" | "revoked";
  connectedAt: Timestamp;
  lastVerifiedAt: Timestamp;
}
```

> **There is deliberately no `socialTokens` collection.** Neither service exposes platform OAuth
> tokens to you — that is the point of managed credentials. You hold one vendor API key in an env
> var and never in Firestore. This removes the entire token-encryption and refresh surface that a
> native integration would require.

### `mediaAssets/{assetId}`
```ts
{
  storagePath: string;          // private Firebase Storage path
  publicUrl?: string | null;    // only if you chose the public-URL path
  mimeType: string;
  kind: "image" | "video" | "document";
  bytes: number;
  width?: number; height?: number; durationSec?: number;
  createdAt: Timestamp;
}
```

### `posts/{postId}`
```ts
{
  body: string;
  bodyOverrides?: Partial<Record<"linkedin" | "facebook" | "instagram", string>>;
  mediaAssetIds: string[];
  targets: string[];            // socialAccounts doc IDs
  scheduledFor: Timestamp | null;
  status: "draft" | "queued" | "publishing" | "partial" | "published" | "failed";
  idempotencyKey: string;       // uuid v4, generated once, reused on every retry
  vendorRequestId?: string;     // Upload-Post request_id / Post for Me post id
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `posts/{postId}/results/{accountId}`
A post that succeeds on LinkedIn and fails on Instagram is normal. Model partial success from day one.
```ts
{
  accountId: string;
  provider: "linkedin" | "facebook" | "instagram";
  status: "pending" | "processing" | "success" | "failed";
  providerPostId?: string;
  permalink?: string;
  attempt: number;
  error?: { code: string; message: string; retryable: boolean };
  publishedAt?: Timestamp;
  updatedAt: Timestamp;
}
```

### Required indexes (`firestore.indexes.json`)
```
posts:          status ASC, scheduledFor ASC
posts:          status ASC, vendorRequestId ASC
socialAccounts: provider ASC, status ASC
results (collectionGroup): provider ASC, status ASC
```
Deploy these before the cron runs, or the query throws at runtime with a console link.

### A note on rules

This project runs with **open Firestore rules** and uses the client SDK from both the browser and
API routes. That is a deliberate, pre-existing choice for an internal dashboard — do not "harden"
it as part of this feature, and do not introduce `firebase-admin` to work around it.

The one thing you **do** need to change is **Storage** rules, which are separate from Firestore
rules and are restrictive by default. See §5.

Because there is no auth layer, `ownerUid` is not meaningful here. Omit it. Records are
dashboard-global, exactly like `competitors` and `contentPacks`.

---

## 7. The adapter interface

`lib/social/types.ts`
```ts
import "server-only";

export type Provider = "linkedin" | "facebook" | "instagram";

export type MediaInput = {
  storagePath?: string;   // preferred: private Firebase Storage object
  publicUrl?: string;     // alternative: already-public URL
  mimeType: string;
  kind: "image" | "video" | "document";
  width?: number; height?: number; durationSec?: number;
  altText?: string;
};

export type PublishInput = {
  accountId: string;
  text: string;
  media: MediaInput[];
  idempotencyKey: string;
  scheduledFor?: Date;
  /** Platform-specific escape hatch. Documented per platform doc. */
  options?: Record<string, unknown>;
};

export type PublishResult = {
  providerPostId?: string;
  permalink?: string;
  /** Set when the vendor accepted the job asynchronously. Poll or await webhook. */
  pendingRequestId?: string;
};

export interface PublishAdapter {
  readonly vendor: "upload_post" | "post_for_me";
  publish(provider: Provider, input: PublishInput): Promise<PublishResult>;
  checkStatus?(requestId: string): Promise<PublishResult & { done: boolean }>;
  delete?(provider: Provider, providerPostId: string, accountId: string): Promise<void>;
}
```

`lib/social/registry.ts`
```ts
import { uploadPostAdapter } from "./upload-post/adapter";
import { postForMeAdapter } from "./post-for-me/adapter";
import type { PublishAdapter } from "./types";

export function getAdapter(): PublishAdapter {
  return process.env.SOCIAL_PROVIDER === "post_for_me"
    ? postForMeAdapter
    : uploadPostAdapter;
}
```

---

## 8. Shared HTTP clients

### `lib/social/upload-post/client.ts`
```ts
import "server-only";
import { SocialPublishError } from "@/lib/social/errors";

const BASE = process.env.UPLOAD_POST_BASE_URL ?? "https://api.upload-post.com/api";

export async function uploadPostFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const { idempotencyKey, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Apikey ${process.env.UPLOAD_POST_API_KEY}`,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(rest.headers ?? {}),
      // Do NOT set Content-Type when body is FormData — fetch sets the multipart boundary.
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json as any)?.success === false) {
    throw new SocialPublishError({
      code: `UPLOADPOST_${res.status}`,
      message: (json as any)?.error ?? (json as any)?.message ?? res.statusText,
      retryable: res.status === 429 || res.status >= 500,
    }, json);
  }
  return json as T;
}
```

### `lib/social/post-for-me/client.ts`
```ts
import "server-only";
import { SocialPublishError } from "@/lib/social/errors";

const BASE = process.env.POST_FOR_ME_BASE_URL ?? "https://api.postforme.dev/v1";

export async function pfmFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.POST_FOR_ME_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new SocialPublishError({
      code: `POSTFORME_${res.status}`,
      message: (json as any)?.message ?? res.statusText,
      retryable: res.status === 429 || res.status >= 500,
    }, json);
  }
  return json as T;
}
```

---

## 9. Errors and retries

`lib/social/errors.ts`
```ts
import "server-only";

export type NormalizedError = {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
};

export class SocialPublishError extends Error {
  constructor(public normalized: NormalizedError, public raw?: unknown) {
    super(normalized.message);
    this.name = "SocialPublishError";
  }
}

/** Exponential backoff with full jitter. */
export function backoffMs(attempt: number): number {
  return Math.floor(Math.random() * Math.min(1000 * 2 ** attempt, 60_000));
}
```

| Class | Retryable | Action |
|---|---|---|
| `401` invalid/expired vendor key | No | Developer problem, not a user problem. Alert |
| `400` validation | No | Bad media or params. Fix input, do not retry |
| `403` | No | Connected account lacks a scope; user must reconnect |
| `404` | No | Unknown profile / job id |
| `409` | No | Nothing to retry (Upload-Post: no failed platforms) |
| `429` | Yes | Backoff; if a daily platform cap, requeue for tomorrow |
| `5xx` | Yes | Backoff, max 3 attempts |

**Duplicate-post protection.** Upload-Post accepts an `Idempotency-Key` header (also accepted as
`X-Idempotency-Key` or `X-Request-Id`) — when a matching upload job already exists it returns the
existing job instead of creating a duplicate. **Always send it.** Post for Me does not document an
equivalent, so guard in Firestore: inside a transaction, refuse to publish if the result doc already
carries a `providerPostId`.

**Never blind-retry a publish.** All three platforms can succeed server-side and still fail to
return a response.

---

## 10. Scheduling

Both vendors schedule natively, so there are two valid designs. **Pick one — running both double-posts.**

- **Delegate (simplest):** pass `scheduled_date` + `timezone` (Upload-Post) or `scheduled_at`
  (Post for Me) and let the vendor hold the queue. Upload-Post also offers a slot-based queue via
  `add_to_queue=true` (default slots 9am / 12pm / 5pm Eastern) — see
  https://docs.upload-post.com/api/queue-system/
- **Own it (portable):** store `scheduledFor` in Firestore and drive from cron. Identical behaviour
  across vendors, survives migration.

`app/api/cron/publish-scheduled/route.ts`
```ts
import "server-only";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { publishPost } from "@/lib/social/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const due = await adminDb.collection("posts")
    .where("status", "==", "queued")
    .where("scheduledFor", "<=", Timestamp.now())
    .limit(25).get();

  const results = await Promise.allSettled(due.docs.map((d) => publishPost(d.id)));
  return NextResponse.json({
    processed: due.size,
    failed: results.filter((r) => r.status === "rejected").length,
  });
}
```

`vercel.json`
```json
{ "crons": [
  { "path": "/api/cron/publish-scheduled",  "schedule": "*/5 * * * *" },
  { "path": "/api/cron/poll-upload-status", "schedule": "* * * * *" }
]}
```

> **Vercel timeout — read this.** Upload-Post automatically switches to asynchronous processing if
> an upload exceeds **59 seconds**, returning a `request_id`. Do not block a request on video.
> Set `async_upload=true` explicitly, persist `request_id` to `posts.vendorRequestId`, and let the
> second cron poll `GET /api/uploadposts/status`.

`app/api/cron/poll-upload-status/route.ts`
```ts
import "server-only";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { uploadPostFetch } from "@/lib/social/upload-post/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pending = await adminDb.collection("posts")
    .where("status", "==", "publishing")
    .limit(25).get();

  for (const doc of pending.docs) {
    const requestId = doc.data().vendorRequestId as string | undefined;
    if (!requestId) continue;

    const status = await uploadPostFetch<any>(
      `/uploadposts/status?request_id=${encodeURIComponent(requestId)}`,
    ).catch(() => null);
    if (!status) continue;

    const results: any[] = status.results ?? status.platforms ?? [];
    const anyPending = results.some((r) => r.success === undefined || r.status === "processing");
    if (anyPending) continue;

    const allOk = results.every((r) => r.success === true);
    await doc.ref.update({
      status: allOk ? "published" : results.some((r) => r.success) ? "partial" : "failed",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  return NextResponse.json({ checked: pending.size });
}
```
> The exact response shape of `/uploadposts/status` is not fully specified in the public docs.
> **Log one real response before trusting the parser above** and adjust the field names. See
> https://docs.upload-post.com/llm.txt (section `docs/api/reference.md` → Upload Status).

---

## 11. Firebase access

There is **no** admin singleton. `lib/firebase.ts` already exports everything needed:

```ts
import { COLLECTIONS, db, firebaseApp } from "../../lib/firebase";
```

Add the new collection to the existing `COLLECTIONS` map rather than hard-coding a string:

```ts
export const COLLECTIONS = {
  competitors: "competitors",
  contentPacks: "contentPacks",
  ragChunks: "ragChunks",
  scoutRuns: "scoutRuns",
  telegramUpdates: "telegramUpdates",
  socialPosts: "socialPosts",   // <- added by the auto-post feature
} as const;
```

**Firestore rejects `undefined`.** `lib/packs.ts` handles this with a JSON round-trip before
`setDoc`. Copy that behaviour exactly:

```ts
const sanitized = JSON.parse(JSON.stringify(record));
await setDoc(doc(db, COLLECTIONS.socialPosts, id), sanitized);
```

## 12. Orchestrator

`lib/social/publish.ts`
```ts
import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getAdapter } from "./registry";
import type { MediaInput, Provider } from "./types";

export async function publishPost(postId: string) {
  const postRef = adminDb.collection("posts").doc(postId);
  const snap = await postRef.get();
  if (!snap.exists) throw new Error(`Unknown post ${postId}`);
  const post = snap.data()!;

  await postRef.update({ status: "publishing", updatedAt: FieldValue.serverTimestamp() });

  const media: MediaInput[] = await Promise.all(
    (post.mediaAssetIds as string[]).map(async (id) => {
      const m = (await adminDb.collection("mediaAssets").doc(id).get()).data()!;
      return {
        storagePath: m.storagePath,
        publicUrl: m.publicUrl ?? undefined,
        mimeType: m.mimeType,
        kind: m.kind,
        width: m.width, height: m.height, durationSec: m.durationSec,
      };
    }),
  );

  const adapter = getAdapter();
  let anyOk = false, anyFail = false;

  for (const accountId of post.targets as string[]) {
    const acct = (await adminDb.collection("socialAccounts").doc(accountId).get()).data()!;
    const provider = acct.provider as Provider;
    const resultRef = postRef.collection("results").doc(accountId);

    // Idempotency guard: never republish a target that already has a provider post id.
    const existing = await resultRef.get();
    if (existing.exists && existing.data()?.providerPostId) { anyOk = true; continue; }

    await resultRef.set({
      accountId, provider, status: "processing",
      attempt: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    try {
      const r = await adapter.publish(provider, {
        accountId,
        text: post.bodyOverrides?.[provider] ?? post.body,
        media,
        idempotencyKey: `${post.idempotencyKey}:${accountId}`,
        scheduledFor: post.scheduledFor?.toDate(),
      });

      if (r.pendingRequestId) {
        await postRef.update({ vendorRequestId: r.pendingRequestId });
        await resultRef.set({ status: "processing", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else {
        anyOk = true;
        await resultRef.set({
          status: "success",
          providerPostId: r.providerPostId ?? null,
          permalink: r.permalink ?? null,
          publishedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    } catch (e: any) {
      anyFail = true;
      await resultRef.set({
        status: "failed",
        error: {
          code: e?.normalized?.code ?? "UNKNOWN",
          message: String(e?.message ?? e).slice(0, 500),
          retryable: e?.normalized?.retryable ?? false,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  await postRef.update({
    status: anyOk && anyFail ? "partial" : anyOk ? "published" : "failed",
    updatedAt: FieldValue.serverTimestamp(),
  });
}
```

---

## 13. Reference index

Deep detail lives in vendor docs rather than being duplicated here. Bookmark these.

**Upload-Post**
- **Entire API as one LLM-readable file:** https://docs.upload-post.com/llm.txt ← start here
- API reference: https://docs.upload-post.com/api/reference/
- Overview and auth: https://docs.upload-post.com/api/overview/
- Photo requirements: https://docs.upload-post.com/api/photo-requirements/
- Queue system: https://docs.upload-post.com/api/queue-system/
- Scheduled post management: https://docs.upload-post.com/api/schedule-posts/
- Retry and unpublish: https://docs.upload-post.com/api/post-actions/
- Upload history: https://docs.upload-post.com/api/upload-history/
- MCP server (MIT): https://github.com/Upload-Post/upload-post-mcp
- Python SDK: https://github.com/upload-post/upload-post-pip

**Post for Me**
- API reference (Scalar): https://api.postforme.dev/docs
- Your first post: https://www.postforme.dev/resources/your-first-post
- Posting media: https://www.postforme.dev/resources/posting-media
- Advanced post configurations: https://www.postforme.dev/resources/advanced-posting-configurations
- Carousels and multi-media: https://www.postforme.dev/resources/creating-carousels-and-multi-media-posts
- Reels and Stories: https://www.postforme.dev/resources/posting-reels-and-stories
- Connection redirects and webhooks: https://www.postforme.dev/resources/handling-account-connection-redirects-and-webhooks
- Errors and retries: https://www.postforme.dev/resources/handling-api-errors-and-retries
- Rate limits: https://www.postforme.dev/resources/understanding-api-rate-limits
- Multi-user applications: https://www.postforme.dev/resources/multi-user-applications
- Quickstart vs White Label: https://www.postforme.dev/resources/quickstart-vs-white-label-project
- Large video files: https://www.postforme.dev/resources/posting-large-video-files
- GitHub: https://github.com/DayMoonDevelopment/post-for-me

**Fallback vendor**
- Zernio docs: https://docs.zernio.com · pricing: https://zernio.com/pricing

---

## 14. VERIFY BEFORE CODING

Compiled 2026-07-23 from vendor documentation. These items are volatile — confirm in the first 10
minutes. Everything else is stable.

| # | Item | Where |
|---|---|---|
| S1 | Upload-Post free-tier allowance (10 uploads/mo at time of writing) and paid tiers | https://www.upload-post.com/#pricing |
| S2 | Post for Me tier boundaries above $10/mo for 1,000 posts | https://www.postforme.dev/pricing |
| S3 | Whether Post for Me has added an idempotency mechanism | https://api.postforme.dev/docs |
| S4 | Exact response shape of `GET /api/uploadposts/status` — log one real response | https://docs.upload-post.com/llm.txt |
| S5 | Ayrshare pricing, if reconsidering | https://www.ayrshare.com/pricing/ |

**If a vendor doc contradicts this file, the vendor doc wins.** Update this file in the same PR.
