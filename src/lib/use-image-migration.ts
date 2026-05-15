"use client";

import { useEffect, useRef } from "react";
import { isBase64DataUrl, migrateBase64Images } from "@/lib/image-storage";
import { getDailyLogs, updateDailyLog } from "@/lib/storage";
import type { DailyLog } from "@/types";

const MIGRATION_KEY = "mind365:image-migration-done";

/**
 * Background hook: scans all daily logs for base64 images and
 * migrates them to Supabase Storage. Runs once per session.
 */
export function useImageMigration() {
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;
    if (typeof window === "undefined") return;

    // Skip if already migrated this session
    if (sessionStorage.getItem(MIGRATION_KEY)) return;

    running.current = true;

    (async () => {
      try {
        const logs = getDailyLogs();
        const logsWithBase64 = logs.filter(
          (log) => log.images && log.images.some(isBase64DataUrl),
        );

        if (logsWithBase64.length === 0) {
          sessionStorage.setItem(MIGRATION_KEY, "1");
          return;
        }

        console.log(`[image-migration] Migrating base64 images in ${logsWithBase64.length} entries...`);

        for (const log of logsWithBase64) {
          try {
            const { urls, changed } = await migrateBase64Images(log.images ?? []);
            if (changed) {
              await updateDailyLog({ ...log, images: urls });
              console.log(`[image-migration] Migrated images for ${log.date}`);
            }
          } catch (err) {
            console.warn(`[image-migration] Failed for ${log.date}:`, err);
          }
        }

        sessionStorage.setItem(MIGRATION_KEY, "1");
        console.log("[image-migration] Done.");
      } catch (err) {
        console.warn("[image-migration] Migration failed:", err);
      } finally {
        running.current = false;
      }
    })();
  }, []);
}
