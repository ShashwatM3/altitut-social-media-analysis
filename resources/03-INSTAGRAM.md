# 03 — INSTAGRAM

**Prerequisite:** `00-SHARED-FOUNDATION.md`.
**Criterion:** working auto-post to Instagram from Next.js + Firestore **within 30 minutes**.
**Compiled:** 2026-07-23

---

## 1. Read this before anything else

> **Instagram publishing requires a Professional account — Business or Creator.**
> Personal Instagram accounts cannot publish via API on any service, ever. This is a Meta platform
> restriction. If your spec assumes users' personal Instagram accounts, **the spec is not
> buildable.** Surface this immediately.

> **Instagram cannot be deleted via API.** Neither Instagram nor TikTok exposes a public endpoint
> to delete a published post. Both vendors return a clear error if you try. **Do not build a
> "delete post" button for Instagram.** Facebook and LinkedIn support it; Instagram does not.

> **Instagram has no native scheduling and no edit endpoint.** Any scheduling you see is the vendor
> queueing on your behalf. There is no way to change a caption after publishing.

---

## 2. Recommendation

| Rank | Service | Setup time | Cost to start | Feed | Carousel | Reels | Stories | Docs |
|---|---|---|---|---|---|---|---|---|
| **#1** | **Upload-Post** | ~10 min | **Free** (10 uploads/mo, no card) | ✅ | ✅ | ✅ `media_type=REELS` | ✅ `media_type=STORIES` | https://docs.upload-post.com/llm.txt |
| **#2** | **Post for Me** | ~25 min | $10/mo | ✅ | ✅ | ✅ `placement: "reels"` | ✅ `placement: "stories"` | https://api.postforme.dev/docs |

**Post for Me wins on Instagram feature depth.** It exposes the richest Instagram surface of the
two — placement, collaborator tagging, share-to-feed control, location, trial reel type, and media
tags with coordinates — and supports **both** Instagram auth paths (Instagram Login and Facebook
Login). Choose it if Instagram is your primary platform and you need those controls.

**Upload-Post still wins on speed and cost**, and covers the common cases (feed, carousel, Reels,
Stories) plus Instagram comments, DMs, and AutoDM monitors that Post for Me does not offer.

**Why not native.** Publishing requires a Facebook account, a Facebook Business account, a Facebook
Page, an Instagram Professional account linked to that Page, a Meta developer app, and App Review
approval for content-publishing permission — **2–4 weeks per submission**. Plus the container model
(create → poll `status_code` → publish) and a hard rule that all media must sit at a public HTTPS
URL. Both vendors absorb every bit of that.

---

## 3. Service #1 — Upload-Post

### 3.1 Thirty-minute setup

| # | Step |
|---|---|
| 1 | Confirm the Instagram account is **Business or Creator** |
| 2 | Create an account at https://app.upload-post.com (no credit card) |
| 3 | Create a **Profile** — e.g. `mybrand` |
| 4 | Connect Instagram to that profile |
| 5 | Generate an API key → `UPLOAD_POST_API_KEY` |
| 6 | Publish |

Note there is **no page-ID step** for Instagram, unlike Facebook. The connected profile is the
destination.

### 3.2 Endpoints

| Purpose | Endpoint |
|---|---|
| Image / carousel | `POST /api/upload_photos` |
| Video / Reel | `POST /api/upload` |
| Async status | `GET /api/uploadposts/status?request_id=…` |
| Retry failed platforms | `POST /api/uploadposts/retry` |
| Recent media (for post pickers) | `GET /api/uploadposts/media?platform=instagram&user=…` |
| Comments | `GET /api/uploadposts/comments` |
| Public reply | `POST /api/uploadposts/comments/public-reply` |
| Private reply (DM) | `POST /api/uploadposts/comments/reply` |
| Send DM | `POST /api/uploadposts/dms/send` |
| AutoDM monitors | `POST /api/uploadposts/autodms/start` |
| Unpublish | ❌ **not supported for Instagram** |

