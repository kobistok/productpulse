import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "__session";
const SESSION_DURATION_MS = 60 * 60 * 24 * 14 * 1000; // 14 days

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();

  if (!idToken) {
    return NextResponse.json({ error: "Missing ID token" }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);

    // Upsert user from Firebase token claims
    await prisma.user.upsert({
      where: { id: decoded.uid },
      create: {
        id: decoded.uid,
        email: decoded.email!,
        name: decoded.name ?? null,
        avatarUrl: decoded.picture ?? null,
      },
      update: {
        name: decoded.name ?? null,
        avatarUrl: decoded.picture ?? null,
      },
    });

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_DURATION_MS / 1000,
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = (error as { message?: string })?.message ?? "Unknown error";
    const code = (error as { code?: string })?.code ?? "";
    console.error("Session creation failed:", code, msg);
    const status = msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("quota") ? 429 : 401;
    return NextResponse.json({ error: msg, code }, { status });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
