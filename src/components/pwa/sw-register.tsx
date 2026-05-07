"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Auto-update: check for new SW every 60 minutes
          setInterval(() => { void reg.update(); }, 60 * 60 * 1000);
        })
        .catch(() => {
          // SW registration failed — silently ignore
        });
    }
  }, []);

  return null;
}
