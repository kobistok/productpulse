import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = new URL(process.env.GOOGLE_REDIRECT_URI!).origin;
  const settingsUrl = `${baseUrl}/settings`;

  if (error || !code || !returnedState) {
    return NextResponse.redirect(`${settingsUrl}?error=google_auth_failed`);
  }

  // Verify state and retrieve orgId from cookie
  const cookieStore = await cookies();
  const raw = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!raw) return NextResponse.redirect(`${settingsUrl}?error=google_auth_failed`);

  let orgId: string;
  try {
    const parsed = JSON.parse(raw) as { state: string; orgId: string };
    if (parsed.state !== returnedState) throw new Error("state mismatch");
    orgId = parsed.orgId;
  } catch {
    return NextResponse.redirect(`${settingsUrl}?error=google_auth_failed`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) return NextResponse.redirect(`${settingsUrl}?error=google_token_failed`);

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Fetch Google account email for display
  const userinfoRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userinfo = userinfoRes.ok
    ? ((await userinfoRes.json()) as { email: string })
    : { email: "" };

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.googleDriveConfig.upsert({
    where: { orgId },
    create: {
      orgId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      email: userinfo.email,
    },
    update: {
      accessToken: tokens.access_token,
      // Only update refresh_token if Google returned one (it doesn't always)
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt,
      email: userinfo.email,
    },
  });

  return NextResponse.redirect(settingsUrl);
}
