import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const state = randomBytes(16).toString("hex");

  // Store state + orgId in a short-lived httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", JSON.stringify({ state, orgId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
    path: "/",
    sameSite: "lax",
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // always return refresh_token
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
