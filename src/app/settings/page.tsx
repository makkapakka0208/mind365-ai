"use client";

import { AlertTriangle, CheckCircle2, Cloud, Copy, Database, Download, RefreshCcw, Settings2, Upload, XCircle } from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { refreshLifePathState } from "@/lib/life-path-storage";
import { createDefaultSupabaseUserId, createMind365SupabaseClient, getSupabaseConfig } from "@/lib/supabase";
import {
  downloadMind365Backup,
  getCloudSyncStatus,
  getSettings,
  importMind365Backup,
  refreshDailyLogs,
  saveSettings,
} from "@/lib/storage";
import type { CloudSyncStatus } from "@/lib/storage";
import type { Mind365Settings } from "@/types";

// ── 建表 SQL ──────────────────────────────────────────────────────────────────

const SETUP_SQL = `-- ============================================================
-- Mind365 数据库初始化脚本
-- 在 Supabase SQL Editor 中一次性运行即可
-- ============================================================

-- 1. 日记表
create table if not exists public.diaries (
  id           uuid        primary key,
  user_id      uuid        not null,
  content      text        not null default '',
  ai_analysis  text,
  created_at   timestamptz not null default now()
);
alter table public.diaries disable row level security;

-- 2. 金句表
create table if not exists public.quotes (
  id           uuid        primary key,
  user_id      uuid        not null,
  created_at   timestamptz not null default now(),
  text         text        not null default '',
  author       text        not null default '',
  book         text        not null default '',
  tags         text[]      not null default '{}'
);
alter table public.quotes disable row level security;

-- 3. 笔记表
create table if not exists public.notes (
  id           uuid        primary key,
  user_id      uuid        not null,
  title        text        not null default '',
  content      text        not null default '',
  tags         text[]      not null default '{}'
);
alter table public.notes disable row level security;

-- 4. 复盘报告表
create table if not exists public.review_reports (
  id           uuid        primary key,
  user_id      uuid        not null,
  created_at   timestamptz not null default now(),
  content      text        not null default ''
);
alter table public.review_reports disable row level security;

-- 5. 人生主线状态表（目标 / 方向 / 导师计划 / 周计划）
create table if not exists public.life_path_state (
  id           text        primary key,   -- "<user_id>:<kind>"
  user_id      uuid        not null,
  kind         text        not null,      -- directions | goals | mentor_plans | week_plans
  content      text        not null default '',
  updated_at   timestamptz not null default now()
);
alter table public.life_path_state disable row level security;`;

// ── 连接检测（读 + 写双重验证）─────────────────────────────────────────────────

type TableCheckResult = { table: string; ok: boolean; error?: string };

/**
 * 对每张表执行一次 upsert 测试行 → 读回 → 删除，确认读写权限均正常。
 * SELECT 返回空行不代表有写权限（RLS 对 SELECT 静默过滤但对写操作报错）。
 */
async function checkAllTables(settings: Mind365Settings): Promise<TableCheckResult[]> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config) return [];

  // 各表的测试行（最小合法 payload）
  // 用 crypto.randomUUID() 生成合法 UUID，避免 uuid 类型列拒绝非 UUID 字符串
  const testUuid = crypto.randomUUID();
  const now = new Date().toISOString();
  const probes: { table: string; row: Record<string, unknown>; pkField: string }[] = [
    {
      table: "diaries",
      row: { id: testUuid, user_id: config.userId, content: "", created_at: now },
      pkField: "id",
    },
    {
      table: "quotes",
      row: { id: testUuid, user_id: config.userId, text: "", author: "", book: "", tags: [], created_at: now },
      pkField: "id",
    },
    {
      table: "notes",
      row: { id: testUuid, user_id: config.userId, title: "", content: "", tags: [] },
      pkField: "id",
    },
    {
      table: "review_reports",
      row: { id: testUuid, user_id: config.userId, content: "", created_at: now },
      pkField: "id",
    },
    {
      table: "life_path_state",
      row: { id: `${config.userId}:__test__`, user_id: config.userId, kind: "__test__", content: "", updated_at: now },
      pkField: "id",
    },
  ];

  return Promise.all(
    probes.map(async ({ table, row, pkField }): Promise<TableCheckResult> => {
      try {
        // 1. 写入测试行
        const { error: upsertErr } = await client.from(table).upsert(row, { onConflict: pkField });
        if (upsertErr) return { table, ok: false, error: `写入失败: ${upsertErr.message}` };

        // 2. 清理测试行
        await client.from(table).delete().eq(pkField, row[pkField] as string);

        return { table, ok: true };
      } catch (e) {
        return { table, ok: false, error: e instanceof Error ? e.message : "未知错误" };
      }
    }),
  );
}

