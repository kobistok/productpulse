import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/db";
import type { User, Membership, Organization } from "@productpulse/db";

const SESSION_COOKIE_NAME = "__session";

export type SessionUser = User & {
  memberships: Array<Membership & { org: Organization }>;
};

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const user = await prisma.user.findUnique({
      where: { id: decoded.uid },
      include: { memberships: { include: { org: true } } },
    });
    return user;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}
