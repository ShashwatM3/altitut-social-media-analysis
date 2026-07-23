# Auto-Post — Brain-Dead Setup Guide

This guide takes you from zero to a working **Auto-Post** pane and the
**Post** buttons on every content pack. It is intentionally hand-holding:
if a step says "click X", do exactly that.

## What you are building

- A standalone **Auto-Post** tab where you drag a video/image, write (or
  AI-generate) per-platform copy, and publish to LinkedIn, Facebook and
  Instagram in one shot.
- A **Post** button next to every content pack that opens the same composer
  pre-filled with hashtags, tone, CTA and captions inferred from the pack.
- A Firestore-backed **Post history** list with live status and permalinks.

You do **not** need a LinkedIn developer app or Meta App Review. Publishing
flows through [Upload-Post](https://upload-post.com) (or the endpoint you
configured with `UPLOAD_POST_BASE_URL`).

## Graceful fallback (read this once)

You do **not** have to connect all three platforms on day one. The app is
built to skip any platform that is not configured and still publish to the
others.

- If you connect only **Instagram**, posts will publish to Instagram and the
  LinkedIn/Facebook cards will show **(will be skipped)**.
- If you connect **Instagram + LinkedIn** but your Facebook Page is not
  connected, Instagram and LinkedIn go live and Facebook is skipped.
- The only hard failure is when **none** of the selected platforms are
  connected.

When a platform is skipped you see a warning in the composer and a
**Skipped** badge in Post history. The final status will be **partial**
instead of **published** if at least one platform succeeded.

---

## Step 0 — Decide which platforms you want now

| Platform | What you need | Can be added later? |
|----------|---------------|---------------------|
| LinkedIn | A LinkedIn personal profile or a company page you admin. | Yes |
| Facebook | A **Facebook Page** you admin (not a personal profile). | Yes |
| Instagram | A **Business or Creator** Instagram account connected to a Facebook Page. | Yes |

You can start with one, two, or all three.

---

## Step 1 — Create an Upload-Post account and profile

1. Open a browser and go to `https://app.upload-post.com` (or the URL that
   matches your `UPLOAD_POST_BASE_URL` if you self-host).
2. Sign up or log in.
3. Once inside the dashboard, look for **Profiles** (or **Accounts / Profiles**).
4. Click **Add Profile** / **Create Profile**.
5. Enter a profile name. This can be anything, but the examples below use:
   ```
   altitut
   ```
6. Save the profile.

You will use this exact profile name in `.env` as `UPLOAD_POST_PROFILE`.

---

## Step 2 — Create an API key

1. In the Upload-Post dashboard, look for **API Keys**, **Developer**, or
   **Settings → API**.
2. Click **Generate API key** / **Create key**.
3. Copy the key. It usually starts with a prefix like `up_` or `ulk_`.
4. Keep it in your clipboard for Step 5.

---

## Step 3 — Connect the platforms to your Upload-Post profile

### 3A. LinkedIn

1. In the Upload-Post dashboard, open the profile you created in Step 1.
2. Look for a **Connect LinkedIn** or **Add account** button.
3. Click it. You will be redirected to LinkedIn's OAuth screen.
4. Log in with the LinkedIn account you want to post from.
5. Authorize Upload-Post.
6. When you are returned to Upload-Post, the LinkedIn row should say
   **Connected** or show a green check.

> If you want to post to a LinkedIn company page, make sure that page is
> listed and selected inside the Upload-Post account settings for this
> profile. The app will publish to whichever page/profile Upload-Post has
> permission to use.

### 3B. Facebook

1. Open the same Upload-Post profile.
2. Click **Connect Facebook** / **Add Facebook**.
3. You will be redirected to Facebook.
4. Log in with the personal Facebook account that **administers** the Page.
5. In the Facebook permissions dialog, select the **Page** you want to post
   to. **Do not select your personal profile** — Upload-Post cannot publish
   to personal profiles, only Pages.
6. Authorize all requested permissions.
7. Back in Upload-Post, the Facebook row should show the Page name and
   **Connected**.

> If you see "No pages found", you are either not an admin of any Page, or
> you selected your personal profile. Go to
> `https://business.facebook.com` and confirm you have at least one Page.

### 3C. Instagram

1. Open the same Upload-Post profile.
2. Click **Connect Instagram**.
3. You will be redirected to Meta/Facebook.
4. Log in with the Facebook account that administers the Instagram account.
5. Select the Instagram **Business or Creator** account you want to post to.
   Personal/private accounts cannot be used.
6. Authorize all requested permissions.
7. Back in Upload-Post, the Instagram row should show the Instagram handle
   and **Connected**.

> If your Instagram account is not listed, open the Instagram app → **Settings
> and privacy → Account type and tools → Switch to Professional Account**,
> choose **Business** or **Creator**, and link it to a Facebook Page.

---

## Step 4 — Add the credentials to `.env`

1. In this repo, open `.env` (create it from `.env.example` if it does not
   exist):
   ```bash
   cp .env.example .env
   ```
2. Find the **Auto-post: Upload-Post (primary)** section and fill it in:
   ```bash
   UPLOAD_POST_API_KEY=the-key-you-copied-in-step-2
   UPLOAD_POST_BASE_URL=https://api.upload-post.com/api
   UPLOAD_POST_PROFILE=altitut
   ```
   Replace `altitut` with the exact profile name you created in Step 1.
