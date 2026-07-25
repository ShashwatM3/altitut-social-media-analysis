# 01 — LINKEDIN

**Prerequisite:** `00-SHARED-FOUNDATION.md` (Firestore schema, clients, adapter, orchestrator).
**Criterion:** working auto-post to LinkedIn from Next.js + Firestore **within 30 minutes**.
**Compiled:** 2026-07-23

---

## 1. Recommendation

| Rank | Service | Setup time | Cost to start | Personal profile | Company page | Docs |
|---|---|---|---|---|---|---|
| **#1** | **Upload-Post** | ~10 min | **Free** (10 uploads/mo, no card) | ✅ default | ✅ `target_linkedin_page_id` | https://docs.upload-post.com/llm.txt |
| **#2** | **Post for Me** | ~25 min | $10/mo | ✅ | ✅ | https://api.postforme.dev/docs |

**Why not native.** LinkedIn is the most gated of the three platforms. The Community Management API
is intended for commercial use by registered legal organisations and is **not available to personal
profiles or independent developers**; access requires an application with identity verification,
use-case evaluation and compliance checks. Company-page posting needs Marketing/Community API
review, typically **2–4 weeks**. Both services above have already cleared that at their app level.

**LinkedIn-specific gotchas that apply on every path:**
- **No native scheduling.** LinkedIn's API has no scheduling parameter. Any "schedule" feature you
  see is the vendor holding a queue. That is fine — just do not run your own cron *and* the vendor's.
- **No edit.** LinkedIn exposes no endpoint to update a published post. Delete-and-recreate only,
  which loses all engagement. Do not build an "edit post" button.
- **3,000 character** commentary limit.
- **Personal-profile analytics do not exist.** LinkedIn's API does not expose member-level
  analytics, only organization pages. If your product promises "your LinkedIn post performance"
  for personal profiles, that promise cannot be kept on any vendor.

---

## 2. Capability matrix

| Capability | Upload-Post | Post for Me | Notes |
|---|---|---|---|
| Text post | ✅ `/api/upload_text` | ✅ | |
| Single image | ✅ `/api/upload_photos` | ✅ | |
| Multi-image | ✅ | ✅ | |
| Video | ✅ `/api/upload` | ✅ | Up to 5 GB / 10 min; chunked upload handled for you |
| **Document / PDF carousel** | ✅ `/api/upload_document` | ❌ | PDF, PPT, PPTX, DOC, DOCX. Max 100 MB, 300 pages |
| Link preview | ✅ (URL in text) | ✅ | LinkedIn auto-generates a card for the first URL |
| Personal profile | ✅ default | ✅ `connection_type: "personal"` | |
| Company page | ✅ `target_linkedin_page_id` | ✅ `connection_type: "organization"` | Connected account must be a page admin |
| Visibility control | ✅ `PUBLIC` / `CONNECTIONS` / `LOGGED_IN` / `CONTAINER` | ⚠️ verify | |
| First comment | ✅ `linkedin_first_comment` | ⚠️ verify | Common growth tactic — put links here, not in the post |
| Scheduling | ✅ `scheduled_date` + `timezone`, or queue | ✅ `scheduled_at` | |
| Delete published post | ✅ `/api/uploadposts/unpublish` | ⚠️ verify | |
| Comments (list/create/delete) | ✅ organization pages, `post_id` = post URN | ⚠️ verify | |
| Analytics | ✅ organization pages only | ✅ | Personal profiles unsupported by LinkedIn itself |

---

## 3. Service #1 — Upload-Post

### 3.1 Thirty-minute setup

| # | Step | Where |
|---|---|---|
| 1 | Create an account (no credit card) | https://app.upload-post.com |
| 2 | Create a **Profile** — e.g. `mybrand`. This is the `user` param in every call and groups the connected networks | Dashboard |
| 3 | Connect the LinkedIn account to that profile | Dashboard |
| 4 | Generate an API key | Dashboard → API Keys |
| 5 | `UPLOAD_POST_API_KEY=` in `.env.local` | |
| 6 | Verify the key: `GET /api/uploadposts/me` returns email + plan | |
| 7 | If posting to a company page: `GET /api/uploadposts/linkedin/pages` → copy the `id` | |

