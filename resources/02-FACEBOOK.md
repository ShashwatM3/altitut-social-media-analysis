# 02 — FACEBOOK

**Prerequisite:** `00-SHARED-FOUNDATION.md`.
**Criterion:** working auto-post to Facebook from Next.js + Firestore **within 30 minutes**.
**Compiled:** 2026-07-23

---

## 1. Read this before anything else

> **Facebook publishes to Pages only. You cannot post to a personal profile.**
> Meta removed personal-profile publishing after Cambridge Analytica (`publish_actions` deprecated
> in Graph API v3.0, 2018) and it has never returned. This is a Meta platform restriction, not a
> vendor limitation — **no service on earth can do it legitimately.** If the product spec says
> "post to the user's Facebook," confirm it means a **Page** before writing any code.

Second constraint, vendor-specific but important:
> Upload-Post notes that for correct posting, the Page should be **directly associated with the
> personal profile** rather than managed through a Business Portfolio. If a connected Page silently
> fails to publish, this is the first thing to check.

---

## 2. Recommendation

| Rank | Service | Setup time | Cost to start | Page posting | Reels | Stories | Docs |
|---|---|---|---|---|---|---|---|
| **#1** | **Upload-Post** | ~10 min | **Free** (10 uploads/mo, no card) | ✅ | ✅ | ✅ `facebook_media_type=STORIES` | https://docs.upload-post.com/llm.txt |
| **#2** | **Post for Me** | ~25 min | $10/mo | ✅ | ✅ `placement: "reels"` | ✅ `placement: "stories"` | https://api.postforme.dev/docs |

**Why not native.** The Meta Graph API is free, but publishing on behalf of Pages you do not own
requires **Advanced Access**, which requires **App Review** (2–4 weeks per submission) plus
**Business Verification** — legal entity documents, domain verification, sometimes a phone call.
Both services above have completed this at their app level.

---

## 3. Service #1 — Upload-Post

### 3.1 Thirty-minute setup

| # | Step |
|---|---|
| 1 | Create an account at https://app.upload-post.com (no credit card) |
| 2 | Create a **Profile** — e.g. `mybrand`. This is the `user` param |
| 3 | Connect Facebook to that profile |
| 4 | Generate an API key → `UPLOAD_POST_API_KEY` |
| 5 | **`GET /api/uploadposts/facebook/pages`** → copy the Page `id` |
| 6 | Store it as `socialAccounts.facebookPageId` |
| 7 | Publish |

### 3.2 The `facebook_page_id` rule

> **Connecting Facebook only links the account — it does not pick a destination Page.**
> You must select the target Page on **every** upload by passing `facebook_page_id`.

Behaviour when omitted:

| Connected Pages | Result |
|---|---|
| Exactly 1 | Auto-selected. Works |
| 2 or more | API returns an error with an `available_pages` list so you can choose |
| 0 | Error — no Pages found |

Relying on auto-select is a latent bug: it works in dev with one Page and breaks the day a user
connects a second. **Always send `facebook_page_id` explicitly.**

```ts
// GET /api/uploadposts/facebook/pages?profile=mybrand
type FacebookPage = { id: string; name: string; picture?: string; account_id: string };

export async function listFacebookPages(profile: string) {
  return uploadPostFetch<{ pages: FacebookPage[] }>(
    `/uploadposts/facebook/pages?profile=${encodeURIComponent(profile)}`,
  );
}
```
Reference: https://docs.upload-post.com/api/get-facebook-pages/

### 3.3 Endpoints

| Purpose | Endpoint |
|---|---|
| Text-only post | `POST /api/upload_text` |
| Image(s) | `POST /api/upload_photos` |
| Video / Reel | `POST /api/upload` |
| List Pages | `GET /api/uploadposts/facebook/pages` |
| Async status | `GET /api/uploadposts/status?request_id=…` |
| Retry failed platforms | `POST /api/uploadposts/retry` |
| **Unpublish** | `POST /api/uploadposts/unpublish` — **supported for Facebook** |

### 3.4 Facebook parameters — complete

