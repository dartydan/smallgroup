import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Switch,
  SafeAreaView,
} from "react-native";
import { useAuth } from "./AuthContext";
import {
  getMe,
  getGroupMembers,
  syncUser,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getSnackSlots,
  snackSignUp,
  snackSignOff,
  getDiscussionTopic,
  setDiscussionTopic,
  getUpcomingBirthdays,
  updateMe,
  getPrayerRequests,
  createPrayerRequest,
  updatePrayerRequestPrayed,
  deletePrayerRequest,
  getVerseMemory,
  setVerseOfMonth,
  setVerseMemorized,
  type Announcement,
  type SnackSlot,
  type DiscussionTopic,
  type UpcomingBirthday,
  type PrayerRequest,
  type VerseMemory,
} from "./api";
import { nature } from "./theme";

/** Map server/network errors to a short, actionable message for the banner. */
function friendlyLoadError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("failed query") || lower.includes("relation \"users\"") || lower.includes("does not exist")) {
    return "Server couldn’t load your account. The API database may be missing tables—ensure migrations are applied and DATABASE_URL is set.";
  }
  if (lower.includes("econnrefused") || lower.includes("network request failed") || lower.includes("fetch")) {
    return "Can’t reach the server. Check EXPO_PUBLIC_API_URL (use your computer’s IP on a real device, not localhost) and that the API is running.";
  }
  if (lower.includes("unauthorized") || lower.includes("401")) {
    return "Session expired or invalid. Try signing out and signing in again.";
  }
  return raw;
}

type Member = {
  id: string;
  displayName: string | null;
  email: string;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  role: string;
};

function getRoleLabel(role: string | null | undefined): "Leader" | "Member" {
  return role === "admin" ? "Leader" : "Member";
}

type AppTab = "home" | "prayer" | "verse" | "settings";

function hasLettersAndNumbers(value: string): boolean {
  return /[a-z]/i.test(value) && /[0-9]/.test(value);
}

function isIdLikeName(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  const prefixed = normalized.match(
    /^(user|org|sess|session|client|sms|email|inv|invite|acct|account|clerk)[\s._:-]+([a-z0-9]+)$/
  );
  if (prefixed) {
    const token = prefixed[2];
    if (token.length >= 16) return true;
    if (token.length >= 6 && hasLettersAndNumbers(token)) return true;
  }
  if (/^[a-f0-9]{16,}$/.test(normalized)) return true;
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  if (compact.length >= 20 && hasLettersAndNumbers(compact)) return true;
  return false;
}

function sanitizeName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "member" || isIdLikeName(trimmed)) return null;
  return trimmed;
}

function formatNameFromEmail(email: string | null | undefined, fallback = "Member"): string {
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart || isIdLikeName(localPart)) return fallback;
  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || isIdLikeName(cleaned)) return fallback;
  return cleaned
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function safeName(
  displayName: string | null | undefined,
  email?: string | null,
  fallback = "Member"
): string {
  const safeDisplayName = sanitizeName(displayName);
  if (safeDisplayName) return safeDisplayName;
  const emailName = formatNameFromEmail(email, fallback);
  return sanitizeName(emailName) ?? fallback;
}

