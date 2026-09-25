"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { ACCOUNT_STORAGE_EVENT } from "@/lib/account-storage";
import { getTodayISODate, parseISODate } from "@/lib/date";
import { readMilestonesRaw, saveMilestones } from "@/lib/life-path-storage";
import { buildAutoMilestones, MILESTONE_ICONS, milestoneIcon, type AutoMilestone } from "@/lib/milestones";
import type { DailyLog } from "@/types";
import type { Milestone } from "@/types/life-path";

/**
 * 生命时间线：按年、按月排开。每个月一行——月份 / 这个月的里程碑 / 每一天的小圆点
 * （写了日记的日子按心情着色，点开看那天）。手动里程碑可增改删；自动里程碑默认收起。
 */

const SERIF = "var(--v5-serif)";

function subscribe(cb: () => void) {
  window.addEventListener("mind365:storage", cb);
  window.addEventListener(ACCOUNT_STORAGE_EVENT, cb);
  return () => {
    window.removeEventListener("mind365:storage", cb);
    window.removeEventListener(ACCOUNT_STORAGE_EVENT, cb);
  };
}

function useMilestones(): Milestone[] {
  const raw = useSyncExternalStore(subscribe, readMilestonesRaw, () => null);
  return useMemo(() => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as Milestone[]) : [];
    } catch {
      return [];
    }
  }, [raw]);
}

type Draft = { id?: string; date: string; title: string; icon: string; note: string };

