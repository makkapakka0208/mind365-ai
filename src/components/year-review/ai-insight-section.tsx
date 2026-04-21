"use client";

import { BrainCircuit, Compass, Lightbulb, Loader2 } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import type { YearSummaryAI } from "@/types/year-review";

interface AIInsightSectionProps {
  ai: YearSummaryAI | null;
  isLoading?: boolean;
}

export function AIInsightSection({ ai, isLoading }: AIInsightSectionProps) {
  if (isLoading) {
    return (
      <Panel className="flex items-center gap-3 p-6" style={{ color: "var(--m-ink2)" }}>
        <Loader2 className="animate-spin" size={18} />
        <span className="text-sm">正在生成 AI 年度洞察…</span>
      </Panel>
    );
  }

  if (!ai) {
    return (
      <Panel className="p-6">
        <p className="text-sm" style={{ color: "var(--m-ink3)" }}>
          暂未生成 AI 洞察。
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Insights */}
      <Panel className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <BrainCircuit size={16} style={{ color: "var(--m-accent)" }} />
          <h3
            className="text-base font-semibold"
            style={{
              color: "var(--m-ink)",
              fontFamily: '"Noto Serif SC", serif',
            }}
          >
            AI 洞察
          </h3>
        </div>
        <ul className="space-y-3">
          {ai.insights.map((text, i) => (
            <li
              className="flex items-start gap-3 rounded-xl p-3"
              key={i}
              style={{ background: "rgba(139,94,60,0.05)" }}
            >
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{
                  background: "var(--m-accent)",
                  color: "#fffaf3",
                  fontFamily: '"Noto Serif SC", serif',
                }}
              >
                {i + 1}
              </span>
              <p
                className="text-sm leading-7"
                style={{
                  color: "var(--m-ink)",
                  fontFamily: '"Noto Serif SC", serif',
                }}
              >
                {text}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Suggestions */}
      <Panel className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Compass size={16} style={{ color: "#4A9B6F" }} />
          <h3
            className="text-base font-semibold"
            style={{
              color: "var(--m-ink)",
              fontFamily: '"Noto Serif SC", serif',
            }}
          >
            明年建议
          </h3>
        </div>
        <ul className="space-y-3">
          {ai.suggestions.map((text, i) => (
            <li
              className="flex items-start gap-3 rounded-xl p-3"
              key={i}
              style={{ background: "rgba(74,155,111,0.06)" }}
            >
              <Lightbulb
                className="mt-0.5 shrink-0"
                size={16}
                style={{ color: "#4A9B6F" }}
              />
              <p
                className="text-sm leading-7"
                style={{
                  color: "var(--m-ink)",
                  fontFamily: '"Noto Serif SC", serif',
                }}
              >
                {text}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
