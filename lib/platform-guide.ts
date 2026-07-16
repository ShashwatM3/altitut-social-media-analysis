import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { PLATFORM_GUIDE_TITLE } from "./platform-guide-content";
import { COLLECTIONS, db } from "./firebase";
import { chunkMarkdown, ingestChunks } from "./rag";

export { PLATFORM_GUIDE_TITLE } from "./platform-guide-content";

/** Absolute path to the canonical markdown guide (also used by seed / RAG). */
export function platformGuidePath(): string {
  return join(process.cwd(), "docs", "PLATFORM-GUIDE.md");
}

export function readPlatformGuideMarkdown(): string {
  return readFileSync(platformGuidePath(), "utf-8");
}

export function platformGuideChunks() {
  return chunkMarkdown(
    PLATFORM_GUIDE_TITLE,
    readPlatformGuideMarkdown(),
    "platform-guide",
  );
}

export async function ingestPlatformGuide(): Promise<number> {
  return ingestChunks(platformGuideChunks());
}

/** True if at least one platform-guide chunk is already in Firestore. */
export async function hasPlatformGuideChunks(): Promise<boolean> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.ragChunks),
      where("docType", "==", "platform-guide"),
      limit(1),
    ),
  );
  return !snapshot.empty;
}

/**
 * Ensure the platform guide is embedded in the RAG store. Safe to call on
 * every help-chat turn — only ingests when the corpus is missing.
 */
export async function ensurePlatformGuideIngested(): Promise<void> {
  if (await hasPlatformGuideChunks()) {
    return;
  }
  await ingestPlatformGuide();
}
