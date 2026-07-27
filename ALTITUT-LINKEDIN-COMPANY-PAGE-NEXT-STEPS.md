# Altitut LinkedIn Company Page Posting — End-to-End Plan

Last updated: 2026-07-24  
Status: Research complete. Diagnostic run. Connection/permissions layer is the blocker, not the app code.

---

## 1. The exact question you asked

> Can I post to Altitut’s LinkedIn company page through Upload-Post, even though I am only a Content admin and the Upload-Post connection screen only showed my personal profile?

**Short answer:** Yes, Upload-Post supports LinkedIn company pages, but right now it cannot see the Altitut page for your `altitut` profile. The blocker is not the app code — it is the Upload-Post ↔ LinkedIn connection/permissions layer.

---

## 2. What is definitively true (with sources)

### 2.1 Upload-Post supports posting to LinkedIn company pages

- **API endpoint:** `GET /api/uploadposts/linkedin/pages` lists company pages associated with a connected LinkedIn account.
- **API parameter:** `target_linkedin_page_id` is accepted on `/api/upload`, `/api/upload_photos`, `/api/upload_text`, and `/api/upload_document`.
- **Official docs quote:**
  > “Retrieves a list of LinkedIn company pages associated with the authenticated user's account(s). Use the page ID for posting to LinkedIn organization pages.”  
  > — [Upload-Post Get LinkedIn Pages API](https://docs.upload-post.com/api/get-linkedin-pages)
- **Official docs quote:**
  > “By default, posts go to the personal profile of the connected LinkedIn account. To post to a company page instead, add the `target_linkedin_page_id` parameter with your organization's numeric ID.”  
  > — [How to Post to LinkedIn via API](https://www.upload-post.com/how-to/post-to-linkedin-api/)
- **Upload-Post Claude Code skill FAQ:**
  > “Can Claude Code post to a LinkedIn Company Page instead of my personal profile? Yes. When you connect your LinkedIn account through Upload-Post, you can authorize both personal profile and Company Page access.”  
  > — [Upload-Post Claude Code LinkedIn Skill](https://www.upload-post.com/skills/claude-code/linkedin)

### 2.2 LinkedIn explicitly allows Content admins to post through third-party sites

- **LinkedIn Help table row "Post content through third-party sites" has checkmarks for both `Super admin` and `Content admin`.**  
  — [LinkedIn Page admin roles permissions](https://www.linkedin.com/help/linkedin/answer/a550647)
- **Microsoft Learn lists `CONTENT_ADMIN` as an acceptable role for the `w_organization_social` scope** (the scope required to post on behalf of an organization).  
  — [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)

### 2.3 The live diagnostic for your `altitut` profile failed

Devin ran:

```bash
cd /Users/gobus/Desktop/main/projects/internship/altitut/ALTITUT-SOCIAL-MEDIA-ANALYSIS
npx tsx --tsconfig tsconfig.test.json scripts/diag-linkedin-pages.ts
```

This script calls:

```
GET https://api.upload-post.com/api/uploadposts/linkedin/pages?profile=altitut
```

**Result:**

```
Checking LinkedIn pages for Upload-Post profile: altitut
Failed: No LinkedIn pages found
```

This means Upload-Post is connected to your personal LinkedIn account, but it cannot see any company pages. Therefore the app cannot send `target_linkedin_page_id` for Altitut.

---

## 3. Why the company page is not showing — the two likely causes

### Cause A: Upload-Post’s page lookup only queries for `ADMINISTRATOR` pages, not `CONTENT_ADMIN` pages

- The LinkedIn API lets a tool query which pages a user can access via `organizationalEntityAcls?q=roleAssignee&role=...`.
- A known bug in third-party tools (documented in [Postiz GitHub issue #1234](https://github.com/gitroomhq/postiz-app/issues/1234)) is that the tool only queries `role=ADMINISTRATOR` and therefore misses pages where the user is `CONTENT_ADMIN`/`CONTENT_ADMINISTRATOR`.
- Since you are a **Content admin** on Altitut, LinkedIn allows you to post through third-party sites, but Upload-Post’s `GET /uploadposts/linkedin/pages` may not be checking the Content-admin role.
- **Fix if this is the cause:** Ask the Altitut Super admin to temporarily promote you to **Super admin** (`ADMINISTRATOR`), then reconnect LinkedIn in Upload-Post and rerun the diagnostic.

### Cause B: The original OAuth connection did not request or grant `w_organization_social`

- Upload-Post says its connection flow can authorize “both personal profile and Company Page access.”
- If the consent screen did not show a page/organization selection box, the OAuth request may not have included the `w_organization_social` scope, or it was not granted.
- **Fix if this is the cause:** Disconnect and reconnect LinkedIn in Upload-Post, and look carefully for any company-page checkbox on LinkedIn’s consent screen.

**Important:** If Cause A is true, even reconnecting will not help until you are promoted to Super admin. If Cause B is true, being Super admin is not required. The fastest way to distinguish them is the Step 1 test below.

---

## 4. Brain-dead next steps for you (Shashwat)

### Step 0 — Do not change any code yet

The app code is already wired to use `target_linkedin_page_id` once Upload-Post returns a page. Changing code before the connection is fixed will not help.

### Step 1 — Confirm your exact role on the Altitut LinkedIn page

1. Go to `https://www.linkedin.com/company/altitut/admin/` while signed in as yourself.
2. In the left sidebar, click **Settings** → **Manage admins**.
3. Find your name and read the role column.
4. **If it says “Content admin”** → proceed to Step 2.
5. **If it says “Super admin”** → skip to Step 3.

### Step 2 — Ask the Super admin to promote you to Super admin (ADMINISTRATOR)

This is the fastest way to test whether the issue is Upload-Post only looking for `ADMINISTRATOR` pages.

1. Identify the current Super admin of the Altitut page (ask your tech lead or the person who made you Content admin).
2. Ask them to go to `https://www.linkedin.com/company/altitut/admin/settings/manage-admins`.
3. Click **Add admin** or edit your existing role.
4. Change your role from **Content admin** to **Super admin**.
5. Accept the admin invitation/email.

**If you cannot be promoted**, keep your Content admin role and proceed to Step 3 anyway, then contact Upload-Post support (Step 5).

### Step 3 — Disconnect LinkedIn from Upload-Post

1. Go to `https://app.upload-post.com/manage-users`.
2. Sign in if needed.
3. Find the `altitut` profile.
4. Locate the LinkedIn connection and click **Disconnect** or **Remove**.

**Also remove Upload-Post from LinkedIn’s authorized apps:**

1. Go to `https://www.linkedin.com/mypreferences/d/categories/privacy`.
2. Click **Data privacy**.
3. Scroll to **Other applications** or **Authorized applications**.
4. Find **Upload-Post** and click **Remove**.

### Step 4 — Reconnect LinkedIn and watch the OAuth consent screen

1. In your app or on the Upload-Post dashboard, generate/connect the LinkedIn link for the `altitut` profile.
2. When LinkedIn’s OAuth screen appears, **do not blindly click Allow**.
3. Look for any of the following:
   - A checkbox list of company pages including **Altitut**.
   - Text like “Share your organization pages” or “Which LinkedIn pages do you want to use?”
   - A small “Edit access” or “Manage access” link.
4. **If Altitut appears, check it and click Allow.**
5. **If no page/organization option appears**, click Allow anyway and proceed to Step 5.

### Step 5 — Rerun the diagnostic

Open a terminal in the repo and run:

```bash
cd /Users/gobus/Desktop/main/projects/internship/altitut/ALTITUT-SOCIAL-MEDIA-ANALYSIS
npx tsx --tsconfig tsconfig.test.json scripts/diag-linkedin-pages.ts
```

**Expected good output:**

```json
{
  "success": true,
  "pages": [
    {
      "id": "urn:li:organization:12345678",
      "name": "Altitut",
      "vanityName": "altitut"
    }
  ]
}
```

If you see this, the connection is fixed and the app will automatically post to Altitut’s page.

**If the output is still `Failed: No LinkedIn pages found`**, proceed to Step 6.

### Step 6 — Contact Upload-Post support

Send this exact message to `info@upload-post.com`:

```
Subject: LinkedIn company page not visible for profile "altitut"

Hi,

I am trying to post to a LinkedIn company page (Altitut) through Upload-Post.

Details:
- Upload-Post profile: altitut
- I am a Content admin of the LinkedIn company page Altitut.
- When I connected LinkedIn, the OAuth screen only asked about my personal profile and did not show any company page selection.
- After connecting, GET /api/uploadposts/linkedin/pages?profile=altitut returns "No LinkedIn pages found".

LinkedIn Help confirms Content admins can "Post content through third-party sites" (https://www.linkedin.com/help/linkedin/answer/a550647), and Microsoft Learn lists CONTENT_ADMIN as an acceptable role for w_organization_social (https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api).

Questions:
1. Does Upload-Post's GET /api/uploadposts/linkedin/pages endpoint query LinkedIn for pages where the user is ADMINISTRATOR only, or also CONTENT_ADMIN?
2. How can I authorize Company Page access for my Upload-Post profile so that Altitut appears in the page list?
3. Do I need to be a Super admin (ADMINISTRATOR) of the company page for Upload-Post to see it?

Thanks.
```

### Step 7 — Get the Altitut LinkedIn company ID (optional, useful for verification)

If you need the exact numeric ID for any manual test:

1. Go to `https://www.linkedin.com/company/altitut/`.
2. If the URL shows a number after `/company/` (e.g., `https://www.linkedin.com/company/1234567/`), that number is the ID.
3. If the URL uses a vanity name (e.g., `https://www.linkedin.com/company/altitut/`), press **Ctrl+U** (or **Cmd+Option+U** on Mac) to view page source.
4. Press **Ctrl+F** and search for `urn:li:fs_normalized_company:` or `urn:li:fsd_company:`.
5. The number after the colon is the company ID.
6. Alternatively, while in the admin view at `https://www.linkedin.com/company/altitut/admin/`, the numeric ID may appear in the URL.

---

## 5. What to do based on the diagnostic result

| Diagnostic result | What it means | Next action |
|---|---|---|
| `pages: [{ id: "urn:li:organization:...", name: "Altitut" }]` | Upload-Post can see Altitut | The app will use `target_linkedin_page_id` automatically. Test posting. |
| `Failed: No LinkedIn pages found` and you are **Super admin** | Upload-Post is not requesting company-page OAuth scope, or there is a backend bug | Contact `info@upload-post.com` with the message in Step 6. |
| `Failed: No LinkedIn pages found` and you are **Content admin** only | Upload-Post likely only queries LinkedIn for `ADMINISTRATOR` pages | Ask Super admin to promote you to Super admin and retest; if still failing, contact Upload-Post support. |

---

## 6. Fallback alternatives if Upload-Post cannot be fixed

If Upload-Post cannot see Altitut, use one of these while the issue is resolved.

### Option A — LinkedIn native scheduler (free)

1. Go to `https://www.linkedin.com/company/altitut/admin/`.
2. Click **Page posts** in the left menu.
3. Click **Start a post**.
4. Write the post, add media, click the **clock icon**.
5. Select date/time and click **Schedule**.

**Limitation:** Cannot schedule events, multiple photos, reshares, polls, jobs, or service posts.

### Option B — Repost from your personal profile to Altitut (free, immediate)

1. Post from your personal profile first.
2. Click **Repost** → **Repost with your thoughts**.
3. At the top of the composer, click your name and switch author to **Altitut**.
4. Add commentary and click **Post**.

**Limitation:** Manual, cannot be scheduled.

### Option C — Buffer Free

1. Go to `https://buffer.com` and sign up for free.
2. Connect the Altitut LinkedIn page.
3. Schedule posts.

**Limitation:** Free plan allows 3 channels and 10 scheduled posts per channel.

### Option D — Hootsuite

1. Go to `https://hootsuite.com`.
2. Start a free trial or paid plan.
3. Connect the Altitut page.

**Limitation:** No free plan; paid starts around $99/user/month.

---

## 7. Code changes already in place in the Altitut app

The app code is already capable of posting to a LinkedIn company page once Upload-Post returns the page ID:

- `lib/social/accounts.ts` calls `GET /api/uploadposts/linkedin/pages` in `listLinkedInPages()`.
- If a page is returned, `resolveSocialAccount()` stores `linkedinPageId` in Firestore.
- `app/api/autopost/route.ts` `validateStep()` copies `account.linkedinPageId` into `target.pageId`.
- `lib/social/upload-post/adapter.ts` `publishToUploadPost()` sends `target_linkedin_page_id` if `target.pageId` is set.
- The OpenAPI spec says the value can be the full `urn:li:organization:{id}` URN returned by `GET /uploadposts/linkedin/pages`.

### Diagnostic script added

`scripts/diag-linkedin-pages.ts` calls `GET /api/uploadposts/linkedin/pages?profile=altitut` and prints the raw response. Use it after every reconnect.

---

## 8. Next steps for Devin (me)

1. Keep `scripts/diag-linkedin-pages.ts` in the repo.
2. After you complete Step 5 above and share the result, I will:
   - If pages appear: verify that one post to Altitut succeeds end-to-end.
   - If pages still do not appear and you are Super admin: add clearer UI messaging in the composer explaining the connection is personal-only, and route you to contact Upload-Post support.
   - If needed: add a manual `target_linkedin_page_id` override field in the composer as a last-resort workaround (only useful if Upload-Post accepts the ID even though it does not list it, which is unlikely).
3. Document any final code changes in `AGENTS.md`.

---

## 9. One-sentence summary

**Upload-Post can post to Altitut’s LinkedIn company page, but right now it cannot see Altitut because the `altitut` profile’s LinkedIn connection is personal-only; the most likely fix is to either promote you to Super admin on the Altitut page or force a reconnect that grants company-page OAuth permissions, then verify with `scripts/diag-linkedin-pages.ts`.**
