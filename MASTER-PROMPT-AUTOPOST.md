# MASTER PROMPT — Auto-Post Pane

Paste everything below into Devin as a single task.

---

## 0. Mission

Add a third pane, **Auto-Post**, to the Altitut Social Media Command Center. It is a beautiful,
guided publishing console that takes a video (or images), lets the operator write per-platform
copy — with a **Generate with AI** button on every text field — and publishes to **LinkedIn,
Facebook and Instagram** through a single unified API. Every publish is persisted to Firestore and
its live status is shown in a history list.

This feature is **functionally independent** of the two existing panes (Competitors Analysis,
Content Creation). They are context for style and conventions only. Do not modify their behaviour.

**Definition of done:** an operator opens the Auto-Post tab, drags in an MP4, clicks
*Generate with AI*, reviews three platform-tailored captions, hits Publish, watches a live step
tracker, and sees the post appear in history with clickable permalinks — with zero LinkedIn or
Meta developer-app setup anywhere in the process.

---

## 1. Read these first, in this order

Four documents ship with this task. They are the **primary reference**. External research is the
secondary reference. If a live vendor doc contradicts them, the vendor doc wins and you must update
the markdown file in the same PR.

| # | File | What it gives you |
|---|---|---|
| 1 | `00-SHARED-FOUNDATION.md` | Vendor choice + rationale, env vars, Firestore schema, the media architecture, the adapter interface, error taxonomy, reference links |
| 2 | `01-LINKEDIN.md` | LinkedIn params, personal vs company page, 3,000-char limit, no-edit / no-schedule constraints |
| 3 | `02-FACEBOOK.md` | Pages-only constraint, mandatory `facebook_page_id`, Reels/Stories placement |
| 4 | `03-INSTAGRAM.md` | Professional-account requirement, no-delete constraint, Reels 9:16 / 5–90s eligibility trap, 2,200-char cap |

Also read the repo's own `AGENTS.md`, `resources/DESIGN_GUIDE.md` and
`resources/DESIGN_GUIDE_P2.md` before writing any UI.

---

## 2. Non-negotiable facts about the existing codebase

You are extending a real, working app. Match it exactly. Verified 2026-07-23.

| Fact | Consequence |
|---|---|
| Firebase **client** SDK only (`firebase/firestore`), exported as `db` from `lib/firebase.ts`. Rules are open. Used from browser *and* API routes | **Never add `firebase-admin`.** No service account, no `FIREBASE_PRIVATE_KEY`, no `server-only` guards on Firestore access |
| No auth layer | Records are dashboard-global. **Do not add `ownerUid`** |
| Firestore rejects `undefined` | Copy the `JSON.parse(JSON.stringify(x))` sanitize from `lib/packs.ts` before every `setDoc` |
| Imports are **relative** (`../../lib/firebase`) | A `@/*` alias exists in `tsconfig.json` but is unused. Match the existing relative style |
| Long jobs use a **client-driven step loop** (`app/api/scout/route.ts` + `app/components/scout-dialog.tsx`): the client POSTs `{ step, state }` repeatedly and each call returns the next `state` | Reuse this pattern verbatim for publishing. It is how this codebase dodges serverless timeouts |
| API routes declare `export const runtime = "nodejs"` and `export const maxDuration = 300` | Do the same |
| OpenAI is accessed through `lib/openai.ts` → `getOpenAI()`, `CHAT_MODEL`, `completeJson<T>()` | **Do not instantiate `new OpenAI()` anywhere.** Reuse `completeJson`, which already does JSON-mode + one repair retry |
| Brand context lives in `lib/altitut.ts` → `ALTITUT_CHAT_CONTEXT`, `DEFAULT_ALTITUT_DESCRIPTION` | Feed this into the caption generator so copy sounds like Altitut |
| Tailwind tokens in `tailwind.config.js`; utilities in `app/globals.css` | Use `deep-teal`, `maroon`, `bright-coral`, `shadow-modern`, `hover-lift`, `animate-fade-in-up`, `scrollbar-modern`, `font-display`. Do **not** introduce new colours |
| No test suite | Do not scaffold one. Verify by running `npm run dev` and exercising the UI |