export function HomeScreen() {
  const { getToken, signOut } = useAuth();
  const [me, setMe] = useState<{
    id: string;
    displayName: string | null;
    email: string;
    role?: string;
    birthdayMonth?: number | null;
    birthdayDay?: number | null;
  } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [snackSlots, setSnackSlots] = useState<SnackSlot[]>([]);
  const [discussionTopic, setDiscussionTopicState] = useState<DiscussionTopic | null>(null);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([]);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [verseMemory, setVerseMemory] = useState<VerseMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<string | null>(null);
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicBibleRef, setTopicBibleRef] = useState("");
  const [topicBibleText, setTopicBibleText] = useState("");
  const [topicSubmitting, setTopicSubmitting] = useState(false);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [birthdaySubmitting, setBirthdaySubmitting] = useState(false);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [prayerContent, setPrayerContent] = useState("");
  const [prayerPrivate, setPrayerPrivate] = useState(false);
  const [prayerSubmitting, setPrayerSubmitting] = useState(false);
  const [showVerseModal, setShowVerseModal] = useState(false);
  const [verseRef, setVerseRef] = useState("");
  const [verseSnippet, setVerseSnippet] = useState("");
  const [verseSubmitting, setVerseSubmitting] = useState(false);
  const [snackPendingIds, setSnackPendingIds] = useState<Set<string>>(
    () => new Set()
  );
  const [activeTab, setActiveTab] = useState<AppTab>("home");

  const load = async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      await signOut();
      return;
    }
    setLoadError(null);
    setLoadErrorRaw(null);
    try {
      await syncUser(token);
      const [meRes, membersRes, announcementsRes, slotsRes, topicRes, birthdaysRes, prayersRes, versesRes] = await Promise.all([
        getMe(token),
        getGroupMembers(token),
        getAnnouncements(token),
        getSnackSlots(token),
        getDiscussionTopic(token),
        getUpcomingBirthdays(token, 14),
        getPrayerRequests(token),
        getVerseMemory(token),
      ]);
      setMe(meRes);
      setMembers(membersRes?.members ?? []);
      setAnnouncements(Array.isArray(announcementsRes) ? announcementsRes : []);
      setSnackSlots(Array.isArray(slotsRes) ? slotsRes : []);
      setDiscussionTopicState(topicRes ?? null);
      setUpcomingBirthdays(Array.isArray(birthdaysRes) ? birthdaysRes : []);
      setPrayerRequests(Array.isArray(prayersRes) ? prayersRes : []);
      setVerseMemory(Array.isArray(versesRes) ? versesRes : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const lower = message.toLowerCase();
      const authFailed =
        lower.includes("tenant or user not found") ||
        lower.includes("unauthorized") ||
        lower.includes("(401)");
      if (authFailed) {
        await signOut();
        return;
      }
      console.error(e);
      setLoadErrorRaw(message);
      setLoadError(friendlyLoadError(message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const isAdmin = me?.role === "admin";

  const onPublishAnnouncement = async () => {
    const token = await getToken();
    if (!token || !newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      await createAnnouncement(token, {
        title: newTitle.trim(),
        body: newBody.trim(),
      });
      setNewTitle("");
      setNewBody("");
      setShowNewAnnouncement(false);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSnackSignup = async (slot: SnackSlot) => {
    const token = await getToken();
    if (!token || !me?.id) return;
    if (snackPendingIds.has(slot.id)) return;
    const isSignedUp = slot.signups.some((s) => s.id === me.id);
    const optimisticSignup = {
      id: me.id,
      displayName: safeName(me.displayName, me.email, "Member"),
      email: me.email,
    };
    let previousSignups: SnackSlot["signups"] | null = null;
    setSnackPendingIds((prev) => {
      const next = new Set(prev);
      next.add(slot.id);
      return next;
    });
    setSnackSlots((prevSlots) =>
      prevSlots.map((existingSlot) => {
        if (existingSlot.id !== slot.id) return existingSlot;
        previousSignups = existingSlot.signups.map((signup) => ({ ...signup }));
        if (isSignedUp) {
          return {
            ...existingSlot,
            signups: existingSlot.signups.filter((signup) => signup.id !== me.id),
          };
        }
        const alreadyInList = existingSlot.signups.some((signup) => signup.id === me.id);
        return alreadyInList
          ? existingSlot
          : {
              ...existingSlot,
              signups: [...existingSlot.signups, optimisticSignup],
            };
      })
    );
    try {
      if (isSignedUp) {
        await snackSignOff(token, slot.id);
      } else {
        await snackSignUp(token, slot.id);
      }
      void getSnackSlots(token)
        .then((freshSlots) => {
          if (Array.isArray(freshSlots)) {
            setSnackSlots(freshSlots);
          }
        })
        .catch(() => {});
    } catch (e) {
      if (previousSignups) {
        setSnackSlots((prevSlots) =>
          prevSlots.map((existingSlot) =>
            existingSlot.id === slot.id
              ? { ...existingSlot, signups: previousSignups ?? [] }
              : existingSlot
          )
        );
      }
      Alert.alert("Error", (e as Error).message);
    } finally {
      setSnackPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(slot.id);
        return next;
      });
    }
  };

  const onAddPrayerRequest = async () => {
    const token = await getToken();
    if (!token || !prayerContent.trim()) return;
    setPrayerSubmitting(true);
    try {
      await createPrayerRequest(token, {
        content: prayerContent.trim(),
        isPrivate: prayerPrivate,
      });
      setPrayerContent("");
      setPrayerPrivate(false);
      setShowPrayerModal(false);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setPrayerSubmitting(false);
    }
  };

  const onTogglePrayed = async (pr: PrayerRequest) => {
    const token = await getToken();
    if (!token) return;
    try {
      await updatePrayerRequestPrayed(token, pr.id, !pr.prayed);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    }
  };

  const onSaveVerse = async () => {
    const token = await getToken();
    if (!token || !verseRef.trim()) return;
    setVerseSubmitting(true);
    try {
      await setVerseOfMonth(token, {
        verseReference: verseRef.trim(),
        verseSnippet: verseSnippet.trim() || undefined,
      });
      setShowVerseModal(false);
      setVerseRef("");
      setVerseSnippet("");
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setVerseSubmitting(false);
    }
  };

  const onToggleVerseMemorized = async (v: VerseMemory) => {
    const token = await getToken();
    if (!token) return;
    try {
      await setVerseMemorized(token, v.id, !v.memorized);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    }
  };

  const onDeletePrayerRequest = (pr: PrayerRequest) => {
    Alert.alert(
      "Delete prayer request",
      "Remove this request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            try {
              await deletePrayerRequest(token, pr.id);
              load();
            } catch (e) {
              Alert.alert("Error", (e as Error).message);
            }
          },
        },
      ]
    );
  };

  const onSaveBirthday = async () => {
    const token = await getToken();
    if (!token) return;
    const m = parseInt(birthdayMonth, 10);
    const d = parseInt(birthdayDay, 10);
    if (!m || m < 1 || m > 12 || !d || d < 1 || d > 31) {
      Alert.alert("Invalid", "Enter month (1-12) and day (1-31).");
      return;
    }
    setBirthdaySubmitting(true);
    try {
      await updateMe(token, { birthdayMonth: m, birthdayDay: d });
      setShowBirthdayModal(false);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setBirthdaySubmitting(false);
    }
  };

  const onSaveTopic = async () => {
    const token = await getToken();
    if (!token || !topicTitle.trim()) return;
    setTopicSubmitting(true);
    try {
      await setDiscussionTopic(token, {
        title: topicTitle.trim(),
        description: topicDescription.trim() || undefined,
        bibleReference: topicBibleRef.trim() || undefined,
        bibleText: topicBibleText.trim() || undefined,
      });
      setShowTopicModal(false);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setTopicSubmitting(false);
    }
  };

  const onDeleteAnnouncement = (item: Announcement) => {
    Alert.alert(
      "Delete announcement",
      `Delete "${item.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            try {
              await deleteAnnouncement(token, item.id);
              load();
            } catch (e) {
              Alert.alert("Error", (e as Error).message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loadError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{loadError}</Text>
            <Text style={styles.errorBannerHint}>
              Pull to refresh. On a real device, set EXPO_PUBLIC_API_URL to your computer’s IP (e.g. http://192.168.1.x:3001), not localhost.
            </Text>
            {loadErrorRaw && loadErrorRaw !== loadError ? (
              <Text style={styles.errorBannerDetail}>Details: {loadErrorRaw}</Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.header}>
          <Text style={styles.title}>Small Group</Text>
          <Text style={styles.subtitle}>
            Hello, {safeName(me?.displayName, me?.email, "Member")}
          </Text>
        </View>

        {activeTab === "home" ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Discussion topic of the month</Text>
                {isAdmin && (
                  <Pressable
                    style={({ pressed }) => [styles.addBtn, pressed && styles.buttonPressed]}
                    onPress={() => {
                      setTopicTitle(discussionTopic?.title ?? "");
                      setTopicDescription(discussionTopic?.description ?? "");
                      setTopicBibleRef(discussionTopic?.bibleReference ?? "");
                      setTopicBibleText(discussionTopic?.bibleText ?? "");
                      setShowTopicModal(true);
                    }}
                  >
                    <Text style={styles.addBtnText}>
                      {discussionTopic ? "Edit" : "Set"}
                    </Text>
                  </Pressable>
                )}
              </View>
              {discussionTopic ? (
                <View style={styles.topicCard}>
                  <Text style={styles.topicTitle}>{discussionTopic.title}</Text>
                  {discussionTopic.description ? (
                    <Text style={styles.topicDescription}>{discussionTopic.description}</Text>
                  ) : null}
                  {discussionTopic.bibleReference ? (
                    <Text style={styles.topicRef}>{discussionTopic.bibleReference}</Text>
                  ) : null}
                  {discussionTopic.bibleText ? (
                    <Text style={styles.topicText}>{discussionTopic.bibleText}</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.muted}>No topic set for this month.</Text>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Announcements</Text>
                {isAdmin && (
                  <Pressable
                    style={({ pressed }) => [styles.addBtn, pressed && styles.buttonPressed]}
                    onPress={() => setShowNewAnnouncement(true)}
                  >
                    <Text style={styles.addBtnText}>Add</Text>
                  </Pressable>
                )}
              </View>
              {announcements.length === 0 ? (
                <Text style={styles.muted}>No announcements yet.</Text>
              ) : (
                announcements.map((a) => (
                  <View key={a.id} style={styles.announcementCard}>
                    <Text style={styles.announcementTitle}>{a.title}</Text>
                    <Text style={styles.announcementBody}>{a.body}</Text>
                    {isAdmin && (
                      <Pressable
                        style={styles.deleteAnnouncement}
                        onPress={() => onDeleteAnnouncement(a)}
                      >
                        <Text style={styles.deleteAnnouncementText}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Snack sign-up</Text>
              {snackSlots.length === 0 ? (
                <Text style={styles.muted}>No upcoming dates.</Text>
              ) : (
                snackSlots.map((slot) => {
                  const isSignedUp = slot.signups.some((s) => s.id === me?.id);
                  const isPending = snackPendingIds.has(slot.id);
                  return (
                    <View key={slot.id} style={styles.snackCard}>
                      <Text style={styles.snackDate}>
                        {new Date(slot.slotDate + "T12:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                      {slot.signups.length > 0 && (
                        <Text style={styles.snackSignups}>
                          {slot.signups
                            .map((s) => safeName(s.displayName, s.email, "Member"))
                            .join(", ")}
                        </Text>
                      )}
                      <Pressable
                        style={({ pressed }) => [
                          styles.snackButton,
                          isSignedUp && styles.snackButtonActive,
                          isPending && styles.buttonDisabled,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() => toggleSnackSignup(slot)}
                        disabled={isPending}
                      >
                        <Text
                          style={[
                            styles.snackButtonText,
                            isSignedUp && styles.snackButtonTextActive,
                          ]}
                        >
                          {isSignedUp ? "Remove my sign-up" : "I'll bring snacks"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Birthdays coming up</Text>
                <Pressable
                  style={({ pressed }) => [styles.addBtn, pressed && styles.buttonPressed]}
                  onPress={() => {
                    setBirthdayMonth(me?.birthdayMonth?.toString() ?? "");
                    setBirthdayDay(me?.birthdayDay?.toString() ?? "");
                    setShowBirthdayModal(true);
                  }}
                >
                  <Text style={styles.addBtnText}>
                    {me?.birthdayMonth ? "Edit mine" : "Set mine"}
                  </Text>
                </Pressable>
              </View>
              {upcomingBirthdays.length === 0 ? (
                <Text style={styles.muted}>No upcoming birthdays in the next 14 days.</Text>
              ) : (
                upcomingBirthdays.map((b) => (
                  <View key={b.id} style={styles.birthdayRow}>
                    <Text style={styles.memberName}>
                      {safeName(b.displayName, null, "Member")} - {b.birthdayMonth}/{b.birthdayDay}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group members</Text>
              {members.length === 0 ? (
                <Text style={styles.muted}>No members yet.</Text>
              ) : (
                members.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <Text style={styles.memberName}>
                      {safeName(m.displayName, m.email, "Member")}
                      {" "}
                      ({getRoleLabel(m.role)})
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {activeTab === "prayer" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Prayer requests</Text>
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.buttonPressed]}
                onPress={() => setShowPrayerModal(true)}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
            {prayerRequests.length === 0 ? (
              <Text style={styles.muted}>No prayer requests yet.</Text>
            ) : (
              prayerRequests.map((pr) => (
                <View key={pr.id} style={styles.prayerCard}>
                  <Text style={styles.prayerContent}>{pr.content}</Text>
                  <Text style={styles.prayerMeta}>
                    {safeName(pr.authorName, null, "Someone")}
                    {pr.isPrivate ? " (private)" : ""}
                  </Text>
                  <View style={styles.prayerActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.prayedButton,
                        pr.prayed && styles.prayedButtonActive,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => onTogglePrayed(pr)}
                    >
                      <Text
                        style={[
                          styles.prayedButtonText,
                          pr.prayed && styles.prayedButtonTextActive,
                        ]}
                      >
                        {pr.prayed ? "Prayed" : "Mark prayed"}
                      </Text>
                    </Pressable>
                    {pr.authorId === me?.id && (
                      <Pressable
                        style={styles.deleteAnnouncement}
                        onPress={() => onDeletePrayerRequest(pr)}
                      >
                        <Text style={styles.deleteAnnouncementText}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeTab === "verse" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bible verse memory</Text>
              {isAdmin && (
                <Pressable
                  style={({ pressed }) => [styles.addBtn, pressed && styles.buttonPressed]}
                  onPress={() => {
                    setVerseRef(verseMemory[0]?.verseReference ?? "");
                    setVerseSnippet(verseMemory[0]?.verseSnippet ?? "");
                    setShowVerseModal(true);
                  }}
                >
                  <Text style={styles.addBtnText}>
                    {verseMemory.length ? "Edit" : "Set verse"}
                  </Text>
                </Pressable>
              )}
            </View>
            {verseMemory.length === 0 ? (
              <Text style={styles.muted}>No verse set for this month.</Text>
            ) : (
              verseMemory.map((v) => (
                <View key={v.id} style={styles.verseCard}>
                  <Text style={styles.verseRef}>{v.verseReference}</Text>
                  {v.verseSnippet ? (
                    <Text style={styles.verseSnippet}>{v.verseSnippet}</Text>
                  ) : null}
                  <Pressable
                    style={({ pressed }) => [
                      styles.prayedButton,
                      v.memorized && styles.prayedButtonActive,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => onToggleVerseMemorized(v)}
                  >
                    <Text
                      style={[
                        styles.prayedButtonText,
                        v.memorized && styles.prayedButtonTextActive,
                      ]}
                    >
                      {v.memorized ? "Memorized" : "I memorized this"}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeTab === "settings" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.settingsCard}>
              <Text style={styles.settingsLabel}>Name</Text>
              <Text style={styles.settingsValue}>
                {safeName(me?.displayName, me?.email, "Member")}
              </Text>
              <Text style={styles.settingsLabel}>Email</Text>
              <Text style={styles.settingsValue}>{me?.email ?? "-"}</Text>
              <Text style={styles.settingsLabel}>Role</Text>
              <Text style={styles.settingsValue}>{getRoleLabel(me?.role)}</Text>
              <View style={styles.settingsActions}>
                <Pressable
                  style={({ pressed }) => [styles.addBtn, pressed && styles.buttonPressed]}
                  onPress={() => {
                    setBirthdayMonth(me?.birthdayMonth?.toString() ?? "");
                    setBirthdayDay(me?.birthdayDay?.toString() ?? "");
                    setShowBirthdayModal(true);
                  }}
                >
                  <Text style={styles.addBtnText}>
                    {me?.birthdayMonth ? "Edit birthday" : "Set birthday"}
                  </Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.signOut, pressed && styles.buttonPressed]}
              onPress={() => signOut()}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable
          style={({ pressed }) => [
            styles.tabButton,
            activeTab === "home" && styles.tabButtonActive,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setActiveTab("home")}
        >
          <Text style={[styles.tabLabel, activeTab === "home" && styles.tabLabelActive]}>Home</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.tabButton,
            activeTab === "prayer" && styles.tabButtonActive,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setActiveTab("prayer")}
        >
          <Text style={[styles.tabLabel, activeTab === "prayer" && styles.tabLabelActive]}>Prayer</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.tabButton,
            activeTab === "verse" && styles.tabButtonActive,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setActiveTab("verse")}
        >
          <Text style={[styles.tabLabel, activeTab === "verse" && styles.tabLabelActive]}>
            Verse Memory
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.tabButton,
            activeTab === "settings" && styles.tabButtonActive,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setActiveTab("settings")}
        >
          <Text style={[styles.tabLabel, activeTab === "settings" && styles.tabLabelActive]}>
            Settings
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={showVerseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVerseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verse of the month</Text>
            <TextInput
              style={styles.input}
              value={verseRef}
              onChangeText={setVerseRef}
              placeholder="Reference (e.g. John 3:16)"
              placeholderTextColor={nature.mutedForeground}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={verseSnippet}
              onChangeText={setVerseSnippet}
              placeholder="Verse text (optional)"
              placeholderTextColor={nature.mutedForeground}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.modalButton, pressed && styles.buttonPressed]}
                onPress={() => setShowVerseModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  (!verseRef.trim() || verseSubmitting) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onSaveVerse}
                disabled={!verseRef.trim() || verseSubmitting}
              >
                {verseSubmitting ? (
                  <ActivityIndicator color={nature.primaryForeground} size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showPrayerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrayerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New prayer request</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={prayerContent}
              onChangeText={setPrayerContent}
              placeholder="Your request..."
              placeholderTextColor={nature.mutedForeground}
              multiline
              numberOfLines={4}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Private (only you see it)</Text>
              <Switch
                value={prayerPrivate}
                onValueChange={setPrayerPrivate}
              />
            </View>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.modalButton, pressed && styles.buttonPressed]}
                onPress={() => setShowPrayerModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  (!prayerContent.trim() || prayerSubmitting) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onAddPrayerRequest}
                disabled={!prayerContent.trim() || prayerSubmitting}
              >
                {prayerSubmitting ? (
                  <ActivityIndicator color={nature.primaryForeground} size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Add
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showBirthdayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBirthdayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>My birthday</Text>
            <TextInput
              style={styles.input}
              value={birthdayMonth}
              onChangeText={setBirthdayMonth}
              placeholder="Month (1-12)"
              placeholderTextColor={nature.mutedForeground}
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.input}
              value={birthdayDay}
              onChangeText={setBirthdayDay}
              placeholder="Day (1-31)"
              placeholderTextColor={nature.mutedForeground}
              keyboardType="number-pad"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.modalButton, pressed && styles.buttonPressed]}
                onPress={() => setShowBirthdayModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  birthdaySubmitting && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onSaveBirthday}
                disabled={birthdaySubmitting}
              >
                {birthdaySubmitting ? (
                  <ActivityIndicator color={nature.primaryForeground} size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showTopicModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopicModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Discussion topic</Text>
            <TextInput
              style={styles.input}
              value={topicTitle}
              onChangeText={setTopicTitle}
              placeholder="Topic title"
              placeholderTextColor={nature.mutedForeground}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={topicDescription}
              onChangeText={setTopicDescription}
              placeholder="Description (optional)"
              placeholderTextColor={nature.mutedForeground}
              multiline
            />
            <TextInput
              style={styles.input}
              value={topicBibleRef}
              onChangeText={setTopicBibleRef}
              placeholder="Bible reference (e.g. John 3:16)"
              placeholderTextColor={nature.mutedForeground}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={topicBibleText}
              onChangeText={setTopicBibleText}
              placeholder="Bible text (optional)"
              placeholderTextColor={nature.mutedForeground}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.modalButton, pressed && styles.buttonPressed]}
                onPress={() => setShowTopicModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  (!topicTitle.trim() || topicSubmitting) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onSaveTopic}
                disabled={!topicTitle.trim() || topicSubmitting}
              >
                {topicSubmitting ? (
                  <ActivityIndicator color={nature.primaryForeground} size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showNewAnnouncement}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewAnnouncement(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New announcement</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Title"
              placeholderTextColor={nature.mutedForeground}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={newBody}
              onChangeText={setNewBody}
              placeholder="Body"
              placeholderTextColor={nature.mutedForeground}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.modalButton, pressed && styles.buttonPressed]}
                onPress={() => setShowNewAnnouncement(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  (submitting || !newTitle.trim() || !newBody.trim()) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onPublishAnnouncement}
                disabled={submitting || !newTitle.trim() || !newBody.trim()}
              >
                {submitting ? (
                  <ActivityIndicator color={nature.primaryForeground} size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Publish
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: nature.iosGroupedBackground },
  container: { flex: 1, backgroundColor: nature.iosGroupedBackground },
  scrollContent: { paddingBottom: 14 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorBanner: {
    margin: 16,
    padding: 12,
    backgroundColor: nature.destructive + "20",
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: nature.destructive,
  },
  errorBannerText: { fontSize: 14, color: nature.foreground, fontWeight: "600" },
  errorBannerHint: { fontSize: 12, color: nature.mutedForeground, marginTop: 4 },
  errorBannerDetail: { fontSize: 11, color: nature.mutedForeground, marginTop: 6 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  title: { fontSize: 34, fontWeight: "700", marginBottom: 2, color: nature.foreground },
  subtitle: { fontSize: 15, color: nature.mutedForeground },
  section: { paddingHorizontal: 16, paddingTop: 0, marginBottom: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: nature.foreground },
  addBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: nature.iosTintMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nature.primary + "55",
  },
  addBtnText: { color: nature.primary, fontWeight: "600", fontSize: 14 },
  announcementCard: {
    backgroundColor: nature.iosSurface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
  },
  announcementTitle: { fontSize: 16, fontWeight: "600", marginBottom: 6, color: nature.foreground },
  announcementBody: { fontSize: 14, color: nature.foreground, marginBottom: 8 },
  deleteAnnouncement: { alignSelf: "flex-start" },
  deleteAnnouncementText: { color: nature.destructive, fontSize: 14 },
  memberRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: nature.iosSurface,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
  },
  birthdayRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: nature.iosSurface,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
  },
  memberName: { fontSize: 16, color: nature.foreground },
  muted: { color: nature.mutedForeground, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.36)", justifyContent: "center", padding: 20 },
  modalContent: {
    backgroundColor: nature.iosSurface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16, color: nature.foreground },
  input: {
    borderWidth: 1,
    borderColor: nature.iosSeparator,
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: nature.secondary,
    color: nature.foreground,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalButton: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
    backgroundColor: nature.iosSurface,
  },
  modalButtonPrimary: { backgroundColor: nature.primary, borderColor: nature.primary },
  modalButtonText: { fontSize: 16, fontWeight: "600", color: nature.foreground },
  modalButtonTextPrimary: { color: nature.primaryForeground },
  snackCard: {
    backgroundColor: nature.iosSurface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
  },
  snackDate: { fontSize: 16, fontWeight: "600", marginBottom: 4, color: nature.foreground },
  snackSignups: { fontSize: 14, color: nature.mutedForeground, marginBottom: 8 },
  snackButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nature.primary + "90",
    alignSelf: "flex-start",
    backgroundColor: nature.iosTintMuted,
  },
  snackButtonActive: { backgroundColor: nature.primary },
  snackButtonText: { fontSize: 14, fontWeight: "600", color: nature.primary },
  snackButtonTextActive: { color: nature.primaryForeground },
  topicCard: {
    backgroundColor: nature.secondary,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
  },
  topicTitle: { fontSize: 18, fontWeight: "600", marginBottom: 6, color: nature.foreground },
  topicDescription: { fontSize: 14, color: nature.foreground, marginBottom: 8 },
  topicRef: { fontSize: 14, fontWeight: "600", color: nature.foreground, marginBottom: 4 },
  topicText: { fontSize: 14, color: nature.mutedForeground, fontStyle: "italic" },
  prayerCard: {
    backgroundColor: nature.iosSurface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
  },
  prayerContent: { fontSize: 15, marginBottom: 4, color: nature.foreground },
  prayerMeta: { fontSize: 12, color: nature.mutedForeground, marginBottom: 8 },
  prayerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  prayedButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nature.primary + "88",
    backgroundColor: nature.iosTintMuted,
  },
  prayedButtonActive: { backgroundColor: nature.primary },
  prayedButtonText: { fontSize: 14, color: nature.primary },
  prayedButtonTextActive: { color: nature.primaryForeground },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  switchLabel: { fontSize: 14, color: nature.foreground },
  verseCard: {
    backgroundColor: nature.secondary,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
  },
  verseRef: { fontSize: 16, fontWeight: "600", marginBottom: 6, color: nature.foreground },
  verseSnippet: { fontSize: 14, color: nature.mutedForeground, fontStyle: "italic", marginBottom: 10 },
  settingsCard: {
    marginTop: 12,
    backgroundColor: nature.iosSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
    padding: 16,
  },
  settingsLabel: { fontSize: 12, color: nature.mutedForeground, marginTop: 10 },
  settingsValue: { fontSize: 15, color: nature.foreground, marginTop: 2 },
  settingsActions: { marginTop: 14, alignItems: "flex-start" },
  signOut: {
    marginTop: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: nature.destructive + "66",
    borderRadius: 12,
    backgroundColor: nature.destructive + "14",
  },
  bottomNav: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: nature.iosSeparator,
    backgroundColor: nature.iosTabBar,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabButtonActive: {
    backgroundColor: nature.iosTintMuted,
    borderColor: nature.primary + "70",
  },
  tabLabel: { fontSize: 12, fontWeight: "600", color: nature.mutedForeground },
  tabLabelActive: { color: nature.primary },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  signOutText: { color: nature.destructive, fontSize: 16, fontWeight: "600" },
});
