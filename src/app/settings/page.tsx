"use client";

import { AlertTriangle, Download, Settings2, Upload } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { downloadMind365Backup, importMind365Backup } from "@/lib/storage";

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onExport = () => {
    try {
      downloadMind365Backup();
      setMessage("Backup exported as mind365-backup.json.");
      setError("");
    } catch {
      setError("Failed to export backup.");
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

    const confirmed = window.confirm(
      "Importing will overwrite your existing Mind365 data (daily logs, quotes, notes, settings). Continue?",
    );

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    try {
      const raw = await file.text();
      const result = importMind365Backup(raw);

      setMessage(
        `Import completed: ${result.dailyLogs} journal entries, ${result.quotes} quotes, ${result.notes} notes restored.`,
      );
      setError("");
    } catch (importError) {
      const text = importError instanceof Error ? importError.message : "Failed to import backup.";
      setError(text);
      setMessage("");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="Backup and restore your personal growth records safely."
        eyebrow="System"
        icon={Settings2}
        title="Settings"
      />

      <Panel className="p-6 sm:p-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Data Backup</h3>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Export all local data into a JSON file, or import a backup file to restore your records.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Button className="justify-center" onClick={onExport} size="lg" variant="primary">
              <Download className="mr-2" size={17} />
              Export Data
            </Button>

            <Button className="justify-center" onClick={onImportTrigger} size="lg" variant="secondary">
              <Upload className="mr-2" size={17} />
              Import Data
            </Button>
          </div>

          <input
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
            ref={fileInputRef}
            type="file"
          />

          <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle size={16} />
              Overwrite Protection
            </p>
            <p className="mt-2 leading-6 text-amber-100/90">
              Import requires a confirmation dialog before replacing current data.
            </p>
          </div>

          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </Panel>
    </PageTransition>
  );
}