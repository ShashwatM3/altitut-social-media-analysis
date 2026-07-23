import { NextResponse } from "next/server";
import { getUploadPostProfile, resolveSocialAccount, type SocialAccount } from "../../../../lib/social/accounts";

type Provider = "linkedin" | "facebook" | "instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.UPLOAD_POST_API_KEY) {
    return NextResponse.json(
      { error: "UPLOAD_POST_API_KEY is not set." },
      { status: 503 },
    );
  }

  const profile = getUploadPostProfile();
  if (!profile) {
    return NextResponse.json(
      { error: "UPLOAD_POST_PROFILE is not set." },
      { status: 503 },
    );
  }

  let body: { platforms?: Provider[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const platforms = body.platforms ?? ["linkedin", "facebook", "instagram"];
  const accounts: SocialAccount[] = [];

  for (const platform of platforms) {
    try {
      const account = await resolveSocialAccount(platform, profile);
      accounts.push(account);
    } catch (error) {
      console.error(`[autopost/accounts] ${platform}:`, error);
      accounts.push({
        provider: platform,
        vendor: "upload_post",
        uploadPostProfile: profile,
        displayName: `${platform} (not connected)`,
        status: "needs_reauth",
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ accounts });
}
