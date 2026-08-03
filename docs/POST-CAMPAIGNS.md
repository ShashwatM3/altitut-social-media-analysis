# Post campaigns

The **Post Campaigns** pane keeps each campaign tied to one platform so its
posts expose only fields that Upload-Post and the destination support. Campaigns
and posts are live Firestore records in `postCampaigns` and `campaignPosts`.

## Workflow

1. Create an Instagram or LinkedIn campaign with a name and optional objective;
   use **Edit campaign** later to rename it or update the objective. **Delete
   campaign** removes its dashboard records after confirmation; already-live
   social posts remain online.
2. Open its card and create posts as drafts.
3. Upload one to ten JPG/PNG images and drag them into carousel order.
4. Add the platform copy, hashtags and optional first comment.
5. Choose any platform-specific options and publish.
6. The post moves through **Draft → Publishing → Published** or **Failed**.
   Publishing posts expose **Check status**; vendor failures expose **Try again**.

Edits create a new idempotency key. Retrying a vendor failure uses Upload-Post's
retry endpoint and original media snapshot instead of creating a duplicate
upload.

## Platform fields

| Field | Instagram | LinkedIn |
| --- | --- | --- |
| Images | 1–10 ordered images | 1–10 ordered images |
| Main copy | Description, including appended hashtags; 2,200 characters | Commentary, including appended hashtags; 3,000 characters |
| First comment | Optional; 2,196 characters | Optional; 1,250 characters |
| Destination | Connected Instagram account | Connected personal profile or an administered company page |
| Extra controls | Collaborator usernames and location ID | Company-page selector; public visibility for image posts |

Instagram collaborators must be public usernames without `@`. A location must
be the numeric Instagram location ID, not a place name. User tags are not in the
first release because photo tags need explicit x/y coordinates and the same tag
positions would be applied to every carousel image.

## Guardrails and failure behavior

- The editor accepts JPG/PNG only, at most 10 images and 8 MB per image.
- Every Instagram feed image must have an aspect ratio from 4:5 through 1.91:1.
- Copy and first-comment limits are checked in both the browser and FastAPI.
- Known Upload-Post-rejected Instagram hashtags are blocked before submission.
- Media must finish uploading and have a public Firebase Storage URL before a
  draft containing that media can be saved or published.
- The request uses asynchronous upload plus a stable `Idempotency-Key`. The
  client polls every five seconds for up to two minutes, then leaves the post in
  **Publishing** so it can be checked again without reposting.
- HTTP success alone is not treated as publish success. The per-platform result
  must complete successfully; otherwise the vendor message is kept on the post.
- Authentication failures require reconnecting the account in Upload-Post.
  Rate limits and server failures stay visible rather than silently duplicating
  the post.
- Upload-Post enforces rolling 24-hour hard caps of 50 successful Instagram
  posts and 150 successful LinkedIn posts per connected account. A 429 can also
  mean the plan's monthly quota is exhausted. Duplicate or very similar content
  inside 48 hours can be rejected as an anti-spam safeguard.
- Upload-Post's failed-upload retry retries only failed platforms and reuses the
  stored media. A 409 means the original request has nothing failed to retry.
- LinkedIn posts can be removed through Upload-Post's unpublish operation;
  Instagram's API does not support remote deletion. Campaigns therefore do not
  present a misleading delete-live-post action.

## Deliberately deferred options

Upload-Post also supports scheduling up to 365 days ahead, profile queues,
webhook completion notifications, Instagram coordinate-based photo tags and
Instagram mixed photo/video carousels. They are useful follow-ups, but keeping
them out of the first pane avoids adding schedule editing, webhook security and
per-image tagging models before those workflows are requested.

## Vendor references reviewed

- [Upload Photos API](https://docs.upload-post.com/api/upload-photo/)
- [Upload status](https://docs.upload-post.com/api/upload-status/)
- [Retry and unpublish](https://docs.upload-post.com/api/post-actions/)
- [LinkedIn pages](https://docs.upload-post.com/api/get-linkedin-pages/)
- [Character limits](https://docs.upload-post.com/resources/character-limits/)
- [Common errors](https://docs.upload-post.com/resources/common-errors/)
- [Rate limits and polling](https://docs.upload-post.com/guides/rate-limits/)
- [Error handling](https://docs.upload-post.com/guides/error-handling/)
- [Webhooks](https://docs.upload-post.com/api/webhooks/)
