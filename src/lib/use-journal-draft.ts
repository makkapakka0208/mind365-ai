"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyLog } from "@/types";
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
    const onLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || !current.current.dirty || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!window.confirm("日记尚未正式保存，是否离开？已保存的草稿会保留。")) {
        event.preventDefault();
        event.stopPropagation();
      }
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

  return { draft, status, change, markSaved, canSwitch: () => !current.current.dirty || window.confirm(current.current.persisted ? "切换日期？已保存的草稿会保留。" : "草稿保存失败，切换日期将丢失当前输入。仍要切换吗？") };
}