> **Text-only posts are impossible on Instagram.** `/api/upload_text` does not list Instagram among
> its supported platforms. Instagram always requires at least one media item. Validate this
> client-side.

### 3.3 Instagram parameters

| Param | Type | Required | Notes |
|---|---|---|---|
| `user` | string | ✅ | Upload-Post profile name |
| `platform[]` | array | ✅ | `["instagram"]` |
| `title` | string | conditional | Caption fallback |
| `instagram_title` | string | — | Platform-specific caption, overrides `title` |
| `media_type` | string | — | `IMAGE` (feed), `REELS`, `STORIES` |
| `photos[]` | file/URL[] | for images | **May include videos for Instagram** — mixed carousels are supported here |
| `video` | file/URL | for video | Use `/api/upload` |
| `first_comment` | string | — | Auto first comment |
| `instagram_first_comment` | string | — | Platform-specific override. Put hashtags here to keep the caption clean |
| `scheduled_date` | ISO-8601 | — | Future, ≤365 days |
| `timezone` | IANA | — | |
| `add_to_queue` | bool | — | Mutually exclusive with `scheduled_date` |
| `async_upload` | bool | — | Returns `request_id` |

**Mixed carousels.** Instagram and Threads are the **only** platforms where you may pass videos
inside `photos[]` to build a mixed photo+video carousel. For Facebook, LinkedIn, X, TikTok and
Pinterest this errors — use `/api/upload` instead. See `02-FACEBOOK.md §3.4`.

**User tagging differs by endpoint.** On `/upload_photos`, Instagram requires x/y coordinates in a
JSON array and **silently drops username-only tags**. If tags appear to vanish, this is why.

**Trial Reels.** Available for public Instagram accounts with **1,000+ followers**. A Trial Reel is
shown only to non-followers first; to everyone else it looks like a normal Reel. Collaborators
cannot be added to Trial Reels.

### 3.4 Adapter — Instagram branch

Extend the adapter from `01-LINKEDIN.md §3.5`:

```ts
// inside uploadPostAdapter.publish()
if (provider === "instagram") {
  if (input.media.length === 0) {
    throw new SocialPublishError({
      code: "VALIDATION",
      message: "Instagram requires at least one media item — text-only posts are impossible",
      retryable: false,
    });
  }
  if (input.media.length > 10) {
    throw new SocialPublishError({
      code: "VALIDATION",
      message: "Instagram carousels cap at 10 items",
      retryable: false,
    });
  }
  if (input.text.length > 2200) {
    throw new SocialPublishError({
      code: "VALIDATION",
      message: "Instagram captions cap at 2200 characters",
      retryable: false,
    });
  }

  fd.append("instagram_title", input.text);
  fd.append("title", input.text.slice(0, 200));

  const placement = input.options?.placement as "feed" | "reels" | "stories" | undefined;
  if (placement === "reels")   fd.append("media_type", "REELS");
  if (placement === "stories") fd.append("media_type", "STORIES");

  const fc = input.options?.firstComment as string | undefined;
  if (fc) fd.append("instagram_first_comment", fc);
}
```

Add a Reels-eligibility warning — this is the highest-value validation in the whole integration:

```ts
/**
 * A video outside 9:16 / 5-90s PUBLISHES SUCCESSFULLY and then quietly does not
 * appear in the Reels tab. There is no error to catch. Warn the user beforehand.
 */
export function reelsTabEligible(m: { width?: number; height?: number; durationSec?: number }) {
  if (!m.width || !m.height || !m.durationSec) return { eligible: true, reason: "unknown" };
  const ar = m.width / m.height;
  const is916 = Math.abs(ar - 9 / 16) < 0.02;
  const inRange = m.durationSec >= 5 && m.durationSec <= 90;
  return {
    eligible: is916 && inRange,
    reason: !is916 ? "aspect ratio is not 9:16" : !inRange ? "duration outside 5–90s" : "ok",
  };
}
```

### 3.5 Instagram engagement (Upload-Post only)

Neither of these exists in Post for Me. Relevant if you want auto-engagement:

