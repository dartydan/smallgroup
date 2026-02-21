import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PracticeVerseGame } from "./practice-verse-game";

type PracticePageProps = {
  searchParams?: {
    reference?: string | string[];
  };
};

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const rawReference = searchParams?.reference;
  const initialReference =
    typeof rawReference === "string"
      ? rawReference
      : Array.isArray(rawReference)
        ? rawReference[0] ?? null
        : null;

  return <PracticeVerseGame initialReference={initialReference} />;
}
