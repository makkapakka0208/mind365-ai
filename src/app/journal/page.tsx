"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Clock3, PencilLine, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { parseReadingHours } from "@/lib/analytics";
import { formatDate } from "@/lib/date";
import { updateDailyLog } from "@/lib/storage";
import { useDailyLogsStore } from "@/lib/storage-store";
import type { DailyLog } from "@/types";

interface EditState {
  date: string;
  mood: number;
  studyHours: number;
  reading: string;
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
    reading: entry.reading,
    thoughts: entry.thoughts,
    tags: entry.tags.join(", "),
  };
}

export default function JournalDetailPage() {
  const router = useRouter();
  const logs = useDailyLogsStore();

  const [id] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("id") ?? "";
  });
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<EditState | null>(null);

  const entry = useMemo(() => logs.find((log) => log.id === id), [logs, id]);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/timeline");
  };

  if (!entry) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-[720px]"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Panel className="space-y-5 p-7">
          <h1 className="text-2xl font-semibold text-slate-100">未找到这条日记</h1>
          <p className="text-sm leading-7 text-slate-300">这条记录可能已被删除，或者当前链接中的 id 无效。</p>
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
      reading: form.reading.trim(),
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
            <h1 className="text-2xl font-semibold text-slate-100">编辑日记</h1>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-200">
                日期
                <Input
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  type="date"
                  value={form.date}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                情绪分数（1-10）
                <Input
                  max={10}
                  min={1}
                  onChange={(event) => setForm({ ...form, mood: Number(event.target.value) || 1 })}
                  type="number"
                  value={form.mood}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                学习时长
                <Input
                  min={0}
                  onChange={(event) => setForm({ ...form, studyHours: Number(event.target.value) || 0 })}
                  step={0.5}
                  type="number"
                  value={form.studyHours}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                阅读记录
                <Input
                  onChange={(event) => setForm({ ...form, reading: event.target.value })}
                  type="text"
                  value={form.reading}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-200">
              完整日记内容
              <Textarea
                className="min-h-44"
                onChange={(event) => setForm({ ...form, thoughts: event.target.value })}
                value={form.thoughts}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-200">
              标签
              <Input
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
                type="text"
                value={form.tags}
              />
            </label>

            <div className="flex items-center gap-3">
              <Button disabled={isSaving} type="submit" variant="primary">
                <Save className="mr-2" size={16} />
                {isSaving ? "保存中..." : "保存修改"}
              </Button>
              {message ? <span className="text-sm text-emerald-300">{message}</span> : null}
            </div>
          </form>
        ) : (
          <div className="space-y-7">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-100">日记详情</h1>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-300">
                <Clock3 size={14} />
                {formatTimestamp(entry.createdAt)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <CalendarDays size={14} />
                  日期
                </p>
                <p className="mt-2 text-base text-slate-100">{formatDate(entry.date)}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">情绪分数</p>
                <p className="mt-2 text-base text-slate-100">{entry.mood}/10</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">学习时长</p>
                <p className="mt-2 text-base text-slate-100">{entry.studyHours.toFixed(1)} 小时</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">阅读时长</p>
                <p className="mt-2 text-base text-slate-100">{parseReadingHours(entry.reading).toFixed(1)} 小时</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">完整日记内容</p>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-slate-100">
                {entry.thoughts || "这一天还没有写下具体内容。"}
              </p>
            </div>

            {entry.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <span
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-300"
                    key={`${entry.id}-${tag}`}
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

