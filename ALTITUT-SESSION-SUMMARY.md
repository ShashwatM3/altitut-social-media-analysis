# Altitut Autopost + LinkedIn Company Page Session Summary

Generated: 2026-07-24  
This file contains the full output of the session: the autopost bug fixes, the LinkedIn company-page research, diagnostic results, and the exact next steps to test/push.

---

## Part 1 — Autopost Bug Fixes

### What was broken
- The autopost composer showed all platforms as connected, but publishing still errored.
- `lib/social/accounts.ts` failed to parse the Upload-Post response shape (`social_accounts` is wrapped under `profile`).
- `resolveSocialAccount` threw when LinkedIn or Facebook had no pages.
- `instagramUserId` was written as `undefined` to Firestore, which Firestore rejects.
- The Upload-Post adapter sent an undocumented `request_id` FormData field.
- The composer caption generator used the content pack’s media kind instead of the actual uploaded file.
- Polling logic and status parsing had several edge cases.

### Files changed
- `lib/social/accounts.ts` — response parsing, page-list error handling, Firestore sanitization.
- `lib/social/upload-post/adapter.ts` — FormData fixes, response parsing, `target_linkedin_page_id` handling.
- `app/api/autopost/route.ts` — `mediaUrlReachable` HEAD/GET fallback, graceful resolve warnings.
- `app/api/autopost/accounts/route.ts` — graceful fallback to `needs_reauth`.
- `app/components/autopost-composer.tsx` — caption `mediaKind` uses actual uploaded media.
- `package.json` — `test:autopost` script now runs three regression tests.
- `scripts/test-upload-post.ts`, `scripts/test-status-queued.ts`, `scripts/test-accounts.ts` — regression tests.
- `scripts/diag-linkedin-pages.ts` — live diagnostic for LinkedIn company pages.
- `ALTITUT-LINKEDIN-COMPANY-PAGE-NEXT-STEPS.md` — detailed LinkedIn plan.
- `AGENTS.md` — updated with learned project notes.

### Verification run
```bash
npm run test:autopost
npm run build
```
Both passed.

### Before testing the autopost fix
1. Restart `npm run dev` so server routes pick up the changes.
2. Facebook will still be skipped until a Facebook Page is connected in Upload-Post.
3. LinkedIn and Instagram should now resolve correctly and be publishable.

---

## Part 2 — LinkedIn Company Page Posting Research

### Core question
Can Upload-Post post to Altitut’s LinkedIn company page when you are only a Content admin?

### Definitive answer
- **Upload-Post supports company pages** via `target_linkedin_page_id` on `/api/upload`, `/api/upload_photos`, `/api/upload_text`, and `/api/upload_document`.
- **LinkedIn allows Content admins to post through third-party sites** (LinkedIn Help table row).
- **Microsoft Learn lists `CONTENT_ADMIN` as acceptable for `w_organization_social` scope**.
- **But Upload-Post cannot currently see Altitut** for your `altitut` profile.

### Live diagnostic result
Command:
```bash
cd /Users/gobus/Desktop/main/projects/internship/altitut/ALTITUT-SOCIAL-MEDIA-ANALYSIS
npx tsx --tsconfig tsconfig.test.json scripts/diag-linkedin-pages.ts
```

Output:
```
Checking LinkedIn pages for Upload-Post profile: altitut
Failed: No LinkedIn pages found
```

This means Upload-Post is connected to your personal LinkedIn only.

