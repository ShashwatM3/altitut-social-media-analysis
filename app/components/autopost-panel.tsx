"use client";

import { AutoPostComposer } from "./autopost-composer";
import { AutoPostHistory } from "./autopost-history";

export function AutoPostPanel() {
  return (
    <section className="grid gap-6 md:gap-8" aria-label="Auto-Post">
      <header className="border-b border-gray-200 pb-5">
        <h2 className="text-2xl font-semibold text-gray-900 lg:text-3xl">
          Auto-Post
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 lg:text-base">
          Upload once, write platform-tailored copy, and publish to LinkedIn,
          Facebook and Instagram through Upload-Post.
        </p>
      </header>
      <AutoPostComposer />
      <AutoPostHistory />
    </section>
  );
}
