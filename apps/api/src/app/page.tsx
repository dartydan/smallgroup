import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Dashboard } from "./(app)/dashboard";

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <Dashboard />;
}
