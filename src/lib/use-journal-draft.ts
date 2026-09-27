"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyLog } from "@/types";
import { askConfirm } from "@/components/ui/confirm-host";
import { captureStorageScope } from "@/lib/account-storage";
import { readJournalDraft, writeJournalDraft, removeJournalDraft, type JournalDraft } from "@/lib/journal-draft";

function fromLog(log: DailyLog | null): JournalDraft {
  return { mood: log?.mood ?? 6, thoughts: log?.thoughts ?? "", tags: log?.tags.join(" ") ?? "", images: log?.images ?? [], base: log, savedAt: "" };
}

export function useJournalDraft(date: string, log: DailyLog | null) {
  const [draft, setDraft] = useState(() => fromLog(log));
  const [status, setStatus] = useState("");
  const current = useRef({ date: "", draft, dirty: false, persisted: true });
  const active = useRef(captureStorageScope());

  /* eslint-disable react-hooks/set-state-in-effect -- Hydrate local drafts after mount to preserve the server-rendered markup. */
  useEffect(() => {
    if (current.current.date === date && current.current.dirty) return;
    let restored: JournalDraft | null = null;
    try { restored = readJournalDraft(date); }
    catch { setStatus("草稿读取失败，请先导出备份检查本地数据。"); return; }
    const next = restored ?? fromLog(log);
    current.current = { date, draft: next, dirty: !!restored, persisted: true };
    setDraft(next);
    setStatus(restored ? "已恢复本地草稿" : "");
  }, [date, log]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!current.current.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    // 页面内确认框是异步的：先拦下这次点击，确认后再重新点一次链接（带放行标记）
    let bypass = false;
    const onLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLElement>("a[href]") : null;
      if (bypass || !link || !current.current.dirty || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      void askConfirm({
        title: "离开写日记",
        message: current.current.persisted
          ? "日记尚未正式保存，是否离开？草稿已保存在本机，回来时会自动恢复。"
          : "草稿保存失败，离开后当前输入会丢失。仍要离开吗？",
        confirmLabel: "离开",
        cancelLabel: "继续写",
      }).then((ok) => {
        if (!ok) return;
        bypass = true;
        try { link.click(); } finally { bypass = false; }
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onLink, true);
    };
  }, []);

  function change<K extends "mood" | "thoughts" | "tags" | "images">(key: K, value: JournalDraft[K]) {
    if (!active.current() || current.current.date !== date) return;
    const next = { ...current.current.draft, [key]: value, savedAt: new Date().toISOString() };
    current.current = { date, draft: next, dirty: true, persisted: false };
    setDraft(next);
    try { writeJournalDraft(date, next); current.current.persisted = true; setStatus("草稿已保存到本机"); }
    catch { setStatus("草稿保存失败，请勿关闭页面，并尽快导出备份释放空间。"); }
  }

  function markSaved(submitted: JournalDraft, savedLog?: DailyLog) {
    if (!active.current() || current.current.date !== date || current.current.draft !== submitted) return;
    removeJournalDraft(date);
    current.current.dirty = false;
    const next = fromLog(savedLog ?? log);
    current.current.draft = next;
    setDraft(next);
    setStatus("");
  }

  const canSwitch = async () =>
    !current.current.dirty ||
    askConfirm({
      title: "切换日期",
      message: current.current.persisted ? "切换日期？这一天的草稿已保存在本机，回来时会自动恢复。" : "草稿保存失败，切换日期将丢失当前输入。仍要切换吗？",
      confirmLabel: "切换",
    });

  return { draft, status, change, markSaved, canSwitch };
}
