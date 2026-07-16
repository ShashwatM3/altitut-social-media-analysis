import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The archived-code git worktree lives as a sibling directory with its own
  // lockfile; pin tracing to this app so Next doesn't infer the wrong root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