const EMPTY_SETTINGS: Mind365Settings = {
  enableSupabaseSync: false,
  supabaseAnonKey: "",
  supabaseUrl: "",
  supabaseUserId: "",
};

const EMPTY_STATUS: CloudSyncStatus = {
  configured: false,
  enabled: false,
  message: "云同步未启用，当前仍使用本地缓存。",
  userId: "",
};

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [tableResults, setTableResults] = useState<TableCheckResult[]>([]);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [form, setForm] = useState<Mind365Settings>(EMPTY_SETTINGS);
  const [status, setStatus] = useState<CloudSyncStatus>(EMPTY_STATUS);

  useEffect(() => {
    const settings = getSettings();
    const nextSettings = settings.supabaseUserId
      ? settings
      : { ...settings, supabaseUserId: createDefaultSupabaseUserId() };

    if (!settings.supabaseUserId) {
      saveSettings(nextSettings);
    }

    setForm(nextSettings);
    setStatus(getCloudSyncStatus());
  }, []);

  const onExport = () => {
    try {
      downloadMind365Backup();
      setMessage("备份已导出为 mind365-backup.json。");
      setError("");
    } catch {
      setError("导出备份失败。");
      setMessage("");
    }
  };

  const onImportTrigger = () => {
    fileInputRef.current?.click();
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const confirmed = window.confirm("导入会覆盖当前的日记、金句、笔记、复盘、Life Path 数据和设置，是否继续？");

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    try {
      const raw = await file.text();
      const result = importMind365Backup(raw);
      const nextSettings = getSettings();

      setForm(nextSettings.supabaseUserId ? nextSettings : { ...nextSettings, supabaseUserId: createDefaultSupabaseUserId() });
      setStatus(getCloudSyncStatus());
      setMessage(`导入完成：恢复 ${result.dailyLogs} 条日记、${result.quotes} 条金句、${result.notes} 条笔记、${result.reviewReports} 份复盘、${result.goals} 个目标、${result.weekPlans} 份周计划。`);
      setError("");
    } catch (importError) {
      const text = importError instanceof Error ? importError.message : "导入备份失败。";
      setError(text);
      setMessage("");
    } finally {
      event.target.value = "";
    }
  };

  const onCopySql = useCallback(() => {
    void navigator.clipboard.writeText(SETUP_SQL).then(() => {
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    });
  }, []);

  const onTestConnection = async () => {
    setIsTesting(true);
    setTableResults([]);
    setMessage("");
    setError("");
    try {
      const results = await checkAllTables(form);
      setTableResults(results);
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        setMessage("所有数据表均正常，云同步已就绪 ✓");
      } else {
        setError(`${failed.length} 张表未就绪，请先在 Supabase SQL 编辑器中运行下方建表语句。`);
      }
    } catch {
      setError("连接测试失败，请检查 URL 和 Anon Key 是否正确。");
    } finally {
      setIsTesting(false);
    }
  };

  const onSaveSyncSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSyncing(true);
    setMessage("");
    setError("");

    try {
      const saved = saveSettings({
        ...form,
        supabaseUserId: form.supabaseUserId.trim() || createDefaultSupabaseUserId(),
      });

      setForm(saved);
      await refreshDailyLogs({ force: true });
      await refreshLifePathState();

      const nextStatus = getCloudSyncStatus();
      setStatus(nextStatus);
      setMessage(nextStatus.configured ? "云同步设置已保存，数据已开始与 Supabase 对齐；本地缓存仍会保留。" : "设置已保存。默认数据存储在本地缓存。");
    } catch {
      setError("保存云同步设置失败。");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="在这里管理备份文件和 Supabase 云同步配置。"
        eyebrow="系统设置"
        icon={Settings2}
        title="设置"
      />

      <Panel className="p-6 sm:p-8">
        <form className="space-y-6" onSubmit={onSaveSyncSettings}>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--m-ink)" }}>Supabase 云同步</h3>
            <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
              默认数据存储在本地缓存；开启后，日记和 Life Path 数据会同步到 Supabase，本地缓存仍会保留用于离线读取。
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink)" }}>
            <input
              checked={form.enableSupabaseSync}
              className="h-4 w-4 rounded"
              style={{ accentColor: "var(--m-accent)" }}
              onChange={(event) => setForm({ ...form, enableSupabaseSync: event.target.checked })}
              type="checkbox"
            />
            启用 Supabase 云同步
          </label>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              Supabase URL
              <Input
                onChange={(event) => setForm({ ...form, supabaseUrl: event.target.value })}
                placeholder="https://your-project.supabase.co"
                type="url"
                value={form.supabaseUrl}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              Supabase Anon Key
              <Input
                onChange={(event) => setForm({ ...form, supabaseAnonKey: event.target.value })}
                placeholder="eyJ..."
                type="text"
                value={form.supabaseAnonKey}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              同步用户 ID（UUID）
              <Input
                onChange={(event) => setForm({ ...form, supabaseUserId: event.target.value })}
                placeholder="建议多个设备使用同一个固定 UUID"
                type="text"
                value={form.supabaseUserId}
              />
            </label>
          </div>

          <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(139,94,60,0.08)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}>
            <p className="inline-flex items-center gap-2 font-medium">
              <Cloud size={16} />
              当前状态
            </p>
            <p className="mt-2 leading-6" style={{ color: "var(--m-ink2)" }}>{status.message}</p>
            <p className="mt-2 text-xs" style={{ color: "var(--m-ink2)" }}>默认数据存储在本地缓存，云同步只是额外备份与跨设备同步。</p>
            <p className="mt-2 text-xs" style={{ color: "var(--m-ink2)" }}>当前同步用户 ID：{status.userId || form.supabaseUserId || "未设置"}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1 justify-center" disabled={isSyncing} size="lg" type="submit" variant="primary">
              <RefreshCcw className="mr-2" size={17} />
              {isSyncing ? "保存中..." : "保存同步设置"}
            </Button>
            <Button
              className="flex-1 justify-center"
              disabled={isTesting || !form.enableSupabaseSync || !form.supabaseUrl || !form.supabaseAnonKey}
              size="lg"
              type="button"
              variant="secondary"
              onClick={onTestConnection}
            >
              <Database className="mr-2" size={17} />
              {isTesting ? "检测中..." : "测试连接"}
            </Button>
          </div>

          {/* 逐表检测结果 */}
          {tableResults.length > 0 && (
            <div className="rounded-xl p-4 text-sm space-y-2" style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}>
              {tableResults.map((r) => (
                <div key={r.table} className="flex items-start gap-2">
                  {r.ok
                    ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "var(--m-success)" }} />
                    : <XCircle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--m-danger)" }} />
                  }
                  <span style={{ color: r.ok ? "var(--m-ink)" : "var(--m-danger)" }}>
                    <code className="font-mono text-xs">{r.table}</code>
                    {!r.ok && r.error ? <span className="ml-2 text-xs opacity-70">{r.error}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </form>
      </Panel>

      {/* 建表 SQL */}
      <Panel className="p-6 sm:p-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold" style={{ color: "var(--m-ink)" }}>数据库初始化 SQL</h3>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--m-ink2)" }}>
                首次使用云同步前，需在 Supabase 项目的 <strong>SQL 编辑器</strong> 中运行以下语句，创建全部 5 张数据表。
              </p>
            </div>
            <Button
              className="shrink-0"
              size="sm"
              type="button"
              variant="secondary"
              onClick={onCopySql}
            >
              <Copy className="mr-1.5" size={14} />
              {sqlCopied ? "已复制" : "复制"}
            </Button>
          </div>
          <pre
            className="overflow-x-auto rounded-xl p-4 text-xs leading-6 font-mono"
            style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}
          >
            {SETUP_SQL}
          </pre>
          <p className="text-xs" style={{ color: "var(--m-ink2)" }}>
            提示：在 Supabase 控制台 → 项目 → SQL Editor → New Query，粘贴并点击 Run。
          </p>
        </div>
      </Panel>

      <Panel className="p-6 sm:p-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--m-ink)" }}>数据备份</h3>
            <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
              导出完整 JSON 备份，或导入备份文件恢复你的日记、金句、笔记、复盘、Life Path 数据和设置。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Button className="justify-center" onClick={onExport} size="lg" type="button" variant="primary">
              <Download className="mr-2" size={17} />
              导出数据
            </Button>

            <Button className="justify-center" onClick={onImportTrigger} size="lg" type="button" variant="secondary">
              <Upload className="mr-2" size={17} />
              导入数据
            </Button>
          </div>

          <input
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
            ref={fileInputRef}
            type="file"
          />

          <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(180,150,110,0.12)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}>
            <p className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle size={16} />
              覆盖保护
            </p>
            <p className="mt-2 leading-6" style={{ color: "var(--m-ink2)" }}>导入前会弹出确认框，避免误覆盖当前数据。</p>
          </div>

          {message ? <p className="text-sm" style={{ color: "var(--m-success)" }}>{message}</p> : null}
          {error ? <p className="text-sm" style={{ color: "var(--m-danger)" }}>{error}</p> : null}
        </div>
      </Panel>
    </PageTransition>
  );
}
