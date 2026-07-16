# What I Need From You (and only this)

Everything in the master prompt is **built, wired, and tested end-to-end** with the
credentials already in `.env` (OpenAI, Exa, Apify, Firebase). The dashboard, the
Competitor Scout, the RAG chatbot, and Firestore ingestion all work right now with
zero action from you — run `npm run dev` and use them.

There are exactly **two things** I could not do without you, both for the Telegram
bot (Task 4): creating the bot (Telegram requires *your* phone/account) and
deploying publicly (Vercel requires *your* login). Follow the steps below in order —
each step says exactly what to click and type.

---

## Part A — Create the Telegram bot (≈2 minutes, phone or desktop)

1. Open Telegram and search for **`@BotFather`** (the verified one, blue check).
2. Tap **Start**.
3. Send the message: `/newbot`
4. BotFather asks for a **name** — send something like: `Altitut Content Packs`
5. BotFather asks for a **username** — it must end in `bot`. Send something like:
   `altitut_packs_bot` (if taken, try `altitut_content_packs_bot`).
6. BotFather replies with a message containing an **HTTP API token** that looks like:
   `1234567890:AAE4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   **Copy that token.**
7. Open the file **`.env`** in the root of this repo. Find the line:
   ```
   TELEGRAM_BOT_TOKEN=
   ```
   and paste your token after the `=` (no quotes, no spaces):
   ```
   TELEGRAM_BOT_TOKEN=1234567890:AAE4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   (The line below it, `TELEGRAM_WEBHOOK_SECRET=…`, is already filled with a random
   secret I generated — leave it as is.)

That's it for Part A. Do **not** send the bot any messages yet — it can't hear you
until Part B/C connects it to the deployed app.

---

## Part B — Deploy to Vercel (≈5 minutes)

The bot needs a public HTTPS URL that is always up. Vercel gives you that for free.

1. Go to https://vercel.com and log in (or sign up with your GitHub account).
2. Click **Add New… → Project**.
3. **Import** this repository (`altitut/altitut-social-media` — or your fork).
   If it's not listed, click "Adjust GitHub App Permissions" and grant access.
4. Framework preset: Vercel auto-detects **Next.js**. Don't change build settings.
5. Before clicking Deploy, open the **Environment Variables** section and add these
   (copy each value straight from your local `.env` file):

   | Name | Value |
   |------|-------|
   | `OPENAI_API_KEY` | (from `.env`) |
   | `OPENAI_MODEL` | `gpt-4o-mini` |
   | `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
   | `EXA_API_KEY` | (from `.env`) |
   | `APIFY_TOKEN` | (from `.env`) |
   | `APIFY_ACTOR_ID` | `apify/instagram-profile-scraper` |
   | `TELEGRAM_BOT_TOKEN` | (the token from Part A) |
   | `TELEGRAM_WEBHOOK_SECRET` | (from `.env` — the random hex string) |

6. Click **Deploy** and wait for the green "Congratulations" screen.
7. Copy your deployment URL, e.g. `https://altitut-social-media.vercel.app`.

> **Important — function duration:** the Telegram reel pipeline can take 2–4
> minutes. In your Vercel project go to **Settings → Functions** and make sure
> **Fluid Compute** is enabled (it is the default on new projects). The routes
> already declare `maxDuration = 300`, which the Hobby plan supports with Fluid
> Compute. If you ever see the bot say "scraping…" and then go silent, check
> this setting first.

---

## Part C — Point the bot at your deployment (1 command)

Back in this repo's folder, run (with your real URL):

```bash
npm run telegram:webhook -- https://YOUR-APP.vercel.app
```

You should see `"ok": true` and `Webhook registered: …/api/telegram`.

**Test it:** open your bot in Telegram (t.me/YOUR_BOT_USERNAME), press **Start**,
then paste any Instagram reel link, e.g.
`https://www.instagram.com/p/DTtSpEKgSo_/`.
The bot replies at each step (scraping → transcribing → building) and finishes with
a summary; the new pack appears in the **Content Creation** tab of the dashboard
(it reads live from Firestore, so no redeploy is needed).

---

## Part D — Nothing else. But good to know:

- **Seed / re-seed Firestore:** `npm run seed` (already run once — the three
  predefined competitors incl. their new TL;DRs, both content packs, and 140 RAG
  chunks are live in the `altitut-sma-dashboard` Firestore project).
- **Run locally:** `npm run dev` → http://localhost:3000. Scout + chatbot work
  locally; only the Telegram webhook needs the public deployment.
- **A scout test run already executed** and added a real competitor ("Befoundr") to
  your dashboard as proof the workflow works. Feel free to keep or delete it —
  deleting is just removing the `befoundr` doc in the Firestore `competitors`
  collection (and its `ragChunks` where `sourceName == "Befoundr"`).
- **Firestore rules:** you set allow read/write to `true`. Fine for an internal
  tool, but anyone with your project ID can write. When you have a moment, consider
  locking writes down (e.g. App Check or auth) — nothing in this app requires the
  rules to stay fully open except reads from the browser and writes from the
  API routes/scripts.
- **Where everything lives:** see the "Stack & setup" section of `AGENTS.md`
  (updated) for a file-by-file map of the new features.