### 3.2 Auth and base URL

```
Base URL:  https://api.upload-post.com/api
Header:    Authorization: Apikey YOUR_API_KEY
```
Note it is `Apikey`, **not** `Bearer`. This is the single most common first-attempt 401.

### 3.3 Endpoints used for LinkedIn

| Purpose | Endpoint |
|---|---|
| Text-only post | `POST /api/upload_text` |
| Image(s) | `POST /api/upload_photos` |
| Video | `POST /api/upload` |
| Document (PDF carousel) | `POST /api/upload_document` |
| List company pages | `GET /api/uploadposts/linkedin/pages` |
| Async job status | `GET /api/uploadposts/status?request_id=…` |
| Retry failed platforms | `POST /api/uploadposts/retry` |
| Unpublish | `POST /api/uploadposts/unpublish` |
| Validate key | `GET /api/uploadposts/me` |

### 3.4 LinkedIn parameters — complete

| Param | Type | Required | Notes |
|---|---|---|---|
| `user` | string | ✅ | Your Upload-Post **profile name**, not a LinkedIn username |
| `platform[]` | array | ✅ | `["linkedin"]` |
| `title` | string | conditional | Fallback title/caption |
| `linkedin_title` | string | — | Platform-specific headline. Overrides `title` |
| `linkedin_description` / `description` | string | — | **The actual post commentary.** If omitted, `title` is reused |
| `visibility` | string | — | `PUBLIC` (default), `CONNECTIONS`, `LOGGED_IN`, `CONTAINER` |
| `target_linkedin_page_id` | string | — | Numeric org id. Omit → posts to the personal profile |
| `first_comment` | string | — | Auto-posts a first comment after publishing |
| `linkedin_first_comment` | string | — | Platform-specific override; takes priority |
| `scheduled_date` | ISO-8601 | — | Must be future, ≤ 365 days |
| `timezone` | IANA | — | e.g. `Asia/Dubai`. Defaults to UTC |
| `add_to_queue` | bool | — | Mutually exclusive with `scheduled_date` |
| `async_upload` | bool | — | Returns `request_id` immediately |
| `request_id` | string | — | Client-provided; also settable as `X-Request-Id` header |
| `photos[]` | file/URL[] | for images | Files **or** URL strings |
| `video` | file/URL | for video | |
| `document` | file/URL | for documents | PDF/PPT/PPTX/DOC/DOCX |

