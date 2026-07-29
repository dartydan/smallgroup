import { NextResponse } from "next/server";
import { getOrSyncUser } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  resolvePersonName,
  sanitizeDisplayName,
} from "@/lib/display-name";

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const name = resolvePersonName({
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      email: user.email,
      fallback: "Member",
    });
    const storedFirstName = sanitizeDisplayName(user.firstName) ?? "";
    const storedLastName = sanitizeDisplayName(user.lastName) ?? "";
    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: name.fullName,
      firstName: storedFirstName,
      lastName: storedLastName,
      fullName: name.fullName,
    });
  } catch (e) {
    const message = getApiErrorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
