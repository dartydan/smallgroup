"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { api, type VersePracticeLevelsResponse } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PracticeLevel = 1 | 2 | 3;
export type PracticeLevelCompletion = Record<PracticeLevel, boolean>;
type PracticeCompletionSource = "reset" | "server" | "local";

type ParsedReference = {
  book: string;
  chapter: number;
  verseNumbers: number[];
};

type VerseToken = {
  id: string;
  text: string;
  prefix: string;
  core: string;
  suffix: string;
  targetIndex: number | null;
  expectedLetter: string | null;
};

function normalizeWord(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function parseVerseNumbers(raw: string | undefined): number[] {
  if (!raw) return [];
  const normalized = raw
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, "");
  if (!normalized) return [];
  if (!/^[\d,-]+$/.test(normalized)) return [];

  const segments = normalized.split(",");
  if (segments.some((segment) => !segment)) return [];

  const numbers = new Set<number>();
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      const value = Number.parseInt(segment, 10);
      if (!Number.isFinite(value) || value < 1) return [];
      numbers.add(value);
      continue;
    }

    const rangeMatch = segment.match(/^(\d+)-(\d+)$/);
    if (!rangeMatch) return [];

    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
      return [];
    }
    if (end - start > 199) return [];

    for (let value = start; value <= end; value += 1) {
      numbers.add(value);
    }
  }

  return [...numbers].sort((a, b) => a - b);
}

function parseVerseReference(reference: string): ParsedReference | null {
  const normalized = reference
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  const match = normalized.match(/^(.+?)\s+(\d+)(?::([\d,\-\s]+))?$/);
  if (!match) return null;

  const chapter = Number.parseInt(match[2], 10);
  if (!Number.isFinite(chapter) || chapter < 1) return null;

  return {
    book: match[1].trim(),
    chapter,
    verseNumbers: parseVerseNumbers(match[3]),
  };
}