**Visibility semantics** (from the vendor's LinkedIn guide):

| Value | Who sees it |
|---|---|
| `PUBLIC` | Anyone on LinkedIn. Default |
| `LOGGED_IN` | LinkedIn members only — keeps it out of search engines |
| `CONNECTIONS` | 1st-degree connections. For company pages this behaves as followers-only |

Full guide: https://www.upload-post.com/how-to/post-to-linkedin-api/

### 3.5 Adapter

`lib/social/upload-post/adapter.ts`
```ts
import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { uploadPostFetch } from "./client";
import { readStorageObject } from "@/lib/media/fromStorage";
import { SocialPublishError } from "@/lib/social/errors";
import type { PublishAdapter, PublishInput, PublishResult, Provider } from "@/lib/social/types";

type UploadPostResponse = {
  success: boolean;
  request_id?: string;
  job_id?: string;
  results?: Array<{ platform: string; success: boolean; post_url?: string; platform_post_id?: string }>;
};

/** Appends a media item to FormData as bytes (private Storage) or as a URL string. */
async function appendMedia(fd: FormData, field: string, m: PublishInput["media"][number]) {
  if (m.storagePath) {
    const { buffer, contentType, filename } = await readStorageObject(m.storagePath);
    fd.append(field, new Blob([buffer], { type: contentType }), filename);
  } else if (m.publicUrl) {
    fd.append(field, m.publicUrl);
  } else {
    throw new SocialPublishError(
      { code: "VALIDATION", message: "Media item has neither storagePath nor publicUrl", retryable: false },
    );
  }
}

export const uploadPostAdapter: PublishAdapter = {
  vendor: "upload_post",

  async publish(provider: Provider, input: PublishInput): Promise<PublishResult> {
    const acct = (await adminDb.collection("socialAccounts").doc(input.accountId).get()).data();
    if (!acct) throw new Error(`Unknown account ${input.accountId}`);

    const fd = new FormData();
    fd.append("user", acct.uploadPostProfile);
    fd.append("platform[]", provider);
    fd.append("async_upload", "true");
    if (input.scheduledFor) {
      fd.append("scheduled_date", input.scheduledFor.toISOString());
      fd.append("timezone", "UTC");
    }

    // ---- LinkedIn ----
    if (provider === "linkedin") {
      if (input.text.length > 3000) {
        throw new SocialPublishError(
          { code: "VALIDATION", message: "LinkedIn caps commentary at 3000 characters", retryable: false },
        );
      }
      fd.append("linkedin_description", input.text);
      fd.append("title", input.text.slice(0, 200));
      fd.append("visibility", (input.options?.visibility as string) ?? "PUBLIC");
      if (acct.linkedinPageId) fd.append("target_linkedin_page_id", acct.linkedinPageId);
      const fc = input.options?.firstComment as string | undefined;
      if (fc) fd.append("linkedin_first_comment", fc);
    }

    // ---- Facebook: see 02-FACEBOOK.md §3.5 ----
    // ---- Instagram: see 03-INSTAGRAM.md §3.5 ----

    // Route to the correct endpoint by media shape
    const videos = input.media.filter((m) => m.kind === "video");
    const images = input.media.filter((m) => m.kind === "image");
    const docs = input.media.filter((m) => m.kind === "document");

    let path: string;
    if (docs.length === 1 && provider === "linkedin") {
      path = "/upload_document";
      await appendMedia(fd, "document", docs[0]);
    } else if (videos.length === 1) {
      path = "/upload";
      await appendMedia(fd, "video", videos[0]);
    } else if (images.length > 0) {
      path = "/upload_photos";
      for (const m of images) await appendMedia(fd, "photos[]", m);
    } else {
      path = "/upload_text";
    }

    const res = await uploadPostFetch<UploadPostResponse>(path, {
      method: "POST",
      body: fd,
      idempotencyKey: input.idempotencyKey,
    });

    if (res.request_id) return { pendingRequestId: res.request_id };

    const hit = res.results?.find((r) => r.platform === provider);
    return { providerPostId: hit?.platform_post_id, permalink: hit?.post_url };
  },

  async checkStatus(requestId: string) {
    const s = await uploadPostFetch<any>(
      `/uploadposts/status?request_id=${encodeURIComponent(requestId)}`,
    );
    const results: any[] = s.results ?? s.platforms ?? [];
    const done = results.length > 0 && results.every((r) => r.success !== undefined);
    const li = results.find((r) => r.platform === "linkedin");
    return { done, providerPostId: li?.platform_post_id, permalink: li?.post_url };
  },

  async delete(provider, providerPostId, accountId) {
    const acct = (await adminDb.collection("socialAccounts").doc(accountId).get()).data()!;
    await uploadPostFetch("/uploadposts/unpublish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: provider, user: acct.uploadPostProfile, post_id: providerPostId }),
    });
  },
};
```

### 3.6 Resolving the company page ID

```ts
// GET /api/uploadposts/linkedin/pages?profile=mybrand
type LinkedInPage = {
  id: string;           // organization URN — use as target_linkedin_page_id
  name: string;
  picture: string | null;
  account_id: string;
  vanityName: string | null;
};

export async function listLinkedInPages(profile: string) {
  return uploadPostFetch<{ pages: LinkedInPage[] }>(
    `/uploadposts/linkedin/pages?profile=${encodeURIComponent(profile)}`,
  );
}
```
Persist the chosen `id` to `socialAccounts.linkedinPageId`. Omitting it posts to the personal profile.

### 3.7 Limits

| Limit | Value |
|---|---|
| Uploads per connected LinkedIn account | **150 per rolling 24 hours**, all content types combined |
| Commentary | 3,000 characters |
| Video | up to 5 GB, 10 minutes |
| Document | 100 MB, 300 pages |
| Free plan | 10 uploads/month |

---

## 4. Service #2 — Post for Me

### 4.1 Thirty-minute setup

| # | Step |
|---|---|
| 1 | Sign up at https://app.postforme.dev (paid from day one — $10/mo) |
| 2 | Create a **Quickstart Project** (managed credentials, no platform approval) |
| 3 | Copy the API key |
| 4 | Generate a LinkedIn auth URL (§4.3), open it, authorize |
| 5 | Capture `accountIds` from the redirect and store as `postForMeAccountId` |
| 6 | Publish |

### 4.2 The connection-type rule — read before coding

LinkedIn is the only platform here where Post for Me forces a choice, and getting it wrong silently
limits you to personal profiles.

| `connection_type` | Underlying LinkedIn API | Can connect |
|---|---|---|
| `organization` | Community Management API | **Both** personal profiles and company pages |
| `personal` | Sign In with OpenID Connect | Personal profiles **only** |

> **Quickstart projects must always use `organization`, even when connecting a personal profile.**
> If omitted, the API defaults to `personal` — and you lose company pages without an obvious error.

`personal` exists for White Label projects that do not need company pages, because OpenID Connect
avoids LinkedIn's approval process and business verification.
Reference: https://www.postforme.dev/resources/understanding-linkedin-connection-types

### 4.3 Generating the auth URL

```ts
// app/api/social/connect/linkedin/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { pfmFetch } from "@/lib/social/post-for-me/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { url } = await pfmFetch<{ url: string }>("/social-accounts/auth-url", {
    method: "POST",
    body: JSON.stringify({
      platform: "linkedin",
      platform_data: {
        linkedin: { connection_type: "organization" }, // MUST be "organization" on Quickstart
      },
    }),
  });
  return NextResponse.redirect(url);
}
```

> **Do not cache or reuse auth URLs.** They have no set expiry, but the vendor's guidance is to
> generate a fresh one at the moment the user clicks Connect.

### 4.4 Handling the redirect

The user is returned to your configured callback **whether or not the connection succeeded**, with
these query parameters appended: `provider`, `projectId`, `isSuccess`, `accountIds`,
`failedAccountIds`, `error`.

```ts
// app/api/social/connect/linkedin/callback/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const uid = await requireUser();
  const p = new URL(req.url).searchParams;

  if (p.get("isSuccess") !== "true") {
    const reason = encodeURIComponent(p.get("error") ?? "unknown");
    return NextResponse.redirect(`${process.env.APP_BASE_URL}/settings?error=${reason}`);
  }

  for (const id of (p.get("accountIds") ?? "").split(",").filter(Boolean)) {
    await adminDb.collection("socialAccounts").doc(`linkedin:${id}`).set({
      ownerUid: uid,
      provider: "linkedin",
      vendor: "post_for_me",
      postForMeAccountId: id,
      displayName: "LinkedIn",
      status: "active",
      connectedAt: FieldValue.serverTimestamp(),
      lastVerifiedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return NextResponse.redirect(`${process.env.APP_BASE_URL}/settings?connected=linkedin`);
}
```

> **Failures never reach the webhook.** The `social.account.created` webhook fires *only* on
> success. Connection failures and cancellations must be read from `isSuccess` and `error` on the
> redirect. If a user clicks Connect and never returns, treat prolonged inactivity as abandonment.
> Reference: https://www.postforme.dev/resources/handling-account-connection-redirects-and-webhooks

### 4.5 Publishing

```ts
import "server-only";
import { pfmFetch } from "./client";
import { adminDb } from "@/lib/firebase/admin";
import type { PublishAdapter, PublishInput, PublishResult, Provider } from "@/lib/social/types";

export const postForMeAdapter: PublishAdapter = {
  vendor: "post_for_me",

  async publish(provider: Provider, input: PublishInput): Promise<PublishResult> {
    const acct = (await adminDb.collection("socialAccounts").doc(input.accountId).get()).data()!;

    const body: Record<string, unknown> = {
      caption: input.text,
      social_accounts: [acct.postForMeAccountId],
      media: input.media
        .filter((m) => m.publicUrl)
        .map((m) => ({ url: m.publicUrl })),
      ...(input.scheduledFor ? { scheduled_at: input.scheduledFor.toISOString() } : {}),
      ...(input.options?.platformConfigurations
        ? { platform_configurations: input.options.platformConfigurations }
        : {}),
    };

    const res = await pfmFetch<{ id: string }>("/social-posts", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { pendingRequestId: res.id };
  },
};
```

**Media without a public URL.** Stage it first:
```ts
const { upload_url, media_url } = await pfmFetch<{ upload_url: string; media_url: string }>(
  "/media/create-upload-url", { method: "POST", body: JSON.stringify({}) },
);
await fetch(upload_url, { method: "PUT", body: buffer });
// then use { url: media_url } in media[]
```
Upload immediately — `upload_url` is short-lived.

**Configuration cascade** (most specific wins, like CSS):
`account_configurations` → `platform_configurations` → base post.
Reference: https://www.postforme.dev/resources/advanced-posting-configurations

---

## 5. Firestore shape for LinkedIn

```ts
// socialAccounts/{accountId}
{
  provider: "linkedin",
  vendor: "upload_post",
  uploadPostProfile: "mybrand",
  linkedinPageId: "107579166",   // omit → personal profile
  displayName: "Acme Inc",
  status: "active",
}
```

---

## 6. Errors

| HTTP | Cause | Action |
|---|---|---|
| `401` | Wrong auth scheme — `Bearer` instead of `Apikey` (Upload-Post), or bad key | Fix header. Not retryable |
| `400` | Missing `user`, missing `platform[]`, past `scheduled_date`, invalid media | Fix input |
| `403` | Connected account lacks a scope, or is not an admin of `target_linkedin_page_id` | User must reconnect or be granted page admin |
| `404` | Profile or job not found | Check the profile name matches the dashboard exactly |
| `409` | Nothing to retry — no failed platforms | Ignore |
| `429` | Daily cap (150/24h per LinkedIn account) or plan quota | Requeue for tomorrow |

**Retry cheaply.** `POST /api/uploadposts/retry` with `request_id` or `job_id` re-enqueues **only
the platforms that failed** and reuses the stored media snapshot — you do not resend the file.
Reference: https://docs.upload-post.com/api/post-actions/

---

## 7. Testing checklist

- [ ] `GET /api/uploadposts/me` returns your email and plan (key valid)
- [ ] Text-only post appears on the personal profile
- [ ] 3,001-character post is rejected client-side before an API call is spent
- [ ] Single image post publishes with commentary
- [ ] 4-image post publishes in the correct order
- [ ] Video publishes and plays
- [ ] PDF publishes as a native LinkedIn document carousel
- [ ] `target_linkedin_page_id` posts to the company page, not the personal profile
- [ ] `visibility=CONNECTIONS` is respected
- [ ] `linkedin_first_comment` appears as the first comment
- [ ] Same `Idempotency-Key` sent twice creates **one** post
- [ ] `async_upload=true` returns `request_id`; the status cron completes the record
- [ ] A failed platform can be retried without re-uploading media
- [ ] Scheduled post fires at the right wall-clock time in your `timezone`
- [ ] UI does **not** offer "edit published post" (LinkedIn has no such endpoint)

---

## 8. VERIFY BEFORE CODING

| # | Item | Where |
|---|---|---|
| L1 | Exact multipart field names (`photos[]`, `platform[]`, `document`) | https://docs.upload-post.com/llm.txt |
| L2 | `GET /api/uploadposts/status` response shape — log one real response | same |
| L3 | Whether Post for Me supports LinkedIn `visibility` and `first_comment` | https://api.postforme.dev/docs |
| L4 | Current LinkedIn daily upload cap (150/24h at time of writing) | https://www.upload-post.com/how-to/post-to-linkedin-api/ |
| L5 | Post for Me LinkedIn delete support | https://api.postforme.dev/docs |

**If a vendor doc contradicts this file, the vendor doc wins.** Update this file in the same PR.
