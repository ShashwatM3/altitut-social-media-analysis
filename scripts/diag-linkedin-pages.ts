import "dotenv/config";
import { uploadPostFetch } from "../lib/social/upload-post/client";

async function run() {
  const profile = process.env.UPLOAD_POST_PROFILE ?? "altitut";
  console.log(`Checking LinkedIn pages for Upload-Post profile: ${profile}`);
  try {
    const res = (await uploadPostFetch<unknown>(
      `/uploadposts/linkedin/pages?profile=${encodeURIComponent(profile)}`,
    )) as Record<string, unknown>;
    console.log("Response:", JSON.stringify(res, null, 2));
  } catch (error) {
    console.error("Failed:", error instanceof Error ? error.message : error);
  }
}

run();
