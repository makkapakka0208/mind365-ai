"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Download, Share, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ── 全局捕获 beforeinstallprompt（在 React 挂载之前就可能触发） ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _deferredPrompt: any = null;
let _promptCaptured = false;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    _promptCaptured = true;
  });
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

const DISMISS_KEY = "mind365_pwa_dismiss";
const DISMISS_DAYS = 7;

export function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [promptType, setPromptType] = useState<"install" | "ios" | "android-manual">("install");

  useEffect(() => {
    if (isStandalone()) return;

    // Check dismiss
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const ts = Number(dismissed);
      if (Date.now() - ts < DISMISS_DAYS * 86400000) return;
    }

    // Check if the global handler already captured the event before React mounted
    if (_promptCaptured && _deferredPrompt) {
      setDeferredPrompt(_deferredPrompt);
      setPromptType("install");
      setShow(true);
      return;
    }

    // Listen for future beforeinstallprompt events
    const handler = (e: Event) => {
      e.preventDefault();
      _deferredPrompt = e;
      _promptCaptured = true;
      setDeferredPrompt(e);
      setPromptType("install");
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Fallback: if no event after 5 seconds, show manual instructions
    const fallbackTimer = setTimeout(() => {
      if (_promptCaptured) return; // Event was captured, no need for fallback

      if (isIOS()) {
        setPromptType("ios");
        setShow(true);
      } else if (isAndroid()) {
        setPromptType("android-manual");
        setShow(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPrompt || _deferredPrompt;
    if (!prompt) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await prompt.prompt();
    } catch {
      // prompt() can only be called once
    }
    _deferredPrompt = null;
    setDeferredPrompt(null);
    setShow(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-24 left-4 right-4 z-[60] mx-auto max-w-sm md:hidden"
        >
          <div
            className="relative overflow-hidden rounded-2xl p-4"
            style={{
              background: "rgba(253,246,235,0.97)",
              border: "1px solid var(--m-rule)",
              boxShadow: "0 20px 50px rgba(100,60,20,0.25), 0 4px 12px rgba(0,0,0,0.08)",
              backdropFilter: "blur(16px)",
            }}
          >
            {/* Close */}
            <button
              type="button"
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-black/5"
              style={{ color: "var(--m-ink3)" }}
              onClick={handleDismiss}
              aria-label="关闭"
            >
              <X size={15} />
            </button>

            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--m-accent)", color: "#FDF6EB" }}
              >
                {promptType === "ios" ? <Share size={20} /> : <Download size={20} />}
              </div>

              <div className="min-w-0 flex-1 pr-6">
                <p className="text-sm font-semibold" style={{ color: "var(--m-ink)" }}>
                  安装 Mind365 到主屏幕
                </p>

                {promptType === "install" ? (
                  <>
                    <p className="mt-1 text-xs" style={{ color: "var(--m-ink3)" }}>
                      全屏体验，离线可用，像原生 App 一样使用。
                    </p>
                    <button
                      type="button"
                      className="mt-2.5 rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                      style={{ background: "var(--m-accent)" }}
                      onClick={handleInstall}
                    >
                      立即安装
                    </button>
                  </>
                ) : promptType === "ios" ? (
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--m-ink3)" }}>
                    点击底部
                    <Share size={12} className="mx-0.5 inline" style={{ color: "var(--m-accent)" }} />
                    分享按钮，选择「添加到主屏幕」即可。
                  </p>
                ) : (
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--m-ink3)" }}>
                    点击浏览器右上角 <strong>⋮</strong> 菜单，选择「添加到主屏幕」或「安装应用」即可。
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
