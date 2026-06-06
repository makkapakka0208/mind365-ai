"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // In local development, never let a cached service worker hide code
    // changes. Unregister any existing SW and drop its caches, then bail.
    const host = window.location.hostname;
    const isLocalDev =
      host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local");
    if (isLocalDev) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k))).catch(() => {});
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Auto-update: check for new SW every 60 minutes
        setInterval(() => { void reg.update(); }, 60 * 60 * 1000);
      })
      .catch(() => {
        // SW registration failed — silently ignore
      });
  }, []);

  return null;
}
