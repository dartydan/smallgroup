"use client";

import { useAuth } from "@/app/providers";
import { LoginForm } from "./(app)/login-form";
import { Dashboard } from "./(app)/dashboard";

export default function Home() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  return <Dashboard />;
}
