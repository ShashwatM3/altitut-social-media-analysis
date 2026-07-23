import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import type {
  AnalysisPack,
  ContentBlock,
  PackEntry,
  PackEpisode,
  PackLinks,
  PackSection,
} from "../app/components/pack-panel";
import { COLLECTIONS, db } from "./firebase";
import type { Provider } from "./social-posts";

export type StoredPack = AnalysisPack & {
  id: string;
  source: "seed" | "competitor-scout" | "telegram-bot";
  createdAt: string;
};

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "pack"
  );
}

/* ------------------------------------------------------------------ */
/* Firestore persistence                                               */
/* ------------------------------------------------------------------ */

type PackCollection =
  | typeof COLLECTIONS.competitors
  | typeof COLLECTIONS.contentPacks;

export async function savePack(
  collectionName: PackCollection,
  pack: AnalysisPack,
  source: StoredPack["source"],
  id?: string,
): Promise<StoredPack> {
  const packId = id ?? slugify(pack.name);
  const stored: StoredPack = {
    ...pack,
    id: packId,
    source,
    createdAt: new Date().toISOString(),
  };
  // Firestore rejects `undefined` values — strip them via JSON round-trip.
  const sanitized = JSON.parse(JSON.stringify(stored));
  await setDoc(doc(db, collectionName, packId), sanitized);
  return stored;
}

export async function fetchPacks(
  collectionName: PackCollection,
): Promise<StoredPack[]> {
  const snapshot = await getDocs(
    query(collection(db, collectionName), orderBy("createdAt", "asc")),
  );
  return snapshot.docs.map((document) => document.data() as StoredPack);
}

export function listenToPacks(
  collectionName: PackCollection,
  onChange: (packs: StoredPack[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, collectionName), orderBy("createdAt", "asc")),
    (snapshot) => {
      onChange(snapshot.docs.map((document) => document.data() as StoredPack));
    },
    (error) => onError?.(error),
  );
}

export async function deletePack(
  collectionName: PackCollection,
  id: string,
): Promise<void> {
  await deleteDoc(doc(db, collectionName, id));
}

/* ------------------------------------------------------------------ */
/* Normalization of model-generated pack JSON                          */
/* ------------------------------------------------------------------ */

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function normalizeBlock(raw: unknown): ContentBlock | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const block = raw as Record<string, unknown>;
  const type = asString(block.type);
  if (type === "paragraph") {
    const text = asString(block.text);
    return text ? { type: "paragraph", text } : null;
  }
  if (type === "bullets") {
    const items = asStringList(block.items);
    return items.length > 0 ? { type: "bullets", items } : null;
  }
  if (type === "labeled") {
    const label = asString(block.label);
    const items = asStringList(block.items);
    return label && items.length > 0 ? { type: "labeled", label, items } : null;
  }
  // Tolerate near-miss shapes from the model.
  if (asString(block.text)) {
    return { type: "paragraph", text: asString(block.text) };
  }
  const items = asStringList(block.items);
  if (items.length > 0) {
    const label = asString(block.label);
    return label ? { type: "labeled", label, items } : { type: "bullets", items };
  }
  return null;
}

export function normalizeEntry(raw: unknown): PackEntry | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entry = raw as Record<string, unknown>;
  const label = asString(entry.label);
  if (!label) {
    return null;
  }
  const blocks = Array.isArray(entry.blocks)
    ? entry.blocks
        .map(normalizeBlock)
        .filter((block): block is ContentBlock => block !== null)
    : [];
  if (blocks.length === 0 && asString(entry.value)) {
    return { label, blocks: [{ type: "paragraph", text: asString(entry.value) }] };
  }
  return blocks.length > 0 ? { label, blocks } : null;
}

function normalizeEpisode(raw: unknown): PackEpisode | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const episode = raw as Record<string, unknown>;
  const title = asString(episode.title);
  const entries = Array.isArray(episode.entries)
    ? episode.entries
        .map(normalizeEntry)
        .filter((entry): entry is PackEntry => entry !== null)
    : [];
  return title && entries.length > 0 ? { title, entries } : null;
}

export function normalizeSection(raw: unknown): PackSection | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const section = raw as Record<string, unknown>;
  const title = asString(section.title);
  if (!title) {
    return null;
  }
  const id = asString(section.id) || slugify(title);
  const entries = Array.isArray(section.entries)
    ? section.entries
        .map(normalizeEntry)
        .filter((entry): entry is PackEntry => entry !== null)
    : [];
  const episodes = Array.isArray(section.episodes)
    ? section.episodes
        .map(normalizeEpisode)
        .filter((episode): episode is PackEpisode => episode !== null)
    : [];
  if (entries.length === 0 && episodes.length === 0) {
    return null;
  }
  const result: PackSection = { id, title };
  if (entries.length > 0) {
    result.entries = entries;
  }
  if (episodes.length > 0) {
    result.episodes = episodes;
  }
  return result;
}

