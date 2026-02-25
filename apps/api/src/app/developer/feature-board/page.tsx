import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FeatureBoardClient } from "./feature-board-client";

export default async function FeatureBoardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return <FeatureBoardClient />;
}
