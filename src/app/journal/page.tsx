"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Loader2,
  PencilLine,
  Save,
  Smile,
  Tag,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/date";
import { refreshDailyLogs, updateDailyLog } from "@/lib/storage";
import { useDailyLogsStore } from "@/lib/storage-store";
import type { DailyLog } from "@/types";

interface EditState {
  date: string;
  mood: number;
  thoughts: string;
  tags: string;
  images: string[];
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toEditState(entry: DailyLog): EditState {
  return {
    date: entry.date,
    mood: entry.mood,
    thoughts: entry.thoughts,
    tags: entry.tags.join(", "),
    images: entry.images ?? [],
  };
}

// Mood → washi-paper tint + label
function moodMeta(score: number): { label: string; color: string; bg: string } {
  if (score >= 8) return { label: "心情很好", color: "#4A9B6F", bg: "rgba(74,155,111,0.08)" };
  if (score >= 6) return { label: "状态平稳", color: "#D4A42A", bg: "rgba(212,164,42,0.08)" };
  if (score >= 4) return { label: "有些疲惫", color: "#C07A3A", bg: "rgba(192,122,58,0.08)" };
  return { label: "心情低落", color: "#C0392B", bg: "rgba(192,57,43,0.08)" };
}

// ── Polaroid image ────────────────────────────────────────────────────────────

function PolaroidImage({ src, index, alt }: { src: string; index: number; alt: string }) {
  const angle = index % 3 === 0 ? -2.2 : index % 3 === 1 ? 1.8 : -0.8;
  return (
    <motion.a
      href={src}
      rel="noopener noreferrer"
      target="_blank"
      className="block"
      style={{ transform: `rotate(${angle}deg)`, transformOrigin: "center bottom" }}
      whileHover={{ scale: 1.04, rotate: 0, transition: { duration: 0.2 } }}
    >
      <div
        style={{
          background: "#fff",
          padding: "9px 9px 32px",
          borderRadius: 4,
          boxShadow: "0 6px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)",
          width: 160,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          src={src}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "1",
            objectFit: "cover",
            borderRadius: 2,
          }}
        />
      </div>
    </motion.a>
  );
}

// ── Main inner component ──────────────────────────────────────────────────────

function JournalDetailPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

