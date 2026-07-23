import { NextResponse } from "next/server";
import { generateCaptions, type Tone } from "../../../../lib/caption";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. AI generation is disabled." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const platforms = (body.platforms as string[] | undefined)?.filter(
    (p): p is "linkedin" | "facebook" | "instagram" =>
      p === "linkedin" || p === "facebook" || p === "instagram",
  );
  const mediaKind =
    body.mediaKind === "image" ? ("image" as const) : ("video" as const);
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  const tone = (body.tone as Tone | undefined) ?? "professional";
  const mode =
    body.mode === "refine"
      ? ("refine" as const)
      : body.mode === "shorten"
        ? ("shorten" as const)
        : ("generate" as const);
  const existingCopy =
    body.existingCopy && typeof body.existingCopy === "object"
      ? (body.existingCopy as Partial<Record<string, string>>)
      : undefined;
  const packContext =
    typeof body.packContext === "string" ? body.packContext : undefined;

  if (!brief && mode !== "shorten") {
    return NextResponse.json(
      { error: "A brief is required to generate captions." },
      { status: 400 },
    );
  }
  if (!platforms || platforms.length === 0) {
    return NextResponse.json(
      { error: "At least one platform is required." },
      { status: 400 },
    );
  }

  try {
    const captions = await generateCaptions({
      platforms,
      mediaKind,
      brief,
      tone,
      mode,
      existingCopy,
      packContext,
    });
    return NextResponse.json(captions);
  } catch (error) {
    console.error("[caption] failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Caption generation failed.",
      },
      { status: 500 },
    );
  }
}
