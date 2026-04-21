"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { getTodayISODate, parseISODate, toISODate } from "@/lib/date";
import type { DailyLog } from "@/types";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/** 把 JS 的 getDay()（周日=0）转换为周一=0 的索引 */
function mondayFirstIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/** 情绪分数 → RGB 颜色：低分冷色 → 高分暖色 */
function moodColor(mood: number): string {
  const t = Math.max(0, Math.min(1, (mood - 1) / 9));
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  // 冷 #A6B8CC → 暖 #DC9264
  const r = lerp(166, 220);
  const g = lerp(184, 146);
  const b = lerp(204, 100);
  return `rgb(${r}, ${g}, ${b})`;
}

type Cell =
  | { kind: "blank" }
  | {
      kind: "day";
      date: string;         // ISO
      day: number;
      isToday: boolean;
      isFuture: boolean;
      isViewing: boolean;
      mood: number | null;
    };

function buildMonthGrid(
  cursorYear: number,
  cursorMonth: number, // 1-12
  viewingDate: string,
  todayIso: string,
  moodByDate: Map<string, number>,
): Cell[] {
  const firstOfMonth = new Date(cursorYear, cursorMonth - 1, 1);
  const daysInMonth = new Date(cursorYear, cursorMonth, 0).getDate();
  const leadingBlanks = mondayFirstIndex(firstOfMonth.getDay());

  const cells: Cell[] = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push({ kind: "blank" });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = toISODate(new Date(cursorYear, cursorMonth - 1, day));
    cells.push({
      kind: "day",
      date,
      day,
      isToday: date === todayIso,
      isFuture: date > todayIso,
      isViewing: date === viewingDate,
      mood: moodByDate.get(date) ?? null,
    });
  }
  // 补齐到 7 的倍数（可选）
  while (cells.length % 7 !== 0) cells.push({ kind: "blank" });
  return cells;
}

interface MonthCalendarThumbProps {
  logs: DailyLog[];
  viewingDate: string;
  onPick: (date: string) => void;
}