  const logs = useDailyLogsStore();
  const [isSyncing, setIsSyncing] = useState(true);
  const hasSynced = useRef(false);

  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<EditState | null>(null);

  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;
    void refreshDailyLogs({ force: true }).finally(() => setIsSyncing(false));
  }, []);

  const entry = useMemo(() => logs.find((log) => log.id === id), [logs, id]);

  const goBack = () => {
    if (window.history.length > 1) { router.back(); return; }
    router.push("/daily-log");
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isSyncing && !entry) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-[680px]"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Panel className="flex items-center gap-3 p-7" style={{ color: "var(--m-ink2)" }}>
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">正在加载日记...</span>
        </Panel>
      </motion.div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (!entry) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-[680px]"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Panel className="space-y-5 p-7">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--m-ink)" }}>
            未找到这条日记
          </h1>
          <p className="text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
            这条记录可能已被删除，或者当前链接中的 id 无效。
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={goBack} variant="ghost">
              <ArrowLeft className="mr-2" size={16} />
              返回
            </Button>
            <Button onClick={() => router.push("/daily-log")} variant="primary">
              去写日记
            </Button>
          </div>
        </Panel>
      </motion.div>
    );
  }

  // ── Save handler ─────────────────────────────────────────────────────────────
  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setIsSaving(true);
    const nextLog: DailyLog = {
      ...entry,
      date: form.date,
      mood: Math.min(10, Math.max(1, form.mood)),
      studyHours: entry.studyHours,
      reading: entry.reading,
      thoughts: form.thoughts.trim(),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      images: form.images,
    };
    const result = await updateDailyLog(nextLog);
    setMessage(result.synced ? "修改已保存，并同步到云端。" : "修改已保存到本地缓存，云端同步稍后重试。");
    setIsSaving(false);
    setIsEditing(false);
  };

  const mood = moodMeta(entry.mood);
  const hasImages = entry.images && entry.images.length > 0;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-[680px] space-y-5"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.38, ease: "easeOut" }}
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={goBack} variant="ghost">
          <ArrowLeft className="mr-2" size={16} />
          返回
        </Button>
        <Button
          onClick={() => {
            if (isEditing) { setIsEditing(false); setMessage(""); return; }
            setForm(toEditState(entry));
            setIsEditing(true);
          }}
          variant="secondary"
        >
          <PencilLine className="mr-2" size={16} />
          {isEditing ? "取消编辑" : "编辑"}
        </Button>
      </div>

      {/* ── Edit form ── */}
      {isEditing && form ? (
        <Panel className="p-6 sm:p-8">
          <form className="space-y-5" onSubmit={onSave}>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--m-ink)" }}>编辑日记</h1>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                日期
                <Input onChange={(e) => setForm({ ...form, date: e.target.value })} type="date" value={form.date} />
              </label>
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                情绪分数（1-10）
                <Input
                  max={10} min={1}
                  onChange={(e) => setForm({ ...form, mood: Number(e.target.value) || 1 })}
                  type="number"
                  value={form.mood}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                标签
                <Input onChange={(e) => setForm({ ...form, tags: e.target.value })} type="text" value={form.tags} />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              完整日记内容
              <Textarea className="min-h-44" onChange={(e) => setForm({ ...form, thoughts: e.target.value })} value={form.thoughts} />
            </label>
            <div className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              图片
              <ImageUploader images={form.images} onChange={(imgs) => setForm({ ...form, images: imgs })} />
            </div>
            <div className="flex items-center gap-3">
              <Button disabled={isSaving} type="submit" variant="primary">
                <Save className="mr-2" size={16} />
                {isSaving ? "保存中..." : "保存修改"}
              </Button>
              {message && <span className="text-sm" style={{ color: "var(--m-success)" }}>{message}</span>}
            </div>
          </form>
        </Panel>
      ) : (
        /* ── Immersive read view ── */
        <Panel className="overflow-hidden p-0">
          {/* Header band */}
          <div
            className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 sm:px-8"
            style={{ borderBottom: "1px solid var(--m-rule)" }}
          >
            <div className="space-y-1">
              <h1
                className="text-2xl font-semibold tracking-tight"
                style={{ color: "var(--m-ink)" }}
              >
                {formatDate(entry.date)}
              </h1>
              <p
                className="inline-flex items-center gap-2 text-xs"
                style={{ color: "var(--m-ink3)" }}
              >
                <Clock3 size={13} />
                {formatTimestamp(entry.createdAt)}
              </p>
            </div>

            {/* Mood badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
              style={{ background: mood.bg, color: mood.color }}
            >
              <Smile size={15} />
              {entry.mood}/10 · {mood.label}
            </div>
          </div>

          {/* Body */}
          <div className="space-y-7 px-6 py-7 sm:px-8 sm:py-8">
            {/* Prose */}
            <p
              className="whitespace-pre-wrap text-[16px] leading-[2.05]"
              style={{
                color: "var(--m-ink)",
                fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
                minHeight: 80,
              }}
            >
              {entry.thoughts || (
                <span style={{ color: "var(--m-ink3)" }}>
                  （这一天只留下了一段安静的空白）
                </span>
              )}
            </p>

            {/* Tags */}
            {entry.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Tag size={13} style={{ color: "var(--m-ink3)" }} />
                {entry.tags.map((tag) => (
                  <span
                    key={`${entry.id}-${tag}`}
                    className="rounded-full px-3 py-0.5 text-xs"
                    style={{
                      background: "rgba(139,94,60,0.08)",
                      border: "1px solid var(--m-rule)",
                      color: "var(--m-ink2)",
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Polaroid images */}
            {hasImages && (
              <div>
                <p
                  className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.12em]"
                  style={{ color: "var(--m-ink3)" }}
                >
                  <CalendarDays size={13} />
                  那天的影像
                </p>
                <div className="flex flex-wrap gap-6">
                  {entry.images!.map((src, i) => (
                    <PolaroidImage
                      key={i}
                      alt={`日记图片 ${i + 1}`}
                      index={i}
                      src={src}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Footer meta */}
            <div
              className="rounded-xl px-4 py-3 text-xs"
              style={{
                background: "var(--m-base)",
                border: "1px solid var(--m-rule)",
                color: "var(--m-ink3)",
              }}
            >
              {formatDate(entry.date)} · 情绪 {entry.mood}/10
              {entry.studyHours > 0 && ` · 学习 ${entry.studyHours}h`}
            </div>
          </div>
        </Panel>
      )}
    </motion.div>
  );
}

// ── Fallback ──────────────────────────────────────────────────────────────────

function JournalPageFallback() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-[680px]"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Panel className="flex items-center gap-3 p-7" style={{ color: "var(--m-ink2)" }}>
        <Loader2 className="animate-spin" size={18} />
        <span className="text-sm">正在加载日记...</span>
      </Panel>
    </motion.div>
  );
}

export default function JournalDetailPage() {
  return (
    <Suspense fallback={<JournalPageFallback />}>
      <JournalDetailPageInner />
    </Suspense>
  );
}
