"use client";

import { ClerkProvider } from "@clerk/nextjs";

export function ClientClerkProvider({
  children,
  publishableKey,
}: {
  children: React.ReactNode;
  publishableKey?: string;
}) {
  if (!publishableKey) {
    throw new Error(
      "Missing Clerk publishable key. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (or CLERK_PUBLISHABLE_KEY / EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY)."
    );
  }

  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
}
