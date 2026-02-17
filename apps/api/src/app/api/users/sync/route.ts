import { NextResponse } from "next/server";
import { getOrSyncUser } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  } catch (e) {
    const message = getApiErrorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
