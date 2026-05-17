"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownNarrowWide,
  ArrowLeft,
  Bookmark,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Coins,
  Feather,
  FolderOpen,
  Grid3X3,
  LayoutList,
  Lightbulb,
  PencilLine,
  Plus,
  Quote as QuoteIcon,
  Save,
  Search,
  Sparkles,
  Shuffle,
  Sprout,
  Tag,
  Target,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { getTodayISODate, parseISODate } from "@/lib/date";
import {
  addCustomTheme,
  classifyNote,
  classifyQuote,
  getAllThemeLabels,
  getThemeIcon,
  groupQuotesByTheme,
  removeTheme,
} from "@/lib/quote-classify";
import { deleteQuote, refreshNotes, refreshQuotes, saveNote, saveQuote, updateQuote } from "@/lib/storage";
import { useNotesStore, useQuotesStore } from "@/lib/storage-store";
import type { Note, Quote } from "@/types";

type Tab = "archive" | "quotes" | "notes";

function getDailyQuote(quotes: Quote[]): Quote | null {
  if (quotes.length === 0) return null;
  const today = parseISODate(getTodayISODate());
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayNumber = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000);
  return quotes[dayNumber % quotes.length] ?? null;
}

function formatPreview(content: string) {
  return content.trim().replace(/\s+/g, " ");
}

function isInThisWeek(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const dayNum = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayNum - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return d.getTime() >= monday.getTime() && d.getTime() <= sunday.getTime();
}

