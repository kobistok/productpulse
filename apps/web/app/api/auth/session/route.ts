import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
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
    const decoded = await adminAuth.verifyIdToken(idToken);

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

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
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
    console.error("Session creation failed:", error);
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
