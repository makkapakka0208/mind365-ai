"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, Cloud, CloudOff, Copy, Database, Download, HardDrive, RefreshCcw, Settings2, Shield, Smartphone, Upload, XCircle } from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { refreshLifePathState, forceUploadAllLifePathData } from "@/lib/life-path-storage";
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

CREATE TABLE IF NOT EXISTS diaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  ai_analysis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diaries_user ON diaries(user_id);

CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

CREATE TABLE IF NOT EXISTS weekly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weekly_user ON weekly_snapshots(user_id);

CREATE TABLE IF NOT EXISTS week_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_week_plans_user ON week_plans(user_id);
`;

// ── 数据表检测 ───────────────────────────────────────────────────────────────

interface TableCheckResult {
  table: string;
  ok: boolean;
  error?: string;
}

const TABLES_TO_CHECK = ["diaries", "quotes", "goals", "weekly_snapshots", "week_plans"] as const;

async function checkAllTables(settings: Mind365Settings): Promise<TableCheckResult[]> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config) return [];

  return Promise.all(
    TABLES_TO_CHECK.map(async (table): Promise<TableCheckResult> => {
      try {
        const { error } = await client.from(table).select("id").eq("user_id", config.userId).limit(1);
        return error ? { table, ok: false, error: error.message } : { table, ok: true };
      } catch (e) {
        return { table, ok: false, error: e instanceof Error ? e.message : "未知错误" };
      }
    }),
  );
}

// ── 组件 ─────────────────────────────────────────────────────────────────────

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
  const [isPushing, setIsPushing] = useState(false);
  const [tableResults, setTableResults] = useState<TableCheckResult[]>([]);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [form, setForm] = useState<Mind365Settings>(EMPTY_SETTINGS);
  const [status, setStatus] = useState<CloudSyncStatus>(EMPTY_STATUS);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        setError(`${failed.length} 张表未就绪，请在数据库中运行下方建表语句。`);
      }
    } catch {
      setError("连接测试失败，请检查配置是否正确。");
    } finally {
      setIsTesting(false);
    }
  };

  const onForcePush = async () => {
    setIsPushing(true);
    setMessage("");
    setError("");
    try {
      await forceUploadAllLifePathData();
      await refreshDailyLogs({ force: true });
      setMessage("所有数据已同步到云端 ✓");
    } catch {
      setError("推送失败，请检查网络连接。");
    } finally {
      setIsPushing(false);
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
      await forceUploadAllLifePathData();
      await refreshLifePathState();

      const nextStatus = getCloudSyncStatus();
      setStatus(nextStatus);
      setMessage(nextStatus.configured ? "云同步已启用，数据将自动备份到云端。" : "设置已保存。");
    } catch {
      setError("保存设置失败。");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncConfigured = status.configured && status.enabled;

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="管理你的数据存储、备份和同步方式。"
        eyebrow="系统设置"
        icon={Settings2}
        title="设置"
      />

      {/* ── 数据存储说明 ── */}
      <StaggerItem index={0}>
        <Panel className="p-6 sm:p-8">
          <div className="space-y-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
              <Shield size={20} />
              你的数据安全
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* 本地存储 */}
              <div
                className="flex gap-3 rounded-2xl p-4"
                style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(139,94,60,0.1)" }}>
                  <Smartphone size={20} style={{ color: "var(--m-accent)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--m-ink)" }}>本机缓存</p>
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--m-ink3)" }}>
                    数据会先保存在浏览器本地，保证离线也能正常使用。清除浏览器缓存后本地数据会丢失，但云端仍有备份。
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--m-success)" }}>
                    <CheckCircle2 size={12} />
                    已启用
                  </p>
                </div>
              </div>

              {/* 云同步 */}
              <div
                className="flex gap-3 rounded-2xl p-4"
                style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: syncConfigured ? "rgba(90,138,60,0.1)" : "rgba(139,94,60,0.06)" }}>
                  {syncConfigured ? <Cloud size={20} style={{ color: "var(--m-success)" }} /> : <CloudOff size={20} style={{ color: "var(--m-ink3)" }} />}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--m-ink)" }}>云端同步</p>
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--m-ink3)" }}>
                    {syncConfigured
                      ? "数据已自动同步到云端，换设备或清缓存后会自动恢复。每个浏览器会分配独立用户 ID。"
                      : "未连接云端，数据仅保存在本地。建议定期导出 JSON 备份。"}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium" style={{ color: syncConfigured ? "var(--m-success)" : "var(--m-ink3)" }}>
                    {syncConfigured ? <><CheckCircle2 size={12} /> 自动同步中</> : <><CloudOff size={12} /> 未连接</>}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-3 text-xs leading-5" style={{ background: "rgba(211,153,60,0.08)", border: "1px solid rgba(211,153,60,0.18)", color: "var(--m-ink2)" }}>
              <p className="font-medium" style={{ color: "var(--m-accent)" }}>⚠️ 重要提醒</p>
              <p className="mt-1">
                云端数据库存储空间有限（免费版 500 MB），日记中的图片会占用较多空间。
                <strong>建议定期使用下方的「导出备份」功能，将数据保存为 JSON 文件到电脑或网盘</strong>，这是最可靠的备份方式。
              </p>
            </div>
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 数据备份（最重要，放最前面） ── */}
      <StaggerItem index={1}>
        <Panel className="p-6 sm:p-8">
          <div className="space-y-5">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
                <HardDrive size={20} />
                数据备份
              </h3>
              <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                导出为 JSON 文件保存到电脑或网盘，是最安全的备份方式。文件包含你所有的日记、金句、笔记和复盘报告，不受云端存储限制。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button className="justify-center" onClick={onExport} size="lg" type="button" variant="primary">
                <Download className="mr-2" size={17} />
                导出备份
              </Button>

              <Button className="justify-center" onClick={onImportTrigger} size="lg" type="button" variant="secondary">
                <Upload className="mr-2" size={17} />
                导入备份
              </Button>
            </div>

            <input
              accept="application/json,.json"
              className="hidden"
              onChange={onImportFile}
              ref={fileInputRef}
              type="file"
            />

            <div className="rounded-xl p-3 text-xs leading-5" style={{ background: "rgba(180,150,110,0.08)", border: "1px solid var(--m-rule)", color: "var(--m-ink3)" }}>
              💡 建议每周导出一次备份，保存到网盘或电脑上。JSON 文件无大小限制，比云端更可靠。导入会覆盖当前数据，请谨慎操作。
            </div>
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 云同步设置（用户友好描述） ── */}
      <StaggerItem index={2}>
        <Panel className="p-6 sm:p-8">
          <form className="space-y-5" onSubmit={onSaveSyncSettings}>
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
                <Cloud size={20} />
                云端同步
              </h3>
              <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                数据会自动备份到云端服务器，支持跨设备同步。云端存储空间有限（500 MB），包含图片的日记会占用较多空间，建议同时使用上方的 JSON 导出作为主力备份。
              </p>
            </div>

            <label className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors" style={{ background: form.enableSupabaseSync ? "rgba(90,138,60,0.08)" : "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink)" }}>
              <input
                checked={form.enableSupabaseSync}
                className="h-4 w-4 rounded"
                style={{ accentColor: "var(--m-accent)" }}
                onChange={(event) => setForm({ ...form, enableSupabaseSync: event.target.checked })}
                type="checkbox"
              />
              启用云端同步
            </label>

            {form.enableSupabaseSync && (
              <div className="space-y-4 rounded-2xl p-4" style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}>
                <p className="text-xs leading-5" style={{ color: "var(--m-ink3)" }}>
                  请填写你的云端服务器信息。如果你不了解这些配置，可以：
                </p>
                <ul className="space-y-1.5 text-xs leading-5" style={{ color: "var(--m-ink3)" }}>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--m-accent)" }} />
                    联系 Mind365 的开发者获取配置信息
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--m-accent)" }} />
                    或者只使用「数据备份」功能手动导出备份即可
                  </li>
                </ul>

                <div className="grid gap-3">
                  <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                    服务器地址
                    <Input
                      onChange={(event) => setForm({ ...form, supabaseUrl: event.target.value })}
                      placeholder="由开发者提供"
                      type="url"
                      value={form.supabaseUrl}
                    />
                  </label>

                  <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                    授权密钥
                    <Input
                      onChange={(event) => setForm({ ...form, supabaseAnonKey: event.target.value })}
                      placeholder="由开发者提供"
                      type="password"
                      value={form.supabaseAnonKey}
                    />
                  </label>

                  <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                    你的用户 ID
                    <Input
                      onChange={(event) => setForm({ ...form, supabaseUserId: event.target.value })}
                      placeholder="自动生成，多设备请使用同一 ID"
                      type="text"
                      value={form.supabaseUserId}
                    />
                    <span className="text-[11px]" style={{ color: "var(--m-ink3)" }}>
                      多个设备使用同一个 ID 即可同步数据
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* 状态 */}
            <div className="rounded-xl p-3 text-sm" style={{ background: "rgba(139,94,60,0.06)", border: "1px solid var(--m-rule)" }}>
              <p className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--m-ink2)" }}>
                {syncConfigured ? <Cloud size={14} style={{ color: "var(--m-success)" }} /> : <CloudOff size={14} />}
                {syncConfigured ? "云端同步运行中" : "仅使用本地存储"}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="flex-1 justify-center" disabled={isSyncing} size="lg" type="submit" variant="primary">
                <RefreshCcw className="mr-2" size={17} />
                {isSyncing ? "保存中..." : "保存设置"}
              </Button>

              {form.enableSupabaseSync && form.supabaseUrl && form.supabaseAnonKey && (
                <>
                  <Button
                    className="flex-1 justify-center"
                    disabled={isTesting}
                    size="lg"
                    type="button"
                    variant="secondary"
                    onClick={onTestConnection}
                  >
                    <Database className="mr-2" size={17} />
                    {isTesting ? "检测中..." : "测试连接"}
                  </Button>
                </>
              )}
            </div>

            {form.enableSupabaseSync && form.supabaseUrl && form.supabaseAnonKey && (
              <Button
                className="w-full justify-center"
                disabled={isPushing}
                size="lg"
                type="button"
                variant="secondary"
                onClick={onForcePush}
              >
                <Cloud className="mr-2" size={17} />
                {isPushing ? "推送中..." : "立即同步所有数据到云端"}
              </Button>
            )}

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

            {message ? <p className="text-sm" style={{ color: "var(--m-success)" }}>{message}</p> : null}
            {error ? <p className="text-sm" style={{ color: "var(--m-danger)" }}>{error}</p> : null}
          </form>
        </Panel>
      </StaggerItem>

      {/* ── 高级设置（折叠，开发者用） ── */}
      <StaggerItem index={3}>
        <Panel className="overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between p-6 text-left sm:p-8"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>开发者选项</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--m-ink3)" }}>数据库初始化脚本、调试信息</p>
            </div>
            <ChevronDown
              size={18}
              style={{
                color: "var(--m-ink3)",
                transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-t px-6 pb-6 pt-4 sm:px-8 sm:pb-8" style={{ borderColor: "var(--m-rule)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--m-ink)" }}>数据库初始化 SQL</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--m-ink3)" }}>
                  首次使用云同步前，需要在数据库中运行以下语句创建数据表。
                </p>
              </div>

              <div className="flex justify-end">
                <Button size="sm" type="button" variant="secondary" onClick={onCopySql}>
                  <Copy className="mr-1.5" size={14} />
                  {sqlCopied ? "已复制" : "复制 SQL"}
                </Button>
              </div>

              <pre
                className="overflow-x-auto rounded-xl p-4 text-xs leading-6 font-mono"
                style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)", maxHeight: 300 }}
              >
                {SETUP_SQL}
              </pre>

              <div className="rounded-xl p-3 text-xs leading-5" style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink3)" }}>
                <p>当前同步用户 ID：<code className="font-mono">{status.userId || form.supabaseUserId || "未设置"}</code></p>
              </div>
            </div>
          )}
        </Panel>
      </StaggerItem>
    </PageTransition>
  );
}
