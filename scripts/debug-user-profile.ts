import "dotenv/config";
import { uploadPostFetch } from "../lib/social/upload-post/client";

async function run() {
  const profile = process.env.UPLOAD_POST_PROFILE ?? "altitut";
  const res = await uploadPostFetch<unknown>(
    `/uploadposts/users/${encodeURIComponent(profile)}`,
  );
  console.log(JSON.stringify(res, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
