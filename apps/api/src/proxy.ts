import { clerkMiddleware } from "@clerk/nextjs/server";

const publishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.CLERK_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default clerkMiddleware({
  publishableKey,
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ico|woff2?|ttf|otf)$).*)",
  ],
};
