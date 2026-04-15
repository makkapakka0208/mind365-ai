"use client";

import { CalendarDays, CheckCircle2, NotebookPen, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { sortLogsByDate } from "@/lib/analytics";
import { formatDate, getTodayISODate } from "@/lib/date";
import { calculateAlignmentScoreWeighted, fuseActions } from "@/lib/life-path";
import { detectActionsByRules } from "@/lib/life-path-rules";
import { saveDailyLog } from "@/lib/storage";
import { useDailyLogsStore } from "@/lib/storage-store";
import type { DailyLog } from "@/types";
import type { FusedAction } from "@/types/life-path";

// ── Alignment result card ─────────────────────────────────────────────────────

function AlignmentCard({
  score,
  positiveDelta,
  negativeDelta,
  contributions,
}: {
  score: number;
  positiveDelta: number;
  negativeDelta: number;
  contributions: FusedAction[];
}) {
  const color = score >= 60 ? "#4A9B6F" : score >= 40 ? "#D4A42A" : "#C0392B";
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;

  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-xl p-4"
      style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
    >
      {/* Mini ring */}
      <svg height={68} viewBox="0 0 68 68" width={68} className="shrink-0">
        <circle cx="34" cy="34" fill="none" r={r} stroke="var(--m-rule)" strokeWidth="7" />
        <circle
          cx="34" cy="34" fill="none" r={r}
          stroke={color}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          strokeWidth="7"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
        />
        <text dominantBaseline="middle" fill={color} fontFamily="inherit" fontSize="13" fontWeight="700" textAnchor="middle" x="34" y="34">
          {score}
        </text>
      </svg>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--m-ink3)" }}>
          <span>今日对齐分</span>
          <span style={{ color: "#4A9B6F" }}>
            <TrendingUp className="mr-0.5 inline" size={11} />+{positiveDelta.toFixed(0)}
          </span>
          <span style={{ color: "#C0392B" }}>
            <TrendingDown className="mr-0.5 inline" size={11} />−{negativeDelta.toFixed(0)}
          </span>
        </div>

        {contributions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {contributions.map((a) => (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                key={a.type}
                style={{
                  background: a.category === "positive" ? "rgba(74,155,111,0.1)" : "rgba(192,57,43,0.1)",
                  color: a.category === "positive" ? "#4A9B6F" : "#C0392B",
                }}
              >
                {a.type}{a.duration !== undefined ? ` ${a.duration}h` : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--m-ink3)" }}>
            未检测到已知行为，在「人生主线」中配置人生方向后分数会更准确。
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DailyLogPage() {
  const [date, setDate] = useState(getTodayISODate());
  const [mood, setMood] = useState(7);
  const [thoughts, setThoughts] = useState("");
  const [studyHours, setStudyHours] = useState(0);
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [alignment, setAlignment] = useState<{
    score: number;
    positiveDelta: number;
    negativeDelta: number;
    contributions: FusedAction[];
  } | null>(null);

  const logs = sortLogsByDate(useDailyLogsStore(), "desc");
  const recentLogs = logs.slice(0, 4);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    setAlignment(null);

    const entry: DailyLog = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      date,
      mood,
      thoughts: thoughts.trim(),
      reading: "",
      studyHours: Number.isFinite(studyHours) ? Math.max(0, studyHours) : 0,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      images,
    };

    const result = await saveDailyLog(entry);

    // Auto-generate alignment score from the journal content
    if (thoughts.trim()) {
      const rules = detectActionsByRules(thoughts.trim());
      const fused = fuseActions(rules, []);
      setAlignment(calculateAlignmentScoreWeighted(fused));
    }

    setThoughts("");
    setStudyHours(0);
    setTags("");
    setImages([]);
    setMessage(result.synced ? "已保存，并同步到云端。" : "已保存到本地缓存，云端同步稍后重试。");
    setIsSaving(false);
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="用最短的路径记录今天的心境、思考和学习投入。阅读积累现在统一记录到金句页。"
        eyebrow="写日记"
        icon={NotebookPen}
        title="写日记"
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <StaggerItem index={0}>
          <Panel className="p-5 sm:p-6 lg:p-7" interactive>
            <form className="grid gap-5" onSubmit={onSubmit}>
              <div className="grid gap-5 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                  日期
                  <Input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
                </label>

                <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                  学习时长
                  <Input
                    min={0}
                    onChange={(event) => setStudyHours(Number(event.target.value))}
                    step={0.5}
                    type="number"
                    value={studyHours}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                情绪分数 ({mood}/10)
                <input
                  className="h-2 w-full cursor-pointer appearance-none rounded-full"
                  max={10}
                  min={1}
                  onChange={(event) => setMood(Number(event.target.value))}
                  style={{
                    background: "var(--m-base)",
                    border: "1px solid var(--m-rule)",
                    accentColor: "var(--m-accent)",
                  }}
                  type="range"
                  value={mood}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                今日日记
                <Textarea
                  onChange={(event) => setThoughts(event.target.value)}
                  placeholder="写下今天最值得记住的一刻..."
                  value={thoughts}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                标签（逗号分隔）
                <Input
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="专注, 成长, 平静"
                  type="text"
                  value={tags}
                />
              </label>

              <div className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                插入图片
                <ImageUploader images={images} onChange={setImages} />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={isSaving} size="lg" type="submit" variant="primary">
                  {isSaving ? "保存中..." : "保存"}
                </Button>
                <Link className="text-sm" href="/library" style={{ color: "var(--m-accent)" }}>
                  去记录书籍摘抄
                </Link>
                {message ? (
                  <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--m-success)" }}>
                    <CheckCircle2 size={16} />
                    {message}
                  </span>
                ) : null}
              </div>

              {/* Auto-generated alignment score */}
              {alignment && (
                <AlignmentCard
                  contributions={alignment.contributions}
                  negativeDelta={alignment.negativeDelta}
                  positiveDelta={alignment.positiveDelta}
                  score={alignment.score}
                />
              )}
            </form>
          </Panel>
        </StaggerItem>

        <StaggerItem index={1} className="h-full">
          <div className="flex h-full flex-col gap-6">
            <Panel className="flex flex-1 flex-col overflow-hidden p-6" interactive>
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
                  书写提示
                </h3>
                <p className="mt-3 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  1. 今天哪个瞬间最影响你的情绪？
                  <br />
                  2. 今天最值得感谢的一件小事是什么？
                  <br />
                  3. 明天最想守住的一个意图是什么？
                </p>
              </div>
              <div className="mt-auto flex justify-center pt-4">
                <Illustration
                  alt="journaling illustration"
                  className="max-w-[240px]"
                  src="/illustrations/personal-notebook2.svg"
                />
              </div>
            </Panel>

            <Panel className="p-6" interactive>
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <h4 className="text-sm font-semibold tracking-wide" style={{ color: "var(--m-ink)" }}>
                  记录的意义
                </h4>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--m-ink2)" }}>
                "无论多么微小的情绪或进步，只要被写下来，就是抵抗遗忘的锚点。不要有压力，只写一两句也很好。"
              </p>
            </Panel>
          </div>
        </StaggerItem>
      </div>

      <StaggerItem index={2}>
        <Panel className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
              最近记录
            </h3>
            <span className="text-sm" style={{ color: "var(--m-ink3)" }}>
              最近 4 条
            </span>
          </div>

          {recentLogs.length === 0 ? (
            <EmptyState
              description="保存第一条日记后，这里会出现最近的记录卡片。"
              icon={CalendarDays}
              illustrationAlt="notebook illustration"
              illustrationSrc="/illustrations/personal-notebook.svg"
              title="还没有日记"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentLogs.map((log, index) => (
                <StaggerItem className="h-full" index={index} key={log.id}>
                  <Link className="block h-full" href={`/journal?id=${log.id}`}>
                    <div
                      className="h-full rounded-2xl p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02]"
                      style={{
                        background: "var(--m-base)",
                        border: "1px solid var(--m-rule)",
                        boxShadow: "var(--m-shadow-out)",
                      }}
                    >
                      <p className="text-sm" style={{ color: "var(--m-ink3)" }}>
                        {formatDate(log.date)}
                      </p>
                      <p className="mt-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                        情绪 {log.mood}/10
                      </p>
                      <p className="mt-1 text-sm" style={{ color: "var(--m-ink2)" }}>
                        学习 {log.studyHours.toFixed(1)} 小时
                      </p>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </div>
          )}
        </Panel>
      </StaggerItem>
    </PageTransition>
  );
}
