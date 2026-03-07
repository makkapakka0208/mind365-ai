"use client";

import { AlertTriangle, Cloud, Download, RefreshCcw, Settings2, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { createDefaultSupabaseUserId } from "@/lib/supabase";
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

    const confirmed = window.confirm("导入会覆盖当前的日记、金句、笔记和设置，是否继续？");

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
      setMessage(`导入完成：恢复 ${result.dailyLogs} 条日记、${result.quotes} 条金句、${result.notes} 条笔记。`);
      setError("");
    } catch (importError) {
      const text = importError instanceof Error ? importError.message : "导入备份失败。";
      setError(text);
      setMessage("");
    } finally {
      event.target.value = "";
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

      const nextStatus = getCloudSyncStatus();
      setStatus(nextStatus);
      setMessage(nextStatus.configured ? "云同步设置已保存，日记已开始与 Supabase 对齐。" : "设置已保存。当前仍会优先使用本地缓存。");
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
            <h3 className="text-lg font-semibold text-slate-100">Supabase 云同步</h3>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              开启后，日记会优先同步到 Supabase 的 <code>diaries</code> 表，本地缓存仍会保留用于离线读取。
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <input
              checked={form.enableSupabaseSync}
              className="h-4 w-4 rounded border-white/20 bg-transparent accent-indigo-400"
              onChange={(event) => setForm({ ...form, enableSupabaseSync: event.target.checked })}
              type="checkbox"
            />
            启用 Supabase 云同步
          </label>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Supabase URL
              <Input
                onChange={(event) => setForm({ ...form, supabaseUrl: event.target.value })}
                placeholder="https://your-project.supabase.co"
                type="url"
                value={form.supabaseUrl}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Supabase Anon Key
              <Input
                onChange={(event) => setForm({ ...form, supabaseAnonKey: event.target.value })}
                placeholder="eyJ..."
                type="text"
                value={form.supabaseAnonKey}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-200">
              同步用户 ID（UUID）
              <Input
                onChange={(event) => setForm({ ...form, supabaseUserId: event.target.value })}
                placeholder="建议多个设备使用同一个固定 UUID"
                type="text"
                value={form.supabaseUserId}
              />
            </label>
          </div>

          <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
            <p className="inline-flex items-center gap-2 font-medium">
              <Cloud size={16} />
              当前状态
            </p>
            <p className="mt-2 leading-6 text-cyan-100/90">{status.message}</p>
            <p className="mt-2 text-xs text-cyan-100/70">当前同步用户 ID：{status.userId || form.supabaseUserId || "未设置"}</p>
          </div>

          <Button className="justify-center" disabled={isSyncing} size="lg" type="submit" variant="primary">
            <RefreshCcw className="mr-2" size={17} />
            {isSyncing ? "保存中..." : "保存同步设置"}
          </Button>
        </form>
      </Panel>

      <Panel className="p-6 sm:p-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">数据备份</h3>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              导出完整 JSON 备份，或导入备份文件恢复你的日记、金句、笔记和设置。
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

          <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle size={16} />
              覆盖保护
            </p>
            <p className="mt-2 leading-6 text-amber-100/90">导入前会弹出确认框，避免误覆盖当前数据。</p>
          </div>

          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </Panel>
    </PageTransition>
  );
}

