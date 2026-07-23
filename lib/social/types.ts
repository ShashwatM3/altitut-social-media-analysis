import "server-only";

export type Provider = "linkedin" | "facebook" | "instagram";

export type MediaInput = {
  storagePath?: string;
  publicUrl?: string;
  mimeType: string;
  kind: "image" | "video" | "document";
  width?: number;
  height?: number;
  durationSec?: number;
  altText?: string;
};

export type PublishInput = {
  accountId: string;
  text: string;
  media: MediaInput[];
  idempotencyKey: string;
  scheduledFor?: Date;
  /** Platform-specific escape hatch and per-target overrides. */
  options?: Record<string, unknown>;
};

export type PublishResult = {
  providerPostId?: string;
  permalink?: string;
  /** Set when the vendor accepted the job asynchronously. Poll or await webhook. */
  pendingRequestId?: string;
};

export interface PublishAdapter {
  readonly vendor: "upload_post" | "post_for_me";
  publish(provider: Provider, input: PublishInput): Promise<PublishResult>;
  checkStatus?(requestId: string): Promise<PublishResult & { done: boolean }>;
  delete?(provider: Provider, providerPostId: string, accountId: string): Promise<void>;
}