function buildVerseTokens(text: string): VerseToken[] {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  let nextTargetIndex = 0;
  return parts.map((part, index) => {
    const parsed = part.match(/^([^A-Za-z']*)([A-Za-z][A-Za-z']*)([^A-Za-z']*)$/);
    if (!parsed) {
      return {
        id: `token-${index}-${part}`,
        text: part,
        prefix: "",
        core: "",
        suffix: "",
        targetIndex: null,
        expectedLetter: null,
      };
    }

    const prefix = parsed[1] ?? "";
    const core = parsed[2] ?? "";
    const suffix = parsed[3] ?? "";
    const normalizedCore = normalizeWord(core);
    if (!normalizedCore) {
      return {
        id: `token-${index}-${part}`,
        text: part,
        prefix: "",
        core: "",
        suffix: "",
        targetIndex: null,
        expectedLetter: null,
      };
    }

    const token: VerseToken = {
      id: `token-${index}-${part}`,
      text: part,
      prefix,
      core,
      suffix,
      targetIndex: nextTargetIndex,
      expectedLetter: normalizedCore[0] ?? null,
    };
    nextTargetIndex += 1;
    return token;
  });
}

function shouldRevealWord(level: PracticeLevel, targetIndex: number): boolean {
  if (level === 1) return true;
  if (level === 2) return targetIndex % 2 === 0;
  return false;
}

function createEmptyCompletion(): PracticeLevelCompletion {
  return { 1: false, 2: false, 3: false };
}

type PracticeCompletionPills = Record<
  PracticeLevel,
  Array<{ userId: string; firstName: string }>
>;

function createEmptyCompletionPills(): PracticeCompletionPills {
  return { 1: [], 2: [], 3: [] };
}

function toPracticeLevel(raw: unknown): PracticeLevel | null {
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (parsed === 1 || parsed === 2 || parsed === 3) return parsed;
  return null;
}

function mapPracticeLevelsPayload(payload: VersePracticeLevelsResponse): {
  completed: PracticeLevelCompletion;
  pills: PracticeCompletionPills;
} {
  const completed = createEmptyCompletion();
  const pills = createEmptyCompletionPills();

  for (const raw of payload.myCompletedLevels ?? []) {
    const level = toPracticeLevel(raw);
    if (!level) continue;
    completed[level] = true;
  }

  for (const rawLevel of [1, 2, 3]) {
    const level = rawLevel as PracticeLevel;
    const members = payload.completedByLevel?.[level] ?? [];
    pills[level] = members
      .filter(
        (member): member is { userId: string; firstName: string } =>
          typeof member?.userId === "string" && typeof member?.firstName === "string",
      )
      .map((member) => ({
        userId: member.userId,
        firstName: member.firstName.trim() || "Member",
      }));
  }

  return { completed, pills };
}

export type PracticeVerseGameProps = {
  initialReference: string | null;
  verseId?: string | null;
  embedded?: boolean;
  level?: PracticeLevel;
  onLevelChange?: (nextLevel: PracticeLevel) => void;
  onCompletedLevelsChange?: (
    completed: PracticeLevelCompletion,
    source: PracticeCompletionSource,
  ) => void;
  showLevelSelector?: boolean;
};

export function PracticeVerseGame({
  initialReference,
  verseId,
  embedded = false,
  level: controlledLevel,
  onLevelChange,
  onCompletedLevelsChange,
  showLevelSelector = true,
}: PracticeVerseGameProps) {
  const router = useRouter();
  const { isLoaded, userId, getToken } = useAuth();
  const { user } = useUser();
  const inlineInputRef = useRef<HTMLInputElement | null>(null);
  const completionAdvanceInputRef = useRef<HTMLInputElement | null>(null);
  const practiceContentRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState(initialReference?.trim() ?? "");
  const [resolvedVerseId, setResolvedVerseId] = useState<string | null>(
    verseId ?? null,
  );
  const [verseText, setVerseText] = useState("");
  const [internalLevel, setInternalLevel] = useState<PracticeLevel>(1);
  const [entryValue, setEntryValue] = useState("");
  const [results, setResults] = useState<Array<boolean | null>>([]);
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [isSmallViewport, setIsSmallViewport] = useState(false);
  const [isSoftwareKeyboardOpen, setIsSoftwareKeyboardOpen] = useState(false);
  const [hasEnteredPractice, setHasEnteredPractice] = useState(!embedded);
  const [completedLevels, setCompletedLevels] = useState<PracticeLevelCompletion>(
    () => createEmptyCompletion(),
  );
  const [completionSource, setCompletionSource] =
    useState<PracticeCompletionSource>("reset");
  const [completionPillsByLevel, setCompletionPillsByLevel] =
    useState<PracticeCompletionPills>(() => createEmptyCompletionPills());
  const level = controlledLevel ?? internalLevel;

  const currentUserFirstName = useMemo(() => {
    const first = user?.firstName?.trim();
    if (first) return first;
    const full = user?.fullName?.trim();
    if (full) return full.split(/\s+/)[0] ?? "You";
    return "You";
  }, [user?.firstName, user?.fullName]);

  const setLevel = useCallback(
    (nextLevel: PracticeLevel) => {
      if (nextLevel !== level) {
        // Clear attempt state immediately to avoid stale completion bleeding into next level.
        setResults((previous) => Array(previous.length).fill(null));
        setCurrentTargetIndex(0);
        setEntryValue("");
      }
      if (onLevelChange) {
        onLevelChange(nextLevel);
        return;
      }
      setInternalLevel(nextLevel);
    },
    [level, onLevelChange],
  );

  const focusInlineInput = useCallback((preventScroll = false) => {
    const input = inlineInputRef.current ?? completionAdvanceInputRef.current;
    if (!input) return;

    if (preventScroll) {
      try {
        input.focus({ preventScroll: true });
        return;
      } catch {
        // Fallback for browsers that do not support focus options.
      }
    }

    input.focus();
  }, []);

  const tokens = useMemo(() => buildVerseTokens(verseText), [verseText]);
  const targetLetters = useMemo(
    () =>
      tokens
        .filter((token) => token.targetIndex != null && token.expectedLetter != null)
        .map((token) => token.expectedLetter as string),
    [tokens],
  );
  const totalTargets = targetLetters.length;
  const attemptedCount = useMemo(
    () => results.filter((result) => result != null).length,
    [results],
  );
  const correctCount = useMemo(
    () => results.filter((result) => result === true).length,
    [results],
  );
  const wrongCount = useMemo(
    () => results.filter((result) => result === false).length,
    [results],
  );
  const accuracyPercent = useMemo(() => {
    if (attemptedCount === 0) return 0;
    return Math.round((correctCount / attemptedCount) * 100);
  }, [attemptedCount, correctCount]);
  const isComplete = totalTargets > 0 && currentTargetIndex >= totalTargets;
  const isPerfectScore = isComplete && totalTargets > 0 && correctCount === totalTargets;
  const isCompactMobileMode = embedded && isSmallViewport;

  useEffect(() => {
    setResolvedVerseId(verseId ?? null);
  }, [verseId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateViewport = () => setIsSmallViewport(mediaQuery.matches);
    updateViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateViewport);
      return () => mediaQuery.removeEventListener("change", updateViewport);
    }

    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const updateKeyboardState = () => {
      // Approximate on-screen keyboard visibility from viewport shrink.
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setIsSoftwareKeyboardOpen(keyboardHeight > 120);
    };

    updateKeyboardState();
    viewport.addEventListener("resize", updateKeyboardState);
    viewport.addEventListener("scroll", updateKeyboardState);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardState);
      viewport.removeEventListener("scroll", updateKeyboardState);
    };
  }, []);

  const loadPracticeVerse = useCallback(async () => {
    if (!isLoaded) return;
    if (!userId) {
      router.push("/sign-in");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Please sign in again.");
        return;
      }

      let nextReference = initialReference?.trim() ?? "";
      if (!nextReference) {
        const memoryVerses = await api.getVerseMemory(token);
        const currentVerse = memoryVerses[0];
        nextReference = currentVerse?.verseReference?.trim() ?? "";
        setResolvedVerseId(currentVerse?.id ?? null);
      }

      if (!nextReference) {
        setError("No memory verse is set yet.");
        return;
      }

      const parsed = parseVerseReference(nextReference);
      if (!parsed) {
        setError("Could not read this verse reference format.");
        return;
      }

      const chapter = await api.getEsvChapter(token, parsed.book, parsed.chapter);
      const verseSet = new Set(parsed.verseNumbers);
      const selectedVerses =
        verseSet.size > 0
          ? chapter.verses.filter((verse) => verseSet.has(verse.verseNumber))
          : chapter.verses;

      if (selectedVerses.length === 0) {
        setError("Could not find verse text for this reference.");
        return;
      }

      const fullVerseText = selectedVerses
        .map((verse) => verse.text.trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      setReference(nextReference);
      setVerseText(fullVerseText);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [getToken, initialReference, isLoaded, router, userId]);

  useEffect(() => {
    void loadPracticeVerse();
  }, [loadPracticeVerse]);

  const applyPracticeLevelsPayload = useCallback(
    (payload: VersePracticeLevelsResponse) => {
      const next = mapPracticeLevelsPayload(payload);
      setCompletionSource("server");
      setCompletedLevels(next.completed);
      setCompletionPillsByLevel(next.pills);
    },
    [],
  );

  const loadPracticeLevels = useCallback(
    async (targetVerseId: string, tokenOverride?: string | null) => {
      if (!isLoaded || !userId) return;
      const token = tokenOverride ?? (await getToken());
      if (!token) return;
      try {
        const payload = await api.getVersePracticeLevels(token, targetVerseId);
        applyPracticeLevelsPayload(payload);
      } catch {
        // Keep practice playable even if completion-sharing API is unavailable.
      }
    },
    [applyPracticeLevelsPayload, getToken, isLoaded, userId],
  );

  useEffect(() => {
    setResults(Array(totalTargets).fill(null));
    setCurrentTargetIndex(0);
    setEntryValue("");
  }, [level, totalTargets]);

  useEffect(() => {
    setCompletionSource("reset");
    setCompletedLevels(createEmptyCompletion());
    setCompletionPillsByLevel(createEmptyCompletionPills());
  }, [reference]);

  useEffect(() => {
    setHasEnteredPractice(!embedded);
  }, [embedded, reference]);

  useEffect(() => {
    if (!resolvedVerseId || !isLoaded || !userId) return;
    void loadPracticeLevels(resolvedVerseId).catch(() => {});
  }, [isLoaded, loadPracticeLevels, resolvedVerseId, userId]);

  useEffect(() => {
    if (!isPerfectScore) return;
    if (completedLevels[level]) return;

    setCompletionSource("local");
    setCompletedLevels((previous) => {
      if (previous[level]) return previous;
      return { ...previous, [level]: true };
    });

    if (userId) {
      setCompletionPillsByLevel((previous) => {
        if (previous[level].some((member) => member.userId === userId)) return previous;
        return {
          ...previous,
          [level]: [
            ...previous[level],
            { userId, firstName: currentUserFirstName },
          ],
        };
      });
    }

    if (!resolvedVerseId) return;

    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const payload = await api.completeVersePracticeLevel(
          token,
          resolvedVerseId,
          level,
        );
        applyPracticeLevelsPayload(payload);
      } catch {
        // Ignore sharing persistence failures; local completion state stays active.
      }
    })();
  }, [
    applyPracticeLevelsPayload,
    completedLevels,
    currentUserFirstName,
    getToken,
    isPerfectScore,
    level,
    resolvedVerseId,
    userId,
  ]);

  useEffect(() => {
    onCompletedLevelsChange?.(completedLevels, completionSource);
  }, [completedLevels, completionSource, onCompletedLevelsChange]);

  useEffect(() => {
    if (loading) return;
    if (totalTargets === 0) return;
    if (isComplete && !(isPerfectScore && level < 3)) return;
    // In embedded mode, avoid stealing focus on initial render,
    // but keep focus moving once practice has started.
    if (embedded && currentTargetIndex === 0 && !hasEnteredPractice) return;
    focusInlineInput(true);
  }, [
    currentTargetIndex,
    embedded,
    focusInlineInput,
    hasEnteredPractice,
    isComplete,
    isPerfectScore,
    loading,
    totalTargets,
    level,
  ]);

  useEffect(() => {
    if (!embedded || !isSmallViewport || !hasEnteredPractice || !isSoftwareKeyboardOpen) {
      return;
    }
    practiceContentRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [embedded, hasEnteredPractice, isSmallViewport, isSoftwareKeyboardOpen]);

  const resetLevel = () => {
    setHasEnteredPractice(true);
    setResults(Array(totalTargets).fill(null));
    setCurrentTargetIndex(0);
    setEntryValue("");
  };

  const handleInlineInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === " " || event.key === "Spacebar" || event.code === "Space") {
      event.preventDefault();
      resetLevel();
      return;
    }

    const pressedEnter =
      event.key === "Enter" || event.key === "NumpadEnter" || event.code === "Enter";
    if (!pressedEnter) return;
    if (!isPerfectScore || level >= 3) return;

    event.preventDefault();
    setLevel((level + 1) as PracticeLevel);
  };

  const submitCurrentAttempt = useCallback(
    (typedValue: string) => {
      if (isComplete || totalTargets === 0) return;

      const expected = targetLetters[currentTargetIndex] ?? "";
      if (!expected) return;

      const normalizedTyped = normalizeWord(typedValue).slice(0, 1);
      if (!normalizedTyped) return;

      const isCorrect = normalizedTyped === expected;
      setResults((previous) => {
        const next = [...previous];
        next[currentTargetIndex] = isCorrect;
        return next;
      });
      setCurrentTargetIndex((index) => Math.min(index + 1, totalTargets));
      setEntryValue("");
    },
    [currentTargetIndex, isComplete, targetLetters, totalTargets],
  );

  const handleInlineInputChange = (rawValue: string) => {
    setHasEnteredPractice(true);
    if (isComplete || totalTargets === 0) {
      setEntryValue("");
      return;
    }

    const typed = normalizeWord(rawValue).slice(-1);
    setEntryValue(typed);
    if (typed) {
      submitCurrentAttempt(typed);
    }
  };

  const levelInstructions =
    "Type the first letter of each word. Press space to restart. Press enter to move to next level.";
  const verseTokenClass = isCompactMobileMode ? "mb-0.5 mr-1.5" : "mb-1 mr-2";

  const canAccessLevel = useCallback(
    (targetLevel: PracticeLevel): boolean => {
      if (targetLevel === 1) return true;
      if (targetLevel === 2) return completedLevels[1] || (level === 1 && isPerfectScore);
      return completedLevels[2] || (level === 2 && isPerfectScore);
    },
    [completedLevels, isPerfectScore, level],
  );

  const handleLevelChange = useCallback(
    (targetLevel: PracticeLevel) => {
      if (targetLevel > level && !canAccessLevel(targetLevel)) return;
      setLevel(targetLevel);
    },
    [canAccessLevel, level, setLevel],
  );

  const levelSelector = (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((value) => {
        const option = value as PracticeLevel;
        const completed = completedLevels[option];
        const isActive = level === option;
        const locked = !canAccessLevel(option);
        return (
          <Button
            key={option}
            size="sm"
            variant={completed ? "outline" : isActive ? "default" : "outline"}
            className={cn(
              completed &&
                "border-primary/35 bg-primary/15 text-primary hover:bg-primary/20",
            )}
            disabled={locked}
            onClick={() => handleLevelChange(option)}
          >
            {completed && <Check className="mr-1 size-3.5" aria-hidden />}
            Level {option}
          </Button>
        );
      })}
    </div>
  );

  const practiceContent = (
    <div
      ref={practiceContentRef}
      className={cn("space-y-4", isCompactMobileMode && "space-y-2")}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          Loading verse...
        </div>
      ) : error ? (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          <div className={cn("space-y-1", isCompactMobileMode && "space-y-0.5")}>
            <p className={cn("text-sm font-medium", isCompactMobileMode && "text-xs")}>
              {reference}
            </p>
            <p
              className={cn(
                "text-sm text-muted-foreground",
                isCompactMobileMode && "text-xs leading-snug",
              )}
            >
              {levelInstructions}
            </p>
          </div>

          <div
            className={cn(
              "rounded-md border border-input bg-background px-4 py-4 shadow-sm focus-within:ring-2 focus-within:ring-primary/30",
              isCompactMobileMode && "max-h-[36dvh] overflow-y-auto px-3 py-2",
            )}
            onClick={() => {
              setHasEnteredPractice(true);
              focusInlineInput(true);
            }}
          >
            <input
              ref={completionAdvanceInputRef}
              onKeyDown={handleInlineInputKeyDown}
              className="pointer-events-none fixed -left-[100vw] -top-[100vh] h-0 w-0 border-0 bg-transparent p-0 opacity-0 caret-transparent"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-hidden
              tabIndex={-1}
            />
            {level === 1 && (
              <input
                ref={(node) => {
                  inlineInputRef.current = node;
                }}
                value={entryValue}
                onChange={(event) => handleInlineInputChange(event.target.value)}
                onKeyDown={handleInlineInputKeyDown}
                className="pointer-events-none fixed -left-[100vw] -top-[100vh] h-0 w-0 border-0 bg-transparent p-0 opacity-0 caret-transparent"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                aria-label={`Word ${currentTargetIndex + 1}`}
              />
            )}
            <div
              className={cn(
                "text-[clamp(1.6rem,2.2vw,2.15rem)] leading-[1.9]",
                isCompactMobileMode &&
                  "text-[clamp(1.05rem,5.2vw,1.35rem)] leading-[1.45]",
              )}
            >
              {tokens.map((token) => {
                const tokenResult =
                  token.targetIndex != null ? results[token.targetIndex] : null;
                const isCurrent = token.targetIndex === currentTargetIndex && !isComplete;
                const isUntypedUpcoming =
                  token.targetIndex != null &&
                  tokenResult == null &&
                  token.targetIndex >= currentTargetIndex;
                const revealWord =
                  token.targetIndex != null
                    ? shouldRevealWord(level, token.targetIndex)
                    : true;

                if (token.targetIndex == null) {
                  return (
                    <span key={token.id} className={cn(verseTokenClass, "inline-block")}>
                      {token.text}
                    </span>
                  );
                }

                if (isCurrent) {
                  if (level === 1) {
                    const firstCoreLetter = token.core.slice(0, 1);
                    const remainingCore = token.core.slice(1);
                    return (
                      <span
                        key={token.id}
                        className={cn(
                          "relative inline-flex items-baseline rounded px-1 text-muted-foreground/55",
                          verseTokenClass,
                        )}
                      >
                        {token.prefix}
                        {isCompactMobileMode && (
                          <span
                            aria-hidden
                            className="typing-indicator-caret mr-[0.08em] inline-block h-[0.9em] w-[2px] align-middle"
                          />
                        )}
                        {firstCoreLetter}
                        {remainingCore}
                        {token.suffix}
                      </span>
                    );
                  }

                  return (
                    <span
                      key={token.id}
                      className={cn(
                        "inline-flex items-baseline rounded px-1 text-muted-foreground/55",
                        verseTokenClass,
                      )}
                    >
                      <input
                        ref={(node) => {
                          inlineInputRef.current = node;
                        }}
                        value={entryValue}
                        onChange={(event) =>
                          handleInlineInputChange(event.target.value)
                        }
                        onKeyDown={handleInlineInputKeyDown}
                        className={cn(
                          "mx-0.5 inline-block h-[1.2em] w-[1.15ch] border-0 bg-transparent p-0 text-center text-[0.72em] font-semibold leading-none text-muted-foreground/70 outline-none",
                          isCompactMobileMode && "w-[1ch] text-[0.68em]",
                        )}
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                        inputMode="text"
                        aria-label={`Word ${currentTargetIndex + 1}`}
                      />
                    </span>
                  );
                }

                return (
                  <span
                    key={token.id}
                    className={cn(
                      "inline-block transition-colors",
                      verseTokenClass,
                      isUntypedUpcoming && "text-muted-foreground/55",
                      tokenResult === true && "text-primary",
                      tokenResult === false && "text-destructive",
                    )}
                  >
                    {revealWord || tokenResult != null ? token.text : ""}
                  </span>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "grid items-stretch gap-2",
              isCompactMobileMode
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]",
            )}
          >
            <div
              className={cn(
                isCompactMobileMode
                  ? "col-span-2 grid h-9 grid-cols-[auto_1fr_auto] items-center rounded-lg px-2 text-xs"
                  : "col-span-2 grid h-11 grid-cols-[auto_1fr_auto] items-center rounded-lg px-4 text-sm sm:col-span-1 sm:col-start-2 sm:row-start-1",
                wrongCount > 0 ? "bg-muted/50 text-foreground" : "bg-primary/10 text-foreground",
              )}
            >
              <p className="flex items-baseline gap-1.5 text-left text-muted-foreground">
                <span>{`${correctCount}/${Math.max(totalTargets, 1)}`}</span>
                {wrongCount > 0 && (
                  <span className="font-medium text-destructive">{`-${wrongCount}`}</span>
                )}
              </p>
              <p className="px-2 text-center">
                {isComplete
                  ? isCompactMobileMode
                    ? null
                    : `Level ${level} complete (${correctCount}/${totalTargets})`
                  : null}
              </p>
              <p className="text-right text-muted-foreground">{accuracyPercent}%</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className={cn(
                isCompactMobileMode
                  ? "h-9 border-destructive px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  : "h-11 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive sm:col-span-1 sm:col-start-1 sm:row-start-1",
                isCompactMobileMode
                  ? level < 3
                    ? "col-span-1"
                    : "col-span-2"
                  : level < 3
                    ? "col-span-1"
                    : "col-span-2",
              )}
              onClick={resetLevel}
            >
              Restart
            </Button>
            {level < 3 && (
              <Button
                size="sm"
                className={cn(
                  isCompactMobileMode
                    ? "col-span-1 h-9 border-0 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted"
                    : "col-span-1 h-11 border-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted sm:col-start-3 sm:row-start-1",
                )}
                disabled={!isPerfectScore}
                onClick={() => {
                  const nextLevel =
                    level < 3 ? ((level + 1) as PracticeLevel) : level;
                  handleLevelChange(nextLevel);
                }}
              >
                Next Level
              </Button>
            )}
          </div>

          {completionPillsByLevel[level].length > 0 && (
            <div className={cn("flex flex-wrap gap-2", isCompactMobileMode && "gap-1.5")}>
              {completionPillsByLevel[level].map((member) => (
                <span
                  key={`${level}-${member.userId}`}
                  className={cn(
                    "inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary",
                    isCompactMobileMode && "px-2.5 py-0.5 text-[11px]",
                  )}
                >
                  {member.firstName}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        {showLevelSelector && <div className="flex justify-end">{levelSelector}</div>}
        {practiceContent}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Practice</h1>
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to Home
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Memory Verse Practice</CardTitle>
              {showLevelSelector && levelSelector}
            </div>
          </CardHeader>
          <CardContent>{practiceContent}</CardContent>
        </Card>
      </main>
    </div>
  );
}