function MilestoneForm({
  draft,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <form
      className="grid gap-4 rounded-[20px] px-6 py-5"
      style={{ background: "var(--m-base)", border: "1px solid var(--v5-rule)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.title.trim() && draft.date) onSave();
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          required
          value={draft.date}
          onChange={(e) => onChange({ ...draft, date: e.target.value })}
          className="rounded-full bg-transparent px-3 py-1.5 text-sm outline-none"
          style={{ border: "1px solid var(--v5-rule-strong)", color: "var(--v5-ink)", fontFamily: SERIF }}
        />
        <input
          autoFocus
          required
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="发生了什么，比如：搬到深圳"
          maxLength={60}
          className="min-w-[220px] flex-1 bg-transparent py-1.5 text-[17px] outline-none placeholder:text-[var(--v5-ink-mute)]"
          style={{ color: "var(--v5-ink)", fontFamily: SERIF, borderBottom: "1px solid var(--v5-rule)" }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {MILESTONE_ICONS.map(({ key, label, Icon }) => {
          const active = draft.icon === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ ...draft, icon: key })}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors"
              style={{
                fontFamily: SERIF,
                background: active ? "var(--v5-accent-fill)" : "transparent",
                color: active ? "var(--v5-accent-fill-ink)" : "var(--v5-ink3)",
                border: `1px solid ${active ? "var(--v5-accent-fill-ring)" : "var(--v5-rule)"}`,
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>
      <input
        value={draft.note}
        onChange={(e) => onChange({ ...draft, note: e.target.value })}
        placeholder="补一句（可选）"
        maxLength={120}
        className="bg-transparent py-1 text-[14.5px] outline-none placeholder:text-[var(--v5-ink-mute)]"
        style={{ color: "var(--v5-ink2)", fontFamily: SERIF, fontStyle: "italic" }}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm transition-opacity hover:opacity-90"
          style={{ background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)", fontFamily: SERIF }}
        >
          保存
        </button>
        <button type="button" onClick={onCancel} className="text-sm" style={{ color: "var(--v5-ink3)" }}>
          取消
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto inline-flex items-center gap-1 text-sm transition-opacity hover:opacity-80"
            style={{ color: "var(--m-danger)" }}
          >
            <Trash2 size={13} /> 删除
          </button>
        )}
      </div>
    </form>
  );
}

export function LifeTimeline({ logs, onOpenLog }: { logs: DailyLog[]; onOpenLog: (id: string) => void }) {
  const milestones = useMilestones();
  const todayIso = getTodayISODate();
  const currentYear = Number(todayIso.slice(0, 4));

  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    for (const l of logs) set.add(Number(l.date.slice(0, 4)));
    for (const m of milestones) set.add(Number(m.date.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [logs, milestones, currentYear]);

  const [year, setYear] = useState(currentYear);
  const [showAuto, setShowAuto] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const autoMilestones = useMemo(() => buildAutoMilestones(logs), [logs]);

  const logByDate = useMemo(() => {
    const m = new Map<string, DailyLog>();
    for (const l of logs) if (!m.has(l.date) || l.mood > (m.get(l.date)?.mood ?? 0)) m.set(l.date, l);
    return m;
  }, [logs]);

  // 这一年要展示的月份：今年到当前月，往年 1–12 月
  const lastMonth = year === currentYear ? Number(todayIso.slice(5, 7)) : 12;
  const months = Array.from({ length: lastMonth }, (_, i) => i + 1);

  const inMonth = <T extends { date: string }>(list: T[], m: number) =>
    list
      .filter((x) => x.date.startsWith(`${year}-${String(m).padStart(2, "0")}`))
      .sort((a, b) => a.date.localeCompare(b.date));

  const saveDraft = () => {
    if (!draft) return;
    const item: Milestone = {
      id: draft.id ?? crypto.randomUUID(),
      date: draft.date,
      title: draft.title.trim(),
      icon: draft.icon,
      note: draft.note.trim() || undefined,
      createdAt: milestones.find((m) => m.id === draft.id)?.createdAt ?? new Date().toISOString(),
    };
    const next = draft.id ? milestones.map((m) => (m.id === draft.id ? item : m)) : [...milestones, item];
    saveMilestones(next);
    setYear(Number(item.date.slice(0, 4)));
    setDraft(null);
  };

  return (
    <section>
      {/* 标题行 */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="v5-eyebrow">LIFE TIMELINE · 生命时间线</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className="rounded-full px-3.5 py-1 text-[15px] transition-colors"
                style={{
                  fontFamily: SERIF,
                  fontFeatureSettings: '"lnum" 1',
                  color: y === year ? "var(--v5-ink)" : "var(--v5-ink3)",
                  borderBottom: y === year ? "1px solid var(--v5-accent)" : "1px solid transparent",
                  borderRadius: 0,
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px]" style={{ fontFamily: SERIF, color: "var(--v5-ink3)" }}>
            <input type="checkbox" checked={showAuto} onChange={(e) => setShowAuto(e.target.checked)} className="accent-[var(--v5-accent)]" />
            显示自动里程碑
          </label>
          <button
            type="button"
            onClick={() => setDraft({ date: todayIso, title: "", icon: "other", note: "" })}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)", fontFamily: SERIF }}
          >
            <Plus size={14} /> 记一个里程碑
          </button>
        </div>
      </div>

      {draft && (
        <div className="mb-5">
          <MilestoneForm
            draft={draft}
            onCancel={() => setDraft(null)}
            onChange={setDraft}
            onDelete={draft.id ? () => { saveMilestones(milestones.filter((m) => m.id !== draft.id)); setDraft(null); } : undefined}
            onSave={saveDraft}
          />
        </div>
      )}

      {/* 月份列表 */}
      <div
        className="overflow-hidden"
        style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 24, boxShadow: "var(--v5-sh-2)" }}
      >
        {months.map((m, idx) => {
          const manual = inMonth(milestones, m);
          const auto: AutoMilestone[] = showAuto ? inMonth(autoMilestones, m).slice(0, 2) : [];
          const daysInMonth = new Date(year, m, 0).getDate();
          const lastDay = year === currentYear && m === lastMonth ? Number(todayIso.slice(8, 10)) : daysInMonth;
          const written = Array.from({ length: lastDay }, (_, i) => `${year}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)
            .filter((iso) => logByDate.has(iso)).length;

          return (
            <div
              key={m}
              className="grid items-start gap-x-6 gap-y-3 px-7 py-4"
              style={{ gridTemplateColumns: "64px minmax(0,1fr) auto", borderTop: idx === 0 ? "none" : "1px solid var(--v5-rule)" }}
            >
              {/* 月份 */}
              <div style={{ fontFamily: SERIF, fontFeatureSettings: '"lnum" 1', paddingTop: 2 }}>
                <div style={{ fontSize: 20, color: "var(--v5-ink)" }}>{m} 月</div>
                <div style={{ fontSize: 12, color: "var(--v5-ink3)" }}>{written ? `写了 ${written} 天` : "—"}</div>
              </div>

              {/* 里程碑 */}
              <div className="flex min-w-0 flex-col gap-1.5" style={{ paddingTop: 4 }}>
                {manual.map((ms) => {
                  const Icon = milestoneIcon(ms.icon);
                  return (
                    <button
                      key={ms.id}
                      type="button"
                      onClick={() => setDraft({ id: ms.id, date: ms.date, title: ms.title, icon: ms.icon, note: ms.note ?? "" })}
                      className="group flex items-baseline gap-2.5 text-left"
                      title="点击编辑"
                    >
                      <Icon size={15} className="shrink-0 translate-y-0.5" style={{ color: "var(--v5-accent)" }} />
                      <span className="transition-colors group-hover:text-[var(--v5-accent)]" style={{ fontFamily: SERIF, fontSize: 16.5, color: "var(--v5-ink)" }}>
                        {ms.title}
                      </span>
                      <span style={{ fontFamily: SERIF, fontSize: 12.5, color: "var(--v5-ink3)", fontFeatureSettings: '"lnum" 1' }}>
                        {parseISODate(ms.date).getDate()} 日{ms.note ? ` · ${ms.note}` : ""}
                      </span>
                    </button>
                  );
                })}
                {auto.map((ms) => {
                  const Icon = milestoneIcon(ms.icon);
                  return (
                    <div key={ms.id} className="flex items-baseline gap-2.5" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: "var(--v5-ink3)" }}>
                      <Icon size={13} className="shrink-0 translate-y-0.5" style={{ opacity: 0.7 }} />
                      {ms.title}
                    </div>
                  );
                })}
              </div>

              {/* 每一天 */}
              <div className="grid gap-[5px]" style={{ gridTemplateColumns: "repeat(16, 10px)", paddingTop: 6 }}>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const iso = `${year}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                  const log = logByDate.get(iso);
                  const future = iso > todayIso;
                  if (future) return <span key={iso} style={{ width: 10, height: 10 }} />;
                  if (!log) {
                    return <span key={iso} className="block rounded-full" style={{ width: 10, height: 10, border: "1px solid var(--v5-rule-strong)" }} />;
                  }
                  const strength = log.mood > 0 ? 0.25 + (log.mood / 10) * 0.75 : 0.5;
                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-label={`${m} 月 ${i + 1} 日${log.mood ? ` · 心情 ${log.mood}` : ""}`}
                      title={`${m} 月 ${i + 1} 日${log.mood ? ` · 心情 ${log.mood}` : ""}`}
                      onClick={() => onOpenLog(log.id)}
                      className="block rounded-full transition-transform hover:scale-150"
                      style={{ width: 10, height: 10, background: `rgba(var(--v5-accent-rgb),${strength.toFixed(2)})` }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {milestones.length === 0 && !draft && (
        <p className="mt-3" style={{ fontFamily: SERIF, fontSize: 13.5, color: "var(--v5-ink3)" }}>
          还没有里程碑。搬家、换工作、开始一件事——把那些改变生活的日子标在这里。
        </p>
      )}
    </section>
  );
}
