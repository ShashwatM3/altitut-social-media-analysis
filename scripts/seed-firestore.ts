/**
 * Seeds Firestore with everything the dashboard knows today:
 *   1. The three predefined competitor packs  -> `competitors` collection
 *   2. The predefined content packs           -> `contentPacks` collection
 *   3. RAG chunks (packs + Altitut overview + platform guide) -> `ragChunks`
 *
 * Idempotent — documents are keyed by slug, so re-running overwrites in place.
 *
 * Run with: npm run seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPETITOR_PACKS } from "../data/competitor-packs";
import { CONTENT_PACKS } from "../data/content-packs";
import { COLLECTIONS } from "../lib/firebase";
import { savePack } from "../lib/packs";
import { platformGuideChunks } from "../lib/platform-guide";
import { chunkMarkdown, chunkPack, ingestChunks } from "../lib/rag";

async function main() {
  console.log("Seeding Firestore for project altitut-sma-dashboard…\n");

  for (const pack of COMPETITOR_PACKS) {
    const stored = await savePack(COLLECTIONS.competitors, pack, "seed");
    console.log(`  competitor  ✓ ${stored.id} (${pack.name})`);
  }

  for (const pack of CONTENT_PACKS) {
    const stored = await savePack(COLLECTIONS.contentPacks, pack, "seed");
    console.log(`  contentPack ✓ ${stored.id} (${pack.name})`);
  }

  console.log("\nBuilding RAG chunks + embeddings (OpenAI text-embedding-3-small)…");
  const pending = [
    ...COMPETITOR_PACKS.flatMap((pack) => chunkPack(pack, "competitor")),
    ...CONTENT_PACKS.flatMap((pack) => chunkPack(pack, "content-pack")),
    ...chunkMarkdown(
      "Altitut Product Overview",
      readFileSync(
        join(process.cwd(), "docs", "ALTITUT-PRODUCT-OVERVIEW.md"),
        "utf-8",
      ),
    ),
    ...platformGuideChunks(),
  ];
  const count = await ingestChunks(pending);
  console.log(`  ragChunks   ✓ ${count} chunks embedded and stored`);

  console.log("\nDone. The dashboard now reads live data from Firestore.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
