import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRealSession } from "@/lib/session";
import { isSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/db";

const IMPERSONATE_COOKIE_NAME = "__impersonate_uid";

export async function POST(req: Request) {
  const realUser = await getRealSession();
  if (!realUser || !isSuperAdmin(realUser.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE_NAME, target.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  return NextResponse.json({ id: target.id, email: target.email, name: target.name });
}

export async function DELETE() {
  const realUser = await getRealSession();
  if (!realUser || !isSuperAdmin(realUser.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE_NAME);

  return NextResponse.json({ ok: true });
}