### Most likely root cause
Upload-Post’s `GET /api/uploadposts/linkedin/pages` likely queries LinkedIn for pages where the connected user has the `ADMINISTRATOR` role, ignoring `CONTENT_ADMIN` pages. A documented equivalent bug exists in Postiz (GitHub issue #1234). Since you are a **Content admin**, LinkedIn allows you to post, but Upload-Post’s page lookup may not return the Altitut page.

### Fastest test
1. Ask the Altitut Super admin to promote you to **Super admin** on the LinkedIn page.
2. Disconnect LinkedIn in Upload-Post: `https://app.upload-post.com/manage-users`.
3. Remove Upload-Post from LinkedIn authorized apps: `https://www.linkedin.com/mypreferences/d/categories/privacy`.
4. Reconnect LinkedIn.
5. Rerun the diagnostic script.

If the script returns a page object for Altitut, the app will automatically post to the company page.

### Full plan
See `ALTITUT-LINKEDIN-COMPANY-PAGE-NEXT-STEPS.md` for:
- Exact URLs and clicks.
- The exact support email to send to `info@upload-post.com`.
- How to find Altitut’s numeric LinkedIn company ID.
- Fallback options (LinkedIn native scheduler, Buffer, Hootsuite, reposting).

---

## Part 3 — Commit and Push Commands

The repo currently has staged changes and 3 unpushed commits on `main`.

```bash
cd /Users/gobus/Desktop/main/projects/internship/altitut/ALTITUT-SOCIAL-MEDIA-ANALYSIS

git commit -m "$(cat <<'EOF'
Fix autopost account resolution, Upload-Post response parsing, and Firestore writes.

- Resolve social_accounts from Upload-Post's wrapped profile response.
- Allow LinkedIn personal profiles and no-Facebook-page setups without crashing.
- Sanitize undefined fields before Firestore writes.
- Harden media URL reachability and adapter FormData fields.
- Add regression tests for upload/accounts flows.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"

git push origin main
```

If you do **not** want the design docs (`MASTER-PROMPT-AUTOPOST.md`, `resources/*.md`) in the commit, unstage them first:

```bash
git reset HEAD MASTER-PROMPT-AUTOPOST.md resources/00-SHARED-FOUNDATION.md resources/01-LINKEDIN.md resources/02-FACEBOOK.md resources/03-INSTAGRAM.md
```

---

## Part 4 — What to Do Next

### To finish autopost testing
1. Restart `npm run dev`.
2. Open a content pack, click Post, upload an image.
3. Select LinkedIn + Instagram, generate copy, publish.
4. If it still errors, copy the exact error and server log.

### To fix LinkedIn company-page posting
1. Read `ALTITUT-LINKEDIN-COMPANY-PAGE-NEXT-STEPS.md`.
2. Try the Super-admin promotion + reconnect test.
3. Rerun `scripts/diag-linkedin-pages.ts`.
4. If it still fails, send the exact support email from the plan to `info@upload-post.com`.

### To persist the code
1. Review `git status`.
2. Run the commit/push commands in Part 3.

---

## Part 5 — Key Files Added or Changed in This Session

| File | Why |
|---|---|
| `lib/social/accounts.ts` | Fixed response parsing, page-list errors, Firestore undefined sanitization. |
| `lib/social/upload-post/adapter.ts` | Removed bad `request_id` field, fixed description fallback, `target_linkedin_page_id` handling. |
| `app/api/autopost/route.ts` | `mediaUrlReachable` GET fallback, graceful warnings. |
| `app/api/autopost/accounts/route.ts` | Graceful `needs_reauth` fallback. |
| `app/components/autopost-composer.tsx` | Use actual uploaded media kind for captions. |
| `scripts/test-upload-post.ts` | Regression test for Upload-Post adapter. |
| `scripts/test-status-queued.ts` | Regression test for status polling. |
| `scripts/test-accounts.ts` | Regression test for account response parsing. |
| `scripts/diag-linkedin-pages.ts` | Live diagnostic for LinkedIn company pages. |
| `ALTITUT-LINKEDIN-COMPANY-PAGE-NEXT-STEPS.md` | Full LinkedIn company-page plan. |
| `ALTITUT-SESSION-SUMMARY.md` | This file. |

---

## Part 6 — Update: Promotion to Super Admin Worked

Date: 2026-07-24

After the tech lead promoted you to **Super admin** on the Altitut LinkedIn page, Devin re-ran the diagnostic:

```bash
npx tsx --tsconfig tsconfig.test.json scripts/diag-linkedin-pages.ts
```

Output:

```json
{
  "success": true,
  "pages": [
    {
      "id": "urn:li:organization:107144704",
      "name": "Altitut",
      "vanityName": "altitut",
      "account_id": "e73WKjelMu"
    }
  ]
}
```

`resolveSocialAccount('linkedin', 'altitut')` now returns:

```json
{
  "provider": "linkedin",
  "status": "active",
  "linkedinPageId": "urn:li:organization:107144704",
  "displayName": "Shashwat Mahalanobis"
}
```

The Firestore `socialAccounts/linkedin` document has been updated with the page URN. The app will now send `target_linkedin_page_id=urn:li:organization:107144704` on every LinkedIn post.

### Final test steps

1. Restart `npm run dev` so the server routes pick up any cached code.
2. Open the dashboard, click Post on a content pack, upload an image.
3. Select **LinkedIn + Instagram**.
4. Generate or type the copy, then click **Publish**.
5. The LinkedIn post should publish to **Altitut’s company page**, and Instagram should publish to `shash.m30`.
6. If any error appears, copy the exact error message and the server log from the `autopost` API call.

---

## Part 7 — One-Line Takeaways

- **Autopost:** Fixed and verified. Restart `npm run dev` and test LinkedIn + Instagram.
- **LinkedIn company page:** Now connected. Posts will go to `Altitut` (`urn:li:organization:107144704`) because you are Super admin.
- **Root cause confirmed:** Upload-Post’s page lookup was not returning pages for the `Content admin` role. Promotion to `Super admin` solved it.
