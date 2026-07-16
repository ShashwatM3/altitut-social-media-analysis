import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import type { AnalysisPack } from "../app/components/pack-panel";
import { COLLECTIONS, db } from "./firebase";
import { embedTexts } from "./openai";
import { packEntryText, slugify } from "./packs";

export type RagDocType =
  | "competitor"
  | "content-pack"
  | "altitut"
  | "platform-guide";

export type RagChunk = {
  id: string;
  /** Which corpus the chunk belongs to. */
  docType: RagDocType;
  /** Pack name or document title the chunk came from. */
  sourceName: string;
  sectionTitle: string;
  entryLabel: string;
  text: string;
  embedding: number[];
};

export type RetrievedChunk = Omit<RagChunk, "embedding"> & { score: number };

/* ------------------------------------------------------------------ */
/* Chunking                                                            */
/* ------------------------------------------------------------------ */

type PendingChunk = Omit<RagChunk, "embedding">;

/** One chunk per pack entry (and per episode entry), plus the TL;DR. */
export function chunkPack(
  pack: AnalysisPack,
  docType: "competitor" | "content-pack",
): PendingChunk[] {
  const packSlug = slugify(pack.name);
  const chunks: PendingChunk[] = [];

  if (pack.tldr) {
    chunks.push({
      id: `${docType}-${packSlug}-tldr`,
      docType,
      sourceName: pack.name,
      sectionTitle: "TL;DR",
      entryLabel: "TL;DR",
      text: pack.tldr,
    });
  }

  for (const section of pack.sections) {
    for (const entry of section.entries ?? []) {
      const text = packEntryText(entry);
      if (!text) continue;
      chunks.push({
        id: `${docType}-${packSlug}-${slugify(`${section.id}-${entry.label}`)}`,
        docType,
        sourceName: pack.name,
        sectionTitle: section.title,
        entryLabel: entry.label,
        text,
      });
    }
    for (const episode of section.episodes ?? []) {
      const text = episode.entries
        .map((entry) => `${entry.label}\n${packEntryText(entry)}`)
        .join("\n\n");
      if (!text) continue;
      chunks.push({
        id: `${docType}-${packSlug}-${slugify(`${section.id}-${episode.title}`)}`,
        docType,
        sourceName: pack.name,
        sectionTitle: section.title,
        entryLabel: episode.title,
        text,
      });
    }
  }
  return chunks;
}

/** Chunk a markdown document by ## headings (Altitut overview, platform guide, …). */
export function chunkMarkdown(
  title: string,
  markdown: string,
  docType: RagDocType = "altitut",
): PendingChunk[] {
  const sections = markdown.split(/\n(?=## )/g);
  const chunks: PendingChunk[] = [];
  sections.forEach((sectionText, index) => {
    const trimmed = sectionText.trim();
    if (!trimmed) return;
    const headingMatch = trimmed.match(/^##\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[1].trim() : `Part ${index + 1}`;
    // Split very long sections into ~2400-char pieces on paragraph borders.
    const paragraphs = trimmed.split(/\n\n+/);
    let buffer = "";
    let part = 0;
    const flush = () => {
      if (!buffer.trim()) return;
      part += 1;
      chunks.push({
        id: `${docType}-${slugify(`${heading}-${part}`)}`,
        docType,
        sourceName: title,
        sectionTitle: heading,
        entryLabel: part > 1 ? `${heading} (${part})` : heading,
        text: buffer.trim(),
      });
      buffer = "";
    };
    for (const paragraph of paragraphs) {
      if (buffer.length + paragraph.length > 2400) {
        flush();
      }
      buffer += `${paragraph}\n\n`;
    }
    flush();
  });
  return chunks;
}

/* ------------------------------------------------------------------ */
/* Ingestion                                                           */
/* ------------------------------------------------------------------ */

export async function ingestChunks(pending: PendingChunk[]): Promise<number> {
  if (pending.length === 0) {
    return 0;
  }
  const embeddings = await embedTexts(
    pending.map(
      (chunk) =>
        `${chunk.sourceName} — ${chunk.sectionTitle} — ${chunk.entryLabel}\n${chunk.text}`,
    ),
  );
  await Promise.all(
    pending.map((chunk, index) =>
      setDoc(doc(db, COLLECTIONS.ragChunks, chunk.id), {
        ...chunk,
        embedding: embeddings[index],
      }),
    ),
  );
  invalidateChunkCache();
  return pending.length;
}

export async function ingestPack(
  pack: AnalysisPack,
  docType: "competitor" | "content-pack",
): Promise<number> {
  return ingestChunks(chunkPack(pack, docType));
}

/** Remove all chunks previously ingested for a given source pack. */
export async function removePackChunks(sourceName: string): Promise<void> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.ragChunks),
      where("sourceName", "==", sourceName),
    ),
  );
  await Promise.all(snapshot.docs.map((document) => deleteDoc(document.ref)));
  invalidateChunkCache();
}

