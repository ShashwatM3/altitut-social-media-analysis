"use client";

import { useState } from "react";

type TraceBannerProps = {
  message: string;
  traceId?: string | null;
  workflow?: string;
};

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="9" height="9" rx="1.5" />
      <path d="M12 6h1.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5V12" />
    </svg>
  );
}

export function TraceBanner({ message, traceId, workflow }: TraceBannerProps) {
  const [copied, setCopied] = useState(false);

  async function copyTraceId() {
    if (!traceId) return;
    try {
      await navigator.clipboard.writeText(traceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <p className="font-medium">{message}</p>
      {traceId ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-red-600">
            Trace ID:{" "}
            <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono">{traceId}</code>
            {workflow ? (
              <span className="ml-1.5 text-red-500/80">· {workflow}</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={copyTraceId}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <CopyIcon />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
