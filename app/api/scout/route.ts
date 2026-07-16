import { doc, setDoc } from "firebase/firestore";
import { NextResponse } from "next/server";
import { COLLECTIONS, db } from "../../../lib/firebase";
import { savePack } from "../../../lib/packs";
import { ingestPack } from "../../../lib/rag";
import {
  assemblePack,
  stepDiscover,
  stepResearch,
  stepSocial,
  stepSynthesizeIdentity,
  stepSynthesizeSocial,
  stepSynthesizeVerdict,
  stepWebsite,
  type ScoutState,
} from "../../../lib/scout";

export const runtime = "nodejs";
export const maxDuration = 300;

export type ScoutStepId =
  | "discover"
  | "website"
  | "social"
  | "research"
  | "synthesize-identity"
  | "synthesize-social"
  | "synthesize-verdict"
  | "save";

const STEP_HANDLERS: Record<
  Exclude<ScoutStepId, "save">,
  (state: ScoutState) => Promise<ScoutState>
> = {
  discover: stepDiscover,
  website: stepWebsite,
  social: stepSocial,
  research: stepResearch,
  "synthesize-identity": stepSynthesizeIdentity,
  "synthesize-social": stepSynthesizeSocial,
  "synthesize-verdict": stepSynthesizeVerdict,
};

export async function POST(request: Request) {
  let step: ScoutStepId;
  let state: ScoutState;
  try {
    const body = await request.json();
    step = body.step;
    state = body.state;
    if (!step || !state || typeof state.productDescription !== "string") {
      throw new Error("Body must be { step, state: { productDescription, ... } }.");
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    if (step === "save") {
      const pack = assemblePack(state);
      const stored = await savePack(
        COLLECTIONS.competitors,
        pack,
        "competitor-scout",
      );
      // Make the new competitor immediately known to the RAG chatbot.
      await ingestPack(pack, "competitor");
      await setDoc(doc(db, COLLECTIONS.scoutRuns, `run-${Date.now()}`), {
        completedAt: new Date().toISOString(),
        competitorId: stored.id,
        competitorName: stored.name,
        productDescription: state.productDescription,
        alternates: state.alternates ?? [],
      });
      return NextResponse.json({ state, pack: stored });
    }

    const handler = STEP_HANDLERS[step];
    if (!handler) {
      return NextResponse.json({ error: `Unknown step "${step}".` }, { status: 400 });
    }
    const nextState = await handler(state);
    return NextResponse.json({ state: nextState });
  } catch (error) {
    console.error(`[scout] step "${step}" failed:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scout step failed." },
      { status: 500 },
    );
  }
}