---

## 3. Vendor decision — already made, do not re-litigate

Use **Upload-Post** (`https://api.upload-post.com/api`).

It is the only option that clears the real constraint: **working auto-post with no LinkedIn
developer app and no Meta App Review.** It ships managed credentials, a free tier (10 uploads/month,
no credit card), ~13 platforms, native scheduling, built-in idempotency, and accepts media by URL.

Build behind the `PublishAdapter` interface in `00-SHARED-FOUNDATION.md §7` so Post for Me can be
swapped in later via the `SOCIAL_PROVIDER` env var. Implement the Upload-Post adapter now; leave
`post-for-me/adapter.ts` as a documented stub that throws `NOT_IMPLEMENTED`.

**Authoritative API reference:** `https://docs.upload-post.com/llm.txt` — the entire Upload-Post API
as one file. **Fetch and read it before writing the client.** Field names in the docs supplied here
were transcribed from it, but that file is the source of truth.

Auth header is `Authorization: Apikey <key>` — **not** `Bearer`. This is the most common first-run
401.

---

## 4. Architecture — get this right or nothing works

### 4.1 The constraint

Vercel caps Route Handler request bodies at roughly **4.5 MB**. A video exceeds that. The browser
therefore must never POST the file to your own API.

### 4.2 The flow

```
1  Browser  ──uploadBytesResumable()──►  Firebase Storage      (direct; no size cap; free % progress)
2  Browser  ──getDownloadURL()────────►  https://firebasestorage.googleapis.com/…?alt=media&token=…
3  Browser  ──POST /api/autopost { step:"publish", state:{ mediaUrl, … } }──►  Route Handler
4  Route    ──POST /api/upload (URL mode) + Idempotency-Key──►  Upload-Post
5  Upload-Post ──►  LinkedIn · Facebook Page · Instagram
6  Browser  ──POST /api/autopost { step:"poll", state:{ requestId } }──►  status until terminal
7  Route    ──setDoc()──►  Firestore `socialPosts`
```

`getDownloadURL()` returns a permanent HTTPS URL that serves raw bytes with the right
`Content-Type`, needs **no `Authorization` header** (the `token` query param is the credential),
and does not redirect. That is exactly the contract Upload-Post and Meta require. **Do not use
`getBytes()`. Do not build signed URLs. Do not proxy the file through your API.**

### 4.3 First-run trap

Firebase **Storage** rules are separate from Firestore rules and default to authenticated-only.
Firestore is already open on this project; Storage is not. Uploads will fail with
`storage/unauthorized` until the rules are opened.

