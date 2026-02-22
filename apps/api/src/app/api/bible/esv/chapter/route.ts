import { NextResponse } from "next/server";
import { getOrSyncUser } from "@/lib/auth";

type EsvChapterVerse = {
  verseNumber: number;
  reference: string;
  text: string;
  heading: string | null;
};

function normalizeBook(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function parseVersesFromPassage(
  rawPassage: string,
  book: string,
  chapter: number,
): EsvChapterVerse[] {
  const cleaned = rawPassage
    .replace(/\r/g, "")
    .replace(/\s*\(ESV\)\s*$/i, "")
    .trim()
    // Some passages may start with "1 " instead of "[1] ".
    .replace(/^(\d+)\s+/, "[$1] ");

  if (!cleaned) return [];

  const markerRegex = /\[(\d+)\]/g;
  const matches = [...cleaned.matchAll(markerRegex)];
  if (matches.length === 0) return [];

  const looksLikeHeading = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.length > 120) return false;
    if (/[,.;:!?]$/.test(trimmed)) return false;
    return /^[A-Z0-9][A-Za-z0-9'’",\-\s()]+$/.test(trimmed);
  };

  const normalizeHeading = (text: string | null): string | null => {
    if (!text) return null;
    const normalized = text.replace(/\s+/g, " ").trim();
    return normalized.length > 0 ? normalized : null;
  };

  const prefix = cleaned.slice(0, matches[0].index ?? 0).trim();
  let pendingHeading = normalizeHeading(prefix);

  const verses: EsvChapterVerse[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const verseNumber = Number.parseInt(current[1], 10);
    if (!Number.isFinite(verseNumber)) continue;

    const contentStart = (current.index ?? 0) + current[0].length;
    const contentEnd = next?.index ?? cleaned.length;
    const rawChunk = cleaned.slice(contentStart, contentEnd);

    const lines = rawChunk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const trailingHeadingParts: string[] = [];
    while (lines.length > 0 && looksLikeHeading(lines[lines.length - 1])) {
      const headingLine = lines.pop();
      if (headingLine) {
        trailingHeadingParts.unshift(headingLine);
      }
    }

    let text = lines
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/\[\d+\]/g, "")
      .trim();
    if (!text && trailingHeadingParts.length > 0) {
      // If heading detection consumed all content, prefer preserving verse text.
      text = trailingHeadingParts
        .join(" ")
        .replace(/\s+/g, " ")
        .replace(/\[\d+\]/g, "")
        .trim();
      trailingHeadingParts.length = 0;
    }
    if (!text) continue;

    verses.push({
      verseNumber,
      reference: `${book} ${chapter}:${verseNumber}`,
      text,
      heading: pendingHeading,
    });

    pendingHeading = normalizeHeading(trailingHeadingParts.join(" "));
  }

  return verses;
}

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ESV_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ESV API unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const rawBook = searchParams.get("book");
  const rawChapter = searchParams.get("chapter");

  const book = rawBook ? normalizeBook(rawBook) : "";
  const chapter = rawChapter ? Number.parseInt(rawChapter, 10) : Number.NaN;

  if (!book || !/^[0-9A-Za-z\s'-]+$/.test(book)) {
    return NextResponse.json(
      { error: "Invalid book parameter" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > 200) {
    return NextResponse.json(
      { error: "Invalid chapter parameter" },
      { status: 400 },
    );
  }

  const esvQuery = new URLSearchParams({
    q: `${book} ${chapter}`,
    "include-headings": "true",
    "include-footnotes": "false",
    "include-short-copyright": "true",
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnote-body": "false",
    "line-length": "0",
  });

  const esvResponse = await fetch(
    `https://api.esv.org/v3/passage/text/?${esvQuery.toString()}`,
    {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
      cache: "no-store",
    },
  );

  if (!esvResponse.ok) {
    return NextResponse.json(
      { error: `ESV upstream error (${esvResponse.status})` },
      { status: 502 },
    );
  }

  const payload = (await esvResponse.json().catch(() => null)) as {
    canonical?: string;
    passages?: string[];
    copyright?: string;
  } | null;

  const rawPassage = payload?.passages?.[0];
  if (!rawPassage || typeof rawPassage !== "string") {
    return NextResponse.json(
      { error: "Unable to parse ESV passage" },
      { status: 502 },
    );
  }

  const verses = parseVersesFromPassage(rawPassage, book, chapter);
  if (verses.length === 0) {
    return NextResponse.json(
      { error: "Unable to parse ESV verses" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    book,
    chapter,
    canonical: payload?.canonical?.trim() || `${book} ${chapter}`,
    verses,
    attribution: payload?.copyright?.trim() || "(ESV)",
  });
}
