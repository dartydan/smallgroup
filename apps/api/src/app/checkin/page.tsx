import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CheckInClient } from "./checkin-client";

export default async function CheckInPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return <CheckInClient />;
}
