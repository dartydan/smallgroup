import { NextResponse } from "next/server";
import { getOrSyncUser } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-error";
import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const user = await getOrSyncUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const membership = await db.query.groupMembers.findFirst({
      where: eq(groupMembers.userId, user.id),
      columns: { role: true },
    });
    return NextResponse.json({
      id: user.id,
      authId: user.authId,
      email: user.email,
      displayName: user.displayName,
      birthdayMonth: user.birthdayMonth,
      birthdayDay: user.birthdayDay,
      role: membership?.role ?? "member",
    });
  } catch (e) {
    const message = getApiErrorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getOrSyncUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { birthdayMonth, birthdayDay } = body as {
      birthdayMonth?: number | null;
      birthdayDay?: number | null;
    };
    await db
      .update(users)
      .set({
        birthdayMonth: birthdayMonth !== undefined ? birthdayMonth : user.birthdayMonth,
        birthdayDay: birthdayDay !== undefined ? birthdayDay : user.birthdayDay,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    return NextResponse.json(updated);
  } catch (e) {
    const message = getApiErrorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