export function MonthCalendarThumb({
  logs,
  viewingDate,
  onPick,
}: MonthCalendarThumbProps) {
  const todayIso = getTodayISODate();
  const today = parseISODate(todayIso);

  // cursor 月份：默认 viewingDate 所在月
  const viewingDateObj = parseISODate(viewingDate);
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: viewingDateObj.getFullYear(),
    month: viewingDateObj.getMonth() + 1,
  });

  const [mobileExpanded, setMobileExpanded] = useState(false);

  const moodByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const log of logs) m.set(log.date, log.mood);
    return m;
  }, [logs]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, viewingDate, todayIso, moodByDate),
    [cursor.year, cursor.month, viewingDate, todayIso, moodByDate],
  );

  // 当前周（移动端折叠时显示）：viewingDate 所在周的 7 个 cell
  const currentWeekCells = useMemo(() => {
    // 只有当 viewingDate 落在当前 cursor 月，才能直接从 cells 里挑；否则回退为计算
    const viewingInCursor =
      viewingDateObj.getFullYear() === cursor.year &&
      viewingDateObj.getMonth() + 1 === cursor.month;
    if (viewingInCursor) {
      const idx = cells.findIndex(
        (c) => c.kind === "day" && c.date === viewingDate,
      );
      if (idx >= 0) {
        const rowStart = Math.floor(idx / 7) * 7;
        return cells.slice(rowStart, rowStart + 7);
      }
    }
    // fallback：基于 viewingDate 直接构造一周
    const monIdx = mondayFirstIndex(viewingDateObj.getDay());
    const weekCells: Cell[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(viewingDateObj);
      d.setDate(viewingDateObj.getDate() - monIdx + i);
      const iso = toISODate(d);
      weekCells.push({
        kind: "day",
        date: iso,
        day: d.getDate(),
        isToday: iso === todayIso,
        isFuture: iso > todayIso,
        isViewing: iso === viewingDate,
        mood: moodByDate.get(iso) ?? null,
      });
    }
    return weekCells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, viewingDate, cursor.year, cursor.month, moodByDate, todayIso]);

  const canGoNextMonth =
    cursor.year < today.getFullYear() ||
    (cursor.year === today.getFullYear() && cursor.month < today.getMonth() + 1);

  const goPrev = () => {
    setCursor((c) => {
      const m = c.month - 1;
      return m < 1 ? { year: c.year - 1, month: 12 } : { year: c.year, month: m };
    });
  };
  const goNext = () => {
    if (!canGoNextMonth) return;
    setCursor((c) => {
      const m = c.month + 1;
      return m > 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: m };
    });
  };

  const headerLabel = `${cursor.year} 年 ${cursor.month} 月`;

  return (
    <div
      className="rounded-2xl border p-4 md:p-5"
      style={{
        background: "var(--m-base-light)",
        borderColor: "var(--m-rule)",
        boxShadow: "var(--m-shadow-out)",
      }}
    >
      {/* 标题行：月份 + 左右切换 */}
      <div className="flex items-center justify-between">
        <button
          aria-label="上一月"
          className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[rgba(139,94,60,0.08)]"
          onClick={goPrev}
          style={{ color: "var(--m-ink2)" }}
          type="button"
        >
          <ChevronLeft size={18} />
        </button>

        <div
          className="text-sm font-medium tracking-wide"
          style={{
            color: "var(--m-ink)",
            fontFamily: '"Noto Serif SC", serif',
          }}
        >
          {headerLabel}
        </div>

        <button
          aria-label="下一月"
          className="flex h-8 w-8 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30 hover:bg-[rgba(139,94,60,0.08)]"
          disabled={!canGoNextMonth}
          onClick={goNext}
          style={{ color: "var(--m-ink2)" }}
          type="button"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 星期表头 */}
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px]" style={{ color: "var(--m-ink3)" }}>
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* 桌面：整月 */}
      <div className="mt-2 hidden grid-cols-7 gap-1.5 md:grid">
        {cells.map((cell, i) => (
          <CalendarCell cell={cell} key={`m-${i}`} onPick={onPick} />
        ))}
      </div>

      {/* 移动：折叠一周 + 展开按钮 */}
      <div className="md:hidden">
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {(mobileExpanded ? cells : currentWeekCells).map((cell, i) => (
            <CalendarCell cell={cell} key={`mob-${i}`} onPick={onPick} />
          ))}
        </div>
        <div className="mt-3 flex justify-center">
          <button
            className="text-xs"
            onClick={() => setMobileExpanded((v) => !v)}
            style={{ color: "var(--m-accent)" }}
            type="button"
          >
            {mobileExpanded ? "收起" : "展开整月"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarCell({
  cell,
  onPick,
}: {
  cell: Cell;
  onPick: (date: string) => void;
}) {
  if (cell.kind === "blank") {
    return <div className="aspect-square" />;
  }

  const { date, day, isToday, isFuture, isViewing, mood } = cell;
  const bg = mood !== null ? moodColor(mood) : "transparent";
  const hasMood = mood !== null;

  const textColor = hasMood
    ? "#fff"
    : isFuture
      ? "rgba(139,94,60,0.28)"
      : "var(--m-ink2)";

  return (
    <button
      aria-label={`查看 ${date}${hasMood ? ` 情绪 ${mood}/10` : ""}`}
      className="group relative aspect-square w-full rounded-[10px] text-[12px] font-medium transition disabled:cursor-not-allowed"
      disabled={isFuture}
      onClick={() => onPick(date)}
      style={{
        background: bg,
        border: hasMood ? "1px solid rgba(90,60,35,0.08)" : "1px dashed rgba(139,94,60,0.15)",
        color: textColor,
        // 当前查看：实心高亮（粗描边 + accent 色描边）
        outline: isViewing ? "2px solid var(--m-accent)" : undefined,
        outlineOffset: isViewing ? "1px" : undefined,
        // 今天：外圈高亮（点状描边）
        boxShadow: isToday && !isViewing ? "0 0 0 2px rgba(139,94,60,0.55)" : undefined,
        opacity: isFuture ? 0.45 : 1,
      }}
      type="button"
    >
      {day}
    </button>
  );
}