export function normalizeLinks(raw: unknown): PackLinks | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const links = raw as Record<string, unknown>;
  const normalized: PackLinks = {};
  const isHttp = (value: string) => /^https?:\/\//i.test(value);
  const website = asString(links.website);
  const instagram = asString(links.instagram);
  const linkedin = asString(links.linkedin);
  const twitter = asString(links.twitter) || asString(links.x);
  if (website && isHttp(website)) normalized.website = website;
  if (instagram && isHttp(instagram)) normalized.instagram = instagram;
  if (linkedin && isHttp(linkedin)) normalized.linkedin = linkedin;
  if (twitter && isHttp(twitter)) normalized.twitter = twitter;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/** Flatten a pack into plain text for RAG chunking and prompt context. */
export function packEntryText(entry: PackEntry): string {
  const parts: string[] = [];
  for (const block of entry.blocks ?? []) {
    if (block.type === "paragraph") {
      parts.push(block.text);
    } else if (block.type === "bullets") {
      parts.push(block.items.map((item) => `- ${item}`).join("\n"));
    } else {
      parts.push(
        `${block.label}:\n${block.items.map((item) => `- ${item}`).join("\n")}`,
      );
    }
  }
  if (parts.length === 0 && entry.value) {
    parts.push(entry.value);
  }
  return parts.join("\n");
}

function packAllText(pack: AnalysisPack): string {
  const parts: string[] = [];
  parts.push(`Pack name: ${pack.name}`);
  if (pack.tag) parts.push(`Pack tag: ${pack.tag}`);
  if (pack.meta) parts.push(`Pack meta: ${pack.meta}`);
  if (pack.tldr) parts.push(`TL;DR: ${pack.tldr}`);

  for (const section of pack.sections) {
    parts.push(`\n# ${section.title}`);
    for (const entry of section.entries ?? []) {
      parts.push(`\n## ${entry.label}`);
      parts.push(packEntryText(entry));
    }
    for (const episode of section.episodes ?? []) {
      parts.push(`\n## Episode: ${episode.title}`);
      for (const entry of episode.entries ?? []) {
        parts.push(`### ${entry.label}`);
        parts.push(packEntryText(entry));
      }
    }
  }
  return parts.join("\n").slice(0, 4000);
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]*[.!?]/);
  return match ? match[0].trim() : text.split(/\n/)[0]?.trim() ?? text;
}

/** Ground truth the caption generator should respect (caption templates, hashtags, tone). */
export function packToGroundTruth(pack: AnalysisPack): string {
  return packAllText(pack);
}

/** A one-line brief derived from the pack. */
export function packToBrief(pack: AnalysisPack): string {
  const candidates: string[] = [];
  if (pack.tldr) candidates.push(firstSentence(pack.tldr));

  for (const section of pack.sections) {
    for (const episode of section.episodes ?? []) {
      const titleEntry = episode.entries.find((e) =>
        e.label.toLowerCase().includes("title / angle"),
      );
      if (titleEntry) {
        const text = packEntryText(titleEntry);
        if (text) candidates.push(text);
      }
    }
  }

  // best-effort: first primary goal listed in the second section (usually Strategy).
  const strategySection = pack.sections[1];
  const goalEntry = strategySection?.entries?.find((e) =>
    e.label.toLowerCase().includes("goal"),
  );
  const goalBlock = goalEntry?.blocks?.find((b) => b.type === "labeled" || b.type === "bullets");
  if (goalBlock && "items" in goalBlock && Array.isArray(goalBlock.items)) {
    const goal = goalBlock.items[1] ?? goalBlock.items[0];
    if (typeof goal === "string" && goal) candidates.push(goal);
  }

  const brief = candidates.filter(Boolean)[0] ?? pack.name;
  return `${pack.name}${pack.meta ? ` · ${pack.meta}` : ""}: ${brief}`.slice(0, 500);
}

/** Guess whether the pack is meant for video or image output. */
export function deriveMediaKindFromPack(
  pack: AnalysisPack,
): "video" | "image" {
  const text = packAllText(pack).toLowerCase();
  if (
    text.includes("reel") ||
    text.includes("video") ||
    text.includes("talking-head") ||
    text.includes("ugc") ||
    text.includes("short")
  ) {
    return "video";
  }
  if (
    text.includes("carousel") ||
    text.includes("photo") ||
    text.includes("image") ||
    text.includes("static")
  ) {
    return "image";
  }
  return "video";
}

/** Derive the intended placement for a given platform from the pack copy. */
export function derivePlacementFromPack(
  pack: AnalysisPack,
): "feed" | "reel" | "story" {
  const text = packAllText(pack).toLowerCase();
  if (text.includes("reel")) return "reel";
  if (text.includes("story")) return "story";
  return "feed";
}

/** Derive the intended social platforms from the pack copy. */
export function derivePlatformsFromPack(pack: AnalysisPack): Provider[] {
  const text = packAllText(pack).toLowerCase();
  const platforms: Provider[] = [];
  if (
    text.includes("instagram") ||
    text.includes(" ig ") ||
    text.includes("reel") ||
    text.includes("tiktok") ||
    text.includes("youtube shorts")
  ) {
    platforms.push("instagram");
  }
  if (text.includes("facebook")) platforms.push("facebook");
  if (text.includes("linkedin")) platforms.push("linkedin");
  return platforms.length > 0 ? platforms : ["instagram"];
}
