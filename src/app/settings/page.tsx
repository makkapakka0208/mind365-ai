"use client";

import { CheckCircle2, Cloud, CloudOff, Download, HardDrive, LogIn, LogOut, Settings2, Shield, Smartphone, Target, Upload } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
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

// ── 组件 ─────────────────────────────────────────────────────────────────────

const EMPTY_STATUS: CloudSyncStatus = {
  configured: false,
  enabled: false,
  message: "云同步未启用，当前仍使用本地缓存。",
  userId: "",
};

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<CloudSyncStatus>(EMPTY_STATUS);
  const [studyTarget, setStudyTarget] = useState(10);
  const [readingTarget, setReadingTarget] = useState(7);
  const [targetSaved, setTargetSaved] = useState(false);

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