- **Comments:** `GET /api/uploadposts/comments` — Meta caps this edge at **50 per page** and returns
  newest-first with no way to change the order. Paginate with `after` while `pagination.has_next`.
- **Private replies (DMs):** only to comments **less than 7 days old**. One reply per comment.
- **AutoDM monitors:** background workers that DM commenters. Limits — 2 new monitors per profile
  per day, auto-expire after 15 days, **10 DMs/day on the free plan** and 500/day on paid, and Meta
  caps 200 DMs/hour per Instagram account.
- Requires permissions `instagram_business_manage_comments` and `instagram_business_manage_messages`.

References: https://docs.upload-post.com/api/instagram-comments/ · https://docs.upload-post.com/api/autodms/

---

## 4. Service #2 — Post for Me

### 4.1 Setup

| # | Step |
|---|---|
| 1 | Confirm the Instagram account is **Business or Creator** |
| 2 | Sign up at https://app.postforme.dev ($10/mo) |
| 3 | Create a **Quickstart Project** |
| 4 | Generate an Instagram auth URL, authorize, capture `accountIds` |
| 5 | Publish |

### 4.2 Two connection methods

Post for Me supports both Instagram auth paths, and both give access to the same publishing
features. The only difference is the login experience:

| Method | Flow | When to use |
|---|---|---|
| **Log in with Instagram** | User signs in with Instagram credentials. No Facebook involved | Simpler — fewer drop-offs |
| **Log in with Facebook** | User signs in with Facebook and selects a linked Instagram account | Users already managing Pages |

If you are **also** building Facebook (`02-FACEBOOK.md`), the Facebook login path lets one consent
flow provision both. If Instagram is standalone, the Instagram login path has less friction.

### 4.3 Instagram configuration options

Set inside `platform_configurations.instagram`:

| Option | Values | Purpose |
|---|---|---|
| `placement` | `timeline` \| `reels` \| `stories` | Where the media lands |
| `collaborators` | usernames | Tag Instagram collaborators on posts and Reels |
| `share_to_feed` | bool | Whether a Reel also appears in the main feed grid |
| `location` | geo data | Attach a location |
| `trial_reel_type` | `manual` \| `performance` | Trial Reel distribution control |
| `media_tags` | coordinate array | Tag users or products with x/y coordinates |

```ts
await pfmFetch("/social-posts", {
  method: "POST",
  body: JSON.stringify({
    caption: "Behind the scenes 🎬",
    social_accounts: [acct.postForMeAccountId],
    media: [{ url: mediaUrl, thumbnail_url: coverUrl }],
    platform_configurations: {
      instagram: {
        placement: "reels",
        share_to_feed: true,
        collaborators: ["someuser"],
      },
    },
  }),
});
```

> **Thumbnails are supported only for Facebook, Instagram, TikTok Business and YouTube.** Passing
> `thumbnail_url` for other platforms is ignored.

References:
- https://www.postforme.dev/resources/posting-reels-and-stories
- https://www.postforme.dev/resources/creating-carousels-and-multi-media-posts
- https://www.postforme.dev/resources/advanced-posting-configurations

### 4.4 Media staging without a public bucket

```ts
const { upload_url, media_url } = await pfmFetch<{ upload_url: string; media_url: string }>(
  "/media/create-upload-url", { method: "POST", body: JSON.stringify({}) },
);
await fetch(upload_url, { method: "PUT", body: buffer });
// use { url: media_url } in media[]
```
`upload_url` is short-lived — upload immediately. Their storage is ephemeral: deleted on publish,
on scheduled-post deletion, or after 24 hours if never attached.

---

## 5. Format rules — enforce at upload, not publish

Instagram is the strictest consumer of the three platforms. Both vendors transcode
non-compliant media, but validating early saves a wasted call and a confusing error.

