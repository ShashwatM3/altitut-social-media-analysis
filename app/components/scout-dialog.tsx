"use client";

import { useCallback, useRef, useState } from "react";
import { DEFAULT_ALTITUT_DESCRIPTION } from "../../lib/altitut";
import type { StoredPack } from "../../lib/packs";

type StepStatus = "pending" | "running" | "done" | "error";

type WorkflowStep = {
  id: string;
  label: string;
  status: StepStatus;
};

const WORKFLOW_STEPS: { id: string; label: string }[] = [
  { id: "discover", label: "Discover competitor candidates (live web search)" },
  { id: "website", label: "Crawl website & product pages" },
  { id: "social", label: "Map social presence (Instagram, LinkedIn, X, YouTube, TikTok)" },
  { id: "research", label: "Deep research: news, reviews, ads, partnerships" },
  { id: "synthesize-identity", label: "Synthesize — Identity & Product (sections 1–2)" },
  { id: "synthesize-social", label: "Synthesize — Social, Content & Top Performers (sections 3–5)" },
  { id: "synthesize-verdict", label: "Synthesize — Paid, Audience, Verdict & TL;DR (sections 6–8)" },
  { id: "save", label: "Save competitor to the dashboard & knowledge base" },
];

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.5 2.7a.8.8 0 0 1 1.2-.7l8 5.3a.8.8 0 0 1 0 1.4l-8 5.3a.8.8 0 0 1-1.2-.7V2.7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8.5 6.5 12 13 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-green-100 text-green-700">
        <CheckIcon />
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

type ScoutRunnerProps = {
  existingNames: string[];
  onComplete: (pack: StoredPack) => void;
};

export function RunCompetitorScout({ existingNames, onComplete }: ScoutRunnerProps) {
  const [phase, setPhase] = useState<"idle" | "input" | "progress">("idle");
  const [description, setDescription] = useState(DEFAULT_ALTITUT_DESCRIPTION);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [foundName, setFoundName] = useState<string | null>(null);
  const [finishedPack, setFinishedPack] = useState<StoredPack | null>(null);
  // Serialized workflow state handed between step API calls.
  const stateRef = useRef<Record<string, unknown> | null>(null);
  const runningRef = useRef(false);

  const setStepStatus = useCallback((id: string, status: StepStatus) => {
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, status } : step)),
    );
  }, []);

  const runFrom = useCallback(
    async (startIndex: number) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setError(null);
      try {
        for (let index = startIndex; index < WORKFLOW_STEPS.length; index += 1) {
          const step = WORKFLOW_STEPS[index];
          setStepStatus(step.id, "running");
          const response = await fetch("/api/scout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: step.id, state: stateRef.current }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw Object.assign(
              new Error(payload.error ?? `Step "${step.label}" failed.`),
              { stepIndex: index },
            );
          }
          stateRef.current = payload.state;
          const candidate = (payload.state as { candidate?: { name?: string } })
            ?.candidate;
          if (candidate?.name) {
            setFoundName(candidate.name);
          }
          setStepStatus(step.id, "done");
          if (step.id === "save" && payload.pack) {
            setFinishedPack(payload.pack as StoredPack);
            onComplete(payload.pack as StoredPack);
          }
        }
      } catch (caught) {
        const failedIndex =
          typeof (caught as { stepIndex?: number }).stepIndex === "number"
            ? (caught as { stepIndex: number }).stepIndex
            : startIndex;
        setStepStatus(WORKFLOW_STEPS[failedIndex].id, "error");
        setError(
          caught instanceof Error ? caught.message : "The workflow failed unexpectedly.",
        );
      } finally {
        runningRef.current = false;
      }
    },
    [onComplete, setStepStatus],
  );

  const startWorkflow = useCallback(() => {
    stateRef.current = {
      productDescription: description.trim(),
      existingNames,
    };
    setSteps(WORKFLOW_STEPS.map((step) => ({ ...step, status: "pending" })));
    setFoundName(null);
    setFinishedPack(null);
    setPhase("progress");
    void runFrom(0);
  }, [description, existingNames, runFrom]);

  const retryFailed = useCallback(() => {
    const failedIndex = steps.findIndex((step) => step.status === "error");
    if (failedIndex >= 0) {
      setStepStatus(steps[failedIndex].id, "pending");
      void runFrom(failedIndex);
    }
  }, [runFrom, setStepStatus, steps]);

  const isRunning = steps.some((step) => step.status === "running");
  const isFinished = finishedPack !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => setPhase("input")}
        className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-maroon-dark"
      >
        <span>Run Competitor Scout</span>
        <PlayIcon />
      </button>

      {phase === "input" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-subtle"
          role="dialog"
          aria-modal="true"
          aria-label="Run Competitor Scout"
        >
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-modern-lg">
            <h3 className="text-xl font-semibold text-gray-900">
              Description of your own product
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              The scout uses this description to hunt for the closest untracked
              competitor. Edit it if you want to steer the search.
            </p>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={7}
              className="mt-4 w-full rounded-lg border border-gray-300 p-3 text-sm leading-relaxed text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPhase("idle")}
                className="rounded-lg border border-gray-300 px-6 py-2 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startWorkflow}
                disabled={description.trim().length < 20}
                className="rounded-lg bg-maroon px-6 py-2 font-semibold text-white transition-colors hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "progress" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-subtle"
          role="dialog"
          aria-modal="true"
          aria-label="Competitor Scout progress"
        >
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-modern-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Competitor Scout is running
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {foundName
                    ? `Target locked: ${foundName}`
                    : "Hunting for the closest untracked competitor…"}
                </p>
              </div>
              {isFinished ? (
                <span className="rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Complete
                </span>
              ) : null}
            </div>

            <ol className="mt-5 grid gap-3">
              {steps.map((step) => (
                <li key={step.id} className="flex items-center gap-3">
                  <StepIndicator status={step.status} />
                  <span
                    className={`text-sm ${
                      step.status === "done"
                        ? "text-gray-900"
                        : step.status === "running"
                          ? "font-medium text-gray-900"
                          : step.status === "error"
                            ? "font-medium text-red-600"
                            : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            ) : null}

            {isFinished && finishedPack ? (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-green-100 text-green-700">
                  <CheckIcon />
                </span>
                <p className="text-sm text-green-800">
                  <strong className="font-semibold">{finishedPack.name}</strong>{" "}
                  has been saved to your dashboard — {finishedPack.tag} ·{" "}
                  {finishedPack.meta}. It&apos;s live in the competitor list below
                  and the copilot already knows about it.
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-3">
              {error ? (
                <button
                  type="button"
                  onClick={retryFailed}
                  className="rounded-lg bg-teal-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-teal-700"
                >
                  Retry failed step
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPhase("idle")}
                disabled={isRunning}
                className="rounded-lg border border-gray-300 px-6 py-2 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFinished ? "Done" : "Close"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