| Param | Type | Required | Notes |
|---|---|---|---|
| `user` | string | ✅ | Upload-Post profile name |
| `platform[]` | array | ✅ | `["facebook"]` |
| `facebook_page_id` | string | **✅ in practice** | Target Page. See §3.2 |
| `title` | string | conditional | Fallback caption |
| `facebook_title` | string | — | Platform-specific caption, overrides `title` |
| `description` | string | — | Used as the Facebook description |
| `facebook_media_type` | string | — | `POSTS` (default) or `STORIES` |
| `first_comment` | string | — | Auto first comment |
| `facebook_first_comment` | string | — | Platform-specific override |
| `scheduled_date` | ISO-8601 | — | Future, ≤365 days |
| `timezone` | IANA | — | e.g. `Asia/Dubai` |
| `add_to_queue` | bool | — | Mutually exclusive with `scheduled_date` |
| `async_upload` | bool | — | Returns `request_id` immediately |
| `photos[]` | file/URL[] | for images | **Do not put videos here for Facebook** — use `/api/upload` |
| `video` | file/URL | for video | |

> **Caption applies to the first photo only.** On a multi-photo Facebook upload the caption is
> attached to the first image. Do not expect per-image captions.

> **Never send videos in `photos[]` for Facebook.** Mixed photo+video carousels via
> `/api/upload_photos` are supported **only for Instagram and Threads**. Sending a video there for
> Facebook returns an error.

### 3.5 Adapter — Facebook branch

Extend the adapter from `01-LINKEDIN.md §3.5`:

```ts
// inside uploadPostAdapter.publish(), after the LinkedIn branch
if (provider === "facebook") {
  if (!acct.facebookPageId) {
    throw new SocialPublishError({
      code: "VALIDATION",
      message: "facebookPageId is required — Facebook cannot post to personal profiles",
      retryable: false,
    });
  }
  fd.append("facebook_page_id", acct.facebookPageId);
  fd.append("facebook_title", input.text);
  fd.append("title", input.text.slice(0, 200));

  const placement = input.options?.placement as "posts" | "stories" | undefined;
  if (placement === "stories") fd.append("facebook_media_type", "STORIES");

  const fc = input.options?.firstComment as string | undefined;
  if (fc) fd.append("facebook_first_comment", fc);
}
```

Routing rule for Facebook specifically:
```ts
// Facebook: video MUST go to /upload, never /upload_photos
const videos = input.media.filter((m) => m.kind === "video");
const images = input.media.filter((m) => m.kind === "image");

if (provider === "facebook" && videos.length > 0 && images.length > 0) {
  throw new SocialPublishError({
    code: "VALIDATION",
    message: "Facebook does not support mixed photo+video carousels via this API",
    retryable: false,
  });
}
```

### 3.6 Deleting

Facebook is one of the platforms where unpublish works.

| Platform | Unpublish via API |
|---|---|
| Facebook | ✅ |
| LinkedIn | ✅ |
| X | ✅ |
| YouTube | ✅ |
| Threads | ✅ |
| **Instagram** | ❌ |
| **TikTok** | ❌ |

```ts
await uploadPostFetch("/uploadposts/unpublish", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ platform: "facebook", user: profile, post_id: providerPostId }),
});
```
Reference: https://docs.upload-post.com/api/post-actions/

---

## 4. Service #2 — Post for Me

### 4.1 Setup

| # | Step |
|---|---|
| 1 | Sign up at https://app.postforme.dev ($10/mo, no free tier) |
| 2 | Create a **Quickstart Project** (managed credentials) |
| 3 | Copy the API key |
| 4 | Generate a Facebook auth URL, authorize, capture `accountIds` from the redirect |
| 5 | Publish |

```ts
const { url } = await pfmFetch<{ url: string }>("/social-accounts/auth-url", {
  method: "POST",
  body: JSON.stringify({ platform: "facebook" }),
});
```
Redirect handling is identical to `01-LINKEDIN.md §4.4` — same `isSuccess` / `accountIds` /
`error` parameters, same rule that failures never reach the webhook.

### 4.2 Placement

Facebook placement is set inside `platform_configurations.facebook`:

| `placement` | Result |
|---|---|
| `timeline` | Standard feed post (default) |
| `reels` | Facebook Reel |
| `stories` | Facebook Story |

