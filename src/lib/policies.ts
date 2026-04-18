import { getSettings } from "@/lib/storage";
import { createMind365SupabaseClient, getSupabaseConfig } from "@/lib/supabase";
import type { Policy, PolicyCheckin } from "@/types/policy";

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function calcStreak(checkins: PolicyCheckin[], policyId: string): number {
  const todayStr = getTodayString();
  const successDates = new Set(
    checkins
      .filter((c) => c.policy_id === policyId && c.result === "success")
      .map((c) => c.date),
  );

  // Start from today if today is a success, else from yesterday
  const start = new Date(todayStr + "T12:00:00");
  if (!successDates.has(todayStr)) {
    start.setDate(start.getDate() - 1);
  }

  let streak = 0;
  const cursor = new Date(start);
  for (let i = 0; i < 60; i++) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (!successDates.has(dateStr)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildTree(flat: Policy[], checkins: PolicyCheckin[]): Policy[] {
  const today = getTodayString();
  const map = new Map<string, Policy>();

  for (const p of flat) {
    const todayEntry = checkins.find((c) => c.policy_id === p.id && c.date === today);
    map.set(p.id, {
      ...p,
      children: [],
      streak: calcStreak(checkins, p.id),
      todayCheckin: todayEntry ? todayEntry.result : null,
    });
  }

  const roots: Policy[] = [];
  for (const p of map.values()) {
    if (p.parent_id && map.has(p.parent_id)) {
      map.get(p.parent_id)!.children!.push(p);
    } else {
      roots.push(p);
    }
  }

  const sort = (nodes: Policy[]) => {
    nodes.sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
    for (const n of nodes) sort(n.children!);
  };
  sort(roots);
  return roots;
}

function getClient() {
  const settings = getSettings();
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config) throw new Error("请先在设置页面配置 Supabase 连接");
  return { client, config };
}

export async function fetchPolicyTree(): Promise<Policy[]> {
  const { client, config } = getClient();

  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceStr = since.toISOString().slice(0, 10);

  const [policiesRes, checkinsRes] = await Promise.all([
    client.from("focus_policies").select("*").eq("user_id", config.userId),
    client
      .from("policy_checkins")
      .select("*")
      .eq("user_id", config.userId)
      .gte("date", sinceStr),
  ]);

  if (policiesRes.error) throw new Error(policiesRes.error.message);
  if (checkinsRes.error) throw new Error(checkinsRes.error.message);

  return buildTree(
    (policiesRes.data ?? []) as Policy[],
    (checkinsRes.data ?? []) as PolicyCheckin[],
  );
}

export async function addPolicy(
  parentId: string | null,
  title: string,
  description?: string,
): Promise<void> {
  const { client, config } = getClient();
  const { error } = await client.from("focus_policies").insert({
    parent_id: parentId,
    title,
    description: description?.trim() || null,
    user_id: config.userId,
  });
  if (error) throw new Error(error.message);
}

export async function extinguishPolicy(policyId: string): Promise<void> {
  const { client } = getClient();
  const { error } = await client.rpc("extinguish_policy", {
    policy_id: policyId,
  });
  if (error) throw new Error(error.message);
}

export async function checkinPolicy(
  policyId: string,
  result: "success" | "fail",
  note?: string,
): Promise<void> {
  const { client, config } = getClient();
  const { error } = await client.from("policy_checkins").upsert(
    {
      policy_id: policyId,
      user_id: config.userId,
      date: getTodayString(),
      result,
      note: note?.trim() || null,
    },
    { onConflict: "policy_id,date" },
  );
  if (error) throw new Error(error.message);
}

export async function deletePolicy(policyId: string): Promise<void> {
  const { client } = getClient();
  const { error } = await client
    .from("focus_policies")
    .delete()
    .eq("id", policyId);
  if (error) throw new Error(error.message);
}

/** Count all descendants (children + grandchildren + ...) */
export function countDescendants(policy: Policy): number {
  let count = 0;
  for (const child of policy.children ?? []) {
    count += 1 + countDescendants(child);
  }
  return count;
}
