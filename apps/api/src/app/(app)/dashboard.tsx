"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/providers";
import { api, type Announcement, type SnackSlot, type DiscussionTopic, type UpcomingBirthday, type PrayerRequest, type VerseMemory } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Member = { id: string; displayName: string | null; email: string; role: string };

export function Dashboard() {
  const { token, signOut } = useAuth();
  const [me, setMe] = useState<{ id: string; displayName: string | null; email: string; role?: string; birthdayMonth?: number | null; birthdayDay?: number | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [snackSlots, setSnackSlots] = useState<SnackSlot[]>([]);
  const [discussionTopic, setDiscussionTopic] = useState<DiscussionTopic | null>(null);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([]);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [verseMemory, setVerseMemory] = useState<VerseMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      await api.syncUser(token);
      const [meRes, membersRes, announcementsRes, slotsRes, topicRes, birthdaysRes, prayersRes, versesRes] = await Promise.all([
        api.getMe(token),
        api.getGroupMembers(token),
        api.getAnnouncements(token),
        api.getSnackSlots(token),
        api.getDiscussionTopic(token),
        api.getUpcomingBirthdays(token, 30),
        api.getPrayerRequests(token),
        api.getVerseMemory(token),
      ]);
      setMe(meRes as typeof me);
      setMembers(membersRes as Member[]);
      setAnnouncements(Array.isArray(announcementsRes) ? announcementsRes : []);
      setSnackSlots(Array.isArray(slotsRes) ? slotsRes : []);
      setDiscussionTopic(topicRes ?? null);
      setUpcomingBirthdays(Array.isArray(birthdaysRes) ? birthdaysRes : []);
      setPrayerRequests(Array.isArray(prayersRes) ? prayersRes : []);
      setVerseMemory(Array.isArray(versesRes) ? versesRes : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(e);
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = me?.role === "admin";

  // Modals state
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicBibleRef, setTopicBibleRef] = useState("");
  const [topicBibleText, setTopicBibleText] = useState("");
  const [prayerOpen, setPrayerOpen] = useState(false);
  const [prayerContent, setPrayerContent] = useState("");
  const [prayerPrivate, setPrayerPrivate] = useState(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [verseOpen, setVerseOpen] = useState(false);
  const [verseRef, setVerseRef] = useState("");
  const [verseSnippet, setVerseSnippet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAnnouncement = async () => {
    if (!token || !newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createAnnouncement(token, { title: newTitle.trim(), body: newBody.trim() });
      setNewTitle("");
      setNewBody("");
      setAnnouncementOpen(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (a: Announcement) => {
    if (!token || !confirm(`Delete "${a.title}"?`)) return;
    try {
      await api.deleteAnnouncement(token, a.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSaveTopic = async () => {
    if (!token || !topicTitle.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.setDiscussionTopic(token, {
        title: topicTitle.trim(),
        description: topicDescription.trim() || undefined,
        bibleReference: topicBibleRef.trim() || undefined,
        bibleText: topicBibleText.trim() || undefined,
      });
      setTopicOpen(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPrayer = async () => {
    if (!token || !prayerContent.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createPrayerRequest(token, { content: prayerContent.trim(), isPrivate: prayerPrivate });
      setPrayerContent("");
      setPrayerPrivate(false);
      setPrayerOpen(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePrayed = async (pr: PrayerRequest) => {
    if (!token) return;
    try {
      await api.updatePrayerRequestPrayed(token, pr.id, !pr.prayed);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDeletePrayer = async (pr: PrayerRequest) => {
    if (!token || !confirm("Remove this prayer request?")) return;
    try {
      await api.deletePrayerRequest(token, pr.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSaveBirthday = async () => {
    if (!token) return;
    const m = parseInt(birthdayMonth, 10);
    const d = parseInt(birthdayDay, 10);
    if (!m || m < 1 || m > 12 || !d || d < 1 || d > 31) {
      setError("Enter month (1-12) and day (1-31).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.updateMe(token, { birthdayMonth: m, birthdayDay: d });
      setBirthdayOpen(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveVerse = async () => {
    if (!token || !verseRef.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.setVerseOfMonth(token, { verseReference: verseRef.trim(), verseSnippet: verseSnippet.trim() || undefined });
      setVerseOpen(false);
      setVerseRef("");
      setVerseSnippet("");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVerseMemorized = async (v: VerseMemory) => {
    if (!token) return;
    try {
      await api.setVerseMemorized(token, v.id, !v.memorized);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleSnackSignup = async (slot: SnackSlot) => {
    if (!token || !me?.id) return;
    const isSignedUp = slot.signups.some((s) => s.id === me.id);
    try {
      if (isSignedUp) await api.snackSignOff(token, slot.id);
      else await api.snackSignUp(token, slot.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">Small Group</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                {me?.displayName ?? me?.email ?? "Member"}
                <span className="text-muted-foreground">▼</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => signOut()} variant="destructive">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto py-6 px-4 space-y-8">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 text-destructive px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Discussion topic */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">
              Discussion topic
            </CardTitle>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTopicTitle(discussionTopic?.title ?? "");
                  setTopicDescription(discussionTopic?.description ?? "");
                  setTopicBibleRef(discussionTopic?.bibleReference ?? "");
                  setTopicBibleText(discussionTopic?.bibleText ?? "");
                  setTopicOpen(true);
                }}
              >
                {discussionTopic ? "Edit" : "Set"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {discussionTopic ? (
              <div className="space-y-2">
                <p className="font-medium">{discussionTopic.title}</p>
                {discussionTopic.description && <p className="text-sm text-muted-foreground">{discussionTopic.description}</p>}
                {discussionTopic.bibleReference && <p className="text-sm font-medium">{discussionTopic.bibleReference}</p>}
                {discussionTopic.bibleText && <p className="text-sm italic text-muted-foreground">{discussionTopic.bibleText}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No topic set for this month.</p>
            )}
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Announcements</CardTitle>
            {isAdmin && (
              <Button size="sm" onClick={() => setAnnouncementOpen(true)}>
                Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="rounded-lg border bg-card p-4">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="mt-2 text-destructive hover:text-destructive" onClick={() => handleDeleteAnnouncement(a)}>
                      Delete
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Prayer requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Prayer requests</CardTitle>
            <Button size="sm" onClick={() => setPrayerOpen(true)}>
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {prayerRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prayer requests yet.</p>
            ) : (
              prayerRequests.map((pr) => (
                <div key={pr.id} className="rounded-lg border bg-card p-4">
                  <p className="text-sm">{pr.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pr.authorName ?? "Someone"}{pr.isPrivate ? " (private)" : ""}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant={pr.prayed ? "default" : "outline"} onClick={() => handleTogglePrayed(pr)}>
                      {pr.prayed ? "Prayed" : "Mark prayed"}
                    </Button>
                    {pr.authorId === me?.id && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeletePrayer(pr)}>Delete</Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Snack sign-up */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Snack sign-up</CardTitle>
            <CardDescription>Upcoming dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snackSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming dates.</p>
            ) : (
              snackSlots.map((slot) => {
                const isSignedUp = slot.signups.some((s) => s.id === me?.id);
                return (
                  <div key={slot.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
                    <div>
                      <p className="font-medium">
                        {new Date(slot.slotDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                      {slot.signups.length > 0 && (
                        <p className="text-sm text-muted-foreground">{slot.signups.map((s) => s.displayName ?? s.email).join(", ")}</p>
                      )}
                    </div>
                    <Button size="sm" variant={isSignedUp ? "default" : "outline"} onClick={() => toggleSnackSignup(slot)}>
                      {isSignedUp ? "Remove my sign-up" : "I'll bring snacks"}
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Birthdays */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">
              Birthdays
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setBirthdayMonth(me?.birthdayMonth?.toString() ?? ""); setBirthdayDay(me?.birthdayDay?.toString() ?? ""); setBirthdayOpen(true); }}>
              {me?.birthdayMonth ? "Edit mine" : "Set mine"}
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming birthdays in the next 30 days.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {upcomingBirthdays.map((b) => (
                  <li key={b.id}>{b.displayName ?? "Member"} — {b.birthdayMonth}/{b.birthdayDay}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Verse memory */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Bible verse memory</CardTitle>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => { setVerseRef(verseMemory[0]?.verseReference ?? ""); setVerseSnippet(verseMemory[0]?.verseSnippet ?? ""); setVerseOpen(true); }}>
                {verseMemory.length ? "Edit" : "Set verse"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {verseMemory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verse set for this month.</p>
            ) : (
              verseMemory.map((v) => (
                <div key={v.id} className="rounded-lg border bg-accent/50 p-4">
                  <p className="font-medium">{v.verseReference}</p>
                  {v.verseSnippet && <p className="text-sm italic text-muted-foreground mt-1">{v.verseSnippet}</p>}
                  <Button size="sm" variant={v.memorized ? "default" : "outline"} className="mt-2" onClick={() => handleToggleVerseMemorized(v)}>
                    {v.memorized ? "Memorized" : "I memorized this"}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Group members</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="text-sm">{m.displayName ?? m.email}</span>
                    {m.role === "admin" && <Badge variant="secondary">admin</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center pb-8">
          <Button variant="outline" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
            {refreshing ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : "Refresh"}
          </Button>
        </div>
      </main>

      {/* New announcement dialog */}
      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title</Label>
              <Input id="ann-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-body">Body</Label>
              <Textarea id="ann-body" value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Body" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAnnouncement} disabled={submitting || !newTitle.trim() || !newBody.trim()}>
              {submitting ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discussion topic dialog */}
      <Dialog open={topicOpen} onOpenChange={setTopicOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Discussion topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Topic title</Label>
              <Input value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} placeholder="Topic title" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={topicDescription} onChange={(e) => setTopicDescription(e.target.value)} placeholder="Description" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Bible reference</Label>
              <Input value={topicBibleRef} onChange={(e) => setTopicBibleRef(e.target.value)} placeholder="e.g. John 3:16" />
            </div>
            <div className="space-y-2">
              <Label>Bible text (optional)</Label>
              <Textarea value={topicBibleText} onChange={(e) => setTopicBibleText(e.target.value)} placeholder="Verse text" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTopic} disabled={submitting || !topicTitle.trim()}>
              {submitting ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prayer request dialog */}
      <Dialog open={prayerOpen} onOpenChange={setPrayerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New prayer request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Your request</Label>
              <Textarea value={prayerContent} onChange={(e) => setPrayerContent(e.target.value)} placeholder="Your request…" rows={4} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="prayer-private">Private (only you see it)</Label>
              <Switch id="prayer-private" checked={prayerPrivate} onCheckedChange={setPrayerPrivate} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrayerOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPrayer} disabled={submitting || !prayerContent.trim()}>
              {submitting ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Birthday dialog */}
      <Dialog open={birthdayOpen} onOpenChange={setBirthdayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My birthday</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month (1-12)</Label>
                <Input type="number" min={1} max={12} value={birthdayMonth} onChange={(e) => setBirthdayMonth(e.target.value)} placeholder="1-12" />
              </div>
              <div className="space-y-2">
                <Label>Day (1-31)</Label>
                <Input type="number" min={1} max={31} value={birthdayDay} onChange={(e) => setBirthdayDay(e.target.value)} placeholder="1-31" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBirthdayOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBirthday} disabled={submitting}>
              {submitting ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verse dialog */}
      <Dialog open={verseOpen} onOpenChange={setVerseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verse of the month</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={verseRef} onChange={(e) => setVerseRef(e.target.value)} placeholder="e.g. John 3:16" />
            </div>
            <div className="space-y-2">
              <Label>Verse text (optional)</Label>
              <Textarea value={verseSnippet} onChange={(e) => setVerseSnippet(e.target.value)} placeholder="Verse text" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerseOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVerse} disabled={submitting || !verseRef.trim()}>
              {submitting ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
