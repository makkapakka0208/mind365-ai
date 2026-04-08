"use client";

import { CheckCircle2, ChevronDown, ChevronRight, Plus, Trash2, XCircle, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { countDescendants } from "@/lib/policies";
import type { Policy } from "@/types/policy";

interface PolicyNodeProps {
  policy: Policy;
  depth?: number;
  onAddChild: (parentId: string) => void;
  onCheckin: (policyId: string) => void;
  onExtinguish: (policy: Policy) => void;
  onDelete: (policyId: string) => void;
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null;

  const isRed = streak >= 30;
  const isGold = streak >= 7;

  const style = isRed
    ? { background: "rgba(239,68,68,0.12)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.25)" }
    : isGold
      ? { background: "rgba(234,179,8,0.12)", color: "#a16207", border: "1px solid rgba(234,179,8,0.25)" }
      : { background: "var(--m-base)", color: "var(--m-ink3)", border: "1px solid var(--m-rule)" };

  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={style}>
      {isRed ? "🔥" : isGold ? "⭐" : "✦"} {streak}天
    </span>
  );
}

function CheckinBadge({ status }: { status: "success" | "fail" | null | undefined }) {
  if (status === "success") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}
      >
        <CheckCircle2 size={12} /> 今日已打卡
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "rgba(239,68,68,0.1)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        <XCircle size={12} /> 今日未达成
      </span>
    );
  }
  return null;
}

export function PolicyNode({
  policy,
  depth = 0,
  onAddChild,
  onCheckin,
  onExtinguish,
  onDelete,
}: PolicyNodeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = (policy.children?.length ?? 0) > 0;
  const isExtinct = policy.status === "extinct";
  const needsCheckin = !isExtinct && policy.todayCheckin === null;

  return (
    <div className={depth > 0 ? "pl-4 border-l" : ""} style={depth > 0 ? { borderColor: "var(--m-rule)" } : {}}>
      <div
        className="rounded-xl p-4 transition-all duration-200"
        style={{
          background: isExtinct ? "var(--m-base)" : "var(--m-base-light)",
          border: needsCheckin
            ? "1px solid #facc15"
            : "1px solid var(--m-rule)",
          borderLeft: needsCheckin
            ? "4px solid #facc15"
            : depth > 0
              ? "1px solid var(--m-rule)"
              : "1px solid var(--m-rule)",
          boxShadow: isExtinct ? "none" : "var(--m-shadow-out)",
          opacity: isExtinct ? 0.4 : 1,
          filter: isExtinct ? "grayscale(1)" : "none",
        }}
      >
        {/* Top row: badges */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {isExtinct ? (
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ background: "var(--m-rule)", color: "var(--m-ink3)" }}
            >
              已熄灭
            </span>
          ) : (
            <>
              <StreakBadge streak={policy.streak ?? 0} />
              <CheckinBadge status={policy.todayCheckin} />
            </>
          )}
        </div>

        {/* Title */}
        <h4
          className="text-sm font-semibold leading-snug"
          style={{
            color: "var(--m-ink)",
            textDecoration: isExtinct ? "line-through" : "none",
          }}
        >
          {policy.title}
        </h4>

        {/* Description */}
        {policy.description ? (
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--m-ink2)" }}>
            {policy.description}
          </p>
        ) : null}

        {/* Action buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isExtinct && (
            <>
              <Button
                onClick={() => onCheckin(policy.id)}
                size="sm"
                variant="secondary"
              >
                <CheckCircle2 className="mr-1" size={13} />
                打卡
              </Button>

              <Button
                onClick={() => onAddChild(policy.id)}
                size="sm"
                variant="ghost"
              >
                <Plus className="mr-1" size={13} />
                子策略
              </Button>

              <Button
                onClick={() => onExtinguish(policy)}
                size="sm"
                variant="ghost"
              >
                <Zap className="mr-1" size={13} />
                熄灭
              </Button>
            </>
          )}

          <Button
            onClick={() => onDelete(policy.id)}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="mr-1" size={13} />
            删除
          </Button>

          {hasChildren && (
            <button
              className="ml-auto flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
              onClick={() => setCollapsed((c) => !c)}
              style={{ color: "var(--m-ink3)" }}
              type="button"
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              {collapsed ? "展开" : "收起"} {policy.children!.length} 个子策略
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {!collapsed && hasChildren && (
        <div className="mt-2 space-y-2">
          {policy.children!.map((child) => (
            <PolicyNode
              depth={depth + 1}
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
