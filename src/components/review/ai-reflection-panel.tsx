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
            <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>{title}</h3>
            <p className="mt-1 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
              穿透数据表象，汇总情绪、学习时长、阅读节奏和日记正文，生成一份成长复盘。
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--m-ink3)" }}>当前周期缓存键：{reviewKey}</p>
          </div>

          <Button className="justify-center sm:min-w-48" onClick={onGenerate} size="lg" variant="primary">
            <Sparkles className="mr-2" size={16} />
            {isGenerating ? "复盘生成中..." : hasSavedReflection ? "查看已保存复盘" : "启动战略复盘"}
          </Button>
        </div>

        {message ? <p className="mt-4 text-sm" style={{ color: "var(--m-ink2)" }}>{message}</p> : null}
      </Panel>

      {reflection ? (
        <Panel className="relative overflow-hidden p-6">
          <div className="relative">
            <h3
              className="mb-6 pb-4 text-xl font-bold tracking-tight"
              style={{ borderBottom: "1px solid var(--m-rule)", color: "var(--m-ink)" }}
            >
              复盘报告
            </h3>

            <div className="mt-4 text-[15px] leading-8" style={{ color: "var(--m-ink)" }}>
              <ReactMarkdown
                components={{
                  h1: (props) => <h1 className="mt-8 mb-4 text-2xl font-bold" style={{ color: "var(--m-ink)" }} {...props} />,
                  h2: (props) => <h2 className="mt-8 mb-4 text-xl font-bold" style={{ color: "var(--m-accent)" }} {...props} />,
                  h3: (props) => (
                    <h3 className="mt-6 mb-3 flex items-center gap-2 text-lg font-bold" style={{ color: "var(--m-ink2)" }} {...props} />
                  ),
                  p: (props) => <p className="mb-4" style={{ color: "var(--m-ink)" }} {...props} />,
                  ul: (props) => (
                    <ul className="mb-4 list-disc list-inside space-y-2" style={{ color: "var(--m-ink)" }} {...props} />
                  ),
                  ol: (props) => (
                    <ol className="mb-4 list-decimal list-inside space-y-2" style={{ color: "var(--m-ink)" }} {...props} />
                  ),
                  li: (props) => <li className="ml-2" {...props} />,
                  strong: (props) => (
                    <strong className="font-bold" style={{ color: "var(--m-accent)" }} {...props} />
                  ),
                  blockquote: (props) => (
                    <blockquote
                      className="my-5 rounded-r-lg py-1 pl-4 italic"
                      style={{
                        borderLeft: "4px solid var(--m-accent)",
                        background: "rgba(139, 94, 60, 0.08)",
                        color: "var(--m-ink2)",
                      }}
                      {...props}
                    />
                  ),
                  hr: (props) => <hr className="my-8" style={{ borderColor: "var(--m-rule)" }} {...props} />,
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
