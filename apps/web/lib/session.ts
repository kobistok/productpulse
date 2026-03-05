import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/db";
import { isSuperAdmin } from "@/lib/super-admin";
import type { User, Membership, Organization } from "@productpulse/db";

const SESSION_COOKIE_NAME = "__session";
const IMPERSONATE_COOKIE_NAME = "__impersonate_uid";

export type SessionUser = User & {
  memberships: Array<Membership & { org: Organization }>;
};

async function fetchUser(uid: string): Promise<SessionUser | null> {
  return prisma.user.findUnique({
    where: { id: uid },
    include: { memberships: { include: { org: true } } },
  });
}

async function verifySessionCookie(cookieValue: string): Promise<string | null> {
  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookieValue, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

// Returns the real authenticated user, ignoring impersonation
export async function getRealSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  const uid = await verifySessionCookie(sessionCookie);
  if (!uid) return null;
  return fetchUser(uid);
}

// Returns the effective user — impersonated user if active, real user otherwise
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  const uid = await verifySessionCookie(sessionCookie);
  if (!uid) return null;

  const impersonateUid = cookieStore.get(IMPERSONATE_COOKIE_NAME)?.value;
  if (impersonateUid) {
    // Only honour impersonation if the real user is a super-admin
    const realUser = await fetchUser(uid);
    if (realUser && isSuperAdmin(realUser.email)) {
      const impersonatedUser = await fetchUser(impersonateUid);
      if (impersonatedUser) return impersonatedUser;
    }
  }

  return fetchUser(uid);
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}
