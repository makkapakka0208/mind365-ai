import type { DailyLog } from "@/types";
import { accountStorage } from "@/lib/account-storage";

export const JOURNAL_DRAFTS_KEY = "journal_drafts";
export interface JournalDraft {
  mood: number;
  thoughts: string;
  tags: string;
  images: string[];
  base: DailyLog | null;
  savedAt: string;
}

export function isJournalDraft(value: unknown): value is JournalDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as JournalDraft;
  return Number.isFinite(d.mood) && typeof d.thoughts === "string" && typeof d.tags === "string" &&
    Array.isArray(d.images) && d.images.every(v => typeof v === "string") &&
    typeof d.savedAt === "string" && (d.base === null || (!!d.base && typeof d.base.id === "string"));
}

export function readJournalDraft(date: string): JournalDraft | null {
  const drafts = JSON.parse(accountStorage.getItem(JOURNAL_DRAFTS_KEY) ?? "{}");
  return isJournalDraft(drafts[date]) ? drafts[date] : null;
}

export function writeJournalDraft(date: string, draft: JournalDraft) {
  const drafts = JSON.parse(accountStorage.getItem(JOURNAL_DRAFTS_KEY) ?? "{}");
  drafts[date] = draft;
  accountStorage.setItem(JOURNAL_DRAFTS_KEY, JSON.stringify(drafts));
}

export function removeJournalDraft(date: string) {
  const drafts = JSON.parse(accountStorage.getItem(JOURNAL_DRAFTS_KEY) ?? "{}");
  delete drafts[date];
  accountStorage.setItem(JOURNAL_DRAFTS_KEY, JSON.stringify(drafts));
}
