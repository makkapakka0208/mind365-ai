"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Clock3, Loader2, PencilLine, Save } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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
  studyHours: number;
  thoughts: string;
  tags: string;
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

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
    studyHours: entry.studyHours,
    thoughts: entry.thoughts,
    tags: entry.tags.join(", "),
  };
}

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

    void refreshDailyLogs({ force: true }).finally(() => {
      setIsSyncing(false);
    });
  }, []);

  const entry = useMemo(() => logs.find((log) => log.id === id), [logs, id]);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/timeline");
  };

  if (isSyncing && !entry) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-[720px]"
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

  if (!entry) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-[720px]"
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

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form) {
      return;
    }

    setIsSaving(true);

    const nextLog: DailyLog = {
      ...entry,
      date: form.date,
      mood: Math.min(10, Math.max(1, form.mood)),
      studyHours: Number.isFinite(form.studyHours) ? Math.max(0, form.studyHours) : 0,
      reading: entry.reading,
      thoughts: form.thoughts.trim(),
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    const result = await updateDailyLog(nextLog);
    setMessage(result.synced ? "修改已保存，并同步到云端。" : "修改已保存到本地缓存，云端同步稍后重试。");
    setIsSaving(false);
    setIsEditing(false);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-[720px] space-y-5"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={goBack} variant="ghost">
          <ArrowLeft className="mr-2" size={16} />
          返回
        </Button>

        <Button
          onClick={() => {
            if (isEditing) {
              setIsEditing(false);
              setMessage("");
              return;
            }

            setForm(toEditState(entry));
            setIsEditing(true);
          }}
          variant="secondary"
        >
          <PencilLine className="mr-2" size={16} />
          {isEditing ? "取消编辑" : "编辑"}
        </Button>
      </div>

      <Panel className="p-6 sm:p-8 md:p-9">
        {isEditing && form ? (
          <form className="space-y-5" onSubmit={onSave}>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--m-ink)" }}>
              编辑日记
            </h1>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                日期
                <Input
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  type="date"
                  value={form.date}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                情绪分数（1-10）
                <Input
                  max={10}
                  min={1}
                  onChange={(event) => setForm({ ...form, mood: Number(event.target.value) || 1 })}
                  type="number"
                  value={form.mood}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                学习时长
                <Input
                  min={0}
                  onChange={(event) => setForm({ ...form, studyHours: Number(event.target.value) || 0 })}
                  step={0.5}
                  type="number"
                  value={form.studyHours}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                标签
                <Input
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  type="text"
                  value={form.tags}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              完整日记内容
              <Textarea
                className="min-h-44"
                onChange={(event) => setForm({ ...form, thoughts: event.target.value })}
                value={form.thoughts}
              />
            </label>

            <div className="flex items-center gap-3">
              <Button disabled={isSaving} type="submit" variant="primary">
                <Save className="mr-2" size={16} />
                {isSaving ? "保存中..." : "保存修改"}
              </Button>
              {message ? (
                <span className="text-sm" style={{ color: "var(--m-success)" }}>
                  {message}
                </span>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="space-y-7">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
                日记详情
              </h1>
              <p className="mt-2 inline-flex items-center gap-2 text-sm" style={{ color: "var(--m-ink2)" }}>
                <Clock3 size={14} />
                {formatTimestamp(entry.createdAt)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-xl p-4"
                style={{
                  background: "var(--m-base)",
                  border: "1px solid var(--m-rule)",
                  boxShadow: "var(--m-shadow-in)",
                }}
              >
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em]" style={{ color: "var(--m-ink3)" }}>
                  <CalendarDays size={14} />
                  日期
                </p>
                <p className="mt-2 text-base" style={{ color: "var(--m-ink)" }}>
                  {formatDate(entry.date)}
                </p>
              </div>

              <div
                className="rounded-xl p-4"
                style={{
                  background: "var(--m-base)",
                  border: "1px solid var(--m-rule)",
                  boxShadow: "var(--m-shadow-in)",
                }}
              >
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--m-ink3)" }}>
                  情绪分数
                </p>
                <p className="mt-2 text-base" style={{ color: "var(--m-ink)" }}>
                  {entry.mood}/10
                </p>
              </div>

              <div
                className="rounded-xl p-4"
                style={{
                  background: "var(--m-base)",
                  border: "1px solid var(--m-rule)",
                  boxShadow: "var(--m-shadow-in)",
                }}
              >
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--m-ink3)" }}>
                  学习时长
                </p>
                <p className="mt-2 text-base" style={{ color: "var(--m-ink)" }}>
                  {entry.studyHours.toFixed(1)} 小时
                </p>
              </div>

              <div
                className="rounded-xl p-4"
                style={{
                  background: "var(--m-base)",
                  border: "1px solid var(--m-rule)",
                  boxShadow: "var(--m-shadow-in)",
                }}
              >
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--m-ink3)" }}>
                  阅读统计
                </p>
                <p className="mt-2 text-base" style={{ color: "var(--m-ink)" }}>
                  请到灵感书库记录阅读时长
                </p>
              </div>
            </div>

            <div
              className="rounded-xl p-5"
              style={{
                background: "var(--m-base)",
                border: "1px solid var(--m-rule)",
                boxShadow: "var(--m-shadow-in)",
              }}
            >
              <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--m-ink3)" }}>
                完整日记内容
              </p>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8" style={{ color: "var(--m-ink)" }}>
                {entry.thoughts || "这一天还没有写下具体内容。"}
              </p>
            </div>

            {entry.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <span
                    className="rounded-full px-3 py-1 text-xs"
                    key={`${entry.id}-${tag}`}
                    style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </motion.div>
  );
}

function JournalPageFallback() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-[720px]"
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