/* ------------------------------------------------------------------ */
/* Hybrid retrieval (dense cosine + lexical overlap)                   */
/* ------------------------------------------------------------------ */

let chunkCache: { chunks: RagChunk[]; loadedAt: number } | null = null;
const CHUNK_CACHE_TTL_MS = 2 * 60 * 1000;

function invalidateChunkCache() {
  chunkCache = null;
}

async function loadChunks(): Promise<RagChunk[]> {
  if (chunkCache && Date.now() - chunkCache.loadedAt < CHUNK_CACHE_TTL_MS) {
    return chunkCache.chunks;
  }
  const snapshot = await getDocs(collection(db, COLLECTIONS.ragChunks));
  const chunks = snapshot.docs
    .map((document) => document.data() as RagChunk)
    .filter((chunk) => Array.isArray(chunk.embedding) && chunk.text);
  chunkCache = { chunks, loadedAt: Date.now() };
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have how in is it its of on or that the their them they this to was we what when where which who why will with our your you not do does did about into over under more most can could should would".split(
    " ",
  ),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9/]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/** BM25-flavoured lexical score: term overlap with tf saturation. */
function lexicalScore(queryTokens: string[], chunk: RagChunk): number {
  if (queryTokens.length === 0) {
    return 0;
  }
  const haystack = tokenize(
    `${chunk.sourceName} ${chunk.sectionTitle} ${chunk.entryLabel} ${chunk.text}`,
  );
  const counts = new Map<string, number>();
  for (const token of haystack) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  let score = 0;
  for (const token of new Set(queryTokens)) {
    const tf = counts.get(token) ?? 0;
    if (tf > 0) {
      score += tf / (tf + 1.2);
    }
  }
  return score / new Set(queryTokens).size;
}

export type HybridRetrieveOptions = {
  /** When set, only search chunks whose docType is in this list. */
  docTypes?: RagDocType[];
};

export async function hybridRetrieve(
  queryText: string,
  topK = 12,
  options?: HybridRetrieveOptions,
): Promise<RetrievedChunk[]> {
  const [allChunks, [queryEmbedding]] = await Promise.all([
    loadChunks(),
    embedTexts([queryText]),
  ]);
  const allowed = options?.docTypes;
  const chunks = allowed?.length
    ? allChunks.filter((chunk) => allowed.includes(chunk.docType))
    : allChunks;
  const queryTokens = tokenize(queryText);
  const queryLower = queryText.toLowerCase();

  const scored = chunks.map((chunk) => {
    const dense = cosineSimilarity(queryEmbedding, chunk.embedding);
    const lexical = lexicalScore(queryTokens, chunk);
    // Direct mention of the competitor/pack name is the strongest signal.
    const nameBoost = queryLower.includes(chunk.sourceName.toLowerCase())
      ? 0.15
      : 0;
    const { embedding: _embedding, ...rest } = chunk;
    return { ...rest, score: 0.6 * dense + 0.4 * lexical + nameBoost };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}
