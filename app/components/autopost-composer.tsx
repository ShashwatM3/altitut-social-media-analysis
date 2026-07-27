"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { AnalysisPack } from "./pack-panel";
import {
  deriveMediaKindFromPack,
  derivePlacementFromPack,
  derivePlatformsFromPack,
  packToBrief,
  packToGroundTruth,
} from "../../lib/packs";
import { reelsTabEligible } from "../../lib/social/reels";
import type { MediaFile } from "./media-dropzone";
import { MediaDropzone } from "./media-dropzone";
import { PlatformCopyCard } from "./platform-copy-card";

type Platform = "linkedin" | "facebook" | "instagram";

type Copy = { caption: string; firstComment?: string };

type CaptionResponse = { captions: Record<Platform, Copy> };

type Target = {
  platform: Platform;
  placement: "feed" | "reel" | "story";
  visibility?: string;
  pageId?: string;
};

type Tone = "professional" | "punchy" | "playful" | "educational";

type AutopostStepId = "validate" | "publish" | "poll" | "save" | "delete";

type AutopostState = {
  postId: string;
  status?:
    | "draft"
    | "publishing"
    | "published"
    | "partial"
    | "failed"
    | "scheduled";
  media: {
    kind: "video" | "image" | "none";
    urls: string[];
    storagePaths: string[];
    width?: number;
    height?: number;
    durationSec?: number;
    bytes?: number;
  };
  brief?: string;
  copy: Partial<Record<Platform, Copy>>;
  targets: Target[];
  scheduledFor: string | null;
  timezone: string | null;
  vendorRequestId?: string;
  jobId?: string;
  results?: Array<{
    platform: Platform;
    status: "pending" | "success" | "failed" | "skipped";
    postUrl?: string;
    platformPostId?: string;
    error?: string;
  }>;
  warnings?: string[];
  done?: boolean;
  availablePages?: Array<{ id: string; name: string }>;
};

const PLACEMENTS: Record<Platform, { key: "feed" | "reel" | "story"; label: string }[]> = {
  linkedin: [{ key: "feed", label: "Feed" }],
  facebook: [
    { key: "feed", label: "Feed" },
    { key: "reel", label: "Reel" },
    { key: "story", label: "Story" },
  ],
  instagram: [
    { key: "feed", label: "Feed" },
    { key: "reel", label: "Reel" },
    { key: "story", label: "Story" },
  ],
};

const PLATFORM_META: Record<
  Platform,
  { name: string; short: string; charLimit?: number; firstCommentHint?: string; note: string }
> = {
  linkedin: {
    name: "LinkedIn",
    short: "LinkedIn",
    charLimit: 3000,
    note: "Posts to your profile or a connected company page.",
  },
  facebook: {
    name: "Facebook",
    short: "Facebook Page",
    note: "Publishes to a Page, not a personal profile.",
  },
  instagram: {
    name: "Instagram",
    short: "Instagram",
    charLimit: 2200,
    firstCommentHint: "Put hashtags here to keep the caption clean",
    note: "Requires a Professional (Business or Creator) account.",
  },
};

const STEPS = [
  { id: "media", label: "Media" },
  { id: "destinations", label: "Destinations" },
  { id: "copy", label: "Copy" },
  { id: "review", label: "Review & Publish" },
] as const;

function StepIndicator({ status }: { status: "pending" | "running" | "done" | "error" }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-green-100 text-green-700">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 8 6.5 12 13 4.5" />
        </svg>
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex h-6 w-6 flex-none items-center justify-center">
        <span className="h-3 w-3 animate-pulse rounded-full bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.7)]" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-600">
        !
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 flex-none items-center justify-center">
      <span className="h-2.5 w-2.5 rounded-full border-2 border-gray-300" />
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 8 6.5 12 13 4.5" />
    </svg>
  );
}

function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mediaKindFromFiles(files: MediaFile[]): "video" | "image" | "none" {
  if (files.length === 0) return "none";
  return files[0].kind;
}

function mediaFromFiles(files: MediaFile[]): AutopostState["media"] {
  const kind = mediaKindFromFiles(files);
  return {
    kind,
    urls: files.map((f) => f.url),
    storagePaths: files.map((f) => f.path),
    width: files[0]?.width,
    height: files[0]?.height,
    durationSec: files[0]?.durationSec,
    bytes: files.reduce((sum, f) => sum + f.bytes, 0),
  };
}

function formatDateForInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

export function AutoPostComposer({
  pack,
  onPublish,
}: {
  pack?: AnalysisPack;
  onPublish?: () => void;
}) {
  const [activeStep, setActiveStep] = useState<(typeof STEPS)[number]["id"]>("media");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [targets, setTargets] = useState<Target[]>([
    { platform: "linkedin", placement: "feed", visibility: "PUBLIC" },
  ]);
  const [copy, setCopy] = useState<Partial<Record<Platform, Copy>>>({});
  const [sameCopy, setSameCopy] = useState(true);
  const [aiBrief, setAiBrief] = useState("");
  const [aiTone, setAiTone] = useState<Tone>("professional");
  const [briefOpen, setBriefOpen] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<Platform | null>(null);
  const [packGenerating, setPackGenerating] = useState(false);
  const [aiDisabled, setAiDisabled] = useState(false);
  const [pendingCaptions, setPendingCaptions] = useState<Partial<Record<Platform, Copy>> | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>("Asia/Dubai");

  const [publishPhase, setPublishPhase] = useState<
    "idle" | "validating" | "submitting" | "processing" | "published" | "error"
  >("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<AutopostState | null>(null);
  const [publishSteps, setPublishSteps] = useState<{ id: string; label: string; status: "pending" | "running" | "done" | "error" }[]>([]);

  const abortRef = useRef(false);

  type Account = {
    provider: Platform;
    displayName: string;
    status: "active" | "needs_reauth";
    pageId?: string;
  };
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    void fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch(api("/api/autopost/accounts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: ["linkedin", "facebook", "instagram"] }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        accounts?: Account[];
      };
      if (json.accounts) setAccounts(json.accounts);
    } catch (error) {
      console.error("[autopost] fetch accounts:", error);
    }
  }

  // If opened from a content pack, pre-select platforms, pre-write the brief,
  // and generate platform-tailored captions using the pack as ground truth.
  useEffect(() => {
    if (!pack) return;
    const platforms = derivePlatformsFromPack(pack);
    const placement = derivePlacementFromPack(pack);
    const brief = packToBrief(pack);
    setAiBrief(brief);
    setTargets(
      platforms.map((platform) => ({
        platform,
        placement,
        visibility: platform === "linkedin" ? "PUBLIC" : undefined,
      })),
    );
    setActiveStep("media");
    void generateForPlatforms(platforms, "generate", brief, aiTone, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);

  const mediaKind = useMemo(() => mediaKindFromFiles(mediaFiles), [mediaFiles]);

  const captionMediaKind = useMemo(() => {
    if (mediaKind !== "none") return mediaKind;
    if (pack) return deriveMediaKindFromPack(pack);
    return "video" as const;
  }, [pack, mediaKind]);

  const selectedPlatforms = useMemo(
    () => targets.map((t) => t.platform),
    [targets],
  );

  function defaultCopyFor(platform: Platform): Copy {
    return copy[platform] ?? { caption: "", firstComment: "" };
  }

  function setPlatformCopy(platform: Platform, next: Copy) {
    if (sameCopy) {
      const nextAll: Partial<Record<Platform, Copy>> = {};
      for (const p of selectedPlatforms) {
        nextAll[p] = next;
      }
      setCopy((prev) => ({ ...prev, ...nextAll }));
    } else {
      setCopy((prev) => ({ ...prev, [platform]: next }));
    }
  }

  function togglePlatform(platform: Platform) {
    setTargets((prev) => {
      const exists = prev.find((t) => t.platform === platform);
      if (exists) return prev.filter((t) => t.platform !== platform);
      return [
        ...prev,
        {
          platform,
          placement: "feed" as const,
          visibility: platform === "linkedin" ? "PUBLIC" : undefined,
        },
      ];
    });
  }

  function setPlacement(platform: Platform, placement: "feed" | "reel" | "story") {
    setTargets((prev) =>
      prev.map((t) => (t.platform === platform ? { ...t, placement } : t)),
    );
  }

  function setVisibility(platform: Platform, visibility: string) {
    setTargets((prev) =>
      prev.map((t) => (t.platform === platform ? { ...t, visibility } : t)),
    );
  }

  function isValidForStep(step: (typeof STEPS)[number]["id"]): boolean {
    if (step === "media") return true;
    if (step === "destinations") return targets.length > 0;
    if (step === "copy") {
      if (targets.length === 0) return false;
      return targets.every((t) => {
        const c = copy[t.platform];
        if (!c || !c.caption.trim()) return false;
        if (t.platform === "linkedin" && c.caption.length > 3000) return false;
        if (t.platform === "instagram" && c.caption.length > 2200) return false;
        return true;
      });
    }
    if (step === "review") return isValidForStep("copy");
    return false;
  }

  function canPublish(): boolean {
    if (mediaFiles.some((f) => f.status !== "done")) return false;
    if (targets.length === 0) return false;
    if (!isValidForStep("copy")) return false;
    return true;
  }

  async function callAutopost(step: AutopostStepId, state: AutopostState): Promise<{ state?: AutopostState; error?: string }> {
    const res = await fetch(api("/api/autopost"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, state }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      state?: AutopostState;
      error?: string;
    };
    if (!res.ok) {
      return { error: json.error ?? `Step ${step} failed.` };
    }
    return { state: json.state, error: json.error };
  }

  async function runPublish() {
    if (abortRef.current) return;
    setPublishPhase("validating");
    setPublishError(null);
    setPublishSteps([
      { id: "validate", label: "Validating", status: "running" },
      { id: "publish", label: "Submitting to LinkedIn/Facebook/Instagram", status: "pending" },
      { id: "process", label: "Processing", status: "pending" },
      { id: "save", label: "Published", status: "pending" },
    ]);

    const initialState: AutopostState = {
      postId: generateId(),
      media: mediaFromFiles(mediaFiles),
      brief: aiBrief,
      copy,
      targets,
      scheduledFor: scheduled ? scheduledFor : null,
      timezone: scheduled ? timezone : null,
      results: targets.map((t) => ({ platform: t.platform, status: "pending" })),
    };

    const validateRes = await callAutopost("validate", initialState);
    if (validateRes.error || !validateRes.state) {
      setPublishError(validateRes.error ?? "Validation failed.");
      setPublishPhase("error");
      setPublishSteps((s) => updateStep(s, "validate", "error"));
      return;
    }

    let state = validateRes.state;
    setPublishSteps((s) => updateStep(s, "validate", "done"));
    setPublishSteps((s) => updateStep(s, "publish", "running"));

    const publishRes = await callAutopost("publish", state);
    if (publishRes.error || !publishRes.state) {
      setPublishError(publishRes.error ?? "Publish failed.");
      setPublishPhase("error");
      setPublishSteps((s) => updateStep(s, "publish", "error"));
      return;
    }
    state = publishRes.state;

    // publishStep already computed the correct status (published/publishing/scheduled).
    await callAutopost("save", state);

    setPublishSteps((s) => updateStep(s, "publish", "done"));

    if (state.done) {
      setPublishSteps((s) => updateStep(s, "process", "done"));
      state.status = computeStatusFromResults(state.results ?? []);
      await callAutopost("save", state);
      setPublishSteps((s) => updateStep(s, "save", "done"));
      setPublishPhase("published");
      setPublishState(state);
      onPublish?.();
      return;
    }

    setPublishSteps((s) => updateStep(s, "process", "running"));
    setPublishPhase("processing");

    let done = false;
    let attempts = 0;
    while (!done && attempts < 120) {
      if (abortRef.current) break;
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await callAutopost("poll", state);
      if (pollRes.error || !pollRes.state) {
        setPublishError(pollRes.error ?? "Status polling failed.");
        setPublishPhase("error");
        setPublishSteps((s) => updateStep(s, "process", "error"));
        return;
      }
      state = pollRes.state;
      done = Boolean(state.done);
      attempts += 1;
    }

    if (done) {
      setPublishSteps((s) => updateStep(s, "process", "done"));
    } else {
      setPublishSteps((s) => updateStep(s, "process", "error"));
      state.status = "failed";
      setPublishError(
        "Publishing is still in progress after the maximum wait time. The post may still complete in the background; check Post history.",
      );
      setPublishPhase("error");
      await callAutopost("save", state);
      setPublishState(state);
      return;
    }

    state.status = computeStatusFromResults(state.results ?? []);
    await callAutopost("save", state);
    setPublishSteps((s) => updateStep(s, "save", "done"));
    setPublishPhase("published");
    setPublishState(state);
    onPublish?.();
  }

  function updateStep(
    steps: { id: string; label: string; status: "pending" | "running" | "done" | "error" }[],
    id: string,
    status: "pending" | "running" | "done" | "error",
  ) {
    return steps.map((s) => (s.id === id ? { ...s, status } : s));
  }

  function computeStatusFromResults(
    results: AutopostState["results"],
  ): AutopostState["status"] {
    if (!results || results.length === 0) return "publishing";
    const statuses = results.map((r) => r.status);
    if (statuses.every((s) => s === "success")) return "published";
    if (statuses.every((s) => s === "failed" || s === "skipped")) return "failed";
    if (statuses.some((s) => s === "success")) return "partial";
    if (statuses.some((s) => s === "pending")) return "publishing";
    return "failed";
  }

  async function fetchCaptions(
    platforms: Platform[],
    mode: "generate" | "shorten" | "punchy",
    brief: string,
    tone: Tone,
  ): Promise<CaptionResponse> {
    const apiMode = mode === "punchy" ? "refine" : mode;
    const apiTone = mode === "punchy" ? "punchy" : tone;
    const existingCopy: Partial<Record<Platform, string>> = {};
    for (const p of platforms) {
      if (copy[p]?.caption) existingCopy[p] = copy[p].caption;
    }
    const res = await fetch(api("/api/autopost/caption"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platforms,
        mediaKind: captionMediaKind,
        brief,
        tone: apiTone,
        mode: apiMode,
        existingCopy: Object.keys(existingCopy).length ? existingCopy : undefined,
        packContext: pack ? packToGroundTruth(pack) : undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      captions?: Record<Platform, Copy & { hashtags?: string[] }>;
      error?: string;
    };
    if (!res.ok) {
      if (res.status === 503) setAiDisabled(true);
      throw new Error(json.error ?? "Caption generation failed.");
    }
    return { captions: json.captions ?? ({} as Record<Platform, Copy>) };
  }

  async function handleGenerate(platform: Platform, mode: "generate" | "shorten" | "punchy") {
    if (!aiBrief && mode !== "shorten") {
      setGeneratingFor(platform);
      setBriefOpen(true);
      return;
    }
    setGeneratingFor(platform);
    try {
      const { captions } = await fetchCaptions([platform], mode, aiBrief, aiTone);
      const generated = captions[platform];
      if (generated) {
        setPendingCaptions((prev) => ({ ...prev, [platform]: generated }));
      }
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "AI failed");
    } finally {
      setGeneratingFor(null);
    }
  }

  async function generateForPlatforms(
    platforms: Platform[],
    mode: "generate" | "shorten" | "punchy",
    brief: string,
    tone: Tone,
    applyDirectly = false,
  ): Promise<void> {
    setPackGenerating(true);
    try {
      const { captions } = await fetchCaptions(platforms, mode, brief, tone);
      if (applyDirectly) {
        const next: Partial<Record<Platform, Copy>> = {};
        for (const p of platforms) {
          next[p] = captions[p];
        }
        setCopy(next);
      } else {
        setPendingCaptions((prev) => ({ ...prev, ...captions }));
      }
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "AI failed");
    } finally {
      setPackGenerating(false);
    }
  }

  function applyPending(platform: Platform, use: boolean) {
    if (!pendingCaptions) return;
    const generated = pendingCaptions[platform];
    if (!generated) return;
    if (use) {
      setPlatformCopy(platform, generated);
    }
    setPendingCaptions((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[platform];
      return Object.keys(next).length > 0 ? next : null;
    });
  }

  function handleBriefSubmit() {
    if (!generatingFor) return;
    if (!aiBrief.trim()) return;
    setBriefOpen(false);
    void handleGenerate(generatingFor, "generate");
  }

  function renderStepper() {
    const activeIndex = STEPS.findIndex((s) => s.id === activeStep);
    return (
      <div className="mb-8">
        <ol className="flex items-center justify-between" aria-label="Publishing steps">
          {STEPS.map((step, index) => {
            const isCompleted = index < activeIndex;
            const isActive = index === activeIndex;
            const stepStatus = isCompleted
              ? "done"
              : isActive
                ? "running"
                : "pending";
            return (
              <li key={step.id} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => isCompleted && setActiveStep(step.id)}
                  disabled={!isCompleted}
                  className="flex items-center gap-2"
                  aria-current={isActive ? "step" : undefined}
                >
                  <StepIndicator status={stepStatus} />
                  <span
                    className={`text-sm font-medium ${
                      isActive
                        ? "text-gray-900"
                        : isCompleted
                          ? "text-gray-900"
                          : "text-gray-500"
                    }`}
                  >
                    {index + 1}. {step.label}
                  </span>
                </button>
                {index < STEPS.length - 1 ? (
                  <div
                    className={`mx-3 h-0.5 flex-1 ${
                      index < activeIndex ? "bg-deep-teal" : "bg-gray-200"
                    }`}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  function renderMediaStep() {
    return (
      <div className="animate-fade-in-up">
        <h3 className="text-lg font-semibold text-gray-900">Upload your media</h3>
        <p className="mt-1 text-sm text-gray-600">
          Drag in a video or up to 10 images. Files upload directly to Firebase
          Storage so the API never has to proxy the bytes.
        </p>
        <div className="mt-4">
          <MediaDropzone
            files={mediaFiles}
            onChange={setMediaFiles}
            onError={(msg) => setPublishError(msg)}
          />
        </div>
        {publishError ? (
          <p className="mt-3 text-sm text-bright-coral">{publishError}</p>
        ) : null}
      </div>
    );
  }

  function renderDestinationsStep() {
    return (
      <div className="animate-fade-in-up">
        <h3 className="text-lg font-semibold text-gray-900">Choose destinations</h3>
        <p className="mt-1 text-sm text-gray-600">
          Select where this post will go and how it should appear.
        </p>
        {accounts.some((a) => a.status === "needs_reauth") ? (
          <p className="mt-2 text-xs text-amber-700">
            Platforms marked “needs reconnect” are not configured yet. They will be
            skipped at publish time so the others can still go live.
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["linkedin", "facebook", "instagram"] as Platform[]).map((platform) => {
            const selected = targets.some((t) => t.platform === platform);
            const target = targets.find((t) => t.platform === platform);
            const account = accounts.find((a) => a.provider === platform);
            const disabled = platform === "instagram" && mediaKind === "none";
            return (
              <div
                key={platform}
                className={`rounded-xl border bg-white p-4 text-left transition-all ${
                  selected
                    ? "border-deep-teal ring-2 ring-teal-500/30 shadow-modern"
                    : "border-gray-200 hover:border-gray-300 hover-lift"
                } ${disabled ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && togglePlatform(platform)}
                  className="w-full text-left disabled:cursor-not-allowed"
                  aria-pressed={selected}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      {PLATFORM_META[platform].name}
                    </span>
                    {selected ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-deep-teal text-white">
                        <CheckIcon />
                      </span>
                    ) : (
                      <span className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    {account ? (
                      <>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            account.status === "active"
                              ? "bg-green-500"
                              : "bg-amber-500"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="text-gray-700">{account.displayName}</span>
                        {account.status === "needs_reauth" ? (
                          <span className="text-amber-600">(will be skipped)</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-gray-500">{PLATFORM_META[platform].note}</span>
                    )}
                  </div>
                </button>
                {selected ? (
                  <div className="mt-4 space-y-3">
                    {platform === "linkedin" ? (
                      <div>
                        <label className="text-xs font-medium text-gray-700">Visibility</label>
                        <select
                          value={target?.visibility ?? "PUBLIC"}
                          onChange={(e) => setVisibility(platform, e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
                        >
                          <option value="PUBLIC">PUBLIC</option>
                          <option value="CONNECTIONS">CONNECTIONS</option>
                          <option value="LOGGED_IN">LOGGED_IN</option>
                        </select>
                      </div>
                    ) : null}
                    {mediaKind === "video" || mediaKind === "image" ? (
                      <div>
                        <label className="text-xs font-medium text-gray-700">Placement</label>
                        <div className="mt-1 flex rounded-lg border border-gray-200 p-1">
                          {PLACEMENTS[platform]
                            .filter((p) => mediaKind === "video" || p.key !== "reel")
                            .map((p) => (
                              <button
                                key={p.key}
                                type="button"
                                onClick={() => setPlacement(platform, p.key)}
                                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
                                  target?.placement === p.key
                                    ? "bg-deep-teal text-white"
                                    : "text-gray-600 hover:bg-gray-50"
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                        </div>
                        {platform !== "linkedin" && target?.placement === "reel" && mediaKind === "video" && mediaFiles[0] ? (
                          <ReelWarning file={mediaFiles[0]} />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderCopyStep() {
    return (
      <div className="animate-fade-in-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Write the copy</h3>
            <p className="mt-1 text-sm text-gray-600">
              Tailor each platform or use the same copy everywhere.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={sameCopy}
              onChange={(e) => setSameCopy(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-deep-teal focus:ring-deep-teal"
            />
            Same copy everywhere
          </label>
        </div>

        {pendingCaptions ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              AI generated new copy. Keep original or use the new version?
            </p>
            <div className="mt-2 flex gap-2">
              {selectedPlatforms
                .filter((p) => pendingCaptions[p])
                .map((p) => (
                  <div key={p} className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyPending(p, false)}
                      className="rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                    >
                      Keep original ({PLATFORM_META[p].short})
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPending(p, true)}
                      className="rounded-md bg-deep-teal px-3 py-1 text-xs font-medium text-white hover:bg-darker-teal"
                    >
                      Use new ({PLATFORM_META[p].short})
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4">
          {selectedPlatforms.map((platform) => (
            <PlatformCopyCard
              key={platform}
              platform={platform}
              copy={defaultCopyFor(platform)}
              onChange={(next) => setPlatformCopy(platform, next)}
              onGenerate={(mode) => void handleGenerate(platform, mode)}
              aiBusy={generatingFor === platform || packGenerating}
              aiDisabled={aiDisabled}
              charLimit={PLATFORM_META[platform].charLimit}
              firstCommentHint={PLATFORM_META[platform].firstCommentHint}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderReviewStep() {
    return (
      <div className="animate-fade-in-up">
        <h3 className="text-lg font-semibold text-gray-900">Review & publish</h3>
        <p className="mt-1 text-sm text-gray-600">
          Double-check everything before it goes live.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700">Media preview</h4>
            <div className="mt-3">
              {mediaFiles.length > 0 ? (
                mediaFiles[0].kind === "video" ? (
                  mediaFiles[0].url ? (
                    <video
                      src={mediaFiles[0].url}
                      controls
                      muted
                      playsInline
                      className="max-h-64 rounded-lg"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
                      Uploading…
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {mediaFiles.slice(0, 4).map((f) =>
                      f.url ? (
                        <img
                          key={f.id}
                          src={f.url}
                          alt=""
                          className="h-32 w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          key={f.id}
                          className="flex h-32 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-500"
                        >
                          Uploading…
                        </div>
                      ),
                    )}
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-500">No media attached (text-only post).</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700">Destinations</h4>
            <ul className="mt-3 space-y-3">
              {targets.map((t) => (
                <li key={t.platform} className="text-sm text-gray-800">
                  <strong className="text-gray-900">{PLATFORM_META[t.platform].name}</strong>
                  {" — "}
                  {t.placement}
                  {t.visibility ? ` · ${t.visibility}` : null}
                  <p className="mt-1 line-clamp-2 text-gray-600">
                    {copy[t.platform]?.caption}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-center gap-3">
              <input
                id="schedule"
                type="checkbox"
                checked={scheduled}
                onChange={(e) => setScheduled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-deep-teal focus:ring-deep-teal"
              />
              <label htmlFor="schedule" className="text-sm font-medium text-gray-700">
                Schedule for later
              </label>
            </div>
            {scheduled ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  value={formatDateForInput(scheduledFor)}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setScheduledFor(Number.isNaN(date.getTime()) ? null : date.toISOString());
                  }}
                  className="rounded-lg border border-gray-300 p-2.5 text-sm"
                />
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="rounded-lg border border-gray-300 p-2.5 text-sm"
                >
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                </select>
              </div>
            ) : null}
          </div>
        </div>

        {publishPhase !== "idle" ? (
          <div
            className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            aria-live="polite"
          >
            <ol className="grid gap-3">
              {publishSteps.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <StepIndicator status={s.status} />
                  <span
                    className={`text-sm ${
                      s.status === "error"
                        ? "font-medium text-red-600"
                        : s.status === "done"
                          ? "text-gray-900"
                          : s.status === "running"
                            ? "font-medium text-gray-900"
                            : "text-gray-500"
                    }`}
                  >
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
            {publishError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {publishError}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void runPublish()}
                    className="rounded-md bg-deep-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-darker-teal"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishPhase("idle")}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
            {publishPhase === "published" && publishState?.results ? (
              <div className="mt-4 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                {publishState.results.map((r) => (
                  <div key={r.platform} className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{r.platform}</span>
                    {r.status === "success" && r.postUrl ? (
                      <a
                        href={r.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-deep-teal underline hover:text-darker-teal"
                      >
                        View
                      </a>
                    ) : r.status === "skipped" ? (
                      <span className="text-amber-600" title={r.error}>
                        Skipped
                      </span>
                    ) : r.status === "failed" ? (
                      <span className="text-red-600" title={r.error}>
                        Failed
                      </span>
                    ) : (
                      <span className="text-gray-500">{r.status}</span>
                    )}
                  </div>
                ))}
                {publishState.warnings && publishState.warnings.length > 0 ? (
                  <div className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                    {publishState.warnings.map((w, i) => (
                      <p key={i}>• {w}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setActiveStep("copy")}
            className="rounded-lg border border-gray-300 px-6 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void runPublish()}
            disabled={!canPublish()}
            className="rounded-lg bg-maroon px-6 py-2.5 font-semibold text-white transition-colors hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </div>
    );
  }

  function renderContent() {
    switch (activeStep) {
      case "media":
        return renderMediaStep();
      case "destinations":
        return renderDestinationsStep();
      case "copy":
        return renderCopyStep();
      case "review":
        return renderReviewStep();
      default:
        return null;
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-modern md:p-6">
      {renderStepper()}
      {renderContent()}

      <div className="mt-8 flex justify-between border-t border-gray-200 pt-5">
        <button
          type="button"
          onClick={() => {
            const idx = STEPS.findIndex((s) => s.id === activeStep);
            if (idx > 0) setActiveStep(STEPS[idx - 1].id);
          }}
          disabled={activeStep === "media"}
          className="rounded-lg border border-gray-300 px-6 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => {
            const idx = STEPS.findIndex((s) => s.id === activeStep);
            if (idx < STEPS.length - 1 && isValidForStep(activeStep)) {
              setActiveStep(STEPS[idx + 1].id);
            }
          }}
          disabled={activeStep === STEPS[STEPS.length - 1].id || !isValidForStep(activeStep)}
          className="rounded-lg bg-deep-teal px-6 py-2.5 font-semibold text-white transition-colors hover:bg-darker-teal disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {briefOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-subtle"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-modern-lg">
            <h3 className="text-lg font-semibold text-gray-900">
              What&apos;s this video about?
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              A one-line brief helps the AI match Altitut&apos;s voice.
            </p>
            <input
              type="text"
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              placeholder="e.g. A student-founder explaining how Altitut helped validate her idea"
              className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-transparent focus:ring-2 focus:ring-teal-500"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {(["professional", "punchy", "playful", "educational"] as Tone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAiTone(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    aiTone === t
                      ? "bg-deep-teal text-white"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBriefOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBriefSubmit}
                disabled={!aiBrief.trim()}
                className="rounded-lg bg-deep-teal px-4 py-2 font-semibold text-white transition-colors hover:bg-darker-teal disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReelWarning({ file }: { file: MediaFile }) {
  const { eligible, reason } = reelsTabEligible({
    width: file.width,
    height: file.height,
    durationSec: file.durationSec,
  });
  if (eligible) return null;
  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
      This video will publish, but it won&apos;t appear in the Reels tab — {reason}.
    </div>
  );
}
