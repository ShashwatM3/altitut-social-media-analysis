"use client";

import { useEffect, useMemo, useState } from "react";
import { COMPETITOR_PACKS } from "../data/competitor-packs";
import { CONTENT_PACKS } from "../data/content-packs";
import { listenToPacks, type StoredPack } from "../lib/packs";
import { ChatPanel } from "./components/chat-panel";
import { PackPanel, type AnalysisPack } from "./components/pack-panel";
import { RunCompetitorScout } from "./components/scout-dialog";

const TABS = ["Competitors Analysis", "Content Creation"] as const;

type Tab = (typeof TABS)[number];

/**
 * Live packs come from Firestore (seeded via `npm run seed`, appended to by
 * the Competitor Scout and the Telegram bot). The static in-repo packs are
 * the fallback so the dashboard still renders if Firestore is unreachable.
 */
function useLivePacks(
  collectionName: "competitors" | "contentPacks",
  fallback: AnalysisPack[],
): AnalysisPack[] {
  const [livePacks, setLivePacks] = useState<StoredPack[] | null>(null);

  useEffect(() => {
    const unsubscribe = listenToPacks(
      collectionName,
      (packs) => setLivePacks(packs),
      () => setLivePacks(null),
    );
    return unsubscribe;
  }, [collectionName]);

  return useMemo(() => {
    if (livePacks && livePacks.length > 0) {
      return livePacks;
    }
    return fallback;
  }, [livePacks, fallback]);
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const competitorPacks = useLivePacks("competitors", COMPETITOR_PACKS);
  const contentPacks = useLivePacks("contentPacks", CONTENT_PACKS);

  const competitorNames = useMemo(
    () => competitorPacks.map((pack) => pack.name),
    [competitorPacks],
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex-none border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-2xl font-semibold text-gray-900 lg:text-3xl">
              Social Media Command Center
            </h1>
            <p className="mt-1 text-sm text-gray-600 lg:text-base">
              Competitor insights and content creation ideas for Altitut
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-6 py-2 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Help ?
          </button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <nav
          className="w-56 flex-none self-start rounded-xl bg-white p-2 shadow-modern"
          aria-label="Main navigation"
        >
          <ul className="space-y-1">
            {TABS.map((tab) => (
              <li key={tab}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                    tab === activeTab
                      ? "bg-teal-50 font-semibold text-deep-teal"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  aria-current={tab === activeTab ? "page" : undefined}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-6 md:mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 lg:text-3xl">
                {activeTab}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-600 lg:text-base">
                {activeTab === "Competitors Analysis"
                  ? "Structured intelligence packs for each tracked competitor."
                  : "Repeatable content series the social team can execute."}
              </p>
            </div>
            {activeTab === "Competitors Analysis" ? (
              <RunCompetitorScout
                existingNames={competitorNames}
                onComplete={() => {
                  /* Firestore onSnapshot picks up the new pack automatically. */
                }}
              />
            ) : null}
          </header>
          {activeTab === "Competitors Analysis" ? (
            <>
              <ChatPanel />
              <PackPanel
                packs={competitorPacks}
                ariaLabel="Competitor packs"
                variant="competitor"
              />
            </>
          ) : (
            <PackPanel packs={contentPacks} ariaLabel="Content packs" />
          )}
        </main>
      </div>
    </div>
  );
}
