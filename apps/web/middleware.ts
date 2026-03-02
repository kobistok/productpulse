import { NextRequest, NextResponse } from "next/server";

// Paths that don't require authentication
const PUBLIC_PREFIXES = ["/login", "/join/", "/d/", "/api/auth/", "/api/webhooks/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPublic) return NextResponse.next();

  // Worker route is authenticated via bearer token, not session cookie
  if (pathname.startsWith("/api/worker/")) return NextResponse.next();

  const session = request.cookies.get("__session");
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