3. Make sure the **Switch** section says:
   ```bash
   SOCIAL_PROVIDER=upload_post
   ```
   The Post-for-Me fallback is not used by default.
4. Save `.env`.

---

## Step 5 — Open Firebase Storage so the browser can upload media

Auto-Post uploads videos/images directly from the browser to Firebase
Storage before handing the public URL to Upload-Post.

1. Open the Firebase console: `https://console.firebase.google.com`.
2. Select the project used by this app (`altitut-sma-dashboard` by default).
3. In the left sidebar click **Storage**.
4. Click the **Rules** tab.
5. Replace the rules with the following:
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
6. Click **Publish**.

> This is the narrowest open rule that works for the browser upload path.
> The app writes only under `/autopost/{postId}/{filename}`.

---

## Step 6 — Restart the app

1. If `npm run dev` is running, stop it (`Ctrl + C`) and start again:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:3000`.
3. Click the **Auto-Post** tab.
4. You should see three destination cards. The ones you connected will show
   the account/page name. The ones you did not connect will show
   **(will be skipped)**.

---

## Step 7 — Test a standalone post

1. In the Auto-Post tab, stay on the **Media** step.
2. Drag or click to upload a video (MP4, ≤500 MB) or image (JPG/PNG).
3. Click **Next**.
4. On **Destinations**, select the platforms you connected. Unconfigured
   platforms are allowed to stay selected but will be skipped.
5. Click **Next**.
6. On **Copy**, either:
   - type each caption yourself, or
   - fill in the **AI brief** popover and click **Generate** for each
     platform.
7. Click **Next**.
8. On **Review & Publish**, click **Publish**.
9. Wait for the stepper to finish. You will see per-platform results:
   - **View** = success, click to open the live post.
   - **Skipped** = not connected.
   - **Failed** = something went wrong; hover to read the message.
10. Open **Post history** below the composer. The new row updates live.

---

## Step 8 — Test the content-pack Post button

1. Switch to the **Content Creation** tab.
2. Find any content pack and click the **Post** button on the right.
3. A modal opens with the composer already pre-filled:
   - platforms are pre-selected based on the pack text,
   - the AI brief is derived from the pack,
   - captions are already generated using the pack as ground truth.
4. Upload the video/image in the modal.
5. Review the copy, then publish.
6. Close the modal. The history list updates.

---

## Step 9 — Verify the graceful fallback

1. Open `https://app.upload-post.com`.
2. Disconnect one platform from your `altitut` profile (for example
   LinkedIn).
3. Back in the app, refresh the page.
4. Create a post selecting all three platforms.
5. Publish.
6. Expected outcome:
   - Instagram and Facebook publish normally.
   - LinkedIn shows **Skipped** with reason "Account not connected in
     Upload-Post."
   - Overall status is **partial**.
7. Reconnect the platform in Upload-Post and retry; it will work again
   without any code change.

---

## Troubleshooting

### "UPLOAD_POST_API_KEY is not set"

- Your `.env` is missing `UPLOAD_POST_API_KEY` or the dev server was started
  before you saved it. Restart `npm run dev`.

### "UPLOAD_POST_PROFILE is not set"

- Add `UPLOAD_POST_PROFILE=altitut` (or your profile name) to `.env` and
  restart.

### "No Facebook Pages found for profile …"

- You connected a Facebook personal profile instead of a Page. Reconnect and
  pick a **Page**.

### "None of the selected platforms are connected"

- All selected platforms are missing in Upload-Post. Either connect at least
  one or select only connected platforms.

### "Media URL is not reachable"

- Firebase Storage rules are not open, or the upload did not finish. Check
  Storage Rules (Step 5) and the browser console for upload errors.

### A platform shows **(will be skipped)** even though I connected it

- The account fetch failed or the session expired. In Upload-Post, refresh
  the connection for that platform, then reload the app.

### Instagram says "Failed" or "skipped"

- Instagram must be a Business or Creator account linked to a Facebook Page.
- Reels must be 9:16 (vertical). The composer warns you if the file is not.

### LinkedIn is not publishing images

- LinkedIn does not support image carousels through Upload-Post in this
  integration. Use a single image or a video.

### I see a different status for each platform in history

That is expected. Each platform is processed independently:

| Badge | Meaning |
|-------|---------|
| **View** | Published successfully. Click to open the post. |
| **Publishing…** | Still processing (common for videos). |
| **Skipped** | Platform not configured; no attempt was made. |
| **Failed** | Upload-Post returned an error. Hover for the message. |

---

## One-line checklist before you publish

- [ ] `UPLOAD_POST_API_KEY` and `UPLOAD_POST_PROFILE` are in `.env`
- [ ] `SOCIAL_PROVIDER=upload_post` is in `.env`
- [ ] Firebase Storage rules allow `/autopost/**`
- [ ] At least one of LinkedIn / Facebook / Instagram is connected in
      Upload-Post
- [ ] `npm run dev` was restarted after editing `.env`
- [ ] You uploaded the video/image and saw a preview
- [ ] You clicked **Publish** and waited for the stepper to finish

---

## Next level (optional)

- The fallback / skip logic lives in `app/api/autopost/route.ts`
  (`validateStep`). It is automatic; nothing to configure.
- The pack-to-caption logic lives in `lib/packs.ts` and `lib/caption.ts`.
- To change which platforms a pack pre-selects, edit the text in the pack
  itself (the code scans for "Instagram", "Facebook", "LinkedIn", "Reel",
  etc.).
