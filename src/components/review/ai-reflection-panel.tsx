"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  Loader2,
  Smile,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { toISODate } from "@/lib/date";
import {
  getCurrentReviewKey,
  getSavedReview,
  requestAiReflection,
  saveReview,
  type ReviewPeriod,
  type ReviewSummary,
} from "@/lib/review-reflection";
import { saveReviewReport } from "@/lib/storage";
import type { DailyLog, ReviewReport } from "@/types";

// ── Section parser ────────────────────────────────────────────────────────────

interface ParsedSection {
  id: string;
  number: string;       // "一" "二" …
  title: string;        // section heading text
  bullets: string[];    // lines (may contain markdown bold)
  raw: string;          // original markdown body
}

/** Split AI markdown into Chinese-numbered sections. */
function parseReflectionSections(text: string): ParsedSection[] {
  // Match lines like "## 一、标题", "### 一、标题", or bare "一、标题"
  const sectionRegex = /^(?:#{1,3}\s*)?([一二三四五六七八九十]+)、\s*(.+)$/gm;
  const matches = [...text.matchAll(sectionRegex)];

  if (matches.length === 0) {
    // Fallback: entire text as one section
    return [{
      id: "0",
      number: "",
      title: "复盘报告",
      bullets: [],
      raw: text.trim(),
    }];
  }

  return matches.map((match, i) => {
    const startIdx = match.index! + match[0].length;
    const endIdx = i < matches.length - 1 ? matches[i + 1].index! : text.length;
    const body = text.slice(startIdx, endIdx).trim();

    // Extract bullet lines
    const bullets = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- ") || l.startsWith("· ") || l.startsWith("* "))
      .map((l) => l.replace(/^[-·*]\s+/, ""));

    return {
      id: String(i),
      number: match[1],
      title: match[2].trim(),
      bullets,
      raw: body,
    };
  });
}

/** Extract first bold sentence or first meaningful paragraph as key insight. */
function extractKeyInsight(sections: ParsedSection[]): string {
  if (sections.length === 0) return "";
  const first = sections[0];
  // Look for bold text in bullets
  for (const b of first.bullets) {
    const boldMatch = b.match(/\*\*(.+?)\*\*/);
    if (boldMatch) return boldMatch[1];
  }
  // Fallback: first bullet
  if (first.bullets.length > 0) return first.bullets[0].replace(/\*\*/g, "");
  // Fallback: first line of raw
  const firstLine = first.raw.split("\n").find((l) => l.trim().length > 10);
  return firstLine?.replace(/\*\*/g, "").replace(/^[-·*#\s]+/, "").trim() ?? "";
}

// ── Section icon mapping ──────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  "一": { icon: Target,        color: "#4A9B6F", bg: "rgba(74,155,111,0.08)" },
  "二": { icon: TrendingUp,    color: "#D4A42A", bg: "rgba(212,164,42,0.08)" },
  "三": { icon: BrainCircuit,  color: "#7A6AAE", bg: "rgba(122,106,174,0.08)" },
  "四": { icon: AlertTriangle, color: "#C07A3A", bg: "rgba(192,122,58,0.08)" },
  "五": { icon: Lightbulb,     color: "#3A8BC0", bg: "rgba(58,139,192,0.08)" },
  "六": { icon: Sparkles,      color: "#9B6A42", bg: "rgba(155,106,66,0.08)" },
  "七": { icon: Smile,         color: "#4A9B6F", bg: "rgba(74,155,111,0.08)" },
};

function getSectionMeta(num: string) {
  return SECTION_ICONS[num] ?? { icon: Sparkles, color: "var(--m-accent)", bg: "rgba(139,94,60,0.06)" };
}

// ── Inline markdown renderer (bold + code) ────────────────────────────────────

function InlineMarkdown({ text }: { text: string }) {
  // Split on **bold** segments
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold" style={{ color: "var(--m-accent)" }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ── Collapsible section card ──────────────────────────────────────────────────

function SectionCard({
  section,
  defaultOpen,
}: {
  section: ParsedSection;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const meta = getSectionMeta(section.number);
  const Icon = meta.icon;

  // Detect special sub-types in bullets
  const categorized = useMemo(() => {
    const result: { type: "insight" | "risk" | "action" | "normal"; text: string }[] = [];
    for (const b of section.bullets) {
      const lower = b.toLowerCase();
      if (
        lower.includes("风险") || lower.includes("陷阱") || lower.includes("负债") ||
        lower.includes("浪费") || lower.includes("回避") || lower.includes("⚠")
      ) {
        result.push({ type: "risk", text: b });
      } else if (
        lower.includes("建议") || lower.includes("调整") || lower.includes("动作") ||
        lower.includes("行动") || lower.includes("优先") || lower.includes("💡") ||
        lower.includes("【")
      ) {
        result.push({ type: "action", text: b });
      } else if (
        lower.includes("信号") || lower.includes("洞察") || lower.includes("发现") ||
        lower.includes("核心") || lower.includes("判断") || lower.includes("📌")
      ) {
        result.push({ type: "insight", text: b });
      } else {
        result.push({ type: "normal", text: b });
      }
    }
    return result;
  }, [section.bullets]);

  const typeStyles: Record<string, { bg: string; border: string; label: string; labelColor: string }> = {
    insight: { bg: "rgba(74,155,111,0.05)", border: "rgba(74,155,111,0.18)", label: "📌 洞察", labelColor: "#4A9B6F" },
    risk:    { bg: "rgba(192,57,43,0.04)", border: "rgba(192,57,43,0.15)", label: "⚠️ 风险", labelColor: "#C0392B" },
    action:  { bg: "rgba(58,139,192,0.05)", border: "rgba(58,139,192,0.15)", label: "💡 建议", labelColor: "#3A8BC0" },
    normal:  { bg: "transparent", border: "transparent", label: "", labelColor: "" },
  };

  // Preview: first bullet, truncated
  const preview = section.bullets[0]?.replace(/\*\*/g, "").slice(0, 60) ?? "";

  return (
    <div
      className="rounded-2xl transition-all duration-200"
      style={{
        background: "var(--m-base-light)",
        border: "1px solid var(--m-rule)",
        boxShadow: "var(--m-shadow-out)",
      }}
    >
      {/* Header — always visible */}
      <button
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-black/[0.015]"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: meta.bg, color: meta.color }}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {section.number && (
              <span
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
                style={{ background: meta.bg, color: meta.color }}
              >
                {section.number}
              </span>
            )}
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--m-ink)" }}>
              {section.title}
            </h3>
          </div>
          {!isOpen && preview && (
            <p className="mt-1 truncate text-sm" style={{ color: "var(--m-ink3)" }}>
              {preview}…
            </p>
          )}
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="mt-1 shrink-0"
          style={{ color: "var(--m-ink3)" }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      {/* Body — collapsible */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="space-y-2.5 px-5 pb-5 pt-1">
              {categorized.length > 0 ? (
                categorized.map((item, i) => {
                  const ts = typeStyles[item.type];
                  return (
                    <div
                      key={i}
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: ts.bg,
                        border: ts.border !== "transparent" ? `1px solid ${ts.border}` : undefined,
                      }}
                    >
                      {ts.label && (
                        <span
                          className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: ts.labelColor }}
                        >
                          {ts.label}
                        </span>
                      )}
                      <p className="text-sm leading-7" style={{ color: "var(--m-ink)" }}>
                        <InlineMarkdown text={item.text} />
                      </p>
                    </div>
                  );
                })
              ) : (
                // Fallback: render raw markdown lines
                <div className="space-y-1.5 text-sm leading-7" style={{ color: "var(--m-ink)" }}>
                  {section.raw.split("\n").filter((l) => l.trim()).map((line, i) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith(">")) {
                      return (
                        <blockquote
                          key={i}
                          className="rounded-r-lg py-2 pl-4 italic"
                          style={{
                            borderLeft: "3px solid var(--m-accent)",
                            background: "rgba(139,94,60,0.06)",
                            color: "var(--m-ink2)",
                          }}
                        >
                          <InlineMarkdown text={trimmed.replace(/^>\s*/, "")} />
                        </blockquote>
                      );
                    }
                    if (trimmed.startsWith("- ") || trimmed.startsWith("· ") || trimmed.startsWith("* ")) {
                      return (
                        <div key={i} className="flex gap-2.5">
                          <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--m-accent)" }} />
                          <span><InlineMarkdown text={trimmed.replace(/^[-·*]\s+/, "")} /></span>
                        </div>
                      );
                    }
                    if (trimmed.startsWith("###")) {
                      return (
                        <p key={i} className="mt-3 font-semibold" style={{ color: "var(--m-ink2)" }}>
                          {trimmed.replace(/^#{1,3}\s*/, "")}
                        </p>
                      );
                    }
                    return (
                      <p key={i}>
                        <InlineMarkdown text={trimmed} />
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Metric mini-card ──────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
      style={{
        background: "var(--m-base-light)",
        border: "1px solid var(--m-rule)",
        boxShadow: "var(--m-shadow-out)",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}12`, color }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--m-ink3)" }}>
          {label}
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-xl font-bold leading-tight" style={{ color: "var(--m-ink)" }}>
            {value}
          </span>
          {unit && (
            <span className="text-xs" style={{ color: "var(--m-ink3)" }}>
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AiReflectionPanelProps {
  emptyMessage: string;
  logs: DailyLog[];
  period: ReviewPeriod;
  range: { end: Date; start: Date };
  summary: ReviewSummary;
  title: string;
}

export function AiReflectionPanel({
  emptyMessage,
  logs,
  period,
  range,
  summary,
  title,
}: AiReflectionPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasSavedReflection, setHasSavedReflection] = useState(false);
  const [reflection, setReflection] = useState("");
  const [message, setMessage] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);
  const [archived, setArchived] = useState(false);

  const reviewKey = getCurrentReviewKey(period);

  useEffect(() => {
    const savedReview = getSavedReview(period);
    if (savedReview) {
      setReflection(savedReview);
      setHasSavedReflection(true);
      setMessage(`已加载 ${reviewKey} 的已保存复盘。`);
      return;
    }
    setReflection("");
    setHasSavedReflection(false);
    setMessage("");
  }, [period, reviewKey]);

  const onGenerate = async () => {
    if (isGenerating || logs.length === 0) return;

    const savedReview = getSavedReview(period);
    if (savedReview) {
      setReflection(savedReview);
      setHasSavedReflection(true);
      setMessage(`已加载 ${reviewKey} 的已保存复盘。`);
      return;
    }

    setIsGenerating(true);
    setMessage("");

    try {
      const data = await requestAiReflection(period, logs, range, summary);
      if (!data.reflection) {
        setReflection("");
        setHasSavedReflection(false);
        setMessage(data.message ?? emptyMessage);
        return;
      }
      const savedKey = saveReview(period, data.reflection);
      setReflection(data.reflection);
      setHasSavedReflection(true);
      setMessage(`复盘已生成并保存（${savedKey}）。`);
    } catch {
      setMessage("AI 复盘生成失败，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const onRegenerate = async () => {
    if (isGenerating || logs.length === 0) return;
    setIsGenerating(true);
    setMessage("");
    try {
      const data = await requestAiReflection(period, logs, range, summary);
      if (!data.reflection) {
        setReflection("");
        setHasSavedReflection(false);
        setMessage(data.message ?? emptyMessage);
        return;
      }
      const savedKey = saveReview(period, data.reflection);
      setReflection(data.reflection);
      setHasSavedReflection(true);
      setMessage(`复盘已重新生成（${savedKey}）。`);
    } catch {
      setMessage("AI 复盘生成失败，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  };

  // Archive AI reflection into ReviewReport history
  const onArchive = async () => {
    if (!reflection || isArchiving) return;
    setIsArchiving(true);
    const report: ReviewReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      period,
      rangeStart: toISODate(range.start),
      rangeEnd: toISODate(range.end),
      title: `${title}（AI 生成）`,
      metrics: summary,
      notes: reflection,
    };
    await saveReviewReport(report);
    setIsArchiving(false);
    setArchived(true);
  };

  // Reset archived state when period changes
  useEffect(() => { setArchived(false); }, [period]);

  // Parse reflection into structured sections
  const sections = useMemo(() => parseReflectionSections(reflection), [reflection]);
  const keyInsight = useMemo(() => extractKeyInsight(sections), [sections]);

  return (
    <div className="space-y-5">
      {/* ── Generate / Load trigger ── */}
      {!reflection && (
        <Panel className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>{title}</h3>
              <p className="mt-1 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                穿透数据表象，生成一份结构化的成长复盘报告。
              </p>
            </div>
            <Button className="justify-center sm:min-w-44" onClick={onGenerate} size="lg" variant="primary">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  生成中…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2" size={16} />
                  {hasSavedReflection ? "查看已保存复盘" : "启动 AI 复盘"}
                </>
              )}
            </Button>
          </div>
          {message && <p className="mt-3 text-sm" style={{ color: "var(--m-ink2)" }}>{message}</p>}
        </Panel>
      )}

      {/* ── Structured report ── */}
      {reflection && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
          initial={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Header + Key Insight */}
          <div
            className="rounded-2xl px-5 py-5 sm:px-6"
            style={{
              background: "linear-gradient(135deg, rgba(253,246,235,0.98), rgba(245,237,222,0.96))",
              border: "1px solid var(--m-rule)",
              boxShadow: "var(--m-shadow-out)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  AI 复盘报告 · {reviewKey}
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--m-ink)" }}>
                  {title}
                </h2>
              </div>
              <button
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-40"
                disabled={isGenerating}
                onClick={onRegenerate}
                type="button"
                style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
              >
                {isGenerating ? "生成中…" : "重新加载"}
              </button>
            </div>

            {keyInsight && (
              <div
                className="mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3"
                style={{ background: "rgba(74,155,111,0.06)", border: "1px solid rgba(74,155,111,0.15)" }}
              >
                <Lightbulb className="mt-0.5 shrink-0" size={15} style={{ color: "#4A9B6F" }} />
                <p className="text-sm font-medium leading-6" style={{ color: "#3A7A55" }}>
                  {keyInsight}
                </p>
              </div>
            )}
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              color="#9B6A42"
              icon={Smile}
              label="平均情绪"
              unit="/10"
              value={summary.entries > 0 ? String(summary.averageMood) : "—"}
            />
            <MetricCard
              color="#4A9B6F"
              icon={BrainCircuit}
              label="学习时长"
              unit="h"
              value={summary.totalStudyHours > 0 ? summary.totalStudyHours.toFixed(1) : "—"}
            />
            <MetricCard
              color="#7A6AAE"
              icon={BookOpen}
              label="阅读时长"
              unit="h"
              value={summary.totalReadingHours > 0 ? summary.totalReadingHours.toFixed(1) : "—"}
            />
            <MetricCard
              color="#D4A42A"
              icon={Target}
              label="日记条数"
              unit="条"
              value={String(summary.entries)}
            />
          </div>

          {/* Section cards */}
          <div className="space-y-3">
            {sections.map((section, i) => (
              <SectionCard
                key={section.id}
                defaultOpen={i === 0}
                section={section}
              />
            ))}
          </div>

          {/* Archive to review history */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4"
            style={{
              background: "var(--m-base-light)",
              border: "1px solid var(--m-rule)",
              boxShadow: "var(--m-shadow-out)",
            }}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                {archived ? "已存入复盘档案" : "是否将这份报告存入复盘档案？"}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--m-ink3)" }}>
                {archived
                  ? "可在「复盘档案」页面查看和管理。"
                  : "存档后可在复盘历史中随时回看。"}
              </p>
            </div>
            {archived ? (
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
                style={{ background: "rgba(74,155,111,0.08)", color: "#4A9B6F" }}
              >
                <CheckCircle2 size={15} />
                已存档
              </span>
            ) : (
              <Button
                className="shrink-0"
                disabled={isArchiving}
                onClick={onArchive}
                variant="secondary"
              >
                <Archive className="mr-2" size={15} />
                {isArchiving ? "存档中…" : "存入复盘档案"}
              </Button>
            )}
          </div>

          {/* Status message */}
          {message && (
            <p className="text-center text-xs" style={{ color: "var(--m-ink3)" }}>
              {message}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
