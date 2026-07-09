# Guide for Archived Code

This repository was reset to a blank slate on 2026-07-09 to start a fresh build. The
entire previous codebase (social media analysis platform: Python backend, React
frontend, connectors, docs) was **not deleted** — it's preserved and still fully
usable. This file explains how to find it, look at it, recover it, or merge pieces
of it back into the new build.

## Where the archived code lives

- **Git tag:** `archive-v1` — points at commit `27451f1`, the last commit before
  the reset. This tag is permanent and will never move.
- **Live checkout (git worktree):** `../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1`
  — a sibling directory next to this repo, checked out from `archive-v1`. It's a
  real, ordinary set of files on disk — no git commands are needed to read it.

Both point at the same commit. The worktree exists purely so the old code can be
browsed like any normal folder.

## Just looking at the old code (no recovery needed)

Read or grep files directly in the sibling directory, same as any other folder:

```bash
ls ../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1
cat ../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1/backend/api/<file>
grep -r "some_function" ../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1
```

For an AI agent: if asked about "the old version," "how did this used to work," or
"what did we have before the reset," look in
`../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1` first — it's the full previous
codebase, not just docs.

## Recovering the entire old codebase

To bring everything back exactly as it was:

```bash
git checkout archive-v1        # detached HEAD at the old snapshot
# or, to work on it as a branch:
git checkout -b restore-from-archive archive-v1
```

Or simply copy the worktree directory's contents back over this repo's root.

## Bringing back specific pieces (selective merge)

When only parts of the old code are wanted alongside new work, decide the merge
criteria at that time (which files, which features, which directories), then use
whichever of these fits:

- **Pull one file/folder as-is:**
  `git checkout archive-v1 -- path/to/file-or-folder`
- **Diff old vs. new before deciding:**
  `git diff archive-v1 -- path/to/file`
- **Cherry-pick a specific historical commit:**
  `git log archive-v1` to find it, then `git cherry-pick <sha>`
- **Manual copy:** since the worktree is plain files, just copy what's needed from
  `../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1` into the new structure and adapt.

## What's NOT captured by the tag

`archive-v1` only contains what git was tracking. Gitignored files from the old
project were copied into the worktree directory manually and are **not** part of
git history:

- `.env` — old environment/secrets file
- `.env.example` — template

If those are needed for the new build, copy them from
`../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1/.env*` directly.

## Maintenance notes

- Do not delete the `archive-v1` tag or force-push over it.
- Do not delete or move the `../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1`
  directory — it's a git worktree, not an independent clone. Removing it without
  running `git worktree remove` first will leave the main repo's worktree
  metadata stale (fix with `git worktree prune` if that happens).
- If this repo is ever re-cloned elsewhere, the worktree directory won't come
  along automatically — only the `archive-v1` tag will (assuming it was pushed).
  Recreate the worktree there with:
  `git worktree add ../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1 archive-v1`
