/**
 * Feedback-loop harness for the Upload-Post adapter.
 * Mocks global fetch, exercises publish and status parsing, and fails loudly
 * on the exact symptom: posts are accepted (HTTP 200) but not actually tracked
 * or posted because response parsing / field mapping is wrong.
 */

// Set minimal env so the adapter/client can run.
process.env.UPLOAD_POST_API_KEY = "test-key";
process.env.UPLOAD_POST_PROFILE = "altitut";
process.env.UPLOAD_POST_BASE_URL = "https://api.upload-post.com/api";

import { publishToUploadPost, checkUploadPostStatus } from "../lib/social/upload-post/adapter";

let lastCall: { url: string; init: RequestInit } | null = null;

const originalFetch = global.fetch;
(globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input.toString();
  lastCall = { url, init: init ?? {} };

  // Status endpoint first: its path also contains "/api/upload...".
  if (url.includes("/uploadposts/status")) {
    return new Response(
      JSON.stringify({
        request_id: "req-123",
        status: "completed",
        completed: 2,
        total: 2,
        results: [
          {
            platform: "instagram",
            success: true,
            message: "Published",
            url: "https://instagram.com/p/poll123",
            post_id: "poll-post-id-ig",
          },
          {
            platform: "linkedin",
            success: true,
            message: "Published",
            url: "https://linkedin.com/feed/update/poll456",
            post_id: "poll-post-id-li",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Realistic synchronous upload response: `results` is an object keyed by platform.
  if (/\/api\/(upload|upload_photos|upload_text)(\?|$)/.test(url)) {
    return new Response(
      JSON.stringify({
        success: true,
        results: {
          instagram: {
            success: true,
            url: "https://instagram.com/p/test123",
            post_id: "test-post-id-ig",
            container_id: "container-ig",
          },
          facebook: {
            success: false,
            error: "Facebook Page ID is required",
          },
          linkedin: {
            success: true,
            url: "https://linkedin.com/feed/update/test456",
            post_id: "test-post-id-li",
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({}), { status: 404 });
};

async function run() {
  const results: { label: string; passed: boolean; detail?: string }[] = [];

  // 1. Verify publish() sends the correct FormData fields.
  lastCall = null;
  try {
    await publishToUploadPost({
      profile: "altitut",
      postId: "post-123",
      targets: [
        { platform: "instagram", placement: "feed" },
        { platform: "facebook", placement: "feed", pageId: "fb-page-123" },
        { platform: "linkedin", placement: "feed", visibility: "PUBLIC" },
      ],
      copy: {
        instagram: { caption: "IG caption", firstComment: "#hashtag" },
        facebook: { caption: "FB caption" },
        linkedin: { caption: "LI caption" },
      },
      media: [],
    });

    const body = lastCall?.init?.body;
    const text = body instanceof FormData ? await formDataToString(body) : String(body);
    const checks = [
      ["user=altitut", text.includes("user=altitut")],
      ["async_upload=true", text.includes("async_upload=true")],
      ["platform[]=instagram", text.includes("platform[]=instagram")],
      ["platform[]=facebook", text.includes("platform[]=facebook")],
      ["platform[]=linkedin", text.includes("platform[]=linkedin")],
      ["facebook_page_id=fb-page-123", text.includes("facebook_page_id=fb-page-123")],
      ["visibility=PUBLIC", text.includes("visibility=PUBLIC")],
      ["instagram_title=IG caption", text.includes("instagram_title=IG caption")],
      ["linkedin_description=LI caption", text.includes("linkedin_description=LI caption")],
      ["facebook_title=FB caption", text.includes("facebook_title=FB caption")],
      ["instagram_first_comment", text.includes("instagram_first_comment")],
    ] as const;

    for (const [label, ok] of checks) {
      results.push({ label: `form field: ${label}`, passed: ok, detail: ok ? undefined : text });
    }
  } catch (error) {
    results.push({
      label: "publish() does not throw",
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // 2. Verify publish() parses the synchronous object-shaped `results`.
  const published = await publishToUploadPost({
    profile: "altitut",
    postId: "post-456",
    targets: [
      { platform: "instagram", placement: "feed" },
      { platform: "facebook", placement: "feed", pageId: "fb-page-123" },
      { platform: "linkedin", placement: "feed" },
    ],
    copy: {
      instagram: { caption: "IG" },
      facebook: { caption: "FB" },
      linkedin: { caption: "LI" },
    },
    media: [],
  });

  const ig = published.results?.find((r) => r.platform === "instagram");
  const li = published.results?.find((r) => r.platform === "linkedin");
  const fb = published.results?.find((r) => r.platform === "facebook");

  results.push({
    label: "sync results parsed: instagram success + url",
    passed: ig?.status === "success" && ig?.postUrl === "https://instagram.com/p/test123",
    detail: JSON.stringify(ig),
  });
  results.push({
    label: "sync results parsed: linkedin success + url",
    passed: li?.status === "success" && li?.postUrl === "https://linkedin.com/feed/update/test456",
    detail: JSON.stringify(li),
  });
  results.push({
    label: "sync results parsed: facebook failed with error",
    passed: fb?.status === "failed" && fb?.error === "Facebook Page ID is required",
    detail: JSON.stringify(fb),
  });

  // 3. Verify status polling also extracts `url` / `post_id` correctly.
  const status = await checkUploadPostStatus("req-123", "request");
  results.push({
    label: "poll status detects done=true",
    passed: status.done === true,
    detail: `done=${status.done}`,
  });
  const pollIg = status.results?.find((r) => r.platform === "instagram");
  results.push({
    label: "poll results parsed: instagram url",
    passed: pollIg?.postUrl === "https://instagram.com/p/poll123",
    detail: JSON.stringify(pollIg),
  });

  // 4. Verify async upload flow: `request_id` response, then polling completion.
  const asyncFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes("/uploadposts/status")) {
      return new Response(
        JSON.stringify({
          request_id: "async-req-456",
          status: "completed",
          completed: 1,
          total: 1,
          results: [
            {
              platform: "instagram",
              success: true,
              message: "Published",
              url: "https://instagram.com/p/async123",
              post_id: "async-post-id-ig",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (/\/api\/(upload|upload_photos|upload_text)(\?|$)/.test(url)) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Upload initiated successfully in background.",
          request_id: "async-req-456",
          total_platforms: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  };
  global.fetch = asyncFetch as any;

  const asyncPublished = await publishToUploadPost({
    profile: "altitut",
    postId: "post-async",
    targets: [{ platform: "instagram", placement: "feed" }],
    copy: { instagram: { caption: "Async IG" } },
    media: [],
  });
  results.push({
    label: "async upload: request_id captured, results empty",
    passed: asyncPublished.requestId === "async-req-456" && (asyncPublished.results?.length ?? 0) === 0,
    detail: JSON.stringify(asyncPublished),
  });

  const asyncStatus = await checkUploadPostStatus("async-req-456", "request");
  results.push({
    label: "async poll: done + url extracted",
    passed: asyncStatus.done && asyncStatus.results?.[0]?.postUrl === "https://instagram.com/p/async123",
    detail: JSON.stringify(asyncStatus.results),
  });

  // Restore fetch.
  global.fetch = originalFetch;

  // Print report.
  console.log("--- Upload-Post Adapter Feedback Loop ---");
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "PASS" : "FAIL";
    console.log(`${icon}: ${r.label}`);
    if (!r.passed && r.detail) {
      console.log(`      detail: ${r.detail.slice(0, 500)}`);
      allPassed = false;
    }
  }
  if (!allPassed) {
    console.error("\nFeedback loop is RED — adapter has response-parsing / field-mapping bugs.");
    process.exit(1);
  }
  console.log("\nFeedback loop is GREEN — adapter maps Upload-Post responses correctly.");
}

async function formDataToString(fd: FormData): Promise<string> {
  const parts: string[] = [];
  for (const [key, value] of fd.entries()) {
    if (value instanceof Blob) {
      parts.push(`${key}=<Blob:${value.type}:${value.size}>`);
    } else {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.join("&");
}

run();
