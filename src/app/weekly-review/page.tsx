"use client";

import { BookOpen, BrainCircuit, CalendarClock, Sparkles, Smile } from "lucide-react";
import { useState } from "react";

import { BarChartCard } from "@/components/charts/bar-chart-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import {
  buildChartSeries,
  computeSummary,
  getCurrentWeekLogs,
  parseReadingHours,
} from "@/lib/analytics";
import { formatDate, getWeekRange, toISODate } from "@/lib/date";
import { useDailyLogsStore } from "@/lib/storage-store";

interface WeeklyReflectionResponse {
  reflection?: string | null;
  message?: string;
  available?: boolean;
}

export default function WeeklyReviewPage() {
  const weekLogs = getCurrentWeekLogs(useDailyLogsStore());
  const metrics = computeSummary(weekLogs);
  const moodSeries = buildChartSeries(weekLogs, (log) => log.mood);
  const studySeries = buildChartSeries(weekLogs, (log) => log.studyHours);
  const readingSeries = buildChartSeries(weekLogs, (log) => parseReadingHours(log.reading));
  const range = getWeekRange();

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReflection, setAiReflection] = useState("");
  const [aiMessage, setAiMessage] = useState("");

  const generateAiReflection = async () => {
    if (isGenerating || weekLogs.length === 0) {
      return;
    }

    setIsGenerating(true);
    setAiMessage("");

    try {
      const payload = {
        weekRange: {
          start: toISODate(range.start),
          end: toISODate(range.end),
        },
        summary: metrics,
        entries: weekLogs.map((log) => ({
          date: log.date,
          emotionScore: log.mood,
          studyHours: log.studyHours,
          readingHours: parseReadingHours(log.reading),
          journalText: log.thoughts,
        })),
      };

      const response = await fetch("/api/weekly-reflection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as WeeklyReflectionResponse;

      if (!response.ok) {
        setAiMessage(data.message ?? "Failed to generate reflection.");
        return;
      }

      if (!data.reflection) {
        setAiMessage(data.message ?? "AI reflection is currently unavailable.");
        return;
      }

      setAiReflection(data.reflection);
      setAiMessage("AI reflection generated.");
    } catch {
      setAiMessage("Failed to generate reflection. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="Review your weekly momentum with emotional and learning signals."
        eyebrow="Weekly Review"
        icon={CalendarClock}
        rightSlot={
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-md">
            {formatDate(toISODate(range.start))} - {formatDate(toISODate(range.end))}
          </div>
        }
        title="Weekly Review"
      />

      {weekLogs.length === 0 ? (
        <EmptyState
          description="No logs yet this week. Add one journal entry and the review charts will appear."
          icon={Sparkles}
          illustrationAlt="reading illustration"
          illustrationSrc="/illustrations/reading-time.svg"
          title="No weekly data"
        />
      ) : (
        <>
          <StaggerItem index={0}>
            <Panel className="grid items-center gap-4 p-5 lg:grid-cols-[1.3fr_1fr]" interactive>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Weekly Snapshot</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  You logged {metrics.entries} day(s), average mood {metrics.averageMood}/10, study
                  {metrics.totalStudyHours.toFixed(1)}h, reading {metrics.totalReadingHours.toFixed(1)}h.
                </p>
              </div>
              <Illustration
                alt="weekly reflection illustration"
                className="mx-auto max-w-[230px]"
                src="/illustrations/relaxed-reading.svg"
              />
            </Panel>
          </StaggerItem>

          <StaggerItem index={1}>
            <Panel className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">AI Reflection</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Generate an optional weekly insight from your journal and growth signals.
                  </p>
                </div>

                <Button onClick={generateAiReflection} size="lg" variant="primary">
                  <Sparkles className="mr-2" size={16} />
                  {isGenerating ? "Generating..." : "Generate AI Reflection"}
                </Button>
              </div>

              {aiMessage ? <p className="mt-4 text-sm text-slate-300">{aiMessage}</p> : null}
            </Panel>
          </StaggerItem>

          {aiReflection ? (
            <StaggerItem index={2}>
              <Panel className="relative overflow-hidden border border-indigo-300/25 bg-gradient-to-br from-indigo-500/22 via-purple-500/16 to-pink-500/20 p-6 shadow-2xl shadow-indigo-900/35">
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-indigo-300/25 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-12 left-8 h-40 w-40 rounded-full bg-pink-300/20 blur-3xl" />

                <div className="relative">
                  <h3 className="text-xl font-semibold tracking-tight text-slate-100">AI Growth Reflection</h3>
                  <div className="mt-4 space-y-4 text-[15px] leading-8 text-slate-100/95">
                    {aiReflection
                      .split(/\n\s*\n/)
                      .map((paragraph) => paragraph.trim())
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p className="whitespace-pre-line" key={`${paragraph.slice(0, 24)}-${index}`}>
                          {paragraph}
                        </p>
                      ))}
                  </div>
                </div>
              </Panel>
            </StaggerItem>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StaggerItem index={3}>
              <SummaryCard icon={Smile} label="Average Mood" value={`${metrics.averageMood}/10`} />
            </StaggerItem>
            <StaggerItem index={4}>
              <SummaryCard
                icon={BrainCircuit}
                label="Total Study"
                value={`${metrics.totalStudyHours.toFixed(1)} h`}
              />
            </StaggerItem>
            <StaggerItem index={5}>
              <SummaryCard
                icon={BookOpen}
                label="Total Reading"
                tone="accent"
                value={`${metrics.totalReadingHours.toFixed(1)} h`}
              />
            </StaggerItem>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StaggerItem index={6}>
              <LineChartCard
                data={moodSeries.data}
                datasetLabel="Mood"
                description="Mood shifts across the week"
                labels={moodSeries.labels}
                title="Weekly Mood"
              />
            </StaggerItem>
            <StaggerItem index={7}>
              <BarChartCard
                data={studySeries.data}
                datasetLabel="Study"
                description="Study effort by day"
                labels={studySeries.labels}
                title="Weekly Study"
              />
            </StaggerItem>
          </div>

          <StaggerItem index={8}>
            <LineChartCard
              data={readingSeries.data}
              datasetLabel="Reading"
              description="Reading rhythm this week"
              labels={readingSeries.labels}
              title="Weekly Reading"
            />
          </StaggerItem>
        </>
      )}
    </PageTransition>
  );
}