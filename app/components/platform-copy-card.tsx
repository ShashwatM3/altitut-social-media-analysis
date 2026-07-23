"use client";

import { useMemo } from "react";

type Platform = "linkedin" | "facebook" | "instagram";

type PlatformCopyCardProps = {
  platform: Platform;
  copy: { caption: string; firstComment?: string };
  onChange: (copy: { caption: string; firstComment?: string }) => void;
  onGenerate: (mode: "generate" | "shorten" | "punchy") => void;
  aiBusy?: boolean;
  aiDisabled?: boolean;
  charLimit?: number;
  firstCommentHint?: string;
};

const PLATFORM_META: Record<
  Platform,
  { label: string; color: string; accentClass: string; icon: React.ReactNode }
> = {
  linkedin: {
    label: "LinkedIn",
    color: "#0A66C2",
    accentClass: "border-l-4 border-l-[#0A66C2]",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    accentClass: "border-l-4 border-l-[#1877F2]",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    accentClass: "border-l-4 border-l-[#E1306C]",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
};

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2l2.8 2.8M5.6 18.4l2.8-2.8m7.2-7.2l2.8-2.8" />
    </svg>
  );
}

export function PlatformCopyCard({
  platform,
  copy,
  onChange,
  onGenerate,
  aiBusy,
  aiDisabled,
  charLimit,
  firstCommentHint,
}: PlatformCopyCardProps) {
  const meta = PLATFORM_META[platform];
  const count = copy.caption.length;
  const overLimit = charLimit ? count > charLimit : false;

  const counterClass = useMemo(() => {
    if (overLimit) return "text-bright-coral font-semibold";
    if (charLimit && count > charLimit * 0.9) return "text-amber-600";
    return "text-gray-500";
  }, [charLimit, count, overLimit]);

  return (
    <div className={`rounded-xl bg-white p-4 shadow-modern ${meta.accentClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5" style={{ color: meta.color }}>
          {meta.icon}
          <h4 className="font-semibold text-gray-900">{meta.label}</h4>
        </div>
        <div className="flex items-center gap-2">
          {copy.caption.trim() ? (
            <>
              <button
                type="button"
                onClick={() => onGenerate("shorten")}
                disabled={aiBusy || aiDisabled}
                className="text-xs font-medium text-gray-600 hover:text-deep-teal disabled:opacity-50"
                title="Shorten"
              >
                Shorten
              </button>
              <button
                type="button"
                onClick={() => onGenerate("punchy")}
                disabled={aiBusy || aiDisabled}
                className="text-xs font-medium text-gray-600 hover:text-deep-teal disabled:opacity-50"
                title="Punch it up"
              >
                Punch it up
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => onGenerate("generate")}
            disabled={aiBusy || aiDisabled}
            title={aiDisabled ? "OpenAI API key is missing" : "Generate with AI"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-deep-teal/30 px-3 py-1.5 text-xs font-semibold text-deep-teal transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SparkleIcon />
            {aiBusy ? "Writing…" : "Generate with AI"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {platform === "linkedin" ? "Commentary" : "Caption"}
            </label>
            {charLimit ? (
              <span className={`text-xs ${counterClass}`}>
                {count} / {charLimit}
              </span>
            ) : (
              <span className="text-xs text-gray-500">{count}</span>
            )}
          </div>
          <textarea
            value={copy.caption}
            onChange={(e) => onChange({ ...copy, caption: e.target.value })}
            rows={4}
            disabled={aiBusy}
            className={`mt-1.5 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 disabled:opacity-70 ${
              aiBusy ? "shimmer" : ""
            } ${overLimit ? "border-bright-coral focus:ring-bright-coral" : ""}`}
            placeholder={
              platform === "linkedin"
                ? "Share an insight…"
                : platform === "instagram"
                  ? "Short, punchy hook first…"
                  : "Write a warm caption…"
            }
          />
          {overLimit ? (
            <p className="mt-1 text-xs text-bright-coral">
              This caption exceeds the {charLimit}-character limit.
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            First comment{" "}
            <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            value={copy.firstComment ?? ""}
            onChange={(e) => onChange({ ...copy, firstComment: e.target.value })}
            rows={2}
            disabled={aiBusy}
            className="mt-1.5 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 disabled:opacity-70"
            placeholder={firstCommentHint ?? "Add a first comment…"}
          />
        </div>
      </div>
    </div>
  );
}
