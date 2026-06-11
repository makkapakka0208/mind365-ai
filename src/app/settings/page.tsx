"use client";

import { BookOpen, CheckCircle2, ChevronRight, Clock, Cloud, CloudOff, Compass, Download, HardDrive, LogIn, LogOut, MonitorSmartphone, Moon, Pencil, Settings2, Shield, Smartphone, Sun, Target, Upload } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { useAuth } from "@/lib/auth";
import { createDefaultSupabaseUserId } from "@/lib/supabase";
import {
  downloadMind365Backup,
  getCloudSyncStatus,
  getSettings,
  importMind365Backup,
  saveSettings,
} from "@/lib/storage";
import type { CloudSyncStatus } from "@/lib/storage";
import { useDailyLogsStore, useNotesStore, useQuotesStore } from "@/lib/storage-store";
import { toggleTabMode, useTabMode } from "@/lib/tab-mode";
import { getThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";

const SERIF = '"Noto Serif SC", "Songti SC", serif';

// ── 组件 ─────────────────────────────────────────────────────────────────────

const EMPTY_STATUS: CloudSyncStatus = {
  configured: false,
  enabled: false,
  message: "云同步未启用，当前仍使用本地缓存。",
  userId: "",
};

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const logs = useDailyLogsStore();
  const quotes = useQuotesStore();
  const notes = useNotesStore();
  const tabMode = useTabMode();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  // 挂载后读取，避免与 SSR 输出不一致
  const [themePref, setThemePref] = useState<ThemePreference>("system");
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
            <div
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{
                width: 64,
                height: 64,
                background: "linear-gradient(135deg, #c8893a 0%, #8B5E3C 100%)",
                color: "#fff",
                fontFamily: SERIF,
                fontWeight: 700,
                fontSize: 26,
                boxShadow: "0 4px 14px rgba(139,94,60,0.28)",
              }}
            >
              {avatarLetter}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[19px] font-semibold" style={{ color: "var(--m-ink)", fontFamily: SERIF, letterSpacing: "-0.01em" }}>
                {displayName}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--m-ink3)" }}>{sinceLabel}</div>
            </div>
            <Link
              href="/daily-log"
              aria-label="去记录"
              className="flex shrink-0 items-center justify-center rounded-[10px]"
              style={{ width: 34, height: 34, border: "1px solid rgba(139,94,60,0.14)", background: "rgba(255,248,236,0.8)", boxShadow: "var(--m-shadow-out)" }}
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
              <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
                <Moon size={20} />
                外观
              </h3>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--m-ink2)" }}>
                夜间模式会把纸张调成温暖的深色，适合睡前书写。
              </p>
            </div>
            <div
              className="flex shrink-0 rounded-xl p-1"
              style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
            >
              {([
                { value: "light", label: "浅色", Icon: Sun },
                { value: "dark", label: "深色", Icon: Moon },
                { value: "system", label: "跟随系统", Icon: MonitorSmartphone },
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
                      ? "数据已自动同步到云端，换设备或清缓存后会自动恢复。"
                      : "未连接云端，数据仅保存在本地。建议定期导出 JSON 备份。"}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium" style={{ color: syncConfigured ? "var(--m-success)" : "var(--m-ink3)" }}>
                    {syncConfigured ? <><CheckCircle2 size={12} /> 自动同步中</> : <><CloudOff size={12} /> 未连接</>}
                  </p>
                  {user ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--m-ink3)" }}>{user.email}</span>
                      <button
                        type="button"
                        onClick={() => void signOut()}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                        style={{ background: "rgba(192,57,43,0.08)", color: "#c0392b", border: "1px solid rgba(192,57,43,0.2)" }}
                      >
                        <LogOut size={12} />
                        退出登录
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ background: "var(--m-accent)", color: "#fff" }}
                    >
                      <LogIn size={12} />
                      登录 / 注册开启云同步
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl p-3 text-xs leading-5" style={{ background: "rgba(211,153,60,0.08)", border: "1px solid rgba(211,153,60,0.18)", color: "var(--m-ink2)" }}>
              <p className="font-medium" style={{ color: "var(--m-accent)" }}>⚠️ 重要提醒</p>
              <p className="mt-1">
                云端数据库存储空间有限，日记中的图片会占用较多空间。
                <strong>建议定期使用下方的「导出备份」功能，将数据保存为 JSON 文件到电脑或网盘</strong>，这是最可靠的备份方式。
              </p>
            </div>
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

            {message ? <p className="text-sm" style={{ color: "var(--m-success)" }}>{message}</p> : null}
            {error ? <p className="text-sm" style={{ color: "var(--m-danger)" }}>{error}</p> : null}
          </div>
        </Panel>
      </StaggerItem>
    </PageTransition>
  );
}
