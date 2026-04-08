"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Policy } from "@/types/policy";

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 84;
const H_GAP = 32;   // horizontal gap between sibling subtrees
const V_GAP = 64;   // vertical gap between levels
const PAD = 48;     // canvas padding

// ── Helpers ───────────────────────────────────────────────────────────────────

function cut(str: string | null | undefined, max: number): string {
  if (!str) return "";
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function getNodeColors(p: Policy) {
  if (p.status === "extinct") return { fill: "#F5F5F3", stroke: "#B4B2A9", dot: "#B4B2A9" };
  if (p.todayCheckin === "success") return { fill: "#F0FAF4", stroke: "#4A9B6F", dot: "#4A9B6F" };
  if (p.todayCheckin === "fail")    return { fill: "#FEF2F2", stroke: "#C0392B", dot: "#C0392B" };
  return { fill: "#FFFBF0", stroke: "#D4A42A", dot: "#D4A42A" };
}

interface StreakInfo { bg: string; text: string; border: string; label: string; w: number }

function getStreakInfo(streak: number): StreakInfo | null {
  if (streak <= 0) return null;
  if (streak >= 30) return { bg: "#FDECEA", text: "#8B2500", border: "#D44A30", label: `🔥${streak}天`, w: 58 };
  if (streak >= 7)  return { bg: "#FEF3C0", text: "#7A5F00", border: "#D4AF37", label: `⭐${streak}天`, w: 50 };
  return { bg: "#FDF3E7", text: "#7A4F1E", border: "#E8C88A", label: `${streak}天`, w: 38 };
}

// ── Layout algorithm ──────────────────────────────────────────────────────────

interface LNode { policy: Policy; cx: number; y: number }
interface Edge  { x1: number; y1: number; x2: number; y2: number }

function buildLayout(roots: Policy[], collapsed: Set<string>) {
  if (!roots.length) return { nodes: [] as LNode[], edges: [] as Edge[], svgW: PAD * 2, svgH: PAD * 2 };

  // Post-order: compute subtree width for each node
  const sw = new Map<string, number>();

  function calcSW(p: Policy): number {
    const kids = collapsed.has(p.id) ? [] : (p.children ?? []);
    if (!kids.length) { sw.set(p.id, NODE_W); return NODE_W; }
    const total = kids.reduce((s, c) => s + calcSW(c), 0) + (kids.length - 1) * H_GAP;
    const w = Math.max(NODE_W, total);
    sw.set(p.id, w);
    return w;
  }
  roots.forEach(calcSW);

  const totalRootsW =
    roots.reduce((s, r) => s + (sw.get(r.id) ?? NODE_W), 0) +
    (roots.length - 1) * H_GAP;

  const nodes: LNode[] = [];
  const edges: Edge[] = [];
  let maxY = 0;

  // Pre-order: assign x/y coordinates
  function place(p: Policy, cx: number, y: number) {
    nodes.push({ policy: p, cx, y });
    if (y + NODE_H > maxY) maxY = y + NODE_H;

    const kids = collapsed.has(p.id) ? [] : (p.children ?? []);
    if (!kids.length) return;

    const totalKW =
      kids.reduce((s, c) => s + (sw.get(c.id) ?? NODE_W), 0) +
      (kids.length - 1) * H_GAP;
    let kx = cx - totalKW / 2;

    for (const kid of kids) {
      const ksw = sw.get(kid.id) ?? NODE_W;
      const kidCX = kx + ksw / 2;
      edges.push({ x1: cx, y1: y + NODE_H, x2: kidCX, y2: y + NODE_H + V_GAP });
      place(kid, kidCX, y + NODE_H + V_GAP);
      kx += ksw + H_GAP;
    }
  }

  let rx = PAD;
  for (const root of roots) {
    const rsw = sw.get(root.id) ?? NODE_W;
    place(root, rx + rsw / 2, PAD);
    rx += rsw + H_GAP;
  }

  return {
    nodes,
    edges,
    svgW: PAD + totalRootsW + PAD,
    svgH: maxY + PAD,
  };
}

// ── Node card (SVG group) ─────────────────────────────────────────────────────

interface CardProps {
  node: LNode;
  isCollapsed: boolean;
  onCardClick: () => void;
  onToggle: () => void;
}

function NodeCard({ node, isCollapsed, onCardClick, onToggle }: CardProps) {
  const { policy: p, cx, y } = node;
  const lx = cx - NODE_W / 2;
  const c = getNodeColors(p);
  const isExtinct = p.status === "extinct";
  const hasKids = (p.children ?? []).length > 0;
  const sk = getStreakInfo(p.streak ?? 0);

  const title = cut(p.title, 10);
  const desc = cut(p.description, 16);

  // Y positions (card-relative)
  const titleY = y + (desc ? 19 : 27);
  const descY  = y + 35;
  const sepY   = y + 51;
  const footCY = y + 68;   // vertical center of footer row

  return (
    <g opacity={isExtinct ? 0.5 : 1}>
      {/* Card background */}
      <rect
        className="cursor-pointer"
        fill={c.fill}
        height={NODE_H}
        onClick={onCardClick}
        rx={10}
        stroke={c.stroke}
        strokeWidth={1.5}
        width={NODE_W}
        x={lx}
        y={y}
      />

      {/* Status dot */}
      <circle
        cx={lx + 13}
        cy={titleY}
        fill={c.dot}
        pointerEvents="none"
        r={4}
      />

      {/* Title */}
      <text
        dominantBaseline="middle"
        fill={isExtinct ? "#9E9E9E" : "#3D2B1F"}
        fontSize={13}
        fontWeight={600}
        pointerEvents="none"
        style={{
          fontFamily: "'Noto Serif SC', serif",
          textDecoration: isExtinct ? "line-through" : "none",
        }}
        x={lx + 25}
        y={titleY}
      >
        {title}
      </text>

      {/* Description */}
      {desc && (
        <text
          dominantBaseline="middle"
          fill="#9E8070"
          fontSize={11}
          pointerEvents="none"
          style={{ fontFamily: "'Noto Serif SC', serif" }}
          x={lx + 13}
          y={descY}
        >
          {desc}
        </text>
      )}

      {/* Separator */}
      <line
        pointerEvents="none"
        stroke={c.stroke}
        strokeOpacity={0.22}
        strokeWidth={1}
        x1={lx + 10}
        x2={lx + NODE_W - 10}
        y1={sepY}
        y2={sepY}
      />

      {/* Streak badge */}
      {sk && (
        <g pointerEvents="none">
          <rect
            fill={sk.bg}
            height={16}
            rx={8}
            stroke={sk.border}
            strokeWidth={1}
            width={sk.w}
            x={lx + 10}
            y={footCY - 8}
          />
          <text
            dominantBaseline="middle"
            fill={sk.text}
            fontSize={10}
            fontWeight={600}
            textAnchor="middle"
            x={lx + 10 + sk.w / 2}
            y={footCY}
          >
            {sk.label}
          </text>
        </g>
      )}

      {/* Collapse / expand toggle */}
      {hasKids && (
        <g
          className="cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          <circle
            cx={lx + NODE_W - 14}
            cy={footCY}
            fill="white"
            r={10}
            stroke={c.stroke}
            strokeWidth={1.2}
          />
          <text
            dominantBaseline="middle"
            fill={c.dot}
            fontSize={9}
            fontWeight={700}
            textAnchor="middle"
            x={lx + NODE_W - 14}
            y={footCY + 0.5}
          >
            {isCollapsed ? "▼" : "▲"}
          </text>
        </g>
      )}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PolicyTreeGraphProps {
  policies: Policy[];
  onCheckin: (id: string) => void;
  onAddChild: (id: string) => void;
  onExtinguish: (policy: Policy) => void;
  onDelete: (id: string) => void;
}

export function PolicyTreeGraph({
  policies,
  onCheckin,
  onAddChild,
  onExtinguish,
  onDelete,
}: PolicyTreeGraphProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menuPolicy, setMenuPolicy] = useState<Policy | null>(null);

  const { nodes, edges, svgW, svgH } = useMemo(
    () => buildLayout(policies, collapsed),
    [policies, collapsed],
  );

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!policies.length) return null;

  return (
    <>
      <div style={{ overflowX: "auto", overflowY: "visible" }}>
        <svg
          height={svgH}
          style={{ display: "block" }}
          width={Math.max(svgW, 300)}
        >
          {/* Bezier connection lines */}
          {edges.map((e, i) => {
            const my = (e.y1 + e.y2) / 2;
            return (
              <path
                d={`M ${e.x1},${e.y1} C ${e.x1},${my} ${e.x2},${my} ${e.x2},${e.y2}`}
                fill="none"
                key={i}
                stroke="#E8D0A0"
                strokeWidth={1.5}
              />
            );
          })}

          {/* Node cards */}
          {nodes.map((node) => (
            <NodeCard
              isCollapsed={collapsed.has(node.policy.id)}
              key={node.policy.id}
              node={node}
              onCardClick={() => setMenuPolicy(node.policy)}
              onToggle={() => toggleCollapse(node.policy.id)}
            />
          ))}
        </svg>
      </div>

      {/* Action menu dialog */}
      <Dialog
        onClose={() => setMenuPolicy(null)}
        open={menuPolicy !== null}
        title={menuPolicy?.title ?? ""}
      >
        {menuPolicy && (
          <div className="space-y-2">
            {menuPolicy.status === "active" && (
              <>
                <Button
                  className="w-full justify-start"
                  onClick={() => { setMenuPolicy(null); onCheckin(menuPolicy.id); }}
                  variant="ghost"
                >
                  ✅ 打卡
                </Button>
                <Button
                  className="w-full justify-start"
                  onClick={() => { setMenuPolicy(null); onAddChild(menuPolicy.id); }}
                  variant="ghost"
                >
                  ＋ 添加子策略
                </Button>
                <Button
                  className="w-full justify-start"
                  onClick={() => { setMenuPolicy(null); onExtinguish(menuPolicy); }}
                  variant="ghost"
                >
                  ⚡ 熄灭
                </Button>
              </>
            )}
            <Button
              className="w-full justify-start"
              onClick={() => { setMenuPolicy(null); onDelete(menuPolicy.id); }}
              variant="ghost"
            >
              🗑 删除
            </Button>
            <Button
              className="mt-2 w-full"
              onClick={() => setMenuPolicy(null)}
              variant="primary"
            >
              取消
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
