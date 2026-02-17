import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Serve Expo web app at root (so / shows the app, not the API message)
  if (request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/index.html", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ico|woff2?|ttf|otf)$).*)",
  ],
};
