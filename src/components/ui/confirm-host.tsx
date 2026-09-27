"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * 页面内确认框：askConfirm() 代替 window.confirm。
 * 部分内嵌浏览器会直接把系统确认框当作「取消」，导致删除、导入、离开页面都没反应。
 * <ConfirmHost /> 挂在根布局里，全站共用一个。
 */

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let show: ((pending: Pending) => void) | null = null;

export function askConfirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === "string" ? { message: options } : options;
  // 确认框还没挂载（极少见）时退回系统确认框
  if (!show) return Promise.resolve(window.confirm(opts.message));
  const open = show;
  return new Promise((resolve) => open({ ...opts, resolve }));
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    show = (next) =>
      setPending((prev) => {
        prev?.resolve(false); // 同时只保留一个确认框
        return next;
      });
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <Dialog onClose={() => close(false)} open={pending !== null} title={pending?.title ?? "请确认"}>
      {pending && (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed" style={{ color: "var(--m-ink2)" }}>{pending.message}</p>
          <div className="flex justify-end gap-3">
            <Button onClick={() => close(false)} type="button" variant="ghost">
              {pending.cancelLabel ?? "取消"}
            </Button>
            <Button autoFocus onClick={() => close(true)} type="button" variant="primary">
              {pending.confirmLabel ?? "确定"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
