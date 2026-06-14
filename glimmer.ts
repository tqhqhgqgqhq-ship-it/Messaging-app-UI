/**
 * Glimmer — a LOCAL memory companion. Not an AI.
 *
 * It extracts keywords from the user's question, searches their own
 * conversations in Turso, ranks matches, and presents them using
 * hand-written templates. There are NO LLMs, NO external APIs, NO keys.
 */

import {
  searchUserMessages,
  recentUserMessages,
  type MemoryMatch,
} from "./turso";

export type { MemoryMatch } from "./turso";

/* ════════════════════════════════════════════════════════════════
   KEYWORD EXTRACTION
   ════════════════════════════════════════════════════════════════ */

// Common words to ignore so "What did I say about bananas?" → ["bananas"]
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "this", "that", "these",
  "those", "i", "you", "we", "they", "he", "she", "it", "me", "my", "mine",
  "your", "yours", "our", "ours", "their", "to", "of", "in", "on", "at", "for",
  "with", "about", "from", "by", "as", "is", "am", "are", "was", "were", "be",
  "been", "being", "do", "did", "does", "have", "has", "had", "will", "would",
  "can", "could", "should", "shall", "may", "might", "must", "what", "when",
  "where", "who", "whom", "which", "why", "how", "say", "said", "saying",
  "tell", "told", "talk", "talked", "mention", "mentioned", "anything",
  "something", "any", "some", "all", "ever", "did", "remember", "find",
  "show", "glimmer", "please", "again", "back", "thing", "things", "stuff",
  "so", "just", "really", "very", "much", "more", "most", "up", "out", "down",
]);

/**
 * Pull meaningful keywords out of a natural-language question.
 * Falls back to the longest words if everything was a stopword.
 */
export function extractKeywords(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const keywords = words.filter((w) => w.length >= 2 && !STOPWORDS.has(w));

  if (keywords.length) {
    // De-dupe while preserving order.
    return Array.from(new Set(keywords)).slice(0, 10);
  }

  // Everything was a stopword — keep the longest raw words as a fallback.
  return Array.from(new Set(words))
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);
}

/* ════════════════════════════════════════════════════════════════
   EMOTION / TONE DETECTION (rule-based, no model)
   ════════════════════════════════════════════════════════════════ */

const FUNNY_HINTS = [
  "lol", "lmao", "haha", "hahaha", "rofl", "😂", "🤣", "😆", "😄", "😅",
  "funny", "joke", "hilarious", "😹",
];
const EMOTIONAL_HINTS = [
  "love", "miss", "sorry", "cry", "crying", "heart", "❤️", "🥹", "😢", "😭",
  "important", "promise", "forever", "always", "thank you", "grateful",
  "proud", "happy", "sad", "hurt", "feel", "feeling",
];

type Tone = "funny" | "emotional" | "neutral";

function detectTone(text: string): Tone {
  const lower = text.toLowerCase();
  if (FUNNY_HINTS.some((h) => lower.includes(h))) return "funny";
  if (EMOTIONAL_HINTS.some((h) => lower.includes(h))) return "emotional";
  return "neutral";
}

/* ════════════════════════════════════════════════════════════════
   FORMATTING HELPERS
   ════════════════════════════════════════════════════════════════ */

function formatDate(ms: number): string {
  if (!ms) return "some time ago";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function clean(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/* ════════════════════════════════════════════════════════════════
   TEMPLATE BUILDER
   ════════════════════════════════════════════════════════════════ */

export type MemoryCard = MemoryMatch & {
  tone: "funny" | "emotional" | "neutral";
  dateLabel: string;
};

export type GlimmerResult = {
  found: boolean;
  /** A short, soft headline shown above the cards (no chat-bubble copy). */
  headline: string;
  cards: MemoryCard[];
};

function toCard(m: MemoryMatch): MemoryCard {
  return {
    ...m,
    text: clean(m.text),
    tone: detectTone(m.text),
    dateLabel: formatDate(m.createdAt),
  };
}

function headlineFor(cards: MemoryCard[]): string {
  if (!cards.length) {
    return "I looked, but nothing came back ✨";
  }
  if (cards[0].tone === "funny") return "This one made me smile 😄";
  if (cards[0].tone === "emotional") return "This looked important";
  return "I found something ✨";
}

/* ════════════════════════════════════════════════════════════════
   PUBLIC — ask Glimmer (returns structured cards, never bubbles)
   ════════════════════════════════════════════════════════════════ */

export async function askGlimmer(
  userId: string,
  question: string,
): Promise<GlimmerResult> {
  const keywords = extractKeywords(question);
  const matches = await searchUserMessages({ userId, keywords, limit: 6 });
  const cards = matches.map(toCard);
  return {
    found: cards.length > 0,
    headline: headlineFor(cards),
    cards,
  };
}

/* ════════════════════════════════════════════════════════════════
   PUBLIC — curated timelines for the full-screen Glimmer world
   ════════════════════════════════════════════════════════════════ */

export type GlimmerWorld = {
  timeline: MemoryCard[];
  important: MemoryCard[];
  funny: MemoryCard[];
  friendship: MemoryCard[];
};

export async function getGlimmerWorld(userId: string): Promise<GlimmerWorld> {
  const recent = await recentUserMessages({ userId, limit: 80 });
  const cards = recent.map(toCard);

  const important = cards.filter((c) => c.tone === "emotional").slice(0, 8);
  const funny = cards.filter((c) => c.tone === "funny").slice(0, 8);

  // Friendship highlights: the people you talk to most, with a sample line.
  const byPerson = new Map<string, MemoryCard>();
  const counts = new Map<string, number>();
  for (const c of cards) {
    counts.set(c.withName, (counts.get(c.withName) || 0) + 1);
    if (!byPerson.has(c.withName)) byPerson.set(c.withName, c);
  }
  const friendship = Array.from(byPerson.values())
    .sort((a, b) => (counts.get(b.withName) || 0) - (counts.get(a.withName) || 0))
    .slice(0, 6);

  return {
    timeline: cards.slice(0, 14),
    important,
    funny,
    friendship,
  };
}
