import "server-only";

import { SocialPublishError } from "../errors";
import type { Provider, PublishAdapter, PublishInput, PublishResult } from "../types";

export const postForMeAdapter: PublishAdapter = {
  vendor: "post_for_me",

  async publish(_provider: Provider, _input: PublishInput): Promise<PublishResult> {
    throw new SocialPublishError(
      {
        code: "NOT_IMPLEMENTED",
        message:
          "Post for Me is configured but not implemented yet. Switch SOCIAL_PROVIDER back to upload_post.",
        retryable: false,
      },
      {},
    );
  },
};
