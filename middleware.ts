import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const expected = process.env.STACK_BASIC_AUTH;
  if (!expected) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      if (atob(header.slice(6)) === expected) return NextResponse.next();
    } catch {
      // malformed base64 — fall through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Stack"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
