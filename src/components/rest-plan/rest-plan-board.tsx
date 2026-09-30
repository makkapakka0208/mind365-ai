"use client";

import { Check, Loader2, Pencil, Plus, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { getTodayISODate, parseISODate } from "@/lib/date";
import { findRestBlock, isRestSeason, useHolidayVersion, type RestBlock } from "@/lib/holidays";
import {
  KIND_LABEL,
  PACE_LABEL,
  WEEKDAY_CN,
  addRestItem,
  buildRestPlanContext,
  generateRestPlan,
  removeRestItem,
  saveRestPlan,
  toggleRestItem,
  updateRestItem,
  useRestPlans,
} from "@/lib/rest-plan";
import type { RestItemKind, RestPlan, RestPlanItem, RestPlanPace } from "@/types/life-path";

/**
 * 周末 / 假期计划。
 * - variant="full"：人生主线页，生成、查看、修改、勾选；
 * - variant="home"：首页，只在休息日及前一天出现，展示当天的安排。
 */

const SERIF = "var(--v5-serif)";
const noopSubscribe = () => () => {};

const KIND_COLOR: Record<RestItemKind, string> = {
  fixed: "var(--v5-rose)",
  task: "var(--v5-accent)",
  todo: "var(--v5-accent)",
  goal: "var(--v5-accent-deep)",
  habit: "var(--m-success)",
  reading: "var(--v5-amber)",
  rest: "var(--v5-ink-mute)",
  life: "var(--v5-ink3)",
};

const md = (iso: string) => {
  const d = parseISODate(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};
const weekday = (iso: string) => WEEKDAY_CN[parseISODate(iso).getDay()];

function rangeLabel(block: RestBlock) {
  const days = block.dates.length;
  return days === 1 ? `${md(block.start)} ${weekday(block.start)}` : `${md(block.start)}–${md(block.end)} · ${days} 天`;
}

function startsLabel(block: RestBlock) {
  if (block.startsIn === 0) return "进行中";
  if (block.startsIn === 1) return "明天开始";
  return `${block.startsIn} 天后开始`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 当前正在进行的条目：今天、开始时间已到、且下一条还没开始 */
function currentItemId(items: RestPlanItem[], date: string): string | null {
  if (date !== getTodayISODate()) return null;
  const now = nowHHMM();
  let current: RestPlanItem | null = null;
  for (const it of items) if (it.start <= now) current = it;
  if (current?.end && current.end <= now) return null;
  return current?.id ?? null;
}

function useRestBlock() {
  const holidayVersion = useHolidayVersion();
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  void holidayVersion; // 节假日数据加载完成后重新计算
  return isClient ? findRestBlock() : null;
}

// ── 生成表单 ────────────────────────────────────────────────────────────────

function GenerateForm({ block, initial, onDone, onCancel }: {
  block: RestBlock;
  initial?: RestPlan;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [pace, setPace] = useState<RestPlanPace>(initial?.pace ?? "balanced");
  const [fixed, setFixed] = useState(initial?.fixed ?? "");
  const [busy, setBusy] = useState(false);
  const [ctx] = useState(buildRestPlanContext);

  const run = async () => {
    setBusy(true);
    try {
      saveRestPlan(await generateRestPlan(block, pace, fixed));
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4" style={{ fontFamily: SERIF }}>
      <label className="grid gap-2">
        <span style={{ fontSize: 14, color: "var(--v5-ink2)" }}>已经定好的安排（可不填）</span>
        <textarea
          value={fixed}
          onChange={(e) => setFixed(e.target.value)}
          rows={2}
          placeholder={block.dates.length > 2 ? "比如：10/2 回老家，10/5 下午和朋友吃饭" : "比如：周六 14:00 和朋友吃饭，周日上午打扫卫生"}
          className="resize-none rounded-[14px] px-4 py-3 text-[15px] outline-none"
          style={{ background: "var(--m-base)", border: "1px solid var(--v5-rule)", color: "var(--v5-ink)" }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <span style={{ fontSize: 14, color: "var(--v5-ink2)" }}>这几天想过得</span>
        <div className="inline-flex rounded-full p-1" style={{ background: "rgba(var(--v5-ink-rgb), 0.06)" }}>
          {(Object.keys(PACE_LABEL) as RestPlanPace[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPace(p)}
              className="rounded-full px-4 py-1.5 text-sm transition-all"
              style={
                pace === p
                  ? { background: "var(--v5-accent-fill)", color: "var(--v5-accent-fill-ink)", boxShadow: "0 1px 4px rgba(var(--v5-shadow-rgb), 0.12)" }
                  : { color: "var(--v5-ink3)" }
              }
            >
              {PACE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--v5-ink3)" }}>
        会参考：本周任务 {ctx.tasks.length} 项 · 待办 {ctx.todos.length} 项 · 习惯 {ctx.habits.length} 个 · 目标 {ctx.goals.length} 个
        {ctx.reading.length ? ` · 在读 ${ctx.reading.length} 本` : ""}。不会读取日记内容。
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-opacity disabled:opacity-70"
          style={{ background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)" }}
        >
          {busy ? <Loader2 className="animate-spin" size={15} /> : null}
          {busy ? "正在排计划…" : initial ? "重新生成" : "生成计划"}
        </button>
        {busy && (
          <span style={{ fontSize: 13, color: "var(--v5-ink3)" }}>
            AI 在考虑你的待办和节奏{block.dates.length > 2 ? "，假期较长可能要一两分钟" : "，大约半分钟"}
          </span>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm" style={{ color: "var(--v5-ink3)" }}>
            取消
          </button>
        )}
      </div>
    </div>
  );
}

// ── 单条计划 ────────────────────────────────────────────────────────────────

function ItemRow({ plan, date, item, current, compact }: {
  plan: RestPlan;
  date: string;
  item: RestPlanItem;
  current: boolean;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ start: item.start, end: item.end ?? "", title: item.title });

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2 rounded-[12px] px-3 py-2"
        style={{ background: "var(--m-base)", border: "1px solid var(--v5-rule)" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.title.trim() || !draft.start) return;
          updateRestItem(plan.id, date, item.id, { start: draft.start, end: draft.end && draft.end > draft.start ? draft.end : undefined, title: draft.title.trim() });
          setEditing(false);
        }}
      >
        <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="rounded-md bg-transparent px-1 text-sm outline-none" style={{ color: "var(--v5-ink)" }} />
        <span style={{ color: "var(--v5-ink3)" }}>–</span>
        <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="rounded-md bg-transparent px-1 text-sm outline-none" style={{ color: "var(--v5-ink)" }} />
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="min-w-[140px] flex-1 border-b bg-transparent py-1 text-[15px] outline-none"
          style={{ borderColor: "var(--v5-rule-strong)", color: "var(--v5-ink)", fontFamily: SERIF }}
        />
        <button type="submit" className="text-sm" style={{ color: "var(--v5-accent)" }}>保存</button>
        <button type="button" onClick={() => setEditing(false)} className="text-sm" style={{ color: "var(--v5-ink3)" }}>取消</button>
        <button type="button" onClick={() => removeRestItem(plan.id, date, item.id)} className="ml-auto text-sm" style={{ color: "var(--v5-ink3)" }}>删除</button>
      </form>
    );
  }

  const time = `${item.start}${item.end ? `–${item.end}` : ""}`;
  const timeColor = current ? "var(--v5-accent)" : "var(--v5-ink3)";

  // 手机：时间在上、名称在下（可换行，不截断），类型只用圆点表示，点名称进入编辑；
  // 桌面：时间 | 名称 + 类型 | 操作（修改 / 删除悬停出现）
  return (
    <div
      className={`group grid items-center gap-x-3 rounded-[12px] px-3 py-2 transition-colors grid-cols-[minmax(0,1fr)_auto] ${
        compact ? "sm:grid-cols-[88px_minmax(0,1fr)_auto]" : "sm:grid-cols-[104px_minmax(0,1fr)_auto]"
      }`}
      style={{
        background: current ? "rgba(var(--v5-accent-rgb), 0.10)" : undefined,
        boxShadow: current ? "inset 2px 0 0 var(--v5-accent)" : undefined,
      }}
    >
      <span className="hidden tabular-nums sm:inline" style={{ fontSize: 13.5, color: timeColor }}>
        {time}
      </span>
      <div className="min-w-0" style={{ fontFamily: SERIF }}>
        <div className="tabular-nums sm:hidden" style={{ fontSize: 12.5, color: timeColor }}>
          {time}
        </div>
        <div className="flex min-w-0 items-baseline gap-2">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full" style={{ background: KIND_COLOR[item.kind] }} title={KIND_LABEL[item.kind]} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-w-0 break-words text-left sm:truncate"
            style={{ fontSize: 15, lineHeight: 1.45, color: item.done ? "var(--v5-ink-mute)" : "var(--v5-ink)", textDecoration: item.done ? "line-through" : undefined }}
            title={`${item.title}（点击修改 / 删除）`}
          >
            {item.title}
          </button>
          {!compact && (
            <span className="hidden shrink-0 text-[11.5px] sm:inline" style={{ color: "var(--v5-ink3)" }}>{KIND_LABEL[item.kind]}</span>
          )}
        </div>
      </div>
      <span className="flex items-center gap-1">
        {!compact && (
          <>
            <button type="button" title="修改" onClick={() => setEditing(true)} className="hidden rounded-full p-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:block" style={{ color: "var(--v5-ink3)" }}>
              <Pencil size={13} />
            </button>
            <button type="button" title="删除" onClick={() => removeRestItem(plan.id, date, item.id)} className="hidden rounded-full p-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:block" style={{ color: "var(--v5-ink3)" }}>
              <X size={14} />
            </button>
          </>
        )}
        <button
          type="button"
          title={item.done ? "取消完成" : item.refId && (item.kind === "todo" || item.kind === "task") ? "完成（原待办 / 任务也会勾掉）" : "完成"}
          onClick={() => toggleRestItem(plan.id, date, item)}
          className="grid h-6 w-6 place-items-center rounded-full transition-colors"
          style={{
            border: `1.5px solid ${item.done ? "var(--v5-accent)" : "var(--v5-rule-strong)"}`,
            background: item.done ? "var(--v5-accent)" : "transparent",
            color: "var(--m-on-accent)",
          }}
        >
          {item.done ? <Check size={13} strokeWidth={3} /> : null}
        </button>
      </span>
    </div>
  );
}

function AddItemRow({ plan, date }: { plan: RestPlan; date: string }) {
  const [draft, setDraft] = useState({ start: "", end: "", title: "" });
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2 px-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.title.trim() || !draft.start) return;
        addRestItem(plan.id, date, {
          start: draft.start,
          ...(draft.end && draft.end > draft.start ? { end: draft.end } : {}),
          title: draft.title.trim(),
          kind: "life",
        });
        setDraft({ start: "", end: "", title: "" });
      }}
    >
      <Plus size={14} style={{ color: "var(--v5-ink3)" }} />
      <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="bg-transparent text-sm outline-none" style={{ color: "var(--v5-ink2)" }} />
      <span style={{ color: "var(--v5-ink3)" }}>–</span>
      <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="bg-transparent text-sm outline-none" style={{ color: "var(--v5-ink2)" }} />
      <input
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder="加一项安排"
        className="min-w-[140px] flex-1 bg-transparent py-1 text-[14.5px] outline-none placeholder:text-[var(--v5-ink-mute)]"
        style={{ color: "var(--v5-ink)", fontFamily: SERIF }}
      />
      {draft.title.trim() && draft.start && (
        <button type="submit" className="text-sm" style={{ color: "var(--v5-accent)" }}>添加</button>
      )}
    </form>
  );
}

// ── 人生主线页：完整版 ──────────────────────────────────────────────────────

export function RestPlanBoard() {
  const block = useRestBlock();
  const plans = useRestPlans();
  const plan = block ? plans.find((p) => p.id === block.start) : undefined;
  const [regenerating, setRegenerating] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  // 从首页「调整 →」跳过来时滚到这里
  useEffect(() => {
    if (window.location.hash === "#rest-plan") document.getElementById("rest-plan")?.scrollIntoView({ block: "start" });
  }, []);

  const today = getTodayISODate();
  const date = plan
    ? pickedDate && plan.days.some((d) => d.date === pickedDate)
      ? pickedDate
      : plan.days.some((d) => d.date === today) ? today : plan.days[0]?.date
    : null;
  const day = plan?.days.find((d) => d.date === date);

  return (
    <section id="rest-plan">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="v5-eyebrow">REST DAYS · 周末计划</div>
          {block && (
            <div className="mt-2" style={{ fontFamily: SERIF, fontSize: 18, color: "var(--v5-ink)" }}>
              {block.name}
              <span style={{ fontSize: 14, color: "var(--v5-ink3)" }}>　{rangeLabel(block)} · {startsLabel(block)}</span>
            </div>
          )}
        </div>
        {plan && !regenerating && (
          <ConfirmButton
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
            confirmLabel="会覆盖当前计划，确定？"
            onConfirm={() => setRegenerating(true)}
            style={{ color: "var(--v5-ink3)", border: "1px solid var(--v5-rule)" }}
          >
            <RefreshCw size={13} /> 重新生成
          </ConfirmButton>
        )}
      </div>

      <div className="rounded-[24px] px-6 py-5" style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", boxShadow: "var(--v5-sh-2)" }}>
        {!block ? (
          <p style={{ margin: 0, fontFamily: SERIF, fontSize: 15, color: "var(--v5-ink3)" }}>最近三周没有休息日。</p>
        ) : !plan || regenerating ? (
          <GenerateForm
            block={block}
            initial={regenerating ? plan : undefined}
            onDone={() => {
              setRegenerating(false);
              setPickedDate(null);
            }}
            onCancel={regenerating ? () => setRegenerating(false) : undefined}
          />
        ) : (
          <>
            {plan.summary && (
              <p className="mb-4" style={{ margin: "0 0 16px", fontFamily: SERIF, fontSize: 14.5, fontStyle: "italic", color: "var(--v5-ink2)" }}>
                {plan.summary}
                <span style={{ fontStyle: "normal", color: "var(--v5-ink3)" }}>　· {PACE_LABEL[plan.pace]}</span>
              </p>
            )}

            {plan.days.length > 1 && (
              <div className="m-scroll-hidden -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 sm:flex-wrap sm:overflow-visible">
                {plan.days.map((d) => {
                  const active = d.date === date;
                  const doneCount = d.items.filter((i) => i.done).length;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setPickedDate(d.date)}
                      className="shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-all"
                      style={
                        active
                          ? { background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)" }
                          : { color: "var(--v5-ink2)", border: "1px solid var(--v5-rule)" }
                      }
                    >
                      {md(d.date).replace("月", "/").replace("日", "")} {weekday(d.date)}
                      {d.date === today ? " · 今天" : ""}
                      {doneCount > 0 && d.items.length > 0 ? ` · ${doneCount}/${d.items.length}` : ""}
                    </button>
                  );
                })}
              </div>
            )}

            {day && (
              <div className="grid gap-0.5">
                {day.items.length === 0 && (
                  <p className="px-3" style={{ margin: 0, fontFamily: SERIF, fontSize: 14.5, color: "var(--v5-ink3)" }}>这一天没有安排，好好休息。</p>
                )}
                {day.items.map((item) => (
                  <ItemRow key={item.id} current={item.id === currentItemId(day.items, day.date)} date={day.date} item={item} plan={plan} />
                ))}
                <AddItemRow date={day.date} plan={plan} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ── 首页：休息日及前一天出现 ────────────────────────────────────────────────

export function RestPlanHomeCard() {
  const block = useRestBlock();
  const plans = useRestPlans();
  if (!block || !isRestSeason(block)) return null;

  const plan = plans.find((p) => p.id === block.start);
  const today = getTodayISODate();
  const day = plan?.days.find((d) => d.date === today) ?? plan?.days[0];
  const current = day ? currentItemId(day.items, day.date) : null;

  return (
    <section className="overflow-hidden" style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 28, boxShadow: "var(--v5-sh-2)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-6 py-4" style={{ borderBottom: "1px solid var(--v5-rule)", background: "rgba(var(--v5-accent-rgb),0.04)" }}>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <span className="v5-eyebrow">{block.name === "周末" ? "周末计划" : `${block.name}计划`}</span>
          <span style={{ fontFamily: SERIF, fontSize: 14, color: "var(--v5-ink3)" }}>{rangeLabel(block)} · {startsLabel(block)}</span>
        </div>
        <Link href="/life-path#rest-plan" className="text-[14px] transition-opacity hover:opacity-80" style={{ fontFamily: SERIF, color: "var(--v5-accent)" }}>
          {plan ? "查看 / 调整 →" : "排一份计划 →"}
        </Link>
      </div>

      <div className="px-3 py-3">
        {!plan || !day ? (
          <p className="px-3 py-1" style={{ margin: 0, fontFamily: SERIF, fontSize: 15, color: "var(--v5-ink2)" }}>
            还没有计划。写下已定的安排、选个节奏，根据你的待办、任务和习惯一键排好这{block.dates.length > 2 ? "个假期" : "个周末"}。
          </p>
        ) : (
          <>
            {day.date !== today && (
              <div className="px-3 pb-1 text-[13px]" style={{ fontFamily: SERIF, color: "var(--v5-ink3)" }}>
                {md(day.date)} {weekday(day.date)} 的安排
              </div>
            )}
            <div className="grid gap-0.5">
              {day.items.slice(0, 8).map((item) => (
                <ItemRow compact current={item.id === current} date={day.date} item={item} key={item.id} plan={plan} />
              ))}
            </div>
            {day.items.length > 8 && (
              <Link href="/life-path#rest-plan" className="block px-3 pt-1 text-[13px]" style={{ fontFamily: SERIF, color: "var(--v5-ink3)" }}>
                还有 {day.items.length - 8} 项 →
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