| Asset | Rule |
|---|---|
| Image formats | Instagram accepts PNG, JPEG, GIF. **JPEG is the safest** — the underlying Meta API historically rejects PNG on some paths |
| Image aspect | between 4:5 (portrait) and 1.91:1 (landscape); 1:1 fine |
| Video | MP4, H.264 video, AAC audio |
| **Reels-tab eligibility** | **9:16 aspect, 5–90 seconds.** Outside this it publishes as a regular video with no error |
| Caption | ≤ 2,200 characters. Hashtags and @mentions work inline |
| Carousel | 2–10 items |
| Reel cover | 1080×1920 recommended. Non-9:16 covers are centre-cropped, and the profile grid crops to 1080×1080 square — make sure the centre survives |

> The Reels rule is the single highest-value item in this document. Warn the user **before** the
> call; there is nothing to catch afterwards.

Full table: https://docs.upload-post.com/api/photo-requirements/

---

## 6. Firestore shape for Instagram

```ts
// socialAccounts/{accountId}
{
  provider: "instagram",
  vendor: "upload_post",
  uploadPostProfile: "mybrand",
  instagramUserId: "17841400000000000",  // informational; not needed to publish
  displayName: "@acme",
  status: "active",
}
```

Instagram result docs never carry a delete affordance:
```ts
// posts/{postId}/results/{accountId}
{ provider: "instagram", canDelete: false }
```

---

## 7. Errors

| Cause | Symptom | Action |
|---|---|---|
| Personal (non-Professional) account | Connect fails or publish rejected | Ask the user to switch to Business/Creator |
| Text-only post attempted | `400` | Require ≥1 media item client-side |
| >10 carousel items | `400` | Cap at 10 |
| Caption >2,200 chars | `400` | Validate client-side |
| Media fetch failed | `400` | If using public URLs, confirm 200 with no auth and no redirect |
| Video not in Reels tab | **No error** | Check 9:16 and 5–90s |
| Username-only photo tags vanish | Silent | Instagram needs x/y coordinates on `/upload_photos` |
| Delete attempted | Clear error | Instagram has no delete endpoint. Remove the UI |
| `429` | Rate limited | Backoff. On free plan also check the 10-uploads/month cap |

---

## 8. Testing checklist

- [ ] Instagram account confirmed Business or Creator
- [ ] Text-only post rejected client-side with a clear message
- [ ] Single JPEG publishes with caption
- [ ] 2:1 aspect image rejected before an API call is spent
- [ ] 5-image carousel publishes in order as one post
- [ ] 11-item carousel rejected client-side
- [ ] Mixed photo+video carousel publishes (Instagram-only capability)
- [ ] 9:16 / 30s Reel appears **in the Reels tab**
- [ ] 4:3 / 120s video publishes as a regular video **and the UI warned first**
- [ ] Story publishes with `media_type=STORIES` / `placement: "stories"`
- [ ] Reel cover renders acceptably when centre-cropped to square on the profile grid
- [ ] `instagram_first_comment` carries the hashtags
- [ ] Same `Idempotency-Key` twice creates one post
- [ ] Long video returns `request_id`; the status cron completes the record
- [ ] **No delete button is exposed for Instagram anywhere in the UI**
- [ ] Scheduled post fires at the correct wall-clock time

---

## 9. VERIFY BEFORE CODING

| # | Item | Where |
|---|---|---|
| I1 | Exact `media_type` enum accepted by Upload-Post (`IMAGE` / `REELS` / `STORIES`) | https://docs.upload-post.com/llm.txt |
| I2 | Whether PNG is reliably accepted, or JPEG should be forced | https://docs.upload-post.com/api/photo-requirements/ |
| I3 | Post for Me `platform_configurations.instagram` full option list and value casing | https://api.postforme.dev/docs |
| I4 | Current Reels max duration via API (Reels-tab eligibility is the real constraint at 5–90s) | vendor docs + https://developers.facebook.com/docs/instagram-platform/content-publishing |
| I5 | Instagram daily publish cap passed through by the vendor | https://docs.upload-post.com/api/reference/ |
| I6 | Photo user-tag coordinate format on `/upload_photos` | https://docs.upload-post.com/llm.txt |

**If a vendor doc contradicts this file, the vendor doc wins.** Update this file in the same PR.
