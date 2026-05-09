"use client";

import { CheckCircle2, Cloud, CloudOff, Database, Download, HardDrive, RefreshCcw, Settings2, Shield, Smartphone, Upload, XCircle } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

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
        setMessage("连接正常，云同步已就绪 ✓");
      } else {
        setError(`${failed.length} 张表未就绪，请检查数据库配置。`);
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
                    所有数据优先保存在浏览器本地，离线也能正常使用。清除浏览器缓存后本地数据会丢失，建议开启云端同步或定期导出备份。
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
                      ? "数据已自动同步到云端。更换设备后用同一账号登录即可恢复所有数据。"
                      : "未开启云端同步，数据仅保存在本地。登录账号后数据将自动同步至云端。"}
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
                建议定期使用下方的「导出备份」功能，<strong>将数据保存为 JSON 文件到电脑或网盘</strong>，这是最可靠的数据保护方式，不受任何存储限制。
              </p>
            </div>
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 数据备份 ── */}
      <StaggerItem index={1}>
        <Panel className="p-6 sm:p-8">
          <div className="space-y-5">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
                <HardDrive size={20} />
                数据备份
              </h3>
              <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                将所有数据（日记、金句、笔记、复盘报告）导出为 JSON 文件，保存到电脑或网盘。即使更换设备或清空缓存，也能随时完整恢复。
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
              💡 建议每周导出一次备份，保存到网盘或电脑上。导入会覆盖当前所有数据，请谨慎操作。
            </div>

            {message ? <p className="text-sm" style={{ color: "var(--m-success)" }}>{message}</p> : null}
            {error ? <p className="text-sm" style={{ color: "var(--m-danger)" }}>{error}</p> : null}
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 云同步设置 ── */}
      <StaggerItem index={2}>
        <Panel className="p-6 sm:p-8">
          <form className="space-y-5" onSubmit={onSaveSyncSettings}>
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
                <Cloud size={20} />
                云端同步
              </h3>
              <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                登录账号后数据会自动同步到云端，支持多设备访问。也可在此手动配置自定义服务器。
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
                  如需使用自定义 Supabase 服务器，请填写以下信息。使用默认服务器无需填写。
                </p>

                <div className="grid gap-3">
                  <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                    服务器地址
                    <Input
                      onChange={(event) => setForm({ ...form, supabaseUrl: event.target.value })}
                      placeholder="https://your-project.supabase.co"
                      type="url"
                      value={form.supabaseUrl}
                    />
                  </label>

                  <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                    授权密钥
                    <Input
                      onChange={(event) => setForm({ ...form, supabaseAnonKey: event.target.value })}
                      placeholder="eyJ..."
                      type="password"
                      value={form.supabaseAnonKey}
                    />
                  </label>

                  <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                    用户 ID
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
    </PageTransition>
  );
}
