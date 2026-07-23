import "server-only";

import { postForMeAdapter } from "./post-for-me/adapter";
import { uploadPostAdapter } from "./upload-post/adapter";
import type { PublishAdapter } from "./types";

export function getAdapter(): PublishAdapter {
  return process.env.SOCIAL_PROVIDER === "post_for_me"
    ? postForMeAdapter
    : uploadPostAdapter;
}
