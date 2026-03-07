"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import {
  getCurrentReviewKey,
  getSavedReview,
  requestAiReflection,
  saveReview,
  type ReviewPeriod,
  type ReviewSummary,
} from "@/lib/review-reflection";
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
  const [hasSavedReflection, setHasSavedReflection] = useState(false);
  const [reflection, setReflection] = useState("");
  const [message, setMessage] = useState("");

  const reviewKey = getCurrentReviewKey(period);

  useEffect(() => {
    const savedReview = getSavedReview(period);

    if (savedReview) {
      setReflection(savedReview);
      setHasSavedReflection(true);
      setMessage(`已加载 ${reviewKey} 的已保存复盘，本次不会重复调用 AI。`);
      return;
    }

    setReflection("");
    setHasSavedReflection(false);
    setMessage("");
  }, [period, reviewKey]);

  const onGenerate = async () => {
    if (isGenerating || logs.length === 0) {
      return;
    }

    const savedReview = getSavedReview(period);

    if (savedReview) {
      setReflection(savedReview);
      setHasSavedReflection(true);
      setMessage(`已加载 ${reviewKey} 的已保存复盘，本次不会重复调用 AI。`);
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
      setMessage(`复盘内容已生成并保存到本地（${savedKey}）。`);
    } catch {
      setMessage("AI 复盘生成失败，请稍后再试。")
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
              穿透数据表象，汇总情绪、学习时长、阅读节奏和日记正文，生成一份成长复盘。
            </p>
            <p className="mt-2 text-xs text-slate-400">当前周期缓存键：{reviewKey}</p>
          </div>

          <Button className="justify-center sm:min-w-48" onClick={onGenerate} size="lg" variant="primary">
            <Sparkles className="mr-2" size={16} />
            {isGenerating ? "复盘生成中..." : hasSavedReflection ? "查看已保存复盘" : "启动战略复盘"}
          </Button>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}
      </Panel>

      {reflection ? (
        <Panel className="relative overflow-hidden border border-indigo-300/25 bg-gradient-to-br from-indigo-500/22 via-purple-500/16 to-pink-500/20 p-6 shadow-2xl shadow-indigo-900/35">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-indigo-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 left-8 h-40 w-40 rounded-full bg-pink-300/20 blur-3xl" />

          <div className="relative">
            <h3 className="mb-6 border-b border-indigo-400/30 pb-4 text-xl font-bold tracking-tight text-slate-100">
              复盘报告
            </h3>

            <div className="mt-4 text-[15px] leading-8 text-slate-100/95">
              <ReactMarkdown
                components={{
                  h1: (props) => <h1 className="mt-8 mb-4 text-2xl font-bold text-white" {...props} />,
                  h2: (props) => <h2 className="mt-8 mb-4 text-xl font-bold text-indigo-200" {...props} />,
                  h3: (props) => (
                    <h3 className="mt-6 mb-3 flex items-center gap-2 text-lg font-bold text-pink-300/90" {...props} />
                  ),
                  p: (props) => <p className="mb-4 text-slate-200" {...props} />,
                  ul: (props) => (
                    <ul
                      className="mb-4 list-disc list-inside space-y-2 text-slate-200 marker:text-indigo-400"
                      {...props}
                    />
                  ),
                  ol: (props) => (
                    <ol
                      className="mb-4 list-decimal list-inside space-y-2 text-slate-200 marker:text-pink-400"
                      {...props}
                    />
                  ),
                  li: (props) => <li className="ml-2" {...props} />,
                  strong: (props) => (
                    <strong
                      className="bg-gradient-to-r from-pink-300 to-indigo-300 bg-clip-text font-bold text-transparent"
                      {...props}
                    />
                  ),
                  blockquote: (props) => (
                    <blockquote
                      className="my-5 rounded-r-lg border-l-4 border-indigo-500 bg-indigo-500/10 py-1 pl-4 text-slate-300 italic"
                      {...props}
                    />
                  ),
                  hr: (props) => <hr className="my-8 border-indigo-300/20" {...props} />,
                }}
              >
                {reflection}
              </ReactMarkdown>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
