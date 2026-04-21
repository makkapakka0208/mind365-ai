"use client";

import { Sun, Moon } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { formatDate } from "@/lib/date";
import type { HighlightDay } from "@/types/year-review";

interface HighlightSectionProps {
  bestDays: HighlightDay[];
  worstDays: HighlightDay[];
}

export function HighlightSection({ bestDays, worstDays }: HighlightSectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <HighlightList
        accent="#C89B5A"
        days={bestDays}
        icon={<Sun size={16} />}
        subtitle="最被自己喜欢的 5 天"
        title="高光时刻"
        tint="rgba(200, 155, 90, 0.10)"
      />
      <HighlightList
        accent="#8A7E92"
        days={worstDays}
        icon={<Moon size={16} />}
        subtitle="值得温柔回看的 5 天"
        title="低谷时刻"
        tint="rgba(138, 126, 146, 0.10)"
      />
    </div>
  );
}

interface HighlightListProps {
  title: string;
  subtitle: string;
  days: HighlightDay[];
  icon: React.ReactNode;
  accent: string;
  tint: string;
}

function HighlightList({
  title,
  subtitle,
  days,
  icon,
  accent,
  tint,
}: HighlightListProps) {
  return (
    <Panel className="p-5 md:p-6" interactive>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3
            className="flex items-center gap-2 text-base font-semibold"
            style={{
              color: "var(--m-ink)",
              fontFamily: '"Noto Serif SC", serif',
            }}
          >
            <span style={{ color: accent }}>{icon}</span>
            {title}
          </h3>
          <p className="mt-1 text-[12px]" style={{ color: "var(--m-ink3)" }}>
            {subtitle}
          </p>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: "var(--m-ink3)" }}>
          暂无足够数据
        </p>
      ) : (
        <ul className="space-y-3">
          {days.map((d) => (
            <li
              className="rounded-xl p-3"
              key={d.date}
              style={{ background: tint }}
            >
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span
                  style={{
                    color: "var(--m-ink2)",
                    fontFamily: '"Noto Serif SC", serif',
                  }}
                >
                  {formatDate(d.date)}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: accent, color: "#fffaf3" }}
                >
                  {d.score}
                </span>
              </div>
              <p
                className="text-sm leading-7"
                style={{
                  color: "var(--m-ink)",
                  fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
                }}
              >
                {d.excerpt}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
