import { SignIn } from "@clerk/nextjs";
import { ClerkAuthBoundary } from "@/components/clerk-auth-boundary";

type Props = { searchParams: Promise<{ redirect?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { redirect } = await searchParams;
  const signUpUrl = redirect ? `/sign-up?redirect=${encodeURIComponent(redirect)}` : "/sign-up";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <ClerkAuthBoundary>
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl={signUpUrl}
          forceRedirectUrl={redirect ?? undefined}
        />
      </ClerkAuthBoundary>
    </div>
  );
}
