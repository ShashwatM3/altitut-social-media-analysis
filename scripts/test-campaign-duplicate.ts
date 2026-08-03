import {
  buildCampaignDuplicate,
  type CampaignPost,
  type PostCampaign,
} from "../lib/campaigns";

const campaign: PostCampaign = {
  id: "campaign-original",
  name: "YC founder ideas",
  platform: "linkedin",
  objective: "Teach student founders",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};
const post: CampaignPost = {
  id: "post-original",
  campaignId: campaign.id,
  platform: "linkedin",
  title: "A published post",
  description: "Useful content",
  hashtags: ["startups"],
  firstComment: "Read more",
  media: {
    urls: ["https://example.com/image.jpg"],
    storagePaths: ["autopost/image.jpg"],
  },
  linkedin: { destination: "profile" },
  status: "published",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  publishedAt: "2026-08-01T01:00:00.000Z",
  publishKey: "vendor-idempotency-key",
  vendorRequestId: "request-id",
  jobId: "job-id",
  postUrl: "https://linkedin.com/post",
  platformPostId: "urn:li:share:123",
};

const duplicate = buildCampaignDuplicate(campaign, [post]);
const clonedPost = duplicate.posts[0];
const passed =
  duplicate.campaign.id !== campaign.id &&
  duplicate.campaign.name === "YC founder ideas (Copy)" &&
  clonedPost.id !== post.id &&
  clonedPost.campaignId === duplicate.campaign.id &&
  clonedPost.status === "draft" &&
  clonedPost.publishKey === undefined &&
  clonedPost.vendorRequestId === undefined &&
  clonedPost.jobId === undefined &&
  clonedPost.postUrl === undefined &&
  clonedPost.platformPostId === undefined &&
  clonedPost.media.urls[0] === post.media.urls[0];

console.log(
  `${passed ? "PASS" : "FAIL"}: campaign duplication preserves content and clears live-publish state.`,
);
if (!passed) process.exit(1);
