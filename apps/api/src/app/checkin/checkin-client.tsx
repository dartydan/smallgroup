"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import {
  api,
  type WeeklyCheckIn,
  type WeeklyCheckInFeed,
  type WeeklyCheckInStatus,
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{
  value: WeeklyCheckInStatus;
  label: string;
  description: string;
}> = [
  { value: "great", label: "Great", description: "I am doing well this week." },
  { value: "okay", label: "Okay", description: "I am doing alright this week." },
  {
    value: "struggling",
    label: "Struggling",
    description: "I need support and prayer this week.",
  },
];

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: WeeklyCheckInStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function statusBadgeClassName(status: WeeklyCheckInStatus): string {
  if (status === "great") return "bg-green-600 text-white";
  if (status === "okay") return "bg-amber-500 text-black";
  return "bg-red-600 text-white";
}

export function CheckInClient() {
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();

  const [feed, setFeed] = useState<WeeklyCheckInFeed>({ isLeader: false, items: [] });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<WeeklyCheckInStatus>("okay");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const getAuthToken = useCallback(async () => {
    if (!isLoaded) return null;
    const token = await getToken();
    if (!token) {
      router.push("/sign-in");
      return null;
    }
    return token;
  }, [getToken, isLoaded, router]);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const token = await getAuthToken();
      if (!token) return;

      if (opts.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [checkIns, me] = await Promise.all([
          api.getWeeklyCheckIns(token),
          api.getMe(token),
        ]);
        setFeed(checkIns);
        setCurrentUserId(me.id ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getAuthToken],
  );

  useEffect(() => {
    if (!isLoaded) return;
    void load();
  }, [isLoaded, load]);

  const myItems = useMemo(() => {
    if (!currentUserId) return [];
    return feed.items.filter((item) => item.userId === currentUserId);
  }, [currentUserId, feed.items]);

  const groupItems = useMemo(() => {
    if (!feed.isLeader) return [];
    return feed.items;
  }, [feed.isLeader, feed.items]);

  const handleSubmit = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.createWeeklyCheckIn(token, {
        status,
        notes: notes.trim() || null,
      });
      setNotes("");
      setNotice("Check-in submitted.");
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [getAuthToken, load, notes, status]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-1 size-4" />
            Dashboard
          </Button>
          <h1 className="text-xl font-semibold">Weekly Check-In</h1>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void load({ silent: true })}
          disabled={loading || refreshing}
        >
          <RefreshCw className={cn("mr-1 size-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-foreground">{notice}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submit your check-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "rounded-md border px-3 py-3 text-left transition",
                  status === option.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/60",
                )}
                onClick={() => setStatus(option.value)}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>

          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Share anything your leaders should know (optional)."
            rows={4}
            maxLength={2000}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{notes.length}/2000</p>
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || loading}>
              {submitting ? "Submitting..." : "Submit check-in"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your recent check-ins</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : myItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No check-ins yet.</p>
          ) : (
            <div className="space-y-2">
              {myItems.map((item) => (
                <div key={item.id} className="rounded-md border bg-card px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={statusBadgeClassName(item.status)}>{statusLabel(item.status)}</Badge>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                  </div>
                  {item.notes ? <p className="mt-2 text-sm text-foreground">{item.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {feed.isLeader ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Group check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : groupItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No group check-ins yet.</p>
            ) : (
              <div className="space-y-2">
                {groupItems.map((item: WeeklyCheckIn) => (
                  <div key={item.id} className="rounded-md border bg-card px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.userName}</p>
                        <Badge className={statusBadgeClassName(item.status)}>{statusLabel(item.status)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                    </div>
                    {item.notes ? <p className="mt-2 text-sm text-foreground">{item.notes}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
