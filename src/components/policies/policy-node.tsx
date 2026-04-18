"use client";

import { CheckCircle2, ChevronDown, ChevronRight, Plus, Trash2, XCircle, Zap } from "lucide-react";
import { useState } from "react";

import type { Policy } from "@/types/policy";

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusDot({ isExtinct, todayCheckin }: { isExtinct: boolean; todayCheckin: Policy["todayCheckin"] }) {
  if (isExtinct) {
    return <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "var(--m-rule)" }} />;
  }
  if (todayCheckin === "success") {
    return <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "#22c55e" }} />;
  }
  if (todayCheckin === "fail") {
    return <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "#ef4444" }} />;
  }
  // Needs checkin — animated yellow pulse
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ background: "#facc15" }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#facc15" }} />
    </span>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (!streak) return null;
  if (streak >= 30) {
    return <span className="flex-shrink-0 text-xs font-bold" style={{ color: "#dc2626" }}>🔥{streak}</span>;
  }
  if (streak >= 7) {
    return <span className="flex-shrink-0 text-xs font-semibold" style={{ color: "#a16207" }}>⭐{streak}</span>;
  }
  return <span className="flex-shrink-0 text-[11px]" style={{ color: "var(--m-ink3)" }}>{streak}天</span>;
}

// ── Action icon button ─────────────────────────────────────────────────────────

interface ActionBtnProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}

function ActionBtn({ icon, title, onClick, danger }: ActionBtnProps) {
  return (
    <button
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150 hover:scale-110"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ color: danger ? "#ef4444" : "var(--m-ink3)" }}
      title={title}
      type="button"
    >
      {icon}
    </button>
  );
}

// ── PolicyNode ─────────────────────────────────────────────────────────────────

interface PolicyNodeProps {
  policy: Policy;
  depth?: number;
  isLast?: boolean;
  onAddChild: (parentId: string) => void;
  onCheckin: (policyId: string) => void;
  onExtinguish: (policy: Policy) => void;
  onDelete: (policyId: string) => void;
}

export function PolicyNode({
  policy,
  depth = 0,
  isLast = false,
  onAddChild,
  onCheckin,
  onExtinguish,
  onDelete,
}: PolicyNodeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const children = policy.children ?? [];
  const hasChildren = children.length > 0;
  const isExtinct = policy.status === "extinct";
  const needsCheckin = !isExtinct && policy.todayCheckin === null;

  return (
    <div className="relative">
      {/* Horizontal connector line (for non-root nodes) */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-[22px] w-3"
          style={{ borderTop: "1.5px solid var(--m-rule)" }}
        />
      )}

      {/* Card */}
      <div
        className="group flex min-h-[44px] cursor-default items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-150"
        style={{
          background: isExtinct
            ? "transparent"
            : needsCheckin
              ? "color-mix(in srgb, #facc15 6%, var(--m-base-light))"
              : "var(--m-base-light)",
          border: needsCheckin
            ? "1px solid rgba(250,204,21,0.5)"
            : "1px solid var(--m-rule)",
          borderLeft: needsCheckin ? "3px solid #facc15" : "1px solid var(--m-rule)",
          boxShadow: isExtinct ? "none" : "var(--m-shadow-out)",
          opacity: isExtinct ? 0.45 : 1,
          filter: isExtinct ? "grayscale(0.8)" : "none",
        }}
      >
        {/* Status dot */}
        <StatusDot isExtinct={isExtinct} todayCheckin={policy.todayCheckin} />

        {/* Title + description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="truncate text-sm font-medium leading-5"
              style={{
                color: "var(--m-ink)",
                textDecoration: isExtinct ? "line-through" : "none",
              }}
            >
              {policy.title}
            </span>
            {isExtinct && (
              <span
                className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
                style={{ background: "var(--m-rule)", color: "var(--m-ink3)" }}
              >
                已熄灭
              </span>
            )}
          </div>
          {policy.description ? (
            <p className="truncate text-[11px] leading-4 mt-0.5" style={{ color: "var(--m-ink3)" }}>
              {policy.description}
            </p>
          ) : null}
        </div>

        {/* Streak badge */}
        <StreakBadge streak={policy.streak ?? 0} />

        {/* Today's checkin status icon */}
        {!isExtinct && policy.todayCheckin === "success" && (
          <CheckCircle2 className="flex-shrink-0" size={13} style={{ color: "#22c55e" }} />
        )}
        {!isExtinct && policy.todayCheckin === "fail" && (
          <XCircle className="flex-shrink-0" size={13} style={{ color: "#ef4444" }} />
        )}

        {/* Hover-reveal action buttons */}
        <div className="flex flex-shrink-0 items-center gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {!isExtinct && (
            <>
              <ActionBtn
                icon={<CheckCircle2 size={13} />}
                onClick={() => onCheckin(policy.id)}
                title="打卡"
              />
              <ActionBtn
                icon={<Plus size={13} />}
                onClick={() => onAddChild(policy.id)}
                title="添加子策略"
              />
              <ActionBtn
                icon={<Zap size={13} />}
                onClick={() => onExtinguish(policy)}
                title="熄灭"
              />
            </>
          )}
          <ActionBtn
            danger
            icon={<Trash2 size={13} />}
            onClick={() => onDelete(policy.id)}
            title="删除"
          />
        </div>

        {/* Collapse toggle */}
        {hasChildren && (
          <button
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-150 hover:opacity-70"
            onClick={() => setCollapsed((c) => !c)}
            style={{
              background: "var(--m-base)",
              border: "1px solid var(--m-rule)",
              color: "var(--m-ink3)",
            }}
            title={collapsed ? "展开" : "收起"}
            type="button"
          >
            {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {/* Children with tree lines */}
      {!collapsed && hasChildren && (
        <div
          className="relative ml-4 mt-1 space-y-1 pb-1 pl-3"
          style={{ borderLeft: "1.5px solid var(--m-rule)" }}
        >
          {children.map((child, i) => (
            <PolicyNode
              depth={depth + 1}
              isLast={i === children.length - 1}
              key={child.id}
              onAddChild={onAddChild}
              onCheckin={onCheckin}
              onDelete={onDelete}
              onExtinguish={onExtinguish}
              policy={child}
            />
          ))}
        </div>
      )}
    </div>
  );
}
