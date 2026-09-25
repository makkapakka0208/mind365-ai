"use client";

import { BookOpen, Camera, CheckCircle2, ChevronRight, Clock, Cloud, CloudOff, Compass, Download, FileText, HardDrive, MonitorSmartphone, Moon, Pencil, Settings2, Sun, Target, Upload } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { useAuth } from "@/lib/auth";
import { accountStorage, captureStorageScope } from "@/lib/account-storage";
import { createDefaultSupabaseUserId } from "@/lib/supabase";
import {
  downloadMind365Backup,
  downloadGuestBackup,
  getDiarySyncState,
  refreshDailyLogs,
  refreshTodos,
  STORAGE_CHANGE_EVENT,
  downloadMind365Markdown,
  getCloudSyncStatus,
  getSettings,
  importMind365Backup,
  saveSettings,
} from "@/lib/storage";
import type { CloudSyncStatus } from "@/lib/storage";
import { useDailyLogsStore, useNotesStore, useQuotesStore } from "@/lib/storage-store";
import { toggleTabMode, useTabMode } from "@/lib/tab-mode";
import { fileToAvatarDataUrl, saveProfile, useProfile } from "@/lib/profile";
import { DEFAULT_THEME, getThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";

const SERIF = '"Noto Serif SC", "Songti SC", serif';

// ── 组件 ─────────────────────────────────────────────────────────────────────

const EMPTY_STATUS: CloudSyncStatus = {
  configured: false,
  enabled: false,
  message: "云同步未启用，当前仍使用本地缓存。",
  userId: "",
};

/** 质感主题的小色块，和 lucide 图标同样接收 size，放进同一个分段控件里。 */
function Swatch(base: string, accent: string) {
  function SwatchIcon({ size = 13 }: { size?: number }) {
    return (
      <span
        aria-hidden
        className="inline-block rounded-full"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${base} 0 55%, ${accent} 55% 100%)`,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
        }}
      />
    );
  }
  return SwatchIcon;
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const logs = useDailyLogsStore();
  const quotes = useQuotesStore();
  const notes = useNotesStore();
  const tabMode = useTabMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const profile = useProfile();

  const displayName = user?.email ? user.email.split("@")[0] : "我的记录";
  const avatarLetter = (displayName.trim()[0] || "M").toUpperCase();
  const sinceLabel = useMemo(() => {
    if (logs.length === 0) return "开始记录你的成长之路";
    const earliest = logs.reduce((min, l) => (l.date < min ? l.date : min), logs[0].date);
    const [y, m, d] = earliest.split("-");
    return `自 ${y} 年 ${Number(m)} 月 ${Number(d)} 日开始写`;
  }, [logs]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<CloudSyncStatus>(EMPTY_STATUS);
  const [studyTarget, setStudyTarget] = useState(10);
  const [readingTarget, setReadingTarget] = useState(7);
  const [targetSaved, setTargetSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  useEffect(() => {
    const update = () => {
      const state = getDiarySyncState();
      setSyncMessage([state.message, state.pending ? `${state.pending} 项日记修改待同步` : "", accountStorage.getItem("todo_sync_status")].filter(Boolean).join(" "));
    };
    update();
    window.addEventListener(STORAGE_CHANGE_EVENT, update);
    return () => window.removeEventListener(STORAGE_CHANGE_EVENT, update);
  }, []);
  // 挂载后读取，避免与 SSR 输出不一致
  const [themePref, setThemePref] = useState<ThemePreference>(DEFAULT_THEME);
  useEffect(() => { setThemePref(getThemePreference()); }, []);

  useEffect(() => {
    const settings = getSettings();
    if (!settings.supabaseUserId) {
      saveSettings({ ...settings, supabaseUserId: createDefaultSupabaseUserId() });
    }
    setStatus(getCloudSyncStatus());
    setStudyTarget(settings.weeklyStudyTarget);
    setReadingTarget(settings.weeklyReadingTarget);
  }, []);

  const onSaveTargets = () => {
    const s = studyTarget > 0 ? studyTarget : 10;
    const r = readingTarget > 0 ? readingTarget : 7;
    const settings = getSettings();
    saveSettings({ ...settings, weeklyStudyTarget: s, weeklyReadingTarget: r });
    setStudyTarget(s);
    setReadingTarget(r);
    setTargetSaved(true);
    setTimeout(() => setTargetSaved(false), 2000);
  };

  const onExport = async (guest = false) => {
    setExporting(true);
    try {
      if (guest) await downloadGuestBackup();
      else await downloadMind365Backup();
      setMessage(guest ? "游客备份已导出。导入到当前账号前，请确认内容属于你。" : "完整备份已导出，包含待办、草稿和图片。");
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "导出备份失败。");
      setMessage("");
    } finally { setExporting(false); }
  };

  const onExportMarkdown = () => {
    try {
      downloadMind365Markdown();
      setMessage("已导出为 mind365-export.md（Markdown，仅用于阅读归档，不可再导入）。");
      setError("");
    } catch {
      setError("导出 Markdown 失败。");
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

    const active = captureStorageScope();
    const confirmed = window.confirm("确认备份属于你，并导入当前账号？将合并日记、待办、草稿等数据；相同记录采用备份内容，其他记录保留。建议先导出当前备份。");

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    try {
      const raw = await file.text();
      if (!active()) return;
      const result = importMind365Backup(raw);
      setStatus(getCloudSyncStatus());
      setMessage(`导入完成：恢复 ${result.dailyLogs} 条日记、${result.todos} 条待办、${result.quotes} 条金句、${result.notes} 条笔记、${result.reviewReports} 份复盘。云端同步失败时，本地数据仍保留。`);
      setError("");
    } catch (importError) {
      const text = importError instanceof Error ? importError.message : "导入备份失败。";
      setError(text);
      setMessage("");
    } finally {
      event.target.value = "";
    }
  };

  const syncConfigured = status.configured && status.enabled;

  return (
    <PageTransition className="mx-auto max-w-[1460px] space-y-6">
      {/* ── Profile (design: MeScreen) ── */}
      <StaggerItem index={0}>
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--m-ink3)" }}>
          ME · 我的
        </p>
        <Panel className="p-[22px]">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              aria-label="更换头像"
              title="更换头像"
              className="group relative shrink-0 rounded-full"
              style={{ width: 64, height: 64 }}
              onClick={() => avatarInputRef.current?.click()}
            >
              {profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- 本地 data URL，无需 next/image 优化
                <img
                  src={profile.avatar}
                  alt="我的头像"
                  className="h-full w-full rounded-full object-cover"
                  style={{ boxShadow: "0 4px 14px rgba(var(--v5-shadow-rgb),0.22), 0 0 0 1px var(--v5-rule-strong)" }}
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center rounded-full"
                  style={{
                    background: "linear-gradient(135deg, var(--v5-amber) 0%, var(--v5-accent) 100%)",
                    color: "var(--m-on-accent)",
                    fontFamily: SERIF,
                    fontWeight: 700,
                    fontSize: 26,
                    boxShadow: "0 4px 14px rgba(var(--v5-accent-rgb),0.28)",
                  }}
                >
                  {avatarLetter}
                </span>
              )}
              {/* 悬停遮罩 + 常驻相机角标，提示可更换 */}
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: "rgba(0,0,0,0.32)", color: "#fff" }}
              >
                <Camera size={18} />
              </span>
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full"
                style={{
                  width: 22,
                  height: 22,
                  background: "var(--v5-surface)",
                  border: "1px solid var(--v5-rule-strong)",
                  color: "var(--v5-accent)",
                  boxShadow: "0 2px 6px rgba(var(--v5-shadow-rgb),0.18)",
                }}
              >
                <Camera size={11} />
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  saveProfile({ avatar: await fileToAvatarDataUrl(file) });
                  setError("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "头像设置失败");
                }
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[19px] font-semibold" style={{ color: "var(--m-ink)", fontFamily: SERIF, letterSpacing: "-0.01em" }}>
                {displayName}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--m-ink3)" }}>
                {sinceLabel}
                {profile.avatar ? (
                  <button
                    type="button"
                    className="ml-2 underline-offset-2 hover:underline"
                    style={{ color: "var(--m-accent)" }}
                    onClick={() => saveProfile({ avatar: undefined })}
                  >
                    恢复默认头像
                  </button>
                ) : null}
              </div>
            </div>
            <Link
              href="/daily-log"
              aria-label="去记录"
              className="flex shrink-0 items-center justify-center rounded-[10px]"
              style={{ width: 34, height: 34, border: "1px solid rgba(var(--v5-accent-rgb),0.14)", background: "var(--m-base-light)", boxShadow: "var(--m-shadow-out)" }}
            >
              <Pencil size={14} style={{ color: "var(--m-ink3)" }} />
            </Link>
          </div>
        </Panel>
      </StaggerItem>

      {/* ── Stats ── */}
      <StaggerItem index={1}>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { v: logs.length, l: "日记" },
            { v: quotes.length, l: "金句" },
            { v: notes.length, l: "笔记" },
          ].map((s) => (
            <Panel key={s.l} className="p-3 text-center">
              <div className="font-semibold" style={{ fontSize: 22, color: "var(--m-ink)", letterSpacing: "-0.04em", fontFamily: "var(--m-font-display)" }}>
                {s.v}
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: "var(--m-ink3)" }}>{s.l}</div>
            </Panel>
          ))}
        </div>
      </StaggerItem>

      {/* ── Quick settings list w/ Tab 四 toggle ── */}
      <StaggerItem index={2}>
        <Panel className="p-2">
          {/* Tab 四 toggle */}
          <div
            className="flex items-center gap-3 px-3.5 py-3"
            style={{ borderBottom: "1px dashed rgba(139,94,60,0.14)" }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}>
              {tabMode === "library" ? <BookOpen size={16} /> : <Compass size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm" style={{ color: "var(--m-ink)" }}>
                Tab 四：{tabMode === "library" ? "灵感书库" : "人生主线"}
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: "var(--m-ink3)" }}>
                {tabMode === "library" ? "灵感书库替换为人生主线" : "替换回灵感书库"}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={tabMode === "lifepath"}
              aria-label="切换第四个标签"
              onClick={() => toggleTabMode()}
              className="relative shrink-0"
              style={{
                width: 44,
                height: 26,
                borderRadius: 99,
                border: "none",
                cursor: "pointer",
                padding: 0,
                background: tabMode === "library" ? "rgba(139,94,60,0.15)" : "var(--m-accent)",
                transition: "background 220ms",
              }}
            >
              <span
                className="absolute"
                style={{
                  top: 3,
                  left: tabMode === "library" ? 3 : 19,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: tabMode === "library" ? "rgba(139,94,60,0.45)" : "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                  transition: "left 220ms cubic-bezier(.34,1.56,.64,1), background 220ms",
                }}
              />
            </button>
          </div>

          {/* Quick links */}
          {[
            { icon: Compass, label: "人生主线", hint: "目标 + 四象限待办", href: "/life-path" },
            { icon: Clock, label: "时间线 · 去年今日", hint: "翻开旧日记忆", href: "/timeline" },
          ].map((row, i, arr) => {
            const RowIcon = row.icon;
            return (
              <Link
                key={row.label}
                href={row.href}
                className="flex items-center gap-3 px-3.5 py-3"
                style={{ borderBottom: i === arr.length - 1 ? "none" : "1px dashed rgba(139,94,60,0.14)" }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}>
                  <RowIcon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm" style={{ color: "var(--m-ink)" }}>{row.label}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--m-ink3)" }}>{row.hint}</div>
                </div>
                <ChevronRight size={16} style={{ color: "var(--m-ink3)" }} />
              </Link>
            );
          })}
        </Panel>
      </StaggerItem>

      <div className="flex items-center gap-2 pt-2">
        <Settings2 size={16} style={{ color: "var(--m-ink3)" }} />
        <h3 className="text-sm font-semibold tracking-[0.04em]" style={{ color: "var(--m-ink2)" }}>系统设置</h3>
      </div>

      {/* ── 外观主题 ── */}
      <StaggerItem index={0}>
        <Panel className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 whitespace-nowrap text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
                <Moon size={20} />
                外观
              </h3>
            </div>
            <div
              className="flex shrink-0 flex-wrap rounded-xl p-1"
              style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
            >
              {([
                { value: "light", label: "浅色", Icon: Sun },
                { value: "dark", label: "深色", Icon: Moon },
                { value: "system", label: "跟随系统", Icon: MonitorSmartphone },
                { value: "plaster", label: "灰泥", Icon: Swatch("#ece8df", "#8a6630") },
                { value: "patina", label: "铜绿", Icon: Swatch("#3d5b5c", "#d0a867") },
              ] as const).map(({ value, label, Icon }) => {
                const active = themePref === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all"
                    style={{
                      background: active ? "var(--m-base-light)" : "transparent",
                      color: active ? "var(--m-accent)" : "var(--m-ink3)",
                      boxShadow: active ? "var(--m-shadow-out)" : "none",
                    }}
                    onClick={() => {
                      setThemePreference(value);
                      setThemePref(value);
                    }}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 云同步（一行状态 + 操作）── */}
      <StaggerItem index={0}>
        <Panel className="px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(var(--v5-accent-rgb),0.08)" }}
            >
              {syncConfigured && user
                ? <Cloud size={18} style={{ color: "var(--m-accent)" }} />
                : <CloudOff size={18} style={{ color: "var(--m-ink3)" }} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold" style={{ color: "var(--m-ink)" }}>云同步</p>
              <p role="status" className="mt-0.5 truncate text-xs" style={{ color: "var(--m-ink3)" }}>
                {user
                  ? (syncMessage || `${user.email} · ${syncConfigured ? "自动同步中" : "未开启同步"}`)
                  : "登录后可在多台设备间同步"}
              </p>
            </div>
            {user ? (
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <button
                  type="button"
                  disabled={syncing}
                  className="transition-opacity hover:opacity-75 disabled:opacity-50"
                  style={{ color: "var(--m-accent)" }}
                  onClick={async () => {
                    setSyncing(true);
                    try { await Promise.all([refreshDailyLogs(), refreshTodos()]); }
                    finally { setSyncing(false); }
                  }}
                >
                  {syncing ? "同步中…" : "立即同步"}
                </button>
                <button
                  type="button"
                  className="transition-opacity hover:opacity-75"
                  style={{ color: "var(--m-ink3)" }}
                  onClick={() => { void signOut().catch(() => setError("退出登录失败，请重试。")); }}
                >
                  退出登录
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-85"
                style={{ background: "var(--v5-accent-fill)", color: "var(--v5-accent-fill-ink)" }}
              >
                登录
              </Link>
            )}
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 每周目标 ── */}
      <StaggerItem index={1}>
        <Panel className="p-6 sm:p-8">
          <div className="space-y-5">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
                <Target size={20} />
                每周目标
              </h3>
              <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                设定本周学习和阅读的目标时长，主页进度环和洞察文案将据此计算。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--m-ink2)" }}>
                  学习目标（小时 / 周）
                </label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={studyTarget}
                  onChange={(e) => setStudyTarget(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--m-ink2)" }}>
                  阅读目标（小时 / 周）
                </label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={readingTarget}
                  onChange={(e) => setReadingTarget(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={onSaveTargets} size="lg" type="button" variant="primary">
                保存目标
              </Button>
              {targetSaved && (
                <span className="flex items-center gap-1 text-sm" style={{ color: "var(--m-success)" }}>
                  <CheckCircle2 size={14} />
                  已保存
                </span>
              )}
            </div>
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 数据备份 ── */}
      <StaggerItem index={2}>
        <Panel className="p-6 sm:p-8">
          <div className="space-y-5">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
                <HardDrive size={20} />
                数据备份
              </h3>
              <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                导出全部记录为 JSON 文件，或从备份文件恢复。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button className="justify-center" disabled={exporting} onClick={() => void onExport()} size="lg" type="button" variant="primary">
                <Download className="mr-2" size={17} />
                {exporting ? "正在生成备份" : "导出备份"}
              </Button>

              <Button className="justify-center" onClick={onImportTrigger} size="lg" type="button" variant="secondary">
                <Upload className="mr-2" size={17} />
                导入备份
              </Button>
            </div>

            {user && <Button className="w-full justify-center" disabled={exporting} onClick={() => void onExport(true)} type="button" variant="secondary">
              <Download size={17} className="mr-2" />导出游客 / 旧版本地数据
            </Button>}
            <Button className="w-full justify-center" onClick={onExportMarkdown} size="lg" type="button" variant="ghost">
              <FileText className="mr-2" size={17} />
              导出为 Markdown（仅阅读 / 归档）
            </Button>

            <input
              accept="application/json,.json"
              className="hidden"
              onChange={onImportFile}
              ref={fileInputRef}
              type="file"
            />

            <div className="rounded-xl p-3 text-xs leading-5" style={{ background: "rgba(180,150,110,0.08)", border: "1px solid var(--m-rule)", color: "var(--m-ink3)" }}>
              导入采用合并恢复，旧版备份缺失的待办和草稿会保留。请保管好备份文件，其中包含私人记录。图片较多时恢复可能受浏览器存储容量限制。
            </div>

            {message ? <p className="text-sm" style={{ color: "var(--m-success)" }}>{message}</p> : null}
            {error ? <p className="text-sm" style={{ color: "var(--m-danger)" }}>{error}</p> : null}
          </div>
        </Panel>
      </StaggerItem>
    </PageTransition>
  );
}
