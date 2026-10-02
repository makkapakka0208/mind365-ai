"use client";

import { ImageUp, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

/**
 * 金句识图：选一张书摘截图（或在弹窗里直接粘贴），识别出语句、书名、作者交给表单。
 * 结果只填进表单，由用户确认后再保存。
 */

export interface RecognizedQuote {
  text: string;
  book: string;
  author: string;
}

/** 把图片压到长边 1600px 以内的 JPEG，控制上传大小（截图通常几 MB → 两三百 KB） */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function recognize(file: File): Promise<{ quotes: RecognizedQuote[]; message?: string }> {
  const image = await toDataUrl(file);
  const resp = await apiFetch("/api/quote-ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  const json = (await resp.json().catch(() => ({}))) as { quotes?: RecognizedQuote[]; message?: string };
  if (resp.status === 401) return { quotes: [], message: "登录后才能使用识图。" };
  return { quotes: json.quotes ?? [], message: json.message };
}

export function QuoteImageImport({
  onResult,
  listenPaste = false,
}: {
  /** 识别出的金句（至少一条）；多条时由调用方决定怎么展示 */
  onResult: (quotes: RecognizedQuote[]) => void;
  /** 是否监听粘贴（弹窗打开时用：直接 Ctrl/⌘+V 粘贴截图） */
  listenPaste?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });

  const run = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatus("请选择图片文件。");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const { quotes, message } = await recognize(file);
      if (quotes.length) {
        onResultRef.current(quotes);
        setStatus(quotes.length > 1 ? `识别出 ${quotes.length} 句，已先填入第 1 句。` : "已识别，确认无误后保存。");
      } else {
        setStatus(message || "没在图里找到摘抄文字。");
      }
    } catch {
      setStatus("识别失败，请换一张图片再试。");
    } finally {
      setBusy(false);
    }
  };
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    if (!listenPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file) return; // 粘贴文字时不拦截
      e.preventDefault();
      void runRef.current(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [listenPaste]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition-opacity hover:opacity-85 disabled:opacity-70"
        style={{ background: "var(--v5-accent-fill)", color: "var(--v5-accent-fill-ink)", boxShadow: "inset 0 0 0 1px var(--v5-accent-fill-ring)" }}
      >
        {busy ? <Loader2 className="animate-spin" size={14} /> : <ImageUp size={14} />}
        {busy ? "正在识别…" : "从图片识别"}
      </button>
      <span className="text-[12.5px]" style={{ color: "var(--v5-ink3)" }}>
        {status || (listenPaste ? "微信读书卡片、书页照片都可以，也能直接粘贴截图" : "微信读书卡片、书页照片都可以")}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void run(file);
        }}
      />
    </div>
  );
}

/** 一图多句时的切换条：点第几句就把那句填进表单 */
export function RecognizedPicker({
  quotes,
  active,
  onPick,
}: {
  quotes: RecognizedQuote[];
  active: number;
  onPick: (index: number) => void;
}) {
  if (quotes.length < 2) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: "var(--v5-ink3)" }}>
      图里还有：
      {quotes.map((q, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          title={q.text}
          className="max-w-[12rem] truncate rounded-full px-3 py-1"
          style={
            i === active
              ? { background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)" }
              : { border: "1px solid var(--v5-rule)", color: "var(--v5-ink2)" }
          }
        >
          {i + 1}. {q.text}
        </button>
      ))}
      <span>保存后会自动填入下一句</span>
    </div>
  );
}