Add this to `SETUP_NEEDED_FROM_YOU.md` and surface a friendly in-UI error when the code is
`storage/unauthorized`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /autopost/{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

---

## 5. Files to create

```
app/components/
  autopost-panel.tsx          # the pane: composer + history
  autopost-composer.tsx       # upload → targets → copy → review → publish
  autopost-history.tsx        # past posts + live status + permalinks
  media-dropzone.tsx          # drag/drop + preview + progress ring
  platform-copy-card.tsx      # one per platform, with Generate with AI
app/api/autopost/
  route.ts                    # step-driven publish (mirrors app/api/scout/route.ts)
  caption/route.ts            # OpenAI caption generation
lib/
  storage.ts                  # client-side Firebase Storage upload with progress
  social-posts.ts             # Firestore CRUD (mirrors lib/packs.ts)
  social/
    types.ts                  # PublishAdapter, PublishInput, PublishResult
    errors.ts                 # SocialPublishError, backoffMs
    registry.ts               # SOCIAL_PROVIDER switch
    upload-post/client.ts     # fetch wrapper, Apikey auth
    upload-post/adapter.ts    # the real implementation
    post-for-me/adapter.ts    # documented stub
  caption.ts                  # prompt construction + validation for AI copy
```

## 6. Files to modify

| File | Change |
|---|---|
| `app/page.tsx` | Add `"Auto-Post"` to the `TABS` array; add the subtitle case; render `<AutoPostPanel />`. Keep the existing `RunCompetitorScout` header button scoped to the Competitors tab only |
| `lib/firebase.ts` | Add `socialPosts: "socialPosts"` to `COLLECTIONS` |
| `.env.example` | Add the vars from `00-SHARED-FOUNDATION.md §4` |
| `SETUP_NEEDED_FROM_YOU.md` | New section: create an Upload-Post account, connect LinkedIn/Facebook/Instagram, create a profile, copy the API key, open Storage rules |
| `AGENTS.md` | Add an **Auto-Post** bullet to the "Feature map" section, matching the existing bullet style |
| `package.json` | No new deps required. `firebase` already includes `firebase/storage` |

**Do not add any npm dependency** unless you can justify it. `firebase`, `openai`, `react-markdown`
are all present.

---

## 7. The composer UX — build this, not a plain form

The user was explicit: *"much more beautiful and aesthetic than a normal simple-ass form."* A
vertical stack of grey inputs is a failed deliverable.

### 7.1 Structure — a four-step horizontal stepper

```
① Media  ──  ② Destinations  ──  ③ Copy  ──  ④ Review & Publish
```

Numbered pills connected by a rule that fills `deep-teal` as steps complete. Completed steps show a
check and are clickable to go back. The active step's content animates in with `animate-fade-in-up`.
Do not render all four steps at once as one long scroll.

### 7.2 Step ① — Media

A large dashed-border dropzone, `rounded-xl`, that turns `border-deep-teal bg-teal-50` on drag-over.
Accepts drag-drop **and** click-to-browse.

On drop:
- Video → `<video>` element with `controls`, `muted`, `playsInline`, poster from the first frame
- Images → thumbnail grid, max 10, reorderable
- Read `videoWidth`/`videoHeight`/`duration` client-side and **store them** — §7.5 depends on it
- Upload begins immediately; show a circular progress ring over the preview with the live percentage
- On success show a small teal check and the file size

Reject before upload, with a clear inline message:
- Non-`video/*` and non-`image/*` files
- More than 10 images
- Mixed images + video in one post

### 7.3 Step ② — Destinations

Three selectable cards, not checkboxes. Each shows the platform mark, the connected account name,
and a live state. Selected = `border-deep-teal ring-2 ring-teal-500/30 shadow-modern`, unselected =
`border-gray-200 hover:border-gray-300 hover-lift`.

Each card carries a **placement** segmented control, shown only when relevant:

| Platform | Placements | Notes |
|---|---|---|
| LinkedIn | Feed | Plus a visibility select: `PUBLIC` / `CONNECTIONS` / `LOGGED_IN` |
| Facebook | Feed · Reel · Story | Reel/Story only when the media is a video |
| Instagram | Feed · Reel · Story | Reel/Story only when the media is a video |

Facebook and Instagram cards must show a permanent, quiet caption of their hard constraints —
"Publishes to a Page, not a personal profile" and "Requires a Professional account" — so the
operator is never confused by a platform rule.

### 7.4 Step ③ — Copy

One `PlatformCopyCard` per selected platform, each with the platform accent, a character counter
that turns `bright-coral` past the limit, and a **Generate with AI** button (§8).

| Platform | Fields | Limit |
|---|---|---|
| LinkedIn | Commentary (textarea), First comment (optional) | 3,000 |
| Facebook | Caption, First comment (optional) | — |
| Instagram | Caption, First comment (optional, hint: "put hashtags here to keep the caption clean") | 2,200 |

Add a **"Same copy everywhere"** toggle at the top. When on, one editor drives all platforms. When
off, per-platform editors with independent AI generation. Default: on.

### 7.5 The Reels eligibility warning — the highest-value detail in this build

A video outside 9:16 aspect or outside 5–90 seconds **publishes successfully and then silently does
not appear in the Reels tab.** There is no error to catch afterward.

Implement `lib/social/reels.ts`:

```ts
export function reelsTabEligible(m: { width?: number; height?: number; durationSec?: number }) {
  if (!m.width || !m.height || !m.durationSec) return { eligible: true, reason: "unknown" as const };
  const ar = m.width / m.height;
  const is916 = Math.abs(ar - 9 / 16) < 0.02;
  const inRange = m.durationSec >= 5 && m.durationSec <= 90;
  return {
    eligible: is916 && inRange,
    reason: !is916 ? "aspect ratio is not 9:16" : !inRange ? "duration is outside 5–90s" : "ok",
  };
}
```

When the operator picks Reel placement and the check fails, show an **amber, non-blocking** banner
on that card: *"This video will publish, but it won't appear in the Reels tab — {reason}."* Never
block the publish; just make sure they chose it knowingly.

### 7.6 Step ④ — Review & Publish

A side-by-side summary: media thumbnail on the left, a per-platform list on the right showing final
copy, placement and visibility. A **Schedule** toggle reveals a datetime picker and an IANA timezone
select (default `Asia/Dubai`, since the team is Dubai-based).

The Publish button is `bg-maroon hover:bg-maroon-dark` to match `RunCompetitorScout`. Disabled until
media is uploaded, ≥1 platform is selected, and every selected platform has non-empty copy within
its limit.

### 7.7 Publishing progress

Reuse the `StepIndicator` visual language from `scout-dialog.tsx` exactly — the four statuses
(`pending` hollow ring / `running` pulsing amber dot with glow / `done` green check / `error` red
`!`) and the retry-from-failed-step affordance.

Steps: `Validating` → `Submitting to LinkedIn/Facebook/Instagram` → `Processing` → `Published`.

On completion, show each platform's result with a permalink. **Partial success is normal** — render
LinkedIn success and Instagram failure side by side, never a single global "failed".

---

## 8. Generate with AI

### 8.1 Route

`app/api/autopost/caption/route.ts`, `runtime = "nodejs"`, `maxDuration = 300`.

Request:
```ts
{
  platforms: ("linkedin" | "facebook" | "instagram")[];
  mediaKind: "video" | "image";
  brief: string;              // operator's rough description of the video
  tone?: "professional" | "punchy" | "playful" | "educational";
  existingCopy?: Partial<Record<Platform, string>>;  // set when refining
  mode: "generate" | "refine" | "shorten";
}
```

Response:
```ts
{ captions: Record<Platform, { caption: string; firstComment: string; hashtags: string[] }> }
```

### 8.2 Implementation

Use `completeJson<T>` from `lib/openai.ts`. Do **not** call the OpenAI SDK directly.

```ts
import { completeJson } from "../../../../lib/openai";
import { ALTITUT_CHAT_CONTEXT } from "../../../../lib/altitut";
```

System prompt must include:
- `ALTITUT_CHAT_CONTEXT` verbatim, so the copy knows the audience is students, early founders and
  instructors
- Per-platform voice rules:
  - **LinkedIn** — professional, first-person, insight-led. Hook in line one. Line breaks between
    short paragraphs. Max 3,000 chars. At most 3 hashtags, at the end. No emoji spam.
  - **Facebook** — warm and conversational, community-oriented. Shorter than LinkedIn. Light emoji.
  - **Instagram** — punchy, hook in the first 125 chars (the pre-"more" cut). Max 2,200 chars.
    Hashtags go in `firstComment`, **never** in the caption.
- Hard rule: return **only** the JSON object matching the schema.

Pass a `validate` callback to `completeJson` that enforces the character limits and coerces missing
fields to `""` rather than throwing.

### 8.3 UX

- Button sits top-right of each `PlatformCopyCard`: a sparkle icon + "Generate with AI", styled
  `border border-deep-teal/30 text-deep-teal hover:bg-teal-50`.
- First click with an empty brief opens a small inline popover: *"What's this video about?"* with a
  one-line input and a tone selector. Subsequent clicks reuse the stored brief.
- While generating: swap the label to "Writing…" and apply the existing `.shimmer` utility to the
  textarea. Never block the whole form.
- Generating with existing text present sends `mode: "refine"` and shows **Keep original / Use new**
  before overwriting. Never silently destroy typed copy.
- Also expose **Shorten** and **Punch it up** as small secondary actions once copy exists.
- If `OPENAI_API_KEY` is missing, disable the button with a tooltip rather than throwing.

---

## 9. The publish route

`app/api/autopost/route.ts` — mirror `app/api/scout/route.ts` structurally.

```ts
export const runtime = "nodejs";
export const maxDuration = 300;

export type AutoPostStepId = "validate" | "publish" | "poll" | "save";
```

Body is `{ step, state }`; each step returns `{ state: nextState }`; the client loops. Errors return
`{ error }` with the right HTTP status and the client marks that step `error` and offers retry.

### 9.1 `validate`
Server-side re-check of limits (3,000 LinkedIn / 2,200 Instagram, ≤10 images, media URL present and
reachable). Never trust the client.

### 9.2 `publish`

Build `FormData` and POST to Upload-Post. Endpoint selection:

| Media | Endpoint |
|---|---|
| Video | `POST /api/upload` |
| Image(s) | `POST /api/upload_photos` |
| None | `POST /api/upload_text` — **LinkedIn and Facebook only. Instagram cannot post text-only.** |

Always set:
```
Authorization: Apikey <UPLOAD_POST_API_KEY>
Idempotency-Key: <postId>
```
```
user            = UPLOAD_POST_PROFILE
platform[]      = one entry per selected platform
async_upload    = true
scheduled_date  = ISO-8601   (only when scheduling)
timezone        = IANA       (only when scheduling)
```

Do **not** set `Content-Type` manually when the body is `FormData` — `fetch` must set the multipart
boundary itself.

Per-platform params — cross-check every name against `https://docs.upload-post.com/llm.txt`:

| Platform | Params |
|---|---|
| LinkedIn | `linkedin_description` (the actual post text), `linkedin_title`, `visibility`, `target_linkedin_page_id` (omit → personal profile), `linkedin_first_comment` |
| Facebook | `facebook_page_id` (**required — always send explicitly**), `facebook_title`, `facebook_media_type` (`POSTS` \| `STORIES`), `facebook_first_comment` |
| Instagram | `instagram_title`, `media_type` (`IMAGE` \| `REELS` \| `STORIES`), `instagram_first_comment` |

Store the returned `request_id` in `state`.

> **Facebook Page ID.** Connecting Facebook does not choose a destination Page. If exactly one Page
> is connected it is auto-selected; with two or more the API returns an error carrying an
> `available_pages` list. Resolve the ID once at setup via
> `GET /api/uploadposts/facebook/pages?profile=<profile>`, persist it, and always send it. Relying
> on auto-select is a latent bug that appears the day a second Page is connected.

### 9.3 `poll`
`GET /api/uploadposts/status?request_id=…`. Return `{ done, results }`. The client calls this step
repeatedly with ~3s spacing.

> **Log one real status response and adapt the parser.** The exact shape is not fully specified in
> the public docs. Write the parser defensively (`s.results ?? s.platforms ?? []`) and leave a
> comment marking it as verified-against-live-response.

### 9.4 `save`
Write to `socialPosts` via `lib/social-posts.ts`, sanitizing with the JSON round-trip.

---

## 10. Firestore

Add to `COLLECTIONS` in `lib/firebase.ts`:
```ts
socialPosts: "socialPosts",
```

`socialPosts/{postId}` — `postId` is a client-generated UUID, reused as the `Idempotency-Key`:

```ts
type SocialPost = {
  id: string;
  createdAt: string;                 // ISO
  status: "draft" | "publishing" | "published" | "partial" | "failed" | "scheduled";
  media: {
    kind: "video" | "image" | "none";
    urls: string[];                  // Firebase Storage download URLs
    storagePaths: string[];
    width?: number; height?: number; durationSec?: number; bytes?: number;
  };
  brief?: string;
  copy: Record<Platform, { caption: string; firstComment?: string }>;
  targets: Array<{
    platform: Platform;
    placement: "feed" | "reel" | "story";
    visibility?: string;             // LinkedIn only
    pageId?: string;                 // Facebook only
  }>;
  scheduledFor: string | null;
  timezone: string | null;
  vendor: "upload_post";
  vendorRequestId?: string;
  results: Array<{
    platform: Platform;
    status: "pending" | "success" | "failed";
    postUrl?: string;
    platformPostId?: string;
    error?: string;
  }>;
};
```

`lib/social-posts.ts` mirrors `lib/packs.ts` exactly: `saveSocialPost`, `listenToSocialPosts`
(`onSnapshot`, `orderBy("createdAt", "desc")`), `deleteSocialPost`.

History renders live via `onSnapshot`, same as the existing panes.

---

## 11. Platform rules to enforce in code, not just docs

These come from `01`/`02`/`03`. Each must be a real guard with a real user-facing message.

| Rule | Where enforced |
|---|---|
| **Facebook cannot post to personal profiles** — Pages only | Destination card copy + server validation. If no `facebook_page_id`, fail with a clear message |
| **Instagram requires a Professional (Business/Creator) account** | Destination card copy; surface the vendor error verbatim if it fails |
| **Instagram cannot be deleted via API** | History rows for Instagram show **no** delete button. Facebook and LinkedIn do |
| **LinkedIn has no edit endpoint** | No "edit published post" affordance anywhere |
| **Instagram has no text-only post** | Disable the Instagram card when no media is attached, with a tooltip |
| **LinkedIn 3,000 / Instagram 2,200 chars** | Live counter + disabled publish + server re-check |
| **Instagram carousel max 10** | Dropzone rejects the 11th image |
| **Reels 9:16 / 5–90s** | Amber non-blocking warning per §7.5 |
| **Instagram mixed photo+video carousels are allowed; Facebook's are not** | Reject mixed media for Facebook with an explanatory message |

---

## 12. Errors

Implement `SocialPublishError` and the classification table from `00-SHARED-FOUNDATION.md §9`.

| Condition | User-facing message |
|---|---|
| `401` from Upload-Post | "Upload-Post API key is missing or invalid. Check `UPLOAD_POST_API_KEY`." |
| `storage/unauthorized` | "Firebase Storage rules are blocking uploads. See SETUP_NEEDED_FROM_YOU.md." |
| `400` + `available_pages` | Render the returned Pages and let the operator pick one |
| `429` | "Rate limited — this will retry automatically." Back off and retry |
| Missing `OPENAI_API_KEY` | Disable Generate with AI; tooltip explains why |

Never surface a raw stack trace. Always keep the operator's typed copy on failure — losing a
carefully written caption to an API error is unacceptable.

---

## 13. Design constraints

Use **only** existing tokens. Introducing new colours is a defect.

| Use | Token |
|---|---|
| Primary action | `bg-maroon hover:bg-maroon-dark` (matches Run Competitor Scout) |
| Active/selected, links, accents | `deep-teal` `#005A6A`, `teal-50` fills |
| Warnings | amber-50/amber-700 |
| Errors, over-limit counters | `bright-coral` `#FF6B6B` |
| Success | `vivid-green` / green-100 |
| Cards | `rounded-xl bg-white shadow-modern`, `hover-lift` on interactive |
| Headings | `font-display` (Montserrat) |
| Entrances | `animate-fade-in-up` |
| Loading | `.shimmer`, `pulse-gentle` |
| Scrollable regions | `scrollbar-modern` |
| Modals | `fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-subtle` + `rounded-xl bg-white shadow-modern-lg` |

Accessibility: `role="dialog"` + `aria-modal` on modals, `aria-current` on the active step,
`aria-live="polite"` on the publish tracker, keyboard-operable dropzone, visible focus rings.

Responsive: composer stacks below `md`. History is a card list on mobile, a table above `lg`.

---

## 14. Build order

Ship in verifiable increments. Do not write all files then debug at once.

1. `lib/firebase.ts` collection + `lib/social-posts.ts` + `lib/social/types.ts` + `errors.ts`
2. `lib/storage.ts` + `media-dropzone.tsx`. **Verify a real MP4 lands in Firebase Storage and
   `getDownloadURL()` opens in a browser tab before continuing.**
3. `lib/social/upload-post/client.ts` + `adapter.ts`. Verify with a text-only LinkedIn post via curl
   first, then through the adapter.
4. `app/api/autopost/route.ts` — `validate` and `publish` steps
5. `poll` + `save`
6. `autopost-composer.tsx` steps ①–④ with the stepper
7. `app/api/autopost/caption/route.ts` + Generate with AI in `platform-copy-card.tsx`
8. `autopost-history.tsx` with `onSnapshot`
9. Wire `<AutoPostPanel />` into `app/page.tsx`
10. Reels warning, per-platform guards, error states
11. Update `.env.example`, `SETUP_NEEDED_FROM_YOU.md`, `AGENTS.md`

---

## 15. Acceptance checklist

Verify each by actually doing it.

**Setup**
- [ ] `npm run dev` compiles with zero TypeScript errors
- [ ] The two existing panes are untouched and still work
- [ ] `firebase-admin` appears nowhere in the codebase

**Media**
- [ ] 50 MB MP4 uploads with a live progress ring
- [ ] `getDownloadURL()` URL opens directly in a browser with no auth
- [ ] Width, height and duration are captured client-side
- [ ] 11th image is rejected with a clear message
- [ ] `storage/unauthorized` produces the friendly setup message

**AI**
- [ ] Generate with AI produces three distinctly voiced captions from one brief
- [ ] Instagram hashtags land in `firstComment`, not the caption
- [ ] LinkedIn output stays under 3,000; Instagram under 2,200
- [ ] Regenerating over existing copy prompts Keep / Use new
- [ ] Missing `OPENAI_API_KEY` disables the button instead of crashing

**Publishing**
- [ ] Text-only post reaches LinkedIn
- [ ] Image post reaches all three
- [ ] Video reaches all three
- [ ] 9:16 / 30s video appears in the **Reels tab**
- [ ] 16:9 video with Reel selected shows the amber warning and still publishes
- [ ] `facebook_page_id` is sent on every Facebook publish
- [ ] Instagram is disabled when no media is attached
- [ ] Publishing twice with the same `Idempotency-Key` creates **one** post
- [ ] Partial success renders per-platform, not as a global failure
- [ ] Failed step can be retried without re-uploading media

**Persistence**
- [ ] Post appears in `socialPosts` with correct `results`
- [ ] History updates live via `onSnapshot` without a refresh
- [ ] Permalinks open the real posts
- [ ] Instagram rows show no delete button; LinkedIn and Facebook do

**Scheduling**
- [ ] Scheduled post shows `scheduled` status and fires at the right wall-clock time in the chosen timezone

---

## 16. Rules of engagement

1. **Do not invent API fields.** If a param is not in `https://docs.upload-post.com/llm.txt` or the
   four supplied docs, fetch the live docs. If still unclear, implement the minimal version and
   leave a `// VERIFY:` comment.
2. **Do not add dependencies** without justification in the PR description.
3. **Do not refactor existing code.** Additive only, except the listed modifications in §6.
4. **Do not add `firebase-admin`, an auth layer, or a test framework.**
5. **Do not use `@/` imports.** Match the relative-import style.
6. **Update the markdown docs** if a vendor doc contradicts them, in the same PR.
7. **Comment the non-obvious.** Specifically: why media goes through Storage rather than the API
   route, why the step loop exists, why `getDownloadURL()` satisfies the vendor contract.
8. If a platform rule makes a requested behaviour impossible, **say so in the PR description** —
   do not silently implement a lookalike.

---

## 17. PR description must include

- What was built, file by file
- Manual verification steps run, with results
- Every `// VERIFY:` comment left, and why
- Any vendor doc that contradicted the supplied markdown, and the correction made
- Screenshots of all four composer steps and the history pane
- Anything deliberately not built, and why