// ── Tab segmented control (v5 pill) ────────────────────────────
function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; Icon: LucideIcon }[] = [
    { id: "quotes", label: "书海拾金", Icon: QuoteIcon },
    { id: "notes", label: "阅读笔记", Icon: Feather },
    { id: "archive", label: "收藏归档", Icon: FolderOpen },
  ];

  return (
    <div
      className="inline-flex self-start"
      style={{
        padding: 4,
        borderRadius: 14,
        background: "var(--v5-card)",
        border: "1px solid var(--v5-rule)",
        boxShadow: "var(--v5-sh-1)",
      }}
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            className="inline-flex items-center"
            key={id}
            onClick={() => onChange(id)}
            type="button"
            style={{
              gap: 7,
              padding: "10px 18px",
              borderRadius: 10,
              border: 0,
              fontFamily: "var(--v5-serif)",
              fontSize: 14,
              fontWeight: isActive ? 500 : 400,
              cursor: "pointer",
              background: isActive ? "var(--v5-accent)" : "transparent",
              color: isActive ? "#fff" : "var(--v5-ink2)",
              boxShadow: isActive ? "0 2px 8px rgba(139,94,60,0.18)" : "none",
              transition: "background var(--v5-dur-fast) var(--v5-ease), color var(--v5-dur-fast) var(--v5-ease)",
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Theme picker dialog ────────────────────────────────────────
function ThemePickerDialog({
  open,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onPick: (label: string) => void;
}) {
  const [themes, setThemes] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (open) {
      setThemes(getAllThemeLabels());
      setDraft("");
    }
  }, [open]);

  const submitNew = () => {
    const t = draft.trim();
    if (!t) return;
    addCustomTheme(t);
    setThemes(getAllThemeLabels());
    setDraft("");
    onPick(t);
  };

  return (
    <Dialog onClose={onClose} open={open} title="加入我的认知体系">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--m-ink2)" }}>
          这句话属于哪个主题？参与构建你自己的体系。
        </p>

        <div className="flex flex-wrap gap-2">
          {themes.map((label) => {
            const active = label === current;
            return (
              <button
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all"
                key={label}
                onClick={() => onPick(label)}
                type="button"
                style={{
                  background: active ? "var(--m-accent)" : "var(--m-base)",
                  border: active ? "1px solid var(--m-accent)" : "1px solid var(--m-rule)",
                  color: active ? "#fff" : "var(--m-ink2)",
                }}
              >
                <span>{getThemeIcon(label)}</span>
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Input
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNew();
              }
            }}
            placeholder="新建一个主题..."
            value={draft}
          />
          <Button disabled={!draft.trim()} onClick={submitNew} type="button" variant="primary">
            <Plus size={14} />
            新建
          </Button>
        </div>

        {current && (
          <p className="text-xs" style={{ color: "var(--m-ink3)" }}>
            当前归类：{getThemeIcon(current)} {current}
          </p>
        )}
      </div>
    </Dialog>
  );
}

// ── Quote card (shared by 书海拾金 and 收藏归档) ──────────────
function QuoteCard({ quote, onOpen }: { quote: Quote; onOpen?: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const currentTheme = classifyQuote(quote);

  const onPick = async (label: string) => {
    await updateQuote({ ...quote, themeCategory: label });
    setPickerOpen(false);
  };

  const dateStr = quote.createdAt
    ? new Date(quote.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "/")
    : "";

  return (
    <>
      <div
        className="group relative break-inside-avoid"
        onClick={onOpen}
        style={{
          background: "var(--m-base-light)",
          borderRadius: 16,
          border: "1px solid var(--m-rule)",
          padding: "20px 20px 16px",
          marginBottom: 14,
          cursor: onOpen ? "pointer" : undefined,
          transition: "all 0.25s ease",
          boxShadow: "0 1px 4px rgba(139,94,60,0.06)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 6px 24px rgba(139,94,60,0.10)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 1px 4px rgba(139,94,60,0.06)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {/* Bookmark icon — top right */}
        <button
          className="absolute right-4 top-4 transition-colors hover:opacity-70"
          onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
          type="button"
          style={{ color: "var(--m-ink3)" }}
        >
          <Bookmark size={16} />
        </button>

        {/* Quote text — calligraphy style */}
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.9,
            color: "var(--m-ink)",
            fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", "Noto Serif SC", serif',
            letterSpacing: "0.04em",
            paddingRight: 24,
          }}
        >
          {quote.text}
        </p>

        {/* Author line */}
        <p
          className="mt-3"
          style={{
            fontSize: 12,
            color: "var(--m-ink3)",
          }}
        >
          —— {quote.author || "佚名"}
          {quote.book ? (
            <span style={{ opacity: 0.7 }}>{"\n"}《{quote.book}》</span>
          ) : null}
        </p>

        {/* Tags + date row */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {quote.tags.map((tag) => (
              <span
                key={`${quote.id}-${tag}`}
                className="rounded px-2 py-0.5"
                style={{
                  fontSize: 11,
                  background: "rgba(139,94,60,0.06)",
                  color: "var(--m-accent)",
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
          {dateStr && (
            <span style={{ fontSize: 11, color: "var(--m-ink3)", whiteSpace: "nowrap", flexShrink: 0 }}>
              {dateStr}
            </span>
          )}
        </div>
      </div>

      <ThemePickerDialog
        current={currentTheme}
        onClose={() => setPickerOpen(false)}
        onPick={onPick}
        open={pickerOpen}
      />
    </>
  );
}

// ── Weekly cognitive card ──────────────────────────────────────
function WeeklyCognitiveCard({ quotes }: { quotes: Quote[] }) {
  const [generated, setGenerated] = useState<{ summary: string[]; topThemes: { label: string; count: number }[] } | null>(null);

  const weekly = useMemo(
    () => quotes.filter((q) => isInThisWeek(q.createdAt)),
    [quotes],
  );

  const themeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of weekly) {
      const t = classifyQuote(q);
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [weekly]);

  if (weekly.length === 0) {
    return null;
  }

  const generate = () => {
    // Heuristic summary: top 2 themes → 1-2 lines.
    const top = themeCounts.slice(0, 3);
    const lines: string[] = [];
    for (const t of top) {
      if (t.label === "成长") lines.push("长期主义正在形成");
      else if (t.label === "情绪与认知") lines.push("对自我情绪的觉察更细腻");
      else if (t.label === "行动") lines.push("从想法到落地的距离在缩短");
      else if (t.label === "赚钱") lines.push("商业与价值的判断力在累积");
      else if (t.label === "关系") lines.push("对人与人的连接在重新审视");
      else if (t.label === "智慧") lines.push("对底层规律的兴趣在加深");
      else lines.push(`「${t.label}」正在成为本周的关注点`);
    }
    setGenerated({ summary: lines, topThemes: top });
  };

  return (
    <div
      className="overflow-hidden"
      style={{
        background: "rgba(253,250,243,0.7)",
        borderRadius: 20,
        border: "1px solid rgba(139,94,60,0.06)",
        padding: "28px 24px",
        boxShadow: "0 2px 12px rgba(139,94,60,0.03)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.22em]"
            style={{ color: "var(--m-ink3)" }}
          >
            WEEKLY INSIGHT
          </p>
          <h3
            className="mt-2"
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--m-ink)",
              fontFamily: '"Noto Serif SC", serif',
            }}
          >
            本周收藏了 {weekly.length} 条金句
          </h3>
          <p className="mt-1.5 text-sm" style={{ color: "var(--m-ink2)" }}>
            主要集中在：
            {themeCounts.slice(0, 3).map((t, i) => (
              <span key={t.label} style={{ color: "var(--m-accent)" }}>
                {i > 0 ? "、" : " "}
                {t.label} ({t.count})
              </span>
            ))}
          </p>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(139,94,60,0.05)", color: "var(--m-accent)" }}
        >
          <Sparkles size={16} />
        </span>
      </div>

      {generated ? (
        <div
          className="mt-5 rounded-2xl px-5 py-4"
          style={{
            background: "rgba(139,94,60,0.025)",
            border: "1px solid rgba(139,94,60,0.06)",
          }}
        >
          <p
            className="text-[10px] font-medium uppercase tracking-[0.22em]"
            style={{ color: "var(--m-ink3)" }}
          >
            本周核心认知
          </p>
          <ol className="mt-3 space-y-2">
            {generated.summary.map((line, i) => (
              <li
                className="text-sm leading-7"
                key={i}
                style={{ color: "var(--m-ink)", fontFamily: '"Noto Serif SC", serif' }}
              >
                <span style={{ color: "var(--m-accent)", marginRight: 6 }}>{i + 1}.</span>
                {line}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <button
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 hover:opacity-80"
          onClick={generate}
          type="button"
          style={{
            background: "rgba(139,94,60,0.06)",
            color: "var(--m-accent)",
            border: "1px solid rgba(139,94,60,0.1)",
          }}
        >
          <Sparkles size={14} />
          生成认知总结
        </button>
      )}
    </div>
  );
}

// ── Quote Stack Modal ─────────────────────────────────────────

const quoteSlideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 320 : -320, opacity: 0, scale: 0.92 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -320 : 320, opacity: 0, scale: 0.92 }),
};

function QuoteCardFace({
  quote,
  dim = false,
}: {
  quote: Quote;
  dim?: boolean;
}) {
  const theme = classifyQuote(quote);
  return (
    <div
      style={{
        background: "#FAF7F0",
        borderRadius: 20,
        boxShadow: dim
          ? "0 4px 16px rgba(0,0,0,0.12)"
          : "0 28px 64px rgba(0,0,0,0.20), 0 6px 20px rgba(0,0,0,0.10)",
        padding: "28px 26px 24px",
        minHeight: 260,
        display: "flex",
        flexDirection: "column",
        pointerEvents: dim ? "none" : undefined,
      }}
    >
      {/* Theme badge */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "ui-sans-serif,sans-serif",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(139,94,60,0.60)",
          marginBottom: 18,
        }}
      >
        {getThemeIcon(theme)} {theme}
      </span>

      {/* Quote mark + text */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 52, lineHeight: 0.8, color: "rgba(139,94,60,0.12)", fontFamily: "Georgia,serif", marginBottom: 4 }}>"</div>
        <p
          style={{
            fontSize: 19,
            lineHeight: 1.85,
            color: "rgba(45,24,17,0.90)",
            fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",serif',
            letterSpacing: "0.03em",
          }}
        >
          {quote.text}
        </p>
      </div>

      {/* Author / source */}
      <p
        className="mt-5 text-sm"
        style={{ color: "rgba(100,72,50,0.65)", fontFamily: "ui-sans-serif,sans-serif" }}
      >
        — {quote.author || "佚名"}{quote.book ? ` · ${quote.book}` : ""}
      </p>

      {/* Tags */}
      {quote.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quote.tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                padding: "2px 10px",
                borderRadius: 99,
                background: "rgba(139,94,60,0.07)",
                border: "1px solid rgba(139,94,60,0.12)",
                color: "rgba(100,72,50,0.70)",
                fontFamily: "ui-sans-serif,sans-serif",
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteStackModal({
  allQuotes,
  initialId,
  onClose,
}: {
  allQuotes: Quote[];
  initialId: string;
  onClose: () => void;
}) {
  const [themesVersion, setThemesVersion] = useState(0);
  const themes = useMemo(() => ["全部", ...getAllThemeLabels()], [themesVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const [filterTab, setFilterTab] = useState<string>("全部");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ text: string; author: string; book: string; tags: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filteredQuotes = useMemo(() => {
    if (filterTab === "全部") return allQuotes;
    return allQuotes.filter((q) => classifyQuote(q) === filterTab);
  }, [allQuotes, filterTab]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = allQuotes.findIndex((q) => q.id === initialId);
    const q = idx >= 0 ? allQuotes[idx] : allQuotes[0];
    if (!q) return 0;
    const fi = (filterTab === "全部" ? allQuotes : allQuotes.filter((x) => classifyQuote(x) === filterTab))
      .findIndex((x) => x.id === q.id);
    return fi >= 0 ? fi : 0;
  });

  const currentIdRef = useRef(initialId);
  const [slideDir, setSlideDir] = useState(0);

  // Re-anchor index when filter changes; fall back to "全部" if empty
  useEffect(() => {
    if (filteredQuotes.length === 0 && filterTab !== "全部") {
      setFilterTab("全部");
      return;
    }
    const idx = filteredQuotes.findIndex((q) => q.id === currentIdRef.current);
    setCurrentIndex(idx >= 0 ? idx : 0);
  }, [filteredQuotes, filterTab]);

  const currentQuote = filteredQuotes[currentIndex] ?? null;

  useEffect(() => {
    if (currentQuote) currentIdRef.current = currentQuote.id;
  }, [currentQuote]);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < filteredQuotes.length - 1;

  const goNext = useCallback(() => {
    if (canNext) { setSlideDir(1); setCurrentIndex((i) => i + 1); setIsEditing(false); }
  }, [canNext]);

  const goPrev = useCallback(() => {
    if (canPrev) { setSlideDir(-1); setCurrentIndex((i) => i - 1); setIsEditing(false); }
  }, [canPrev]);

  // Swipe / drag — use touch events to avoid blocking native scroll
  const dragRef = useRef<{ x: number; y: number; t: number; decided: boolean; isHorizontal: boolean } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [role='button']")) return;
    dragRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now(), decided: false, isHorizontal: false };
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    if (!dragRef.current.decided) {
      const dx = Math.abs(touch.clientX - dragRef.current.x);
      const dy = Math.abs(touch.clientY - dragRef.current.y);
      if (dx > 8 || dy > 8) {
        dragRef.current.decided = true;
        dragRef.current.isHorizontal = dx > dy;
      }
    }
    // Only prevent default scroll if swiping horizontally
    if (dragRef.current.decided && dragRef.current.isHorizontal) {
      e.preventDefault();
    }
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) { dragRef.current = null; return; }
    const dx = touch.clientX - dragRef.current.x;
    const dy = touch.clientY - dragRef.current.y;
    const dt = Date.now() - dragRef.current.t;
    const isH = dragRef.current.isHorizontal;
    dragRef.current = null;
    if (isH && Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 450) {
      if (dx < 0) goNext(); else goPrev();
    }
  }, [goNext, goPrev]);
  // Mouse fallback for desktop
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [role='button']")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), decided: true, isHorizontal: true };
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || e.pointerType !== "mouse") return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    const dt = Date.now() - dragRef.current.t;
    dragRef.current = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 450) {
      if (dx < 0) goNext(); else goPrev();
    }
  }, [goNext, goPrev]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (isEditing) setIsEditing(false); else onClose(); }
      if (!isEditing && e.key === "ArrowLeft") goPrev();
      if (!isEditing && e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext, isEditing]);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Safety: if filteredQuotes is empty (e.g. during filter switch), auto-close modal
  useEffect(() => {
    if (filteredQuotes.length === 0 && filterTab === "全部") onClose();
  }, [filteredQuotes.length, filterTab, onClose]);

  if (!currentQuote) return null;

  // Pagination dots (sliding window, max 7)
  const total = filteredQuotes.length;
  const DOT_MAX = 7;
  const half = Math.floor(DOT_MAX / 2);
  let dotStart = Math.max(0, currentIndex - half);
  let dotEnd = Math.min(total, dotStart + DOT_MAX);
  dotStart = Math.max(0, dotEnd - DOT_MAX);
  const dotIndices = Array.from({ length: dotEnd - dotStart }, (_, i) => dotStart + i);

  const prevQuote = filteredQuotes[currentIndex - 1];
  const nextQuote = filteredQuotes[currentIndex + 1];
  const currentTheme = classifyQuote(currentQuote);

  const startEdit = () => {
    setEditForm({
      text: currentQuote.text,
      author: currentQuote.author,
      book: currentQuote.book,
      tags: currentQuote.tags.join(", "),
    });
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    await updateQuote({
      ...currentQuote,
      text: editForm.text.trim(),
      author: editForm.author.trim(),
      book: editForm.book.trim(),
      tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setSaving(false);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!currentQuote) return;
    await deleteQuote(currentQuote.id);
    setConfirmDelete(false);
    // If no quotes left, close modal
    if (filteredQuotes.length <= 1) {
      onClose();
    } else {
      // Move to next or previous
      setCurrentIndex((prev) => Math.min(prev, filteredQuotes.length - 2));
    }
  };

  const CARD_WIDTH = "min(460px, calc(100vw - 72px))";

  return (
    <motion.div
      animate={{ opacity: 1, pointerEvents: "auto" as const }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      exit={{ opacity: 0, pointerEvents: "none" as const }}
      initial={{ opacity: 0 }}
      onClick={onClose}
      style={{ background: "rgba(18,10,4,0.70)", backdropFilter: "blur(14px)" }}
      transition={{ duration: 0.22 }}
    >
      <div className="flex h-full flex-col" onClick={(e) => e.stopPropagation()}>

        {/* ── Top bar ── */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top,20px))]">
          <span style={{ fontSize: 13, color: "rgba(250,247,240,0.45)", fontFamily: "ui-sans-serif,sans-serif" }}>
            {filteredQuotes.length > 0 ? `${currentIndex + 1} / ${filteredQuotes.length}` : ""}
          </span>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            onClick={onClose}
            type="button"
            style={{ color: "rgba(250,247,240,0.65)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Category tabs ── */}
        <div className="shrink-0 overflow-x-auto pb-4 pt-2 px-4" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-2 w-max">
            {themes.map((theme) => {
              const isActive = filterTab === theme;
              const canDelete = theme !== "全部";
              return (
                <div key={theme} className="relative shrink-0 flex items-center">
                  <button
                    className="shrink-0 rounded-full px-4 py-1.5 text-sm transition-all"
                    onClick={() => { setFilterTab(theme); setIsEditing(false); }}
                    type="button"
                    style={{
                      background: isActive ? "rgba(250,247,240,0.92)" : "rgba(250,247,240,0.10)",
                      color: isActive ? "#4A3022" : "rgba(250,247,240,0.60)",
                      fontFamily: "ui-sans-serif,sans-serif",
                      border: `1px solid ${isActive ? "transparent" : "rgba(250,247,240,0.10)"}`,
                      fontWeight: isActive ? 600 : 400,
                      paddingRight: canDelete ? "28px" : undefined,
                    }}
                  >
                    {theme === "全部" ? "全部" : `${getThemeIcon(theme)} ${theme}`}
                  </button>
                  {canDelete && (
                    <button
                      className="absolute right-1.5 flex h-5 w-5 items-center justify-center rounded-full transition-all hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTheme(theme);
                        setThemesVersion((v) => v + 1);
                        if (filterTab === theme) setFilterTab("全部");
                      }}
                      type="button"
                      style={{ color: isActive ? "rgba(74,48,34,0.50)" : "rgba(250,247,240,0.40)" }}
                      title={`删除"${theme}"标签`}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Card stack ── */}
        <div
          className="relative flex flex-1 items-center justify-center"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          style={{ userSelect: "none", overflow: "hidden", touchAction: "pan-y" }}
        >
          {/* Prev card shadow */}
          {prevQuote && !isEditing && (
            <div
              className="pointer-events-none absolute"
              style={{
                width: CARD_WIDTH,
                transform: "translateX(-20%) translateY(10px) rotate(-3deg) scale(0.87)",
                opacity: 0.35,
                transformOrigin: "bottom center",
                zIndex: 1,
              }}
            >
              <QuoteCardFace quote={prevQuote} dim />
            </div>
          )}

          {/* Next card shadow */}
          {nextQuote && !isEditing && (
            <div
              className="pointer-events-none absolute"
              style={{
                width: CARD_WIDTH,
                transform: "translateX(20%) translateY(10px) rotate(3deg) scale(0.87)",
                opacity: 0.35,
                transformOrigin: "bottom center",
                zIndex: 1,
              }}
            >
              <QuoteCardFace quote={nextQuote} dim />
            </div>
          )}

          {/* Current card */}
          <div style={{ width: CARD_WIDTH, position: "relative", zIndex: 10 }}>
            <AnimatePresence mode="wait" initial={false} custom={slideDir}>
              <motion.div
                key={currentQuote.id + (isEditing ? "-edit" : "")}
                animate="center"
                custom={slideDir}
                exit="exit"
                initial="enter"
                transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                variants={quoteSlideVariants}
              >
                {isEditing && editForm ? (
                  /* ── Edit form ── */
                  <div
                    style={{
                      background: "#FAF7F0",
                      borderRadius: 20,
                      boxShadow: "0 28px 64px rgba(0,0,0,0.20)",
                      padding: "26px 24px 22px",
                    }}
                  >
                    <p className="mb-4 text-sm font-semibold" style={{ color: "#7A5535" }}>编辑金句</p>
                    <div className="space-y-3">
                      <textarea
                        className="w-full resize-none rounded-xl px-3 py-2.5 text-sm leading-7 outline-none"
                        onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                        rows={4}
                        style={{ background: "rgba(139,94,60,0.05)", border: "1px solid rgba(139,94,60,0.15)", color: "#2D1811", fontFamily: '"Ma Shan Zheng","STKaiti",serif', fontSize: 16 }}
                        value={editForm.text}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="rounded-xl px-3 py-2 text-sm outline-none"
                          onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                          placeholder="作者"
                          style={{ background: "rgba(139,94,60,0.05)", border: "1px solid rgba(139,94,60,0.15)", color: "#2D1811", fontFamily: "ui-sans-serif" }}
                          value={editForm.author}
                        />
                        <input
                          className="rounded-xl px-3 py-2 text-sm outline-none"
                          onChange={(e) => setEditForm({ ...editForm, book: e.target.value })}
                          placeholder="书名 / 来源"
                          style={{ background: "rgba(139,94,60,0.05)", border: "1px solid rgba(139,94,60,0.15)", color: "#2D1811", fontFamily: "ui-sans-serif" }}
                          value={editForm.book}
                        />
                      </div>
                      <input
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                        placeholder="标签，逗号分隔"
                        style={{ background: "rgba(139,94,60,0.05)", border: "1px solid rgba(139,94,60,0.15)", color: "#2D1811", fontFamily: "ui-sans-serif" }}
                        value={editForm.tags}
                      />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                        disabled={saving}
                        onClick={saveEdit}
                        type="button"
                        style={{ background: "#2D1811", color: "#FAF7F0" }}
                      >
                        <Save size={13} />
                        {saving ? "保存中…" : "保存"}
                      </button>
                      <button
                        className="rounded-xl px-4 py-2 text-sm transition-opacity hover:opacity-70"
                        onClick={() => setIsEditing(false)}
                        type="button"
                        style={{ color: "#A08060" }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Read view ── */
                  <div>
                    <QuoteCardFace quote={currentQuote} />
                    {/* Action bar */}
                    <div className="mt-4 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all hover:opacity-80"
                          onClick={() => setPickerOpen(true)}
                          type="button"
                          style={{
                            background: "rgba(250,247,240,0.14)",
                            border: "1px solid rgba(250,247,240,0.20)",
                            color: "rgba(250,247,240,0.80)",
                            fontFamily: "ui-sans-serif,sans-serif",
                          }}
                        >
                          <Sparkles size={13} />
                          加入认知体系
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all hover:opacity-80"
                          onClick={startEdit}
                          type="button"
                          style={{
                            background: "rgba(250,247,240,0.10)",
                            border: "1px solid rgba(250,247,240,0.14)",
                            color: "rgba(250,247,240,0.60)",
                            fontFamily: "ui-sans-serif,sans-serif",
                          }}
                        >
                          <PencilLine size={13} />
                          编辑
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all hover:opacity-80"
                          onClick={() => setConfirmDelete(true)}
                          type="button"
                          style={{
                            background: "rgba(250,247,240,0.10)",
                            border: "1px solid rgba(250,247,240,0.14)",
                            color: "rgba(220,120,100,0.70)",
                            fontFamily: "ui-sans-serif,sans-serif",
                          }}
                        >
                          <Trash2 size={13} />
                          删除
                        </button>
                      </div>
                      {/* Desktop side arrows */}
                      <div className="hidden items-center gap-1 sm:flex">
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-20"
                          disabled={!canPrev}
                          onClick={goPrev}
                          type="button"
                          style={{ color: "rgba(250,247,240,0.65)" }}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-20"
                          disabled={!canNext}
                          onClick={goNext}
                          type="button"
                          style={{ color: "rgba(250,247,240,0.65)" }}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Pagination dots ── */}
        {!isEditing && (
          <div className="flex shrink-0 items-center justify-center gap-1.5 py-5">
            {dotStart > 0 && (
              <span style={{ fontSize: 10, color: "rgba(250,247,240,0.30)", fontFamily: "ui-sans-serif" }}>…</span>
            )}
            {dotIndices.map((i) => (
              <button
                key={i}
                onClick={() => { setSlideDir(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
                type="button"
                style={{
                  width: i === currentIndex ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === currentIndex ? "rgba(250,247,240,0.88)" : "rgba(250,247,240,0.25)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  flexShrink: 0,
                }}
              />
            ))}
            {dotEnd < total && (
              <span style={{ fontSize: 10, color: "rgba(250,247,240,0.30)", fontFamily: "ui-sans-serif" }}>…</span>
            )}
          </div>
        )}

        {/* Swipe hint on mobile */}
        {!isEditing && total > 1 && (
          <p className="shrink-0 pb-4 text-center text-[11px] sm:hidden" style={{ color: "rgba(250,247,240,0.28)", fontFamily: "ui-sans-serif" }}>
            ← 左右滑动切换 →
          </p>
        )}

        {/* Theme picker dialog — inside stopPropagation div to prevent backdrop click from closing modal */}
        <ThemePickerDialog
          current={currentTheme}
          onClose={() => setPickerOpen(false)}
          onPick={async (label) => {
            await updateQuote({ ...currentQuote, themeCategory: label });
            setPickerOpen(false);
          }}
          open={pickerOpen}
        />

        {/* Delete confirmation overlay */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              className="fixed inset-0 z-[60] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(false)}
              style={{ background: "rgba(0,0,0,0.5)" }}
            >
              <motion.div
                className="mx-6 w-full max-w-xs rounded-2xl p-6"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{ background: "#FAF7F0" }}
              >
                <p className="mb-1 text-base font-semibold" style={{ color: "#2D1811" }}>确认删除</p>
                <p className="mb-5 text-sm" style={{ color: "#8C735D" }}>
                  删除后无法恢复，确定要删除这条金句吗？
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                    onClick={handleDelete}
                    type="button"
                    style={{ background: "#DC4446", color: "#fff" }}
                  >
                    删除
                  </button>
                  <button
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
                    onClick={() => setConfirmDelete(false)}
                    type="button"
                    style={{ background: "rgba(0,0,0,0.06)", color: "#2D1811" }}
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Archive section (folders + search + cognitive card) ───────
/* ──────────────────────────────────────────────────────────────────
 * v5 Archive helpers: ThemeCard palette, SearchBar, WeeklyInsight,
 * ThemeCard. Used by ArchiveSection desktop branch.
 * ────────────────────────────────────────────────────────────────── */

interface V5ThemeMeta {
  accent: string;
  Icon: LucideIcon;
}

function getThemeMeta(label: string): V5ThemeMeta {
  // Map known built-in themes to a tinted accent + Lucide icon.
  // Falls back to cocoa primary for custom themes.
  switch (label) {
    case "赚钱":
      return { accent: "#a8853c", Icon: Coins };
    case "行动":
      return { accent: "#b96845", Icon: Target };
    case "情绪与认知":
      return { accent: "#8b5e3c", Icon: Brain };
    case "成长":
      return { accent: "#6a8554", Icon: Sprout };
    case "未分类":
      return { accent: "#a89580", Icon: FolderOpen };
    default:
      return { accent: "var(--v5-accent)", Icon: FolderOpen };
  }
}

function V5SearchBar({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <label
      className="inline-flex w-full items-center"
      style={{
        gap: 10,
        padding: "10px 16px",
        borderRadius: 999,
        background: "var(--v5-card)",
        border: "1px solid var(--v5-rule)",
        maxWidth: 560,
      }}
    >
      <Search size={15} style={{ color: "var(--v5-ink3)", flexShrink: 0 }} />
      <input
        className="flex-1 border-0 bg-transparent outline-none"
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索金句、阅读笔记、标签…"
        style={{
          fontFamily: "var(--v5-serif)",
          fontSize: 14,
          color: "var(--v5-ink)",
          minWidth: 0,
        }}
        type="text"
        value={value}
      />
      <span
        className="inline-flex items-center"
        style={{
          gap: 3,
          padding: "2px 8px",
          border: "1px solid var(--v5-rule-strong)",
          borderRadius: 6,
          fontFamily: "var(--v5-mono)",
          fontSize: 10.5,
          color: "var(--v5-ink3)",
          letterSpacing: "0.04em",
        }}
      >
        ⌘ K
      </span>
    </label>
  );
}

// Same heuristic as the legacy WeeklyCognitiveCard.generate()
const COGNITIVE_LINES: Record<string, string> = {
  "成长": "长期主义正在形成",
  "情绪与认知": "对自我情绪的觉察更细腻",
  "行动": "从想法到落地的距离在缩短",
  "赚钱": "商业与价值的判断力在累积",
  "关系": "对人与人的连接在重新审视",
  "智慧": "对底层规律的兴趣在加深",
};
function buildCognitiveSummary(topThemes: { label: string; count: number }[]): string[] {
  return topThemes.slice(0, 3).map((t) => COGNITIVE_LINES[t.label] ?? `「${t.label}」正在成为本周的关注点`);
}

function V5WeeklyInsight({
  weekQuotes,
  buckets,
}: {
  weekQuotes: Quote[];
  buckets: ReturnType<typeof groupQuotesByTheme>;
}) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const dateRange = `${weekStart.getMonth() + 1}/${String(weekStart.getDate()).padStart(2, "0")} — ${now.getMonth() + 1}/${String(now.getDate()).padStart(2, "0")}`;

  // Per-theme weekly counts
  const weekByTheme = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of weekQuotes) {
      const label = classifyQuote(q);
      m.set(label, (m.get(label) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [weekQuotes]);

  const topTheme = weekByTheme[0];
  const maxCount = topTheme?.[1] ?? 0;

  // Cognitive summary (lazy-built on click, same heuristic as WeeklyCognitiveCard)
  const [summary, setSummary] = useState<string[] | null>(null);
  const generateSummary = () => {
    setSummary(buildCognitiveSummary(weekByTheme.map(([label, count]) => ({ label, count }))));
  };

  return (
    <div
      className="relative overflow-hidden grid"
      style={{
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: 32,
        borderRadius: 28,
        padding: "32px 36px",
        background: "linear-gradient(135deg, var(--v5-card) 0%, #faecc8 100%)",
        boxShadow: "var(--v5-sh-2)",
      }}
    >
      {/* Left column */}
      <div>
        <div className="flex items-center" style={{ gap: 14 }}>
          <span className="v5-eyebrow">WEEKLY INSIGHT · 本周收藏</span>
          <span style={{ width: 24, height: 1, background: "var(--v5-rule-strong)" }} />
          <span
            style={{
              fontFamily: "var(--v5-mono)",
              fontSize: 11,
              color: "var(--v5-ink3)",
              letterSpacing: "0.06em",
            }}
          >
            {dateRange}
          </span>
        </div>

        <h3
          style={{
            margin: "16px 0 0",
            fontFamily: "var(--v5-serif)",
            fontVariationSettings: '"opsz" 144, "SOFT" 60',
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.4,
            color: "var(--v5-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          本周收藏了{" "}
          <span style={{ color: "var(--v5-accent)", fontStyle: "italic" }}>{weekQuotes.length} 条</span>{" "}
          金句
        </h3>

        <p
          style={{
            margin: "10px 0 0",
            fontFamily: "var(--v5-serif)",
            fontStyle: "italic",
            fontVariationSettings: '"opsz" 14',
            fontSize: 14,
            lineHeight: 1.7,
            color: "var(--v5-ink2)",
          }}
        >
          {topTheme
            ? `主要集中在 ${topTheme[0]} (${topTheme[1]})，慢慢拼出你这周关心的事。`
            : "本周还没有新的收藏。今天读到的句子，可以试着记下来。"}
        </p>

        {summary ? (
          <div
            className="mt-5"
            style={{
              borderRadius: 16,
              padding: "16px 18px",
              background: "rgba(139,94,60,0.05)",
              border: "1px solid rgba(139,94,60,0.10)",
            }}
          >
            <div className="v5-eyebrow" style={{ fontSize: 10 }}>
              本周核心认知
            </div>
            <ol className="m-0 mt-3 list-none p-0" style={{ display: "grid", gap: 8 }}>
              {summary.map((line, i) => (
                <li
                  key={i}
                  style={{
                    fontFamily: "var(--v5-serif)",
                    fontSize: 14,
                    lineHeight: 1.75,
                    color: "var(--v5-ink)",
                  }}
                >
                  <span style={{ color: "var(--v5-accent)", marginRight: 6, fontWeight: 600 }}>
                    {i + 1}.
                  </span>
                  {line}
                </li>
              ))}
            </ol>
            <button
              className="mt-3 inline-flex items-center"
              onClick={() => setSummary(null)}
              type="button"
              style={{
                border: 0,
                background: "transparent",
                padding: 0,
                color: "var(--v5-ink3)",
                fontFamily: "var(--v5-sans)",
                fontSize: 12,
                cursor: "pointer",
                gap: 4,
              }}
            >
              重新生成
            </button>
          </div>
        ) : (
          <button
            className="mt-5 inline-flex items-center"
            disabled={weekByTheme.length === 0}
            onClick={generateSummary}
            type="button"
            style={{
              gap: 6,
              padding: "10px 18px",
              borderRadius: 999,
              border: 0,
              background: "var(--v5-ink)",
              color: "#fff",
              fontFamily: "var(--v5-sans)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: weekByTheme.length === 0 ? "not-allowed" : "pointer",
              opacity: weekByTheme.length === 0 ? 0.5 : 1,
              boxShadow: "0 4px 12px rgba(33,22,17,0.18)",
              transition: "transform var(--v5-dur) var(--v5-ease), background var(--v5-dur) var(--v5-ease)",
            }}
            onMouseEnter={(e) => {
              if (weekByTheme.length === 0) return;
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.background = "var(--v5-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.background = "var(--v5-ink)";
            }}
          >
            <Sparkles size={14} />
            生成认知总结
          </button>
        )}
      </div>

      {/* Right column: distribution viz */}
      <div className="flex flex-col" style={{ gap: 12 }}>
        <div
          className="v5-eyebrow"
          style={{ fontSize: 10 }}
        >
          Distribution
        </div>
        {weekByTheme.length === 0 ? (
          <p style={{ margin: 0, fontFamily: "var(--v5-sans)", fontSize: 12.5, color: "var(--v5-ink3)" }}>
            本周还没有数据。
          </p>
        ) : (
          weekByTheme.slice(0, 5).map(([label, count]) => {
            const { accent } = getThemeMeta(label);
            const pct = Math.max(8, (count / Math.max(1, maxCount)) * 100);
            return (
              <div className="flex items-center" key={label} style={{ gap: 10 }}>
                <span
                  style={{
                    flex: "0 0 90px",
                    fontFamily: "var(--v5-serif)",
                    fontSize: 13,
                    color: "var(--v5-ink2)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {label}
                </span>
                <div className="flex-1" style={{ height: 4, background: "rgba(75,51,27,0.06)", borderRadius: 999 }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: accent,
                      borderRadius: 999,
                      transition: "width var(--v5-dur-slow) var(--v5-ease-out)",
                    }}
                  />
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    fontFamily: "var(--v5-mono)",
                    fontSize: 12,
                    color: "var(--v5-ink2)",
                    fontWeight: 600,
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function V5ThemeCard({
  bucket,
  weekCount,
  onOpen,
}: {
  bucket: ReturnType<typeof groupQuotesByTheme>[number];
  weekCount: number;
  onOpen: () => void;
}) {
  const [hov, setHov] = useState(false);
  const { accent, Icon } = getThemeMeta(bucket.label);
  const preview = bucket.items[0];

  return (
    <button
      className="relative overflow-hidden text-left"
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      type="button"
      style={{
        background: "var(--v5-card)",
        border: "1px solid var(--v5-rule)",
        borderRadius: 22,
        padding: 22,
        boxShadow: hov ? "var(--v5-sh-hover)" : "var(--v5-sh-2)",
        transform: hov ? "translateY(-3px)" : "translateY(0)",
        transition: "transform var(--v5-dur) var(--v5-ease-out), box-shadow var(--v5-dur) var(--v5-ease-out)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 200,
      }}
    >
      {/* accent corner glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: 0,
          right: 0,
          width: 96,
          height: 96,
          background: `radial-gradient(circle at top right, color-mix(in oklab, ${accent}, transparent 78%) 0%, transparent 70%)`,
          opacity: hov ? 1 : 0.6,
          transition: "opacity var(--v5-dur) var(--v5-ease)",
        }}
      />

      {/* Top row */}
      <div className="relative flex items-start justify-between" style={{ gap: 10 }}>
        <div className="flex items-start" style={{ gap: 12, minWidth: 0 }}>
          <span
            className="grid place-items-center"
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: `color-mix(in oklab, ${accent}, transparent 86%)`,
              border: `1px solid color-mix(in oklab, ${accent}, transparent 70%)`,
              color: accent,
              transform: hov ? "scale(1.06) rotate(-4deg)" : "scale(1) rotate(0)",
              transition: "transform var(--v5-dur) var(--v5-ease-spring)",
              flexShrink: 0,
            }}
          >
            <Icon size={17} strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <div className="v5-eyebrow" style={{ fontSize: 10 }}>Collection</div>
            <div
              style={{
                marginTop: 2,
                fontFamily: "var(--v5-serif)",
                fontSize: 18,
                fontWeight: 500,
                color: "var(--v5-ink)",
                letterSpacing: "-0.01em",
              }}
            >
              {bucket.label}
            </div>
          </div>
        </div>
        <ChevronRight size={16} style={{ color: "var(--v5-ink-mute)", flexShrink: 0 }} />
      </div>

      {/* Mid row */}
      <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
        <div className="flex items-baseline" style={{ gap: 4 }}>
          <span
            className="v5-numeral"
            style={{
              fontSize: 32,
              fontVariationSettings: '"opsz" 144, "wght" 400',
              color: "var(--v5-ink)",
            }}
          >
            {bucket.items.length}
          </span>
          <span
            style={{
              fontFamily: "var(--v5-sans)",
              fontSize: 12,
              color: "var(--v5-ink3)",
            }}
          >
            条
          </span>
        </div>
        {weekCount > 0 && (
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: `color-mix(in oklab, ${accent}, transparent 84%)`,
              color: accent,
              fontFamily: "var(--v5-sans)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            本周 +{weekCount}
          </span>
        )}
      </div>

      {/* Bottom preview */}
      <div
        className="mt-auto"
        style={{
          paddingTop: 12,
          borderTop: "1px dashed var(--v5-rule)",
        }}
      >
        {preview ? (
          <>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--v5-serif)",
                fontStyle: "italic",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--v5-ink2)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              “{preview.text}”
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontFamily: "var(--v5-serif)",
                fontSize: 11.5,
                color: "var(--v5-ink3)",
              }}
            >
              — {preview.author || "佚名"}
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontFamily: "var(--v5-sans)", fontSize: 12, color: "var(--v5-ink-mute)" }}>
            暂未归类
          </p>
        )}
      </div>
    </button>
  );
}

function ArchiveSection({
  quotes,
  notes,
  onOpenQuote,
}: {
  quotes: Quote[];
  notes: Note[];
  onOpenQuote: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const buckets = useMemo(() => groupQuotesByTheme(quotes), [quotes]);

  const searchLower = query.trim().toLowerCase();
  const isSearching = searchLower.length > 0;

  const matchingQuotes = useMemo(() => {
    if (!isSearching) return [];
    return quotes.filter((q) =>
      [q.text, q.author, q.book, classifyQuote(q), ...q.tags]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(searchLower)),
    );
  }, [quotes, searchLower, isSearching]);

  const matchingNotes = useMemo(() => {
    if (!isSearching) return [];
    return notes.filter((n) =>
      [n.title, n.content, classifyNote(n), ...n.tags]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(searchLower)),
    );
  }, [notes, searchLower, isSearching]);

  const matchingTags = useMemo(() => {
    if (!isSearching) return [];
    const all = new Set<string>();
    for (const q of quotes) for (const t of q.tags) all.add(t);
    for (const n of notes) for (const t of n.tags) all.add(t);
    return [...all].filter((t) => t.toLowerCase().includes(searchLower));
  }, [quotes, notes, searchLower, isSearching]);

  // ── Note detail view ─────────────────────────────────────────
  if (selectedNote) {
    return (
      <div className="space-y-5">
        <button
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80"
          onClick={() => setSelectedNote(null)}
          type="button"
          style={{ color: "var(--m-accent)" }}
        >
          <ArrowLeft size={14} />
          返回搜索结果
        </button>

        <Panel className="p-6 md:p-7">
          <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
            {selectedNote.title}
          </h2>
          {selectedNote.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedNote.tags.map((t) => (
                <span
                  className="rounded-full px-3 py-1 text-xs"
                  key={`${selectedNote.id}-${t}`}
                  style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
          <p
            className="mt-5 whitespace-pre-wrap text-[15px] leading-8"
            style={{ color: "var(--m-ink2)" }}
          >
            {selectedNote.content}
          </p>
        </Panel>
      </div>
    );
  }

  // ── Drill-into-folder view ────────────────────────────────────
  if (openFolder) {
    const bucket = buckets.find((b) => b.label === openFolder);
    return (
      <div className="space-y-5">
        <button
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80"
          onClick={() => setOpenFolder(null)}
          type="button"
          style={{ color: "var(--m-accent)" }}
        >
          <ArrowLeft size={14} />
          返回归档
        </button>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
            FOLDER
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
            {bucket ? `${bucket.icon} ${bucket.label}` : openFolder}
            <span className="ml-2 text-sm font-normal" style={{ color: "var(--m-ink3)" }}>
              {bucket?.items.length ?? 0} 条
            </span>
          </h2>
        </div>

        {bucket && bucket.items.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {bucket.items.map((q) => (
              <QuoteCard key={q.id} quote={q} />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm" style={{ color: "var(--m-ink3)" }}>
            该分类下暂无金句
          </p>
        )}
      </div>
    );
  }

  // v5 desktop: weekly quotes + per-theme week counts
  const weekQuotes = useMemo(
    () => quotes.filter((q) => isInThisWeek(q.createdAt.slice(0, 10))),
    [quotes],
  );
  const themeWeekCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of weekQuotes) {
      const label = classifyQuote(q);
      m.set(label, (m.get(label) ?? 0) + 1);
    }
    return m;
  }, [weekQuotes]);

  return (
    <>
    {/* ── Desktop v5 layout ── */}
    <section className="hidden md:block">
      <div className="grid" style={{ gap: 28 }}>
        <V5SearchBar onChange={setQuery} value={query} />

        {isSearching ? (
          /* When searching, fall through to mobile-style results below */
          <div
            className="rounded-[20px] border border-dashed px-6 py-10 text-center"
            style={{ borderColor: "var(--v5-rule-strong)", background: "var(--v5-card)" }}
          >
            <p style={{ margin: 0, fontFamily: "var(--v5-sans)", fontSize: 13, color: "var(--v5-ink3)" }}>
              在下方查看搜索结果（共 {matchingQuotes.length + matchingNotes.length} 条匹配）。
            </p>
          </div>
        ) : buckets.length === 0 ? (
          <EmptyState
            description="保存第一条金句后，AI 会自动按主题分类，这里会形成你的认知文件夹。"
            icon={FolderOpen}
            illustrationAlt="empty archive"
            illustrationSrc="/illustrations/relaxed-reading.svg"
            title="还没有归档内容"
          />
        ) : (
          <>
            <V5WeeklyInsight buckets={buckets} weekQuotes={weekQuotes} />

            <div>
              <div className="mb-5 flex flex-wrap items-end justify-between" style={{ gap: 16 }}>
                <div>
                  <div className="v5-eyebrow">COLLECTIONS · 主题归档</div>
                  <h2
                    className="v5-display mt-2"
                    style={{
                      margin: 0,
                      fontSize: 28,
                      fontVariationSettings: '"opsz" 144',
                      fontWeight: 400,
                      color: "var(--v5-ink)",
                    }}
                  >
                    按主题翻阅
                  </h2>
                </div>
              </div>
              <div
                className="grid"
                style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18 }}
              >
                {buckets.map((b) => (
                  <V5ThemeCard
                    bucket={b}
                    key={b.label}
                    onOpen={() => setOpenFolder(b.label)}
                    weekCount={themeWeekCounts.get(b.label) ?? 0}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>

    {/* ── Mobile (existing layout) ── */}
    <div className="md:hidden space-y-5">
      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          size={16}
          style={{ color: "var(--m-ink3)" }}
        />
        <Input
          className="pl-9 pr-9"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索金句、阅读笔记、标签..."
          value={query}
        />
        {query && (
          <button
            aria-label="清空"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => setQuery("")}
            type="button"
            style={{ color: "var(--m-ink3)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search results */}
      {isSearching ? (
        <div className="space-y-5">
          {matchingTags.length > 0 && (
            <Panel className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                相关标签 · {matchingTags.length}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {matchingTags.map((t) => (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs"
                    key={t}
                    style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}
                  >
                    <Tag size={11} />
                    {t}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {matchingQuotes.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                金句 · {matchingQuotes.length}
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                {matchingQuotes.map((q) => (
                  <div
                    className="cursor-pointer"
                    key={q.id}
                    onClick={() => onOpenQuote(q.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpenQuote(q.id); }}
                    role="button"
                    tabIndex={0}
                  >
                    <QuoteCard quote={q} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingNotes.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                阅读笔记 · {matchingNotes.length}
              </p>
              <div className="space-y-3">
                {matchingNotes.map((n) => (
                  <div
                    className="cursor-pointer"
                    key={n.id}
                    onClick={() => setSelectedNote(n)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedNote(n); }}
                    role="button"
                    tabIndex={0}
                  >
                    <Panel className="p-5" interactive>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
                          {n.title}
                        </h3>
                        <ChevronRight
                          className="mt-0.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                          size={16}
                          style={{ color: "var(--m-ink3)" }}
                        />
                      </div>
                      <p
                        className="mt-2 text-sm leading-7"
                        style={{ color: "var(--m-ink2)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}
                      >
                        {formatPreview(n.content)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {n.tags.map((t) => (
                          <span className="rounded-full px-2 py-0.5 text-[11px]" key={`${n.id}-${t}`}
                            style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink3)" }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    </Panel>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingTags.length === 0 && matchingQuotes.length === 0 && matchingNotes.length === 0 && (
            <p className="py-10 text-center text-sm" style={{ color: "var(--m-ink3)" }}>
              没有匹配「{query}」的内容
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Weekly cognitive card */}
          <WeeklyCognitiveCard quotes={quotes} />

          {/* Folder list */}
          {buckets.length === 0 ? (
            <EmptyState
              description="保存第一条金句后，AI 会自动按主题分类，这里会形成你的认知文件夹。"
              icon={FolderOpen}
              illustrationAlt="empty archive"
              illustrationSrc="/illustrations/relaxed-reading.svg"
              title="还没有归档内容"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {buckets.map((b) => (
                <button
                  className="group flex items-center gap-4 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
                  key={b.label}
                  onClick={() => setOpenFolder(b.label)}
                  type="button"
                  style={{
                    background: "var(--m-base-light)",
                    border: "1px solid var(--m-rule)",
                    boxShadow: "var(--m-shadow-out)",
                  }}
                >
                  <span className="text-3xl">{b.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
                      {b.label}
                    </h3>
                    <p className="text-xs" style={{ color: "var(--m-ink3)" }}>
                      {b.items.length} 条
                    </p>
                  </div>
                  <ChevronRight
                    className="transition-transform group-hover:translate-x-1"
                    size={18}
                    style={{ color: "var(--m-ink3)" }}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * v5 Library helpers: PageHeader, TodaysPick, FilterBar,
 * QuoteCard variants, AddQuoteModal
 * ────────────────────────────────────────────────────────────────── */

function V5PageHeader() {
  return (
    <div>
      <div className="v5-eyebrow">LIBRARY · 灵感书库</div>
      <h1
        className="v5-display mt-2"
        style={{
          margin: 0,
          fontSize: "clamp(34px, 4vw, 48px)",
          fontVariationSettings: '"opsz" 144, "SOFT" 60',
          fontWeight: 400,
          color: "var(--v5-ink)",
        }}
      >
        灵感书库
      </h1>
      <p
        className="mt-3"
        style={{
          margin: "12px 0 0",
          fontFamily: "var(--v5-serif)",
          fontVariationSettings: '"opsz" 14',
          fontSize: 16,
          lineHeight: 1.7,
          color: "var(--v5-ink2)",
          fontStyle: "italic",
          maxWidth: 520,
        }}
      >
        把值得反复回看的句子和阅读笔记，收进同一座灵感书库里。
      </p>
    </div>
  );
}

function V5TodaysPick({
  quote,
  onShuffle,
  onSaveToday,
}: {
  quote: Quote | null;
  onShuffle: () => void;
  onSaveToday: () => void;
}) {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayNumber = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日`;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: 32,
        padding: "clamp(28px, 4vw, 48px) clamp(28px, 4.5vw, 56px)",
        background: "linear-gradient(135deg, var(--v5-card) 0%, #faecc8 100%)",
        boxShadow: "var(--v5-sh-3)",
      }}
    >
      {/* Decorative giant glyph */}
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          right: 32,
          top: -40,
          fontFamily: "var(--v5-serif)",
          fontVariationSettings: '"opsz" 144, "wght" 500',
          fontSize: 280,
          lineHeight: 1,
          color: "var(--v5-accent)",
          opacity: 0.08,
          userSelect: "none",
        }}
      >
        “
      </span>

      {/* Top eyebrow row */}
      <div className="relative flex items-center" style={{ gap: 16 }}>
        <span className="v5-eyebrow">TODAY&apos;S PICK · 今日金句</span>
        <span style={{ width: 24, height: 1, background: "var(--v5-rule-strong)" }} />
        <span
          style={{
            fontFamily: "var(--v5-mono)",
            fontSize: 11,
            color: "var(--v5-ink3)",
            letterSpacing: "0.08em",
          }}
        >
          {dateLabel} · 第 {dayNumber} 日
        </span>
      </div>

      {/* Quote text */}
      <p
        className="relative"
        style={{
          margin: "28px 0 0",
          fontFamily: "var(--v5-serif)",
          fontVariationSettings: '"opsz" 144, "SOFT" 60',
          fontSize: "clamp(24px, 3.4vw, 42px)",
          fontWeight: 400,
          lineHeight: 1.35,
          color: "var(--v5-ink)",
          letterSpacing: "-0.015em",
          maxWidth: 880,
        }}
      >
        {quote?.text ?? "重要的不是被给予了什么，而是如何去使用被给予的东西。"}
      </p>

      {/* Footer row */}
      <div
        className="relative mt-8 flex flex-wrap items-center justify-between"
        style={{ gap: 16 }}
      >
        <div className="flex items-center" style={{ gap: 14, minWidth: 0 }}>
          <span style={{ width: 28, height: 1, background: "var(--v5-rule-strong)", flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "var(--v5-serif)",
              fontStyle: "italic",
              fontSize: 15,
              color: "var(--v5-ink2)",
              fontVariationSettings: '"opsz" 14',
            }}
          >
            {quote
              ? `${quote.author || "佚名"}${quote.book ? ` · 《${quote.book}》` : ""}`
              : "阿德勒 · 《被讨厌的勇气》"}
          </span>
        </div>

        <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
          <button
            className="inline-flex items-center"
            onClick={onShuffle}
            type="button"
            style={{
              gap: 6,
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid var(--v5-rule-strong)",
              background: "transparent",
              color: "var(--v5-ink2)",
              fontFamily: "var(--v5-sans)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background var(--v5-dur) var(--v5-ease)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(75,51,27,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Shuffle size={14} />
            换一句
          </button>
          <button
            className="inline-flex items-center"
            disabled={!quote}
            onClick={onSaveToday}
            type="button"
            style={{
              gap: 6,
              padding: "10px 18px",
              borderRadius: 999,
              border: 0,
              background: "var(--v5-ink)",
              color: "#fff",
              fontFamily: "var(--v5-sans)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: quote ? "pointer" : "not-allowed",
              opacity: quote ? 1 : 0.5,
              boxShadow: "0 4px 12px rgba(33,22,17,0.18)",
              transition: "transform var(--v5-dur) var(--v5-ease), background var(--v5-dur) var(--v5-ease)",
            }}
            onMouseEnter={(e) => {
              if (!quote) return;
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.background = "var(--v5-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.background = "var(--v5-ink)";
            }}
          >
            <Bookmark size={14} />
            收藏到今日
          </button>
        </div>
      </div>

      {/* Tag chips */}
      {quote && quote.tags && quote.tags.length > 0 && (
        <div className="relative mt-5 flex flex-wrap" style={{ gap: 8 }}>
          {quote.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(139,94,60,0.07)",
                color: "var(--v5-ink2)",
                fontFamily: "var(--v5-serif)",
                fontStyle: "italic",
                fontSize: 12.5,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── v5 Filter bar ─────────────────────────────────────────────── */

interface V5FilterBarProps {
  onAdd: () => void;
  search: string;
  onSearch: (s: string) => void;
  allTags: string[];
  activeTags: Set<string>;
  onToggleTag: (t: string) => void;
  onClearTags: () => void;
  sort: SortMode;
  onSortChange: (s: SortMode) => void;
}

type SortMode = "recent" | "author" | "tag";

const SORT_LABELS: Record<SortMode, string> = {
  recent: "最新收藏",
  author: "按作者",
  tag: "按标签",
};

function V5FilterBar({
  onAdd,
  search,
  onSearch,
  allTags,
  activeTags,
  onToggleTag,
  onClearTags,
  sort,
  onSortChange,
}: V5FilterBarProps) {
  const [showAllTags, setShowAllTags] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const visibleTags = showAllTags ? allTags : allTags.slice(0, 7);
  const overflowCount = Math.max(0, allTags.length - 7);

  return (
    <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
      {/* Add button */}
      <button
        className="inline-flex items-center"
        onClick={onAdd}
        type="button"
        style={{
          gap: 6,
          padding: "9px 18px",
          borderRadius: 999,
          border: 0,
          background: "var(--v5-ink)",
          color: "#fff",
          fontFamily: "var(--v5-sans)",
          fontSize: 13.5,
          fontWeight: 500,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(33,22,17,0.18)",
          transition: "transform var(--v5-dur) var(--v5-ease), background var(--v5-dur) var(--v5-ease)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.background = "var(--v5-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.background = "var(--v5-ink)";
        }}
      >
        <Plus size={14} />
        添加新金句
      </button>

      {/* Search input */}
      <label
        className="inline-flex items-center"
        style={{
          gap: 8,
          padding: "8px 14px",
          borderRadius: 999,
          background: "var(--v5-card)",
          border: "1px solid var(--v5-rule)",
          flex: "1 1 220px",
          maxWidth: 320,
          minWidth: 0,
        }}
      >
        <Search size={14} style={{ color: "var(--v5-ink3)", flexShrink: 0 }} />
        <input
          className="flex-1 border-0 bg-transparent outline-none"
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索金句、作者或标签…"
          style={{
            fontFamily: "var(--v5-serif)",
            fontSize: 13.5,
            color: "var(--v5-ink)",
            minWidth: 0,
            width: "100%",
          }}
          type="text"
          value={search}
        />
      </label>

      {/* Tag chips */}
      <div className="flex flex-wrap items-center" style={{ gap: 6, flex: "1 1 auto", minWidth: 0 }}>
        {visibleTags.map((tag) => {
          const active = activeTags.has(tag);
          return (
            <button
              className="inline-flex items-center"
              key={tag}
              onClick={() => onToggleTag(tag)}
              type="button"
              style={{
                gap: 4,
                padding: "5px 11px",
                borderRadius: 999,
                border: 0,
                background: active ? "var(--v5-accent)" : "rgba(139,94,60,0.07)",
                color: active ? "#fff" : "var(--v5-ink2)",
                fontFamily: "var(--v5-serif)",
                fontStyle: "italic",
                fontSize: 12.5,
                cursor: "pointer",
                transition: "background var(--v5-dur-fast) var(--v5-ease), color var(--v5-dur-fast) var(--v5-ease)",
              }}
            >
              #{tag}
              {active && <X size={11} />}
            </button>
          );
        })}
        {overflowCount > 0 && (
          <button
            className="inline-flex items-center"
            onClick={() => setShowAllTags((v) => !v)}
            type="button"
            style={{
              gap: 3,
              padding: "5px 10px",
              borderRadius: 999,
              border: 0,
              background: "transparent",
              color: "var(--v5-ink3)",
              fontFamily: "var(--v5-sans)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {showAllTags ? "收起" : `+${overflowCount}`}
            <ChevronDown
              size={11}
              style={{ transform: showAllTags ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            />
          </button>
        )}
      </div>

      {/* Sort dropdown */}
      <div className="relative">
        <button
          className="inline-flex items-center"
          onClick={() => setSortOpen((v) => !v)}
          type="button"
          style={{
            gap: 6,
            padding: "8px 14px",
            borderRadius: 999,
            background: "var(--v5-card)",
            border: "1px solid var(--v5-rule)",
            color: "var(--v5-ink2)",
            fontFamily: "var(--v5-sans)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <ArrowDownNarrowWide size={13} />
          {SORT_LABELS[sort]}
          <ChevronDown size={12} />
        </button>
        {sortOpen && (
          <>
            <div
              className="fixed inset-0"
              onClick={() => setSortOpen(false)}
              style={{ zIndex: 40 }}
            />
            <div
              className="absolute right-0 mt-2"
              style={{
                zIndex: 41,
                minWidth: 140,
                borderRadius: 12,
                background: "var(--v5-card)",
                border: "1px solid var(--v5-rule)",
                boxShadow: "var(--v5-sh-3)",
                padding: 4,
              }}
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map((opt) => (
                <button
                  className="block w-full text-left"
                  key={opt}
                  onClick={() => {
                    onSortChange(opt);
                    setSortOpen(false);
                  }}
                  type="button"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: opt === sort ? "rgba(139,94,60,0.08)" : "transparent",
                    color: opt === sort ? "var(--v5-accent)" : "var(--v5-ink2)",
                    fontFamily: "var(--v5-sans)",
                    fontSize: 13,
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  {SORT_LABELS[opt]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Active filters indicator */}
      {activeTags.size > 0 && (
        <div
          className="flex items-center"
          style={{
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(139,94,60,0.06)",
            fontSize: 12,
            color: "var(--v5-ink2)",
            fontFamily: "var(--v5-sans)",
          }}
        >
          筛选 ({activeTags.size})
          <button
            onClick={onClearTags}
            type="button"
            style={{
              border: 0,
              background: "transparent",
              color: "var(--v5-accent)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              padding: 0,
            }}
          >
            清除
          </button>
        </div>
      )}
    </div>
  );
}

/* ── v5 Quote card with 3 variants ─────────────────────────────── */

type QuoteVariant = "plain" | "pullquote" | "featured";

function pickVariant(q: Quote, index: number): QuoteVariant {
  const len = q.text?.length ?? 0;
  if (len < 25 && q.tags && q.tags.length > 0) return "pullquote";
  if (len > 120 || /[。！？!?]\s*\S/.test(q.text ?? "")) return "plain";
  return index % 4 === 3 ? "featured" : "plain";
}

function formatSavedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`;
}

function V5QuoteCard({
  quote,
  variant,
  onOpen,
}: {
  quote: Quote;
  variant: QuoteVariant;
  onOpen: () => void;
}) {
  const [hov, setHov] = useState(false);
  const author = quote.author?.trim() || "佚名";
  const book = quote.book?.trim();
  const tags = quote.tags ?? [];
  const savedAt = formatSavedDate(quote.createdAt);

  const baseCardStyle: React.CSSProperties = {
    breakInside: "avoid",
    marginBottom: 18,
    padding: "26px 24px 20px",
    borderRadius: 20,
    cursor: "pointer",
    boxShadow: hov ? "var(--v5-sh-hover)" : "var(--v5-sh-2)",
    transform: hov ? "translateY(-3px)" : "translateY(0)",
    transition: "transform var(--v5-dur) var(--v5-ease-out), box-shadow var(--v5-dur) var(--v5-ease-out)",
    position: "relative",
    overflow: "hidden",
  };

  if (variant === "featured") {
    return (
      <div
        onClick={onOpen}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          ...baseCardStyle,
          background: "linear-gradient(135deg, var(--v5-accent) 0%, #6b4628 100%)",
          color: "#fff",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            right: 18,
            top: -22,
            fontFamily: "var(--v5-serif)",
            fontVariationSettings: '"opsz" 144, "wght" 500',
            fontSize: 88,
            lineHeight: 1,
            color: "#fff",
            opacity: 0.18,
            userSelect: "none",
          }}
        >
          “
        </span>
        <p
          className="relative"
          style={{
            margin: 0,
            fontFamily: "var(--v5-serif)",
            fontVariationSettings: '"opsz" 144, "SOFT" 60',
            fontSize: 23,
            fontWeight: 400,
            lineHeight: 1.42,
            color: "#fff",
            letterSpacing: "-0.01em",
          }}
        >
          {quote.text}
        </p>
        <div
          className="mt-5 flex items-center justify-between"
          style={{
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.18)",
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: "var(--v5-serif)",
              fontStyle: "italic",
              fontSize: 13,
              color: "rgba(255,250,243,0.92)",
            }}
          >
            {author}{book ? ` · 《${book}》` : ""}
          </span>
          <Bookmark size={14} style={{ color: "rgba(255,250,243,0.7)" }} />
        </div>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap" style={{ gap: 6 }}>
            {tags.slice(0, 4).map((t) => (
              <span
                key={t}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(255,250,243,0.12)",
                  color: "#fff",
                  fontFamily: "var(--v5-serif)",
                  fontStyle: "italic",
                  fontSize: 12,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (variant === "pullquote") {
    return (
      <div
        onClick={onOpen}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          ...baseCardStyle,
          background: "var(--v5-card)",
          border: "1px solid var(--v5-rule)",
        }}
      >
        <span
          aria-hidden
          className="absolute"
          style={{
            left: 18,
            top: -6,
            fontFamily: "var(--v5-serif)",
            fontVariationSettings: '"opsz" 144, "wght" 500',
            fontSize: 46,
            lineHeight: 1,
            color: "var(--v5-accent)",
            opacity: 0.45,
            userSelect: "none",
          }}
        >
          “
        </span>
        <p
          className="relative"
          style={{
            margin: "20px 0 0",
            fontFamily: "var(--v5-serif)",
            fontVariationSettings: '"opsz" 144, "SOFT" 50',
            fontStyle: "italic",
            fontSize: 20,
            fontWeight: 400,
            lineHeight: 1.42,
            color: "var(--v5-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {quote.text}
        </p>
        <div
          className="mt-5 flex items-center justify-between"
          style={{
            paddingTop: 12,
            borderTop: "1px dashed var(--v5-rule)",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--v5-serif)",
              fontSize: 12.5,
              color: "var(--v5-ink2)",
            }}
          >
            — {author}{book ? ` · 《${book}》` : ""}
          </span>
          {savedAt && (
            <span
              style={{
                fontFamily: "var(--v5-mono)",
                fontSize: 11,
                color: "var(--v5-ink3)",
                letterSpacing: "0.04em",
              }}
            >
              {savedAt}
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap" style={{ gap: 6 }}>
            {tags.slice(0, 4).map((t) => (
              <span
                key={t}
                style={{
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "rgba(139,94,60,0.07)",
                  color: "var(--v5-ink2)",
                  fontFamily: "var(--v5-serif)",
                  fontStyle: "italic",
                  fontSize: 11.5,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Variant A · plain
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...baseCardStyle,
        background: "var(--v5-card)",
        border: "1px solid var(--v5-rule)",
      }}
    >
      <div className="flex items-start justify-between" style={{ gap: 12 }}>
        <span
          className="v5-eyebrow"
          style={{ fontSize: 10, lineHeight: 1.4 }}
        >
          {author}
        </span>
        <Bookmark size={12} style={{ color: "var(--v5-ink-mute)", flexShrink: 0 }} />
      </div>
      <p
        style={{
          margin: "12px 0 0",
          fontFamily: "var(--v5-serif)",
          fontVariationSettings: '"opsz" 14',
          fontSize: 15,
          lineHeight: 1.78,
          color: "var(--v5-ink)",
        }}
      >
        {quote.text}
      </p>
      <div
        className="mt-4 flex items-center justify-between"
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--v5-rule)",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--v5-serif)",
            fontStyle: "italic",
            fontSize: 13,
            color: "var(--v5-ink2)",
          }}
        >
          {book ? `《${book}》` : "未注明出处"}
        </span>
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
            {tags.slice(0, 2).map((t) => (
              <span
                key={t}
                style={{
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "rgba(139,94,60,0.07)",
                  color: "var(--v5-ink2)",
                  fontFamily: "var(--v5-serif)",
                  fontStyle: "italic",
                  fontSize: 11.5,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── v5 Add Quote Modal ────────────────────────────────────────── */

function V5AddQuoteModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { text: string; author: string; book: string; tags: string[] }) => Promise<void> | void;
}) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [book, setBook] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setText(""); setAuthor(""); setBook(""); setTags("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const tagList = tags
    .split(/[,\s，、]+/)
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);

  const submit = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ text: text.trim(), author: author.trim(), book: book.trim(), tags: tagList });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      onClick={onClose}
      style={{
        zIndex: 100,
        background: "rgba(33,22,17,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        style={{
          width: "min(560px, 100%)",
          background: "var(--v5-card)",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 24px 60px rgba(33,22,17,0.35)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="v5-eyebrow">NEW QUOTE · 记录新金句</span>
          <button
            aria-label="关闭"
            onClick={onClose}
            type="button"
            style={{
              border: 0,
              background: "transparent",
              color: "var(--v5-ink3)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <h2
          className="v5-display mt-3"
          style={{
            margin: "12px 0 0",
            fontSize: 24,
            fontVariationSettings: '"opsz" 144',
            fontWeight: 400,
            color: "var(--v5-ink)",
          }}
        >
          写下那句打动你的话
        </h2>

        <textarea
          autoFocus
          className="mt-5 w-full resize-y outline-none"
          onChange={(e) => setText(e.target.value)}
          placeholder="在这里写下那句金句…"
          style={{
            minHeight: 130,
            padding: "14px 16px",
            background: "rgba(75,51,27,0.04)",
            border: "1px solid var(--v5-rule)",
            borderRadius: 14,
            fontFamily: "var(--v5-serif)",
            fontSize: 15,
            lineHeight: 1.7,
            color: "var(--v5-ink)",
          }}
          value={text}
        />

        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <input
            className="w-full outline-none"
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="作者"
            style={{
              padding: "12px 14px",
              background: "rgba(75,51,27,0.04)",
              border: "1px solid var(--v5-rule)",
              borderRadius: 12,
              fontFamily: "var(--v5-serif)",
              fontSize: 14,
              color: "var(--v5-ink)",
            }}
            type="text"
            value={author}
          />
          <input
            className="w-full outline-none"
            onChange={(e) => setBook(e.target.value)}
            placeholder="出处 · 书 / 文 / 演讲"
            style={{
              padding: "12px 14px",
              background: "rgba(75,51,27,0.04)",
              border: "1px solid var(--v5-rule)",
              borderRadius: 12,
              fontFamily: "var(--v5-serif)",
              fontSize: 14,
              color: "var(--v5-ink)",
            }}
            type="text"
            value={book}
          />
        </div>

        <input
          className="mt-3 w-full outline-none"
          onChange={(e) => setTags(e.target.value)}
          placeholder="标签 · 用空格分隔，例：勇气 成长 当下"
          style={{
            padding: "12px 14px",
            background: "rgba(75,51,27,0.04)",
            border: "1px solid var(--v5-rule)",
            borderRadius: 12,
            fontFamily: "var(--v5-serif)",
            fontSize: 14,
            color: "var(--v5-ink)",
          }}
          type="text"
          value={tags}
        />

        {tagList.length > 0 && (
          <div className="mt-3 flex flex-wrap" style={{ gap: 6 }}>
            {tagList.map((t) => (
              <span
                key={t}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(139,94,60,0.08)",
                  color: "var(--v5-ink2)",
                  fontFamily: "var(--v5-serif)",
                  fontStyle: "italic",
                  fontSize: 12,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-7 flex items-center justify-end" style={{ gap: 10 }}>
          <button
            onClick={onClose}
            type="button"
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid var(--v5-rule-strong)",
              background: "transparent",
              color: "var(--v5-ink2)",
              fontFamily: "var(--v5-sans)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            className="inline-flex items-center"
            disabled={!text.trim() || saving}
            onClick={submit}
            type="button"
            style={{
              gap: 6,
              padding: "10px 18px",
              borderRadius: 999,
              border: 0,
              background: "var(--v5-ink)",
              color: "#fff",
              fontFamily: "var(--v5-sans)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: text.trim() && !saving ? "pointer" : "not-allowed",
              opacity: text.trim() && !saving ? 1 : 0.5,
              boxShadow: "0 4px 12px rgba(33,22,17,0.18)",
            }}
          >
            <Bookmark size={14} />
            {saving ? "收藏中…" : "收藏这句话"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quotes section ─────────────────────────────────────────────
function QuotesSection({ scrollToId, onOpenQuote }: { scrollToId: string | null; onOpenQuote: (id: string) => void }) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [book, setBook] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");

  const quotes = useQuotesStore();
  const dailyQuote = getDailyQuote(quotes);
  const tagList = useMemo(
    () => tags.split(/[,\s，、]+/).map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
    [tags],
  );

  useEffect(() => { void refreshQuotes(); }, []);

  // Smooth-scroll to the quote when navigated from search results.
  useEffect(() => {
    if (!scrollToId) return;
    const el = document.getElementById(`quote-${scrollToId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollToId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quote: Quote = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      text: text.trim(),
      author: author.trim(),
      book: book.trim(),
      readingHours: 0,
      tags: tagList,
    };
    await saveQuote(quote);
    setText(""); setAuthor(""); setBook(""); setTags("");
    setMessage("已保存到你的灵感书库。");
  };

  // v5 desktop state — modal + filters
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of quotes) for (const t of q.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [quotes]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let out = quotes.filter((q) => {
      if (activeTags.size > 0 && !(q.tags ?? []).some((t) => activeTags.has(t))) return false;
      if (!needle) return true;
      const hay = `${q.text} ${q.author} ${q.book} ${(q.tags ?? []).join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
    if (sortMode === "author") {
      out = [...out].sort((a, b) => (a.author || "").localeCompare(b.author || "", "zh-Hans-CN"));
    } else if (sortMode === "tag") {
      out = [...out].sort((a, b) => (b.tags?.length ?? 0) - (a.tags?.length ?? 0));
    } else {
      out = [...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return out;
  }, [quotes, search, activeTags, sortMode]);

  const handleAdd = async (data: { text: string; author: string; book: string; tags: string[] }) => {
    await saveQuote({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      text: data.text,
      author: data.author,
      book: data.book,
      readingHours: 0,
      tags: data.tags,
    });
  };

  const toggleTag = (t: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  return (
    <>
      {/* ── Desktop (v5 redesign) ── */}
      <section className="hidden md:block">
        <div className="grid" style={{ gap: 32 }}>
          {/* Section header */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 16 }}>
            <div>
              <div className="v5-eyebrow">MY LIBRARY · 我的金句库</div>
              <h2
                className="v5-display mt-2"
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontVariationSettings: '"opsz" 144',
                  fontWeight: 400,
                  color: "var(--v5-ink)",
                }}
              >
                回看那些打动过你的句子
              </h2>
            </div>
            <span
              style={{
                fontFamily: "var(--v5-mono)",
                fontSize: 12,
                color: "var(--v5-ink3)",
                letterSpacing: "0.06em",
              }}
            >
              共 {quotes.length} 句 · {allTags.length} 条标签
            </span>
          </div>

          <V5FilterBar
            activeTags={activeTags}
            allTags={allTags}
            onAdd={() => setAddOpen(true)}
            onClearTags={() => setActiveTags(new Set())}
            onSearch={setSearch}
            onSortChange={setSortMode}
            onToggleTag={toggleTag}
            search={search}
            sort={sortMode}
          />

          {/* Masonry grid */}
          {filtered.length === 0 ? (
            quotes.length === 0 ? (
              <EmptyState
                description="保存第一条金句后，这里会逐渐变成你的私人灵感墙。"
                icon={Sparkles}
                illustrationAlt="relaxed reading illustration"
                illustrationSrc="/illustrations/relaxed-reading.svg"
                title="还没有收藏金句"
              />
            ) : (
              <div
                className="rounded-[20px] border border-dashed px-6 py-10 text-center"
                style={{ borderColor: "var(--v5-rule-strong)", background: "var(--v5-card)" }}
              >
                <p className="text-sm leading-7" style={{ color: "var(--v5-ink2)" }}>
                  没有匹配的金句。试试换一个关键词或清除筛选。
                </p>
              </div>
            )
          ) : (
            <div className="v5-quote-masonry">
              {filtered.map((quote, i) => (
                <div id={`quote-${quote.id}`} key={quote.id}>
                  <V5QuoteCard
                    onOpen={() => onOpenQuote(quote.id)}
                    quote={quote}
                    variant={pickVariant(quote, i)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <V5AddQuoteModal onClose={() => setAddOpen(false)} onSave={handleAdd} open={addOpen} />
      </section>

      {/* ── Mobile (existing form-based layout) ── */}
      <div className="md:hidden space-y-6">
      {/* ── Quote editor — journal-style writing surface ── */}
      <StaggerItem index={0}>
        <form
          className="relative overflow-hidden rounded-[32px] p-5 sm:p-7 lg:p-9"
          onSubmit={onSubmit}
          style={{
            background:
              "linear-gradient(180deg, rgba(255,252,246,0.98), rgba(249,240,225,0.96)), linear-gradient(90deg, rgba(165,106,67,0.045) 1px, transparent 1px)",
            backgroundSize: "auto, 44px 44px",
            border: "1px solid rgba(139,94,60,0.12)",
            boxShadow: "0 30px 70px rgba(122,79,43,0.13)",
          }}
        >
          {/* Header + save button */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                <QuoteIcon size={14} />
                NEW QUOTE
              </p>
              <h2 className="mt-2 text-2xl font-semibold" style={{ color: "var(--m-ink)" }}>
                记录一句值得回看的话
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--m-ink2)" }}>
                写下那些触动你的智慧、观点或力量。
              </p>
            </div>
            <Button disabled={!text.trim()} size="lg" type="submit" variant="primary">
              <Save className="mr-1.5" size={15} />
              收藏这句话
            </Button>
          </div>

          <div className="space-y-0">
            {/* Main writing area — seamless lined paper, no border */}
            <section className="relative">
              <Textarea
                className="min-h-[180px] w-full resize-none border-0 bg-transparent px-2 py-4 text-[17px] leading-[36px] outline-none focus:ring-0 sm:px-4 sm:py-5 sm:text-[18px]"
                onChange={(e) => setText(e.target.value)}
                placeholder="在这里写下那句打动你的话…"
                required
                style={{
                  backgroundImage: "repeating-linear-gradient(180deg, transparent, transparent 35px, rgba(139,94,60,0.07) 35px, rgba(139,94,60,0.07) 36px)",
                  backgroundPositionY: "35px",
                  fontFamily: '"Noto Serif SC", "Songti SC", "KaiTi", serif',
                  color: "var(--m-ink)",
                  caretColor: "var(--m-accent)",
                }}
                value={text}
              />
              <div className="flex justify-end px-2 pb-2 text-xs" style={{ color: "var(--m-ink3)" }}>
                {text.length} 字
              </div>
            </section>

            {/* Elegant divider */}
            <div className="flex items-center gap-4 py-5">
              <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(139,94,60,0.12), transparent)" }} />
              <QuoteIcon size={12} style={{ color: "rgba(139,94,60,0.25)" }} />
              <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(139,94,60,0.12), transparent)" }} />
            </div>

            {/* Author + source — borderless underline inputs */}
            <section className="grid gap-6 sm:grid-cols-2 sm:gap-8">
              <div className="group">
                <label className="mb-2 flex items-center gap-2 text-xs tracking-wider" style={{ color: "var(--m-ink3)" }}>
                  <PencilLine size={13} />
                  作者
                </label>
                <input
                  className="w-full border-0 border-b bg-transparent pb-2 text-[15px] outline-none transition-colors placeholder:text-[rgba(139,94,60,0.28)] focus:border-b-2"
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="留下名字"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(139,94,60,0.15)",
                    borderBottomStyle: "solid",
                    color: "var(--m-ink)",
                    fontFamily: '"Noto Serif SC", "Songti SC", serif',
                  }}
                  type="text"
                  value={author}
                />
              </div>
              <div className="group">
                <label className="mb-2 flex items-center gap-2 text-xs tracking-wider" style={{ color: "var(--m-ink3)" }}>
                  <Bookmark size={13} />
                  出处
                </label>
                <input
                  className="w-full border-0 border-b bg-transparent pb-2 text-[15px] outline-none transition-colors placeholder:text-[rgba(139,94,60,0.28)] focus:border-b-2"
                  onChange={(e) => setBook(e.target.value)}
                  placeholder="书籍、文章或演讲"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(139,94,60,0.15)",
                    borderBottomStyle: "solid",
                    color: "var(--m-ink)",
                    fontFamily: '"Noto Serif SC", "Songti SC", serif',
                  }}
                  type="text"
                  value={book}
                />
              </div>
            </section>

            {/* Tags — minimal inline */}
            <section className="pt-6">
              <label className="mb-2 flex items-center gap-2 text-xs tracking-wider" style={{ color: "var(--m-ink3)" }}>
                <Tag size={13} />
                标签
              </label>
              <input
                className="w-full border-0 border-b bg-transparent pb-2 text-[15px] outline-none transition-colors placeholder:text-[rgba(139,94,60,0.28)] focus:border-b-2"
                onChange={(e) => setTags(e.target.value)}
                placeholder="思想, 成长, 勇气, 平静"
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(139,94,60,0.15)",
                  borderBottomStyle: "solid",
                  color: "var(--m-ink)",
                }}
                type="text"
                value={tags}
              />
              {tagList.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tagList.map((t) => (
                    <span
                      key={t}
                      className="rounded-full px-3 py-1 text-[11px] tracking-wide"
                      style={{ background: "rgba(139,94,60,0.06)", color: "var(--m-accent)", border: "1px solid rgba(139,94,60,0.08)" }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>

          {message && (
            <p className="mt-4 text-center text-sm" style={{ color: "var(--m-success)" }}>
              {message}
            </p>
          )}
        </form>
      </StaggerItem>

      {/* ── Quote wall ── */}
      {quotes.length === 0 ? (
        <EmptyState
          description="保存第一条金句后，这里会逐渐变成你的私人灵感墙。"
          icon={Sparkles}
          illustrationAlt="relaxed reading illustration"
          illustrationSrc="/illustrations/relaxed-reading.svg"
          title="还没有收藏金句"
        />
      ) : (
        <StaggerItem index={1}>
          <div>
            <h3 className="mb-4" style={{ fontSize: 16, color: "var(--m-ink)", fontWeight: 600 }}>
              我的金句库
              <span className="ml-2" style={{ fontSize: 14, color: "var(--m-ink3)", fontWeight: 400 }}>
                {quotes.length} 句
              </span>
            </h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {quotes.map((quote) => (
                <div key={quote.id} id={`quote-${quote.id}`}>
                  <QuoteCard onOpen={() => onOpenQuote(quote.id)} quote={quote} />
                </div>
              ))}
            </div>
          </div>
        </StaggerItem>
      )}
      </div>
    </>
  );
}

// ── Notes section — journal style matching QuotesSection ──────
function ReadingNotebookSection() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const notes = useNotesStore();

  useEffect(() => {
    void refreshNotes();
  }, []);

  const sortedNotes = useMemo(() => [...notes].reverse(), [notes]);
  const tagList = useMemo(
    () => tags.split(/[,\s，、]+/).map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
    [tags],
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((cur) => cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note: Note = {
      id: crypto.randomUUID(),
      title: title.trim(),
      content: content.trim(),
      tags: tagList,
    };
    saveNote(note);
    setTitle("");
    setContent("");
    setTags("");
    setMessage("阅读笔记已保存。");
  };

  return (
    <div className="space-y-6">
      {/* ── Note editor — journal-style writing surface ── */}
      <StaggerItem index={0}>
        <form
          className="relative overflow-hidden rounded-[32px] p-5 sm:p-7 lg:p-9"
          onSubmit={onSubmit}
          style={{
            background:
              "linear-gradient(180deg, rgba(255,252,246,0.98), rgba(249,240,225,0.96)), linear-gradient(90deg, rgba(165,106,67,0.045) 1px, transparent 1px)",
            backgroundSize: "auto, 44px 44px",
            border: "1px solid rgba(139,94,60,0.12)",
            boxShadow: "0 30px 70px rgba(122,79,43,0.13)",
          }}
        >
          {/* Header + save button */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                <Brain size={14} />
                READING NOTE
              </p>
              <h2 className="mt-2 text-2xl font-semibold" style={{ color: "var(--m-ink)" }}>
                写下一则阅读笔记
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--m-ink2)" }}>
                把读到的线索、疑问和触动放进这一页。
              </p>
            </div>
            <Button disabled={!title.trim() || !content.trim()} size="lg" type="submit" variant="primary">
              <Save className="mr-1.5" size={15} />
              保存笔记
            </Button>
          </div>

          <div className="space-y-0">
            {/* Title — borderless underline input */}
            <section className="pb-4">
              <label className="mb-2 flex items-center gap-2 text-xs tracking-wider" style={{ color: "var(--m-ink3)" }}>
                <PencilLine size={13} />
                标题
              </label>
              <input
                className="w-full border-0 border-b bg-transparent pb-2 text-xl font-semibold outline-none transition-colors placeholder:text-[rgba(139,94,60,0.28)] focus:border-b-2"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="这段阅读想回答什么问题？"
                required
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(139,94,60,0.15)",
                  borderBottomStyle: "solid",
                  color: "var(--m-ink)",
                  fontFamily: '"Noto Serif SC", "Songti SC", serif',
                }}
                type="text"
                value={title}
              />
            </section>

            {/* Elegant divider */}
            <div className="flex items-center gap-4 py-4">
              <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(139,94,60,0.12), transparent)" }} />
              <Brain size={12} style={{ color: "rgba(139,94,60,0.25)" }} />
              <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(139,94,60,0.12), transparent)" }} />
            </div>

            {/* Main writing area — seamless lined paper, no border */}
            <section className="relative">
              <Textarea
                className="min-h-[240px] w-full resize-none border-0 bg-transparent px-2 py-4 text-[17px] leading-[36px] outline-none focus:ring-0 sm:min-h-[320px] sm:px-4 sm:py-5 sm:text-[18px]"
                onChange={(e) => setContent(e.target.value)}
                placeholder="写下你的摘录、理解、疑问，或者读完以后还在心里回响的一句话…"
                required
                style={{
                  backgroundImage: "repeating-linear-gradient(180deg, transparent, transparent 35px, rgba(139,94,60,0.07) 35px, rgba(139,94,60,0.07) 36px)",
                  backgroundPositionY: "35px",
                  fontFamily: '"Noto Serif SC", "Songti SC", "KaiTi", serif',
                  color: "var(--m-ink)",
                  caretColor: "var(--m-accent)",
                }}
                value={content}
              />
              <div className="flex justify-end px-2 pb-2 text-xs" style={{ color: "var(--m-ink3)" }}>
                {content.length} 字
              </div>
            </section>

            {/* Tags — minimal inline */}
            <section className="pt-4">
              <label className="mb-2 flex items-center gap-2 text-xs tracking-wider" style={{ color: "var(--m-ink3)" }}>
                <Tag size={13} />
                标签
              </label>
              <input
                className="w-full border-0 border-b bg-transparent pb-2 text-[15px] outline-none transition-colors placeholder:text-[rgba(139,94,60,0.28)] focus:border-b-2"
                onChange={(e) => setTags(e.target.value)}
                placeholder="结构, 反思, 阅读, 成长"
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(139,94,60,0.15)",
                  borderBottomStyle: "solid",
                  color: "var(--m-ink)",
                }}
                type="text"
                value={tags}
              />
              {tagList.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tagList.map((t) => (
                    <span
                      key={t}
                      className="rounded-full px-3 py-1 text-[11px] tracking-wide"
                      style={{ background: "rgba(139,94,60,0.06)", color: "var(--m-accent)", border: "1px solid rgba(139,94,60,0.08)" }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>

          {message && (
            <p className="mt-4 text-center text-sm" style={{ color: "var(--m-success)" }}>
              {message}
            </p>
          )}
        </form>
      </StaggerItem>

      {/* ── Notes list ── */}
      {sortedNotes.length === 0 ? (
        <EmptyState
          description="你的阅读笔记会在这里慢慢沉淀成一条个人专栏。写下第一篇后，阅读流就会开始形成。"
          icon={Sparkles}
          illustrationAlt="thinking notebook illustration"
          illustrationSrc="/illustrations/reading-time.svg"
          title="还没有阅读笔记"
        />
      ) : (
        <StaggerItem index={1}>
          <div>
            <h3 className="mb-4" style={{ fontSize: 16, color: "var(--m-ink)", fontWeight: 600 }}>
              我的笔记
              <span className="ml-2" style={{ fontSize: 14, color: "var(--m-ink3)", fontWeight: 400 }}>
                {sortedNotes.length} 篇
              </span>
            </h3>
            <div className="space-y-4">
              {sortedNotes.map((note) => {
                const isExpanded = expandedIds.includes(note.id);
                return (
                  <div
                    key={note.id}
                    className="group relative break-inside-avoid"
                    style={{
                      background: "var(--m-base-light)",
                      borderRadius: 16,
                      border: "1px solid var(--m-rule)",
                      padding: "20px 20px 16px",
                      transition: "all 0.25s ease",
                      boxShadow: "0 1px 4px rgba(139,94,60,0.06)",
                    }}
                  >
                    <h4
                      className="text-lg font-semibold leading-tight"
                      style={{ color: "var(--m-ink)" }}
                    >
                      {note.title}
                    </h4>
                    <p
                      className="mt-3 whitespace-pre-wrap text-[15px] leading-8"
                      style={isExpanded
                        ? { color: "var(--m-ink2)" }
                        : { color: "var(--m-ink2)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden" }}
                    >
                      {note.content}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {note.tags.map((tag) => (
                          <span
                            className="rounded-full px-3 py-1 text-xs"
                            key={`${note.id}-${tag}`}
                            style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <button
                        className="rounded-full px-4 py-1.5 text-sm transition-all hover:opacity-80"
                        onClick={() => toggleExpanded(note.id)}
                        style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
                        type="button"
                      >
                        {isExpanded ? "收起" : "展开阅读"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </StaggerItem>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("quotes");
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [quoteModalId, setQuoteModalId] = useState<string | null>(null);
  const [quoteModalKey, setQuoteModalKey] = useState(0);
  const [todayPickIndex, setTodayPickIndex] = useState(0);
  const quotes = useQuotesStore();
  const notes = useNotesStore();

  useEffect(() => {
    void refreshQuotes();
    void refreshNotes();
  }, []);

  const onOpenQuote = (id: string) => {
    setQuoteModalId(id);
    setQuoteModalKey((k) => k + 1);
  };

  const dailyQuote = getDailyQuote(quotes);
  const todaysPick = quotes.length > 0
    ? (todayPickIndex === 0 ? dailyQuote : quotes[todayPickIndex % quotes.length])
    : null;

  return (
    <>
      {/* Desktop (v5) header + TodaysPick — sit above tabs */}
      <div className="hidden md:block" style={{ marginBottom: 32 }}>
        <div className="grid" style={{ gap: 32 }}>
          <V5PageHeader />
          <V5TodaysPick
            onSaveToday={() => todaysPick && onOpenQuote(todaysPick.id)}
            onShuffle={() => setTodayPickIndex((i) => i + 1)}
            quote={todaysPick}
          />
        </div>
      </div>

      <PageTransition className="space-y-6">
        {/* Mobile keeps the old PageTitle header */}
        <div className="md:hidden">
          <PageTitle
            description="把值得反复回看的句子和阅读笔记，收进同一座灵感书库里。"
            eyebrow="灵感书库"
            icon={Lightbulb}
            title="灵感书库"
          />
        </div>

        <TabBar active={activeTab} onChange={(t) => { setActiveTab(t); setScrollToId(null); }} />

        {activeTab === "archive" && (
          <ArchiveSection notes={notes} onOpenQuote={onOpenQuote} quotes={quotes} />
        )}
        {activeTab === "quotes" && <QuotesSection onOpenQuote={onOpenQuote} scrollToId={scrollToId} />}
        {activeTab === "notes" && <ReadingNotebookSection />}
      </PageTransition>

      {/* Quote stack modal */}
      <AnimatePresence mode="wait">
        {quoteModalId && quotes.length > 0 && (
          <QuoteStackModal
            key={quoteModalKey}
            allQuotes={quotes}
            initialId={quoteModalId}
            onClose={() => setQuoteModalId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
