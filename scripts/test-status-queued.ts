/**
 * Isolated repro for the premature-polling bug.
 * Upload-Post can return status "in_progress" with per-platform `success: true`
 * and `message: "Queued"`. The adapter must NOT mark the job as done in that case.
 */

process.env.UPLOAD_POST_API_KEY = "test-key";
process.env.UPLOAD_POST_BASE_URL = "https://api.upload-post.com/api";

import { checkUploadPostStatus } from "../lib/social/upload-post/adapter";

const originalFetch = global.fetch;
(globalThis as any).fetch = async (input: RequestInfo | URL) => {
  const url = input.toString();
  if (url.includes("/uploadposts/status")) {
    return new Response(
      JSON.stringify({
        request_id: "req-queued",
        status: "in_progress",
        completed: 0,
        total: 1,
        results: [
          {
            platform: "instagram",
            success: true,
            message: "Queued",
            upload_timestamp: "2025-01-01T12:00:00Z",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(JSON.stringify({}), { status: 404 });
};

async function run() {
  const status = await checkUploadPostStatus("req-queued", "request");
  global.fetch = originalFetch;

  console.log("--- Queued Status Repro ---");
  console.log("done:", status.done);
  console.log("results:", JSON.stringify(status.results));

  if (status.done) {
    console.error("BUG: Polling marked as done while status is still 'in_progress' / 'Queued'.");
    process.exit(1);
  }
  if (status.results?.[0]?.status === "success") {
    console.error("BUG: Queued result mapped to success even though message says 'Queued'.");
    process.exit(1);
  }
  console.log("PASS: Queued status stays pending until the job actually completes.");
}

run();
