"use client";

import { CalendarDays, CheckCircle2, NotebookPen } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { sortLogsByDate } from "@/lib/analytics";
import { formatDate, getTodayISODate } from "@/lib/date";
import { saveDailyLog } from "@/lib/storage";
import { useDailyLogsStore } from "@/lib/storage-store";
import type { DailyLog } from "@/types";

export default function DailyLogPage() {
  const [date, setDate] = useState(getTodayISODate());
  const [mood, setMood] = useState(7);
  const [thoughts, setThoughts] = useState("");
  const [reading, setReading] = useState("");
  const [studyHours, setStudyHours] = useState(0);
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");

  const logs = sortLogsByDate(useDailyLogsStore(), "desc");
  const recentLogs = logs.slice(0, 4);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const entry: DailyLog = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      date,
      mood,
      thoughts: thoughts.trim(),
      reading: reading.trim(),
      studyHours: Number.isFinite(studyHours) ? Math.max(0, studyHours) : 0,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    saveDailyLog(entry);
    setThoughts("");
    setReading("");
    setStudyHours(0);
    setTags("");
    setMessage("Saved. Your reflection is now part of your growth story.");
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="Capture your mood, thoughts, and focus in one calm daily flow."
        eyebrow="Daily Journal"
        icon={NotebookPen}
        title="Journal"
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <StaggerItem index={0}>
          <Panel className="p-6 sm:p-7">
            <form className="grid gap-5" onSubmit={onSubmit}>
              <div className="grid gap-5 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Date
                  <Input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Study Hours
                  <Input
                    min={0}
                    onChange={(event) => setStudyHours(Number(event.target.value))}
                    step={0.5}
                    type="number"
                    value={studyHours}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Mood ({mood}/10)
                <input
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-indigo-400"
                  max={10}
                  min={1}
                  onChange={(event) => setMood(Number(event.target.value))}
                  type="range"
                  value={mood}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Daily Thoughts
                <Textarea
                  onChange={(event) => setThoughts(event.target.value)}
                  placeholder="Write the most meaningful moment of your day..."
                  value={thoughts}
                />
              </label>

              <div className="grid gap-5 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Reading
                  <Input
                    onChange={(event) => setReading(event.target.value)}
                    placeholder="e.g. 1.5h Atomic Habits"
                    type="text"
                    value={reading}
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Tags (comma separated)
                  <Input
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="focus, growth, calm"
                    type="text"
                    value={tags}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" type="submit" variant="primary">
                  Save Entry
                </Button>
                {message ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300">
                    <CheckCircle2 size={16} />
                    {message}
                  </span>
                ) : null}
              </div>
            </form>
          </Panel>
        </StaggerItem>

        <StaggerItem index={1}>
          <Panel className="overflow-hidden p-6" interactive>
            <h3 className="text-base font-semibold text-slate-100">Writing Prompts</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              1. What moment shifted your emotion today?
              <br />
              2. What small win are you grateful for?
              <br />
              3. What one intention matters most tomorrow?
            </p>
            <Illustration
              alt="journaling illustration"
              className="mt-5 max-w-[260px]"
              src="/illustrations/personal-notebook.svg"
            />
          </Panel>
        </StaggerItem>
      </div>

      <StaggerItem index={2}>
        <Panel className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">Recent Entries</h3>
            <span className="text-sm text-slate-400">Last 4 logs</span>
          </div>

          {recentLogs.length === 0 ? (
            <EmptyState
              description="Once you save your first entry, your recent timeline appears here."
              icon={CalendarDays}
              illustrationAlt="notebook illustration"
              illustrationSrc="/illustrations/personal-notebook.svg"
              title="No entries yet"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentLogs.map((log, index) => (
                <StaggerItem className="h-full" index={index} key={log.id}>
                  <Link className="block h-full" href={`/journal?id=${log.id}`}>
                    <div className="h-full rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-950/35">
                      <p className="text-sm text-slate-400">{formatDate(log.date)}</p>
                      <p className="mt-2 text-sm font-medium text-slate-100">Mood {log.mood}/10</p>
                      <p className="mt-1 text-sm text-slate-300">Study {log.studyHours} h</p>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </div>
          )}
        </Panel>
      </StaggerItem>
    </PageTransition>
  );
}
