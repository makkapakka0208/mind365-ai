"use client";

import { Loader2, Plus, TreePine } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { PolicyNode } from "@/components/policies/policy-node";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import {
  addPolicy,
  checkinPolicy,
  countDescendants,
  deletePolicy,
  extinguishPolicy,
  fetchPolicyTree,
} from "@/lib/policies";
import type { Policy } from "@/types/policy";

// ── Modal state types ──────────────────────────────────────────────────────────

interface AddModal {
  parentId: string | null;
  parentTitle: string | null;
}

interface ExtinguishModal {
  policy: Policy;
  descendantCount: number;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [tree, setTree] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [addModal, setAddModal] = useState<AddModal | null>(null);
  const [checkinPolicyId, setCheckinPolicyId] = useState<string | null>(null);
  const [extinguishModal, setExtinguishModal] = useState<ExtinguishModal | null>(null);

  // Modal form state
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [checkinNote, setCheckinNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // ── Data fetching ────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    try {
      const data = await fetchPolicyTree();
      setTree(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, [reload]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openAddRoot = () => {
    setAddTitle("");
    setAddDesc("");
    setAddModal({ parentId: null, parentTitle: null });
  };

  const openAddChild = (parentId: string) => {
    const find = (nodes: Policy[]): Policy | undefined => {
      for (const n of nodes) {
        if (n.id === parentId) return n;
        const found = find(n.children ?? []);
        if (found) return found;
      }
    };
    const parent = find(tree);
    setAddTitle("");
    setAddDesc("");
    setAddModal({ parentId, parentTitle: parent?.title ?? null });
  };

  const onAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim() || !addModal) return;
    setIsSubmitting(true);
    try {
      await addPolicy(addModal.parentId, addTitle.trim(), addDesc.trim());
      setAddModal(null);
      await reload();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "添加失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCheckin = (policyId: string) => {
    setCheckinNote("");
    setCheckinPolicyId(policyId);
  };

  const onCheckin = async (result: "success" | "fail") => {
    if (!checkinPolicyId) return;
    setIsSubmitting(true);
    try {
      await checkinPolicy(checkinPolicyId, result, checkinNote);
      setCheckinPolicyId(null);
      await reload();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "打卡失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openExtinguish = (policy: Policy) => {
    setExtinguishModal({ policy, descendantCount: countDescendants(policy) });
  };

  const onExtinguishConfirm = async () => {
    if (!extinguishModal) return;
    setIsSubmitting(true);
    try {
      await extinguishPolicy(extinguishModal.policy.id);
      setExtinguishModal(null);
      await reload();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "熄灭失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async (policyId: string) => {
    if (!window.confirm("确认删除该策略及所有子策略？此操作不可恢复。")) return;
    try {
      await deletePolicy(policyId);
      await reload();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "删除失败");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const activeCount = tree.reduce(function countActive(sum: number, p: Policy): number {
    return sum + (p.status === "active" ? 1 : 0) + (p.children ?? []).reduce(countActive, 0);
  }, 0);

  const uncheckedToday = tree.reduce(function countUnchecked(sum: number, p: Policy): number {
    const self = p.status === "active" && p.todayCheckin === null ? 1 : 0;
    return sum + self + (p.children ?? []).reduce(countUnchecked, 0);
  }, 0);

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="把长期目标拆解成可递归执行的行动节点，每天打卡，逐步推进稳态。"
        eyebrow="RSIP"
        icon={TreePine}
        title="国策树"
      />

      {/* Summary bar */}
      {!loading && !error && tree.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Panel className="px-4 py-3 text-sm" inset>
            <span style={{ color: "var(--m-ink3)" }}>活跃节点</span>
            <span className="ml-2 font-semibold" style={{ color: "var(--m-ink)" }}>
              {activeCount}
            </span>
          </Panel>
          {uncheckedToday > 0 && (
            <Panel className="px-4 py-3 text-sm" inset>
              <span style={{ color: "#a16207" }}>今日待打卡</span>
              <span className="ml-2 font-semibold" style={{ color: "#a16207" }}>
                {uncheckedToday}
              </span>
            </Panel>
          )}
        </div>
      )}

      {/* Error */}
      {error ? (
        <Panel className="p-6">
          <p className="text-sm" style={{ color: "var(--m-danger, #dc2626)" }}>
            {error}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--m-ink3)" }}>
            此功能需要 Supabase 支持。请先在设置页完成连接配置，并在 Supabase 中建立 focus_policies 和 policy_checkins 表。
          </p>
        </Panel>
      ) : loading ? (
        <Panel className="flex items-center gap-3 p-7" style={{ color: "var(--m-ink2)" }}>
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">正在加载国策树...</span>
        </Panel>
      ) : (
        <>
          {/* Add root button */}
          <div className="flex items-center gap-3">
            <Button onClick={openAddRoot} variant="primary">
              <Plus className="mr-2" size={16} />
              新增根节点
            </Button>
            {actionMsg && (
              <span className="text-sm" style={{ color: "var(--m-danger, #dc2626)" }}>
                {actionMsg}
              </span>
            )}
          </div>

          {/* Tree */}
          {tree.length === 0 ? (
            <EmptyState
              description="点击「新增根节点」，创建你的第一个国策，然后逐步拆解为子策略。"
              icon={TreePine}
              illustrationAlt="policy tree empty"
              illustrationSrc="/illustrations/personal-notebook.svg"
              title="还没有国策"
            />
          ) : (
            <Panel className="p-5 sm:p-6 space-y-3">
              {tree.map((policy) => (
                <PolicyNode
                  key={policy.id}
                  onAddChild={openAddChild}
                  onCheckin={openCheckin}
                  onDelete={onDelete}
                  onExtinguish={openExtinguish}
                  policy={policy}
                />
              ))}
            </Panel>
          )}
        </>
      )}

      {/* ── Add Policy Dialog ─────────────────────────────────────────────────── */}
      <Dialog
        onClose={() => setAddModal(null)}
        open={addModal !== null}
        title={addModal?.parentId ? `在「${addModal.parentTitle ?? ""}」下新增子策略` : "新增根节点"}
      >
        <form className="space-y-4" onSubmit={(e) => void onAddSubmit(e)}>
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            策略标题 *
            <Input
              autoFocus
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="例：每天阅读 30 分钟"
              required
              type="text"
              value={addTitle}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            描述（选填）
            <Textarea
              onChange={(e) => setAddDesc(e.target.value)}
              placeholder="补充这条策略的背景或执行标准..."
              value={addDesc}
            />
          </label>
          <div className="flex justify-end gap-3 pt-1">
            <Button onClick={() => setAddModal(null)} type="button" variant="ghost">
              取消
            </Button>
            <Button disabled={isSubmitting || !addTitle.trim()} type="submit" variant="primary">
              {isSubmitting ? "保存中..." : "确认添加"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── Checkin Dialog ───────────────────────────────────────────────────── */}
      <Dialog
        onClose={() => setCheckinPolicyId(null)}
        open={checkinPolicyId !== null}
        title="今日打卡"
      >
        <div className="space-y-4">
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            备注（选填）
            <Textarea
              autoFocus
              onChange={(e) => setCheckinNote(e.target.value)}
              placeholder="今天执行情况..."
              value={checkinNote}
            />
          </label>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => void onCheckin("success")}
              variant="primary"
            >
              ✅ 成功完成
            </Button>
            <Button
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => void onCheckin("fail")}
              variant="secondary"
            >
              ❌ 未达成
            </Button>
          </div>
          <Button
            className="w-full"
            onClick={() => setCheckinPolicyId(null)}
            variant="ghost"
          >
            取消
          </Button>
        </div>
      </Dialog>

      {/* ── Extinguish Confirm Dialog ────────────────────────────────────────── */}
      <Dialog
        onClose={() => setExtinguishModal(null)}
        open={extinguishModal !== null}
        title="确认熄灭"
      >
        {extinguishModal && (
          <div className="space-y-4">
            <p className="text-sm leading-6" style={{ color: "var(--m-ink2)" }}>
              熄灭后，<strong style={{ color: "var(--m-ink)" }}>「{extinguishModal.policy.title}」</strong>
              {extinguishModal.descendantCount > 0 && (
                <>
                  {" "}
                  及其 <strong style={{ color: "var(--m-ink)" }}>{extinguishModal.descendantCount} 个子策略</strong>
                </>
              )}{" "}
              将同时熄灭。此操作不可逆，历史打卡记录仍会保留。
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={isSubmitting}
                onClick={() => void onExtinguishConfirm()}
                variant="primary"
              >
                {isSubmitting ? "熄灭中..." : "确认熄灭"}
              </Button>
              <Button
                className="flex-1"
                onClick={() => setExtinguishModal(null)}
                variant="ghost"
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </PageTransition>
  );
}
