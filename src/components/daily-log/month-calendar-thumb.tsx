"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { getTodayISODate, parseISODate, toISODate } from "@/lib/date";
import type { DailyLog } from "@/types";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function mondayFirstIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function moodColor(mood: number): string {
  const stops = [
    "#d8d1c1",
    "#c8ad92",
    "#b99171",
    "#a77851",
    "#8e5932",
  ];
  const index = Math.max(0, Math.min(stops.length - 1, Math.round((mood - 2) / 2)));
  return stops[index];
}

type Cell =
  | { kind: "blank" }
  | {
      kind: "day";
      date: string;
      day: number;
      isToday: boolean;
      isFuture: boolean;
      isViewing: boolean;
      mood: number | null;
    };

function buildMonthGrid(
  cursorYear: number,
  cursorMonth: number,
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

  const currentWeekCells = useMemo(() => {
    const viewingInCursor =
      viewingDateObj.getFullYear() === cursor.year &&
      viewingDateObj.getMonth() + 1 === cursor.month;
    if (viewingInCursor) {
      const idx = cells.findIndex((c) => c.kind === "day" && c.date === viewingDate);
      if (idx >= 0) {
        const rowStart = Math.floor(idx / 7) * 7;
        return cells.slice(rowStart, rowStart + 7);
      }
    }

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
  }, [cells, cursor.month, cursor.year, moodByDate, todayIso, viewingDate, viewingDateObj]);

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

  return (
    <div className="daily-log-calendar">
      <div className="flex items-start justify-between">
        <button
          aria-label="上一个月"
          className="daily-log-calendar-arrow"
          onClick={goPrev}
          type="button"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="text-center">
          <div className="text-[24px] font-semibold tracking-[-0.02em]" style={{ color: "var(--v5-ink)" }}>
            {cursor.year} 年 {cursor.month} 月
          </div>
          <div className="mt-1 text-xs italic" style={{ color: "var(--v5-ink3)" }}>
            May, in passing
          </div>
        </div>

        <button
          aria-label="下一个月"
          className="daily-log-calendar-arrow disabled:cursor-not-allowed disabled:opacity-30"
          disabled={!canGoNextMonth}
          onClick={goNext}
          type="button"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-7 grid grid-cols-7 gap-2 text-center text-xs font-medium" style={{ color: "var(--v5-ink3)" }}>
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="mt-3 hidden grid-cols-7 gap-2 md:grid">
        {cells.map((cell, i) => (
          <CalendarCell cell={cell} key={`m-${i}`} onPick={onPick} />
        ))}
      </div>

      <div className="md:hidden">
        <div className="mt-3 grid grid-cols-7 gap-2">
          {(mobileExpanded ? cells : currentWeekCells).map((cell, i) => (
            <CalendarCell cell={cell} key={`mob-${i}`} onPick={onPick} />
          ))}
        </div>
        <div className="mt-4 flex justify-center">
          <button
            className="text-xs"
            onClick={() => setMobileExpanded((v) => !v)}
            style={{ color: "var(--v5-accent)" }}
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

  const { date, day, isFuture, isViewing, mood } = cell;
  const hasMood = mood !== null;

  return (
    <button
      aria-label={`查看 ${date}${hasMood ? ` 心情 ${mood}/10` : ""}`}
      className="daily-log-calendar-cell"
      disabled={isFuture}
      onClick={() => onPick(date)}
      style={{
        background: hasMood ? moodColor(mood) : "rgba(255, 253, 248, 0.28)",
        borderColor: isViewing
          ? "var(--v5-ink)"
          : hasMood
            ? "rgba(90,60,35,0.10)"
            : "rgba(139,94,60,0.10)",
        color: hasMood ? "#fffaf3" : "var(--v5-ink2)",
        opacity: isFuture ? 0.28 : 1,
        boxShadow: isViewing ? "inset 0 0 0 2px #d59b72" : undefined,
      }}
      type="button"
    >
      {day}
    </button>
  );
}
