import Image from "next/image";
import { SignUp } from "@clerk/nextjs";
import { ClerkAuthBoundary } from "@/components/clerk-auth-boundary";

type Props = { searchParams: Promise<{ redirect?: string }> };

export default async function SignUpPage({ searchParams }: Props) {
  const { redirect } = await searchParams;
  const signInUrl = redirect ? `/sign-in?redirect=${encodeURIComponent(redirect)}` : "/sign-in";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="flex justify-center mb-6">
        <Image src="/sglogo.png" alt="Small Group" width={52} height={52} />
      </div>
      <ClerkAuthBoundary>
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl={signInUrl}
          forceRedirectUrl={redirect ?? undefined}
        />
      </ClerkAuthBoundary>
    </div>
  );
}
