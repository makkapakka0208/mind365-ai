"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { requestAiReflection, type ReviewPeriod, type ReviewSummary } from "@/lib/review-reflection";
import type { DailyLog } from "@/types";

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
  const [reflection, setReflection] = useState("");
  const [message, setMessage] = useState("");

  const onGenerate = async () => {
    if (isGenerating || logs.length === 0) {
      return;
    }

    setIsGenerating(true);
    setMessage("");

    try {
      const data = await requestAiReflection(period, logs, range, summary);

      if (!data.reflection) {
        setReflection("");
        setMessage(data.message ?? emptyMessage);
        return;
      }

      setReflection(data.reflection);
      setMessage("AI 复盘已生成。");
    } catch {
      setMessage("AI 复盘生成失败，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            <p className="mt-1 text-sm leading-7 text-slate-300">
              汇总情绪、学习时长、阅读节奏和日记正文，生成一份温和的成长复盘。
            </p>
          </div>

          <Button className="justify-center sm:min-w-48" onClick={onGenerate} size="lg" variant="primary">
            <Sparkles className="mr-2" size={16} />
            {isGenerating ? "生成中..." : "生成 AI 复盘"}
          </Button>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}
      </Panel>

      {reflection ? (
        <Panel className="relative overflow-hidden border border-indigo-300/25 bg-gradient-to-br from-indigo-500/22 via-purple-500/16 to-pink-500/20 p-6 shadow-2xl shadow-indigo-900/35">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-indigo-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 left-8 h-40 w-40 rounded-full bg-pink-300/20 blur-3xl" />

          <div className="relative">
            <h3 className="text-xl font-semibold tracking-tight text-slate-100">AI 成长复盘</h3>
            <div className="mt-4 space-y-4 text-[15px] leading-8 text-slate-100/95">
              {reflection
                .split(/\n\s*\n/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p className="whitespace-pre-line" key={`${paragraph.slice(0, 24)}-${index}`}>
                    {paragraph}
                  </p>
                ))}
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

