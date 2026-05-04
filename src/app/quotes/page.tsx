"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Lightbulb,
  PencilLine,
  Plus,
  Quote as QuoteIcon,
  Save,
  Search,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
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
} from "@/lib/quote-classify";
import { refreshNotes, refreshQuotes, saveNote, saveQuote, updateQuote } from "@/lib/storage";
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

// ── Tab segmented control ──────────────────────────────────────
function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; Icon: typeof Lightbulb }[] = [
    { id: "quotes", label: "书海拾金", Icon: Lightbulb },
    { id: "notes", label: "阅读笔记", Icon: Brain },
    { id: "archive", label: "收藏归档", Icon: FolderOpen },
  ];

  return (
    <div
      className="inline-flex rounded-xl p-1"
      style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-medium transition-all duration-200"
            key={id}
            onClick={() => onChange(id)}
            style={
              isActive
                ? {
                    background: "var(--m-base-light)",
                    boxShadow: "var(--m-shadow-out)",
                    color: "var(--m-accent)",
                  }
                : { color: "var(--m-ink3)" }
            }
            type="button"
          >
            <Icon size={14} />
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
  const isAuto = !quote.themeCategory;

  const onPick = async (label: string) => {
    await updateQuote({ ...quote, themeCategory: label });
    setPickerOpen(false);
  };

  return (
    <Panel
      className="p-5"
      interactive
      onClick={onOpen}
      style={{ cursor: onOpen ? "pointer" : undefined }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1 shrink-0 rounded-xl p-2"
          style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", boxShadow: "var(--m-shadow-out)", color: "var(--m-accent)" }}
        >
          <QuoteIcon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="leading-7" style={{ color: "var(--m-ink)" }}>{quote.text}</p>
          <p className="mt-3 text-sm" style={{ color: "var(--m-ink2)" }}>
            {quote.author || "佚名"}{quote.book ? ` · ${quote.book}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Theme chip */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
              style={{
                background: isAuto ? "var(--m-base)" : "rgba(139,94,60,0.08)",
                border: `1px solid ${isAuto ? "var(--m-rule)" : "rgba(139,94,60,0.2)"}`,
                color: isAuto ? "var(--m-ink3)" : "var(--m-accent)",
              }}
            >
              <span>{getThemeIcon(currentTheme)}</span>
              {currentTheme}
              {isAuto && <span style={{ opacity: 0.6 }}>· 自动</span>}
            </span>

            {/* Tag chips */}
            {quote.tags.map((tag) => (
              <span className="rounded-full px-3 py-1 text-xs" key={`${quote.id}-${tag}`}
                style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}>
                #{tag}
              </span>
            ))}
          </div>

          <button
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium hover:opacity-80"
            onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
            type="button"
            style={{ color: "var(--m-accent)" }}
          >
            <Sparkles size={12} />
            加入我的认知体系
          </button>
        </div>
      </div>

      <ThemePickerDialog
        current={currentTheme}
        onClose={() => setPickerOpen(false)}
        onPick={onPick}
        open={pickerOpen}
      />
    </Panel>
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
    <Panel className="p-6" interactive>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
            WEEKLY · 认知卡片
          </p>
          <h3 className="mt-1.5 text-base font-semibold" style={{ color: "var(--m-ink)" }}>
            本周你收藏了 {weekly.length} 条金句
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--m-ink2)" }}>
            主要集中在：
            {themeCounts.slice(0, 3).map((t, i) => (
              <span key={t.label} style={{ color: "var(--m-accent)" }}>
                {i > 0 ? "、" : " "}
                {t.label} ({t.count} 条)
              </span>
            ))}
          </p>
        </div>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
        >
          <Sparkles size={18} />
        </span>
      </div>

      {generated ? (
        <div
          className="mt-4 rounded-2xl px-4 py-4"
          style={{ background: "var(--m-base)", boxShadow: "var(--m-shadow-in)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
            本周你的核心认知
          </p>
          <ol className="mt-2 space-y-1.5">
            {generated.summary.map((line, i) => (
              <li className="text-sm leading-6" key={i} style={{ color: "var(--m-ink)" }}>
                <span style={{ color: "var(--m-accent)" }}>{i + 1}. </span>
                {line}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <button
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          onClick={generate}
          type="button"
          style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)", border: "1px solid rgba(139,94,60,0.2)" }}
        >
          <Sparkles size={14} />
          生成认知总结卡
        </button>
      )}
    </Panel>
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
  const themes = useMemo(() => ["全部", ...getAllThemeLabels()], []);
  const [filterTab, setFilterTab] = useState<string>("全部");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ text: string; author: string; book: string; tags: string } | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Re-anchor index when filter changes
  useEffect(() => {
    const idx = filteredQuotes.findIndex((q) => q.id === currentIdRef.current);
    setCurrentIndex(idx >= 0 ? idx : 0);
  }, [filteredQuotes]);

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

  // Swipe / drag
  const dragRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Don't capture pointer when user taps an interactive element (button, link, input…)
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [role='button']")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    const dt = Date.now() - dragRef.current.t;
    dragRef.current = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 450) {
      if (dx < 0) goNext(); else goPrev();
    }
  }, [goNext, goPrev]);
  const onPointerCancel = useCallback(() => { dragRef.current = null; }, []);

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
        <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-3">
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
        <div className="shrink-0 overflow-x-auto pb-4 px-4" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-2 w-max">
            {themes.map((theme) => {
              const isActive = filterTab === theme;
              return (
                <button
                  key={theme}
                  className="shrink-0 rounded-full px-4 py-1.5 text-sm transition-all"
                  onClick={() => { setFilterTab(theme); setIsEditing(false); }}
                  type="button"
                  style={{
                    background: isActive ? "rgba(250,247,240,0.92)" : "rgba(250,247,240,0.10)",
                    color: isActive ? "#4A3022" : "rgba(250,247,240,0.60)",
                    fontFamily: "ui-sans-serif,sans-serif",
                    border: `1px solid ${isActive ? "transparent" : "rgba(250,247,240,0.10)"}`,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {theme === "全部" ? "全部" : `${getThemeIcon(theme)} ${theme}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Card stack ── */}
        <div
          className="relative flex flex-1 items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{ userSelect: "none", overflow: "hidden" }}
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
      </div>
    </motion.div>
  );
}

// ── Archive section (folders + search + cognitive card) ───────
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

  return (
    <div className="space-y-5">
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
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    await saveQuote(quote);
    setText(""); setAuthor(""); setBook(""); setTags("");
    setMessage("已保存到你的灵感书库。");
  };

  return (
    <div className="space-y-5">
      {/* Daily quote */}
      <StaggerItem index={0}>
        <Panel className="relative overflow-hidden p-6 sm:p-7" interactive>
          <div className="relative grid items-center gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em]" style={{ color: "var(--m-ink2)" }}>
                今日推荐
              </p>
              {dailyQuote ? (
                <>
                  <div className="mt-3 flex gap-2">
                    <QuoteIcon className="mt-1 shrink-0" size={18} style={{ color: "var(--m-accent)" }} />
                    <p className="text-lg leading-8" style={{ color: "var(--m-ink)" }}>
                      {dailyQuote.text}
                    </p>
                  </div>
                  <p className="mt-3 text-sm italic" style={{ color: "var(--m-ink2)" }}>
                    {dailyQuote.author || "佚名"}
                    {dailyQuote.book ? ` · ${dailyQuote.book}` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm" style={{ color: "var(--m-ink2)" }}>
                  保存第一条金句后，这里会出现今天的推荐语录。
                </p>
              )}
            </div>
            <Illustration
              alt="books and ideas illustration"
              className="mx-auto w-full max-w-[250px]"
              src="/illustrations/ideas.svg"
            />
          </div>
        </Panel>
      </StaggerItem>

      {/* Add quote form */}
      <StaggerItem index={1}>
        <Panel className="p-6">
          <div className="border-b border-dashed pb-5" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
            <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>NEW QUOTE</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
              收录一句值得回看的话
            </h2>
          </div>
          <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              金句内容
              <Textarea
                className="min-h-28"
                onChange={(e) => setText(e.target.value)}
                placeholder="写下一句值得反复回看的话..."
                required
                value={text}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                作者
                <Input onChange={(e) => setAuthor(e.target.value)} placeholder="作者姓名" type="text" value={author} />
              </label>
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                书名 / 来源
                <Input onChange={(e) => setBook(e.target.value)} placeholder="书籍、影视或文章来源" type="text" value={book} />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              标签
              <Input onChange={(e) => setTags(e.target.value)} placeholder="心态, 勇气, 平静" type="text" value={tags} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" type="submit" variant="primary">保存</Button>
              {message && <span className="text-sm" style={{ color: "var(--m-success)" }}>{message}</span>}
            </div>
          </form>
        </Panel>
      </StaggerItem>

      {/* Quote cards */}
      {quotes.length === 0 ? (
        <EmptyState
          description="保存第一条金句后，这里会逐渐变成你的私人提醒墙。"
          icon={Sparkles}
          illustrationAlt="relaxed reading illustration"
          illustrationSrc="/illustrations/relaxed-reading.svg"
          title="还没有收藏金句"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {quotes.map((quote, index) => (
            <StaggerItem index={index} key={quote.id}>
              <div id={`quote-${quote.id}`}>
                <QuoteCard onOpen={() => onOpenQuote(quote.id)} quote={quote} />
              </div>
            </StaggerItem>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notes section ──────────────────────────────────────────────
function NotesSection() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const notes = useNotesStore();
  useEffect(() => { refreshNotes(); }, []);

  const sortedNotes = useMemo(() => [...notes].reverse(), [notes]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((cur) => cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note: Note = {
      id: crypto.randomUUID(),
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    saveNote(note);
    setTitle(""); setContent(""); setTags("");
    setMessage("笔记已保存，继续把想法慢慢写清楚。");
  };

  return (
    <div className="space-y-5">
      {/* Add note form */}
      <Panel className="p-6 md:p-7">
        <div className="border-b border-dashed pb-5" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
          <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>NEW NOTE</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
            写下一则阅读笔记
          </h2>
          <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
            慢一点，把读到的线索、疑问和触动写下来，它们会在复盘里慢慢长出结构。
          </p>
        </div>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            标题
            <Input onChange={(e) => setTitle(e.target.value)} placeholder="这篇文章想回答什么问题？" required type="text" value={title} />
          </label>
          <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            内容
            <Textarea
              className="min-h-56"
              onChange={(e) => setContent(e.target.value)}
              placeholder="把你的书评、摘录理解或者阅读后的想法写下来..."
              required
              value={content}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            标签
            <Input onChange={(e) => setTags(e.target.value)} placeholder="结构化, 反思, 阅读" type="text" value={tags} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" type="submit" variant="secondary">保存笔记</Button>
            {message && <span className="text-sm" style={{ color: "var(--m-success)" }}>{message}</span>}
          </div>
        </form>
      </Panel>

      {/* Notes list */}
      {sortedNotes.length === 0 ? (
        <EmptyState
          description="你的阅读笔记会在这里慢慢沉淀成一条个人专栏。写下第一篇后，阅读流就会开始形成。"
          icon={Sparkles}
          illustrationAlt="thinking notebook illustration"
          illustrationSrc="/illustrations/reading-time.svg"
          title="还没有阅读笔记"
        />
      ) : (
        <div className="space-y-4">
          {sortedNotes.map((note) => {
            const isExpanded = expandedIds.includes(note.id);
            return (
              <Panel className="p-6 md:p-7" interactive key={note.id}>
                <div className="border-b border-dashed pb-4" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
                  <h3 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.04em]" style={{ color: "var(--m-ink)" }}>
                    {note.title}
                  </h3>
                </div>
                <p
                  className="mt-5 text-[15px] leading-8"
                  style={isExpanded
                    ? { color: "var(--m-ink2)" }
                    : { color: "var(--m-ink2)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden" }}
                >
                  {formatPreview(note.content)}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {note.tags.map((tag) => (
                      <span className="rounded-full px-3 py-1 text-xs" key={`${note.id}-${tag}`}
                        style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <button
                    className="rounded-full px-4 py-2 text-sm transition-all"
                    onClick={() => toggleExpanded(note.id)}
                    style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
                    type="button"
                  >
                    {isExpanded ? "收起" : "展开阅读"}
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("quotes");
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [quoteModalId, setQuoteModalId] = useState<string | null>(null);
  const [quoteModalKey, setQuoteModalKey] = useState(0);
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

  return (
    <>
      <PageTransition className="space-y-6">
        <PageTitle
          description="把值得反复回看的句子和阅读笔记，收进同一座灵感书库里。"
          eyebrow="灵感书库"
          icon={Lightbulb}
          title="灵感书库"
        />

        <TabBar active={activeTab} onChange={(t) => { setActiveTab(t); setScrollToId(null); }} />

        {activeTab === "archive" && (
          <ArchiveSection notes={notes} onOpenQuote={onOpenQuote} quotes={quotes} />
        )}
        {activeTab === "quotes" && <QuotesSection onOpenQuote={onOpenQuote} scrollToId={scrollToId} />}
        {activeTab === "notes" && <NotesSection />}
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