```ts
await pfmFetch("/social-posts", {
  method: "POST",
  body: JSON.stringify({
    caption: "Launch day.",
    social_accounts: [acct.postForMeAccountId],
    media: [{ url: mediaUrl }],
    platform_configurations: {
      facebook: {
        placement: "reels",
        // location tags also supported here
      },
    },
  }),
});
```

**Per-account override.** If several Facebook Pages are in one call but only one should post a
Reel, use `account_configurations` with that `social_account_id` — the others fall back to their
default placement. The cascade is `account_configurations` → `platform_configurations` → base post.

References:
- https://www.postforme.dev/resources/posting-reels-and-stories
- https://www.postforme.dev/resources/posting-instagram-and-facebook-stories
- https://www.postforme.dev/resources/advanced-posting-configurations

---

## 5. Media requirements

| Asset | Requirement |
|---|---|
| Image formats | JPEG, PNG, GIF, WebP accepted by Facebook |
| Video | MP4, H.264 + AAC |
| Reels | 9:16 for correct placement |
| Caption | Applied to the **first** photo on multi-photo posts |

Both vendors auto-transcode non-compliant media, but validating first saves a wasted call.
Full table: https://docs.upload-post.com/api/photo-requirements/

---

## 6. Firestore shape for Facebook

```ts
// socialAccounts/{accountId}
{
  provider: "facebook",
  vendor: "upload_post",
  uploadPostProfile: "mybrand",
  facebookPageId: "1234567890",   // REQUIRED — never omit
  displayName: "Acme Page",
  status: "active",
}
```

Because `facebookPageId` is mandatory, add a guard at account-creation time rather than discovering
it at publish time:

```ts
if (provider === "facebook" && !facebookPageId) {
  throw new Error("Refusing to save a Facebook account without a Page ID");
}
```

---

## 7. Errors

| HTTP | Cause | Action |
|---|---|---|
| `400` + `available_pages` | Multiple Pages connected, no `facebook_page_id` | Present the list, let the user pick, persist it |
| `400` | Video sent in `photos[]` for Facebook | Route to `/api/upload` instead |
| `401` | `Bearer` used instead of `Apikey` (Upload-Post) | Fix the header |
| `403` | Connected account is not a Page admin, or the Page sits behind a Business Portfolio | Reconnect; verify Page association |
| `404` | Profile not found | Profile name must match the dashboard exactly |
| `429` | Plan quota or Meta rate limit | Backoff, requeue |

---

## 8. Testing checklist

- [ ] Product spec confirmed to mean **Pages**, not personal profiles
- [ ] `GET /api/uploadposts/facebook/pages` returns at least one Page
- [ ] `facebook_page_id` sent explicitly on every publish
- [ ] Behaviour verified with **two** Pages connected (not just one)
- [ ] Text post publishes to the Page
- [ ] Link in text renders a preview card
- [ ] Single photo publishes with caption
- [ ] Multi-photo publishes — caption on first image is expected, not a bug
- [ ] Video publishes and plays
- [ ] Reel lands on the Reels surface, not the feed
- [ ] Story publishes with `facebook_media_type=STORIES` / `placement: "stories"`
- [ ] Mixed photo+video rejected client-side with a clear message
- [ ] Same `Idempotency-Key` twice creates one post
- [ ] Unpublish removes the live post
- [ ] Scheduled post fires at the correct wall-clock time

---

## 9. VERIFY BEFORE CODING

| # | Item | Where |
|---|---|---|
| F1 | `GET /api/uploadposts/facebook/pages` response shape | https://docs.upload-post.com/api/get-facebook-pages/ |
| F2 | Whether `facebook_media_type` accepts values beyond `POSTS` / `STORIES` (e.g. Reels) | https://docs.upload-post.com/llm.txt |
| F3 | Post for Me Facebook `placement` enum and location-tag field name | https://api.postforme.dev/docs |
| F4 | Current Facebook video size/duration ceilings | https://docs.upload-post.com/api/reference/ |

**If a vendor doc contradicts this file, the vendor doc wins.** Update this file in the same PR.
