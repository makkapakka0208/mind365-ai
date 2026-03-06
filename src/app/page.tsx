"use client";

import {
  BookOpen,
  Brain,
  Calendar,
  LayoutDashboard,
  Quote,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { BarChartCard } from "@/components/charts/bar-chart-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { buildChartSeries, parseReadingHours, sortLogsByDate } from "@/lib/analytics";
import { formatDate, getTodayISODate } from "@/lib/date";
import { useDailyLogsStore, useQuotesStore } from "@/lib/storage-store";
import type { Quote as QuoteType } from "@/types";

const DEFAULT_DAILY_QUOTE = {
  text: "Even a small honest note can change the way you see your day.",
  author: "",
  book: "The Curious Case of Benjamin Button",
};

function pickRandomQuote(quotes: QuoteType[]) {
  if (quotes.length === 0) {
    return DEFAULT_DAILY_QUOTE;
  }

  const randomIndex = Math.floor(Math.random() * quotes.length);
  const quote = quotes[randomIndex];

  return {
    text: quote.text,
    author: quote.author,
    book: quote.book,
  };
}

export default function DashboardPage() {
  const logs = useDailyLogsStore();
  const quotes = useQuotesStore();

  const [isMounted, setIsMounted] = useState(false);
  const [dailyQuote, setDailyQuote] = useState(DEFAULT_DAILY_QUOTE);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsMounted(true);
      setDailyQuote(pickRandomQuote(quotes));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [quotes]);

  const today = getTodayISODate();
  const sortedDesc = sortLogsByDate(logs, "desc");
  const recentLogs = sortLogsByDate(logs, "asc").slice(-14);

  const todayLog = sortedDesc.find((log) => log.date === today);
  const latestReflection = sortedDesc.find((log) => log.thoughts.trim().length > 0);
  const readingHoursToday = todayLog ? parseReadingHours(todayLog.reading) : 0;
  const readingTargetHours = 2;
  const readingProgress = Math.min(100, Math.round((readingHoursToday / readingTargetHours) * 100));

  const moodSeries = buildChartSeries(recentLogs, (log) => log.mood);
  const studySeries = buildChartSeries(recentLogs, (log) => log.studyHours);
  const readingSeries = buildChartSeries(recentLogs, (log) => parseReadingHours(log.reading));

  const displayQuote = isMounted ? dailyQuote : DEFAULT_DAILY_QUOTE;
  const quoteSource =
    displayQuote.author || displayQuote.book
      ? `- ${displayQuote.author ? `${displayQuote.author}${displayQuote.book ? " · " : ""}` : ""}${displayQuote.book}`
      : "- Benjamin Button";

  const favoriteQuotes = quotes.slice(0, 3);

  const statsCards: Array<{
    label: string;
    value: string;
    hint: string;
    icon: typeof Sparkles;
    tone?: "primary" | "accent";
  }> = [
    {
      label: "Emotion Score",
      value: todayLog ? `${todayLog.mood}/10` : "-",
      hint: "How you feel today",
      icon: Sparkles,
    },
    {
      label: "Study Hours",
      value: todayLog ? `${todayLog.studyHours.toFixed(1)} h` : "0 h",
      hint: "Focused deep work",
      icon: Brain,
    },
    {
      label: "Reading Hours",
      value: `${readingHoursToday.toFixed(1)} h`,
      hint: "Daily reading ritual",
      icon: BookOpen,
      tone: "accent",
    },
    {
      label: "Growth Trend",
      value: `${logs.length}`,
      hint: "Total journal records",
      icon: TrendingUp,
    },
  ];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1280px] space-y-8 px-6">
        <PageTitle
          description="A calm space to reflect, learn, and move your growth forward every day."
          eyebrow="Mind365 Dashboard"
          icon={LayoutDashboard}
          rightSlot={
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-md">
              <Calendar size={14} />
              {formatDate(today)}
            </div>
          }
          title="Overview"
        />

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <StaggerItem className="md:col-span-12" index={0}>
            <Panel
              className="gradient-ring relative overflow-hidden p-7 shadow-2xl shadow-indigo-950/45 sm:p-10"
              interactive
            >
              <Image
                alt="soft landscape"
                className="pointer-events-none object-cover opacity-10"
                fill
                src="/illustrations/among-nature.svg"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/12 via-purple-500/10 to-pink-500/12" />
              <div className="relative mx-auto max-w-4xl text-center">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300">Today&apos;s Quote</p>
                <div className="mt-4 flex justify-center">
                  <span className="rounded-2xl border border-indigo-300/30 bg-indigo-400/12 p-3 text-indigo-200 shadow-lg shadow-indigo-950/35">
                    <Quote size={22} />
                  </span>
                </div>
                <p className="mt-5 text-2xl font-bold tracking-wide text-slate-100 sm:text-3xl">{displayQuote.text}</p>
                <p className="mt-4 text-sm italic text-slate-300">{quoteSource}</p>
              </div>
            </Panel>
          </StaggerItem>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {statsCards.map((card, index) => (
            <StaggerItem className="md:col-span-3" index={index + 1} key={card.label}>
              <SummaryCard
                className="h-full"
                hint={card.hint}
                icon={card.icon}
                label={card.label}
                tone={card.tone}
                value={card.value}
              />
            </StaggerItem>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <StaggerItem className="md:col-span-6" index={5}>
            <Panel className="flex h-full flex-col justify-between p-6" interactive>
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-100">Reading Progress</h3>
                  <span className="text-sm text-slate-300">{readingProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/15">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                    style={{ width: `${readingProgress}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Today {readingHoursToday.toFixed(1)}h / Goal {readingTargetHours}h
                </p>
              </div>
              <Illustration
                alt="reading illustration"
                className="mt-5 max-w-[220px]"
                src="/illustrations/reading-time.svg"
              />
            </Panel>
          </StaggerItem>

          <StaggerItem className="md:col-span-6" index={6}>
            <Panel className="relative flex h-full flex-col justify-between overflow-hidden p-6" interactive>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-blue-500/10" />
              <div className="relative">
                <h3 className="text-base font-semibold text-slate-100">Inspiration</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  You do not need a perfect day. You only need one conscious moment to keep growing.
                </p>
              </div>
              <div className="relative mt-5 space-y-4">
                <Illustration
                  alt="inspiration illustration"
                  className="max-w-[220px]"
                  src="/illustrations/ideas.svg"
                />
                <div className="flex flex-wrap gap-2">
                  <Link href="/daily-log">
                    <Button size="sm" variant="primary">
                      Write Journal
                    </Button>
                  </Link>
                  <Link href="/notes">
                    <Button size="sm" variant="ghost">
                      Deep Thinking
                    </Button>
                  </Link>
                </div>
              </div>
            </Panel>
          </StaggerItem>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <StaggerItem className="md:col-span-12" index={7}>
            <Panel className="p-6 lg:p-7" interactive>
              <h3 className="text-lg font-semibold text-slate-100">Reflection Diary</h3>
              <p className="mt-4 max-w-4xl text-sm leading-8 text-slate-200 lg:text-[15px]">
                {latestReflection
                  ? latestReflection.thoughts
                  : "Capture one honest sentence about your day and let it guide your next step."}
              </p>
            </Panel>
          </StaggerItem>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <StaggerItem className="md:col-span-6" index={8}>
            <Panel className="flex h-full flex-col justify-between p-6" interactive>
              <div className="mb-5 flex items-center gap-2">
                <Quote className="text-indigo-200" size={18} />
                <h3 className="text-base font-semibold text-slate-100">Favorite Quotes</h3>
              </div>

              {favoriteQuotes.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Save your first quote and this section becomes your inspiration wall.
                </div>
              ) : (
                <div className="space-y-3">
                  {favoriteQuotes.map((quote) => (
                    <div
                      className="rounded-xl border border-white/10 bg-white/10 p-4 shadow-lg shadow-indigo-950/20"
                      key={quote.id}
                    >
                      <p className="text-sm leading-7 text-slate-200">&ldquo;{quote.text}&rdquo;</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {quote.author || "Unknown"}
                        {quote.book ? ` · ${quote.book}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </StaggerItem>

          <StaggerItem className="md:col-span-6" index={9}>
            <Panel className="flex h-full flex-col justify-between p-6" interactive>
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="text-cyan-200" size={18} />
                  <h3 className="text-base font-semibold text-slate-100">Gentle Reminder</h3>
                </div>
                <p className="text-sm leading-7 text-slate-200">
                  Your progress is not loud, but it is real. Keep writing, keep learning, keep noticing.
                </p>
              </div>
              <Illustration
                alt="inspiration illustration"
                className="mt-5 max-w-[240px]"
                src="/illustrations/among-nature.svg"
              />
            </Panel>
          </StaggerItem>
        </section>

        {logs.length === 0 ? (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <StaggerItem className="md:col-span-12" index={10}>
              <EmptyState
                description="Start with one journal entry. Your mood, study, and reading trends will appear here."
                icon={Sparkles}
                illustrationAlt="notebook illustration"
                illustrationSrc="/illustrations/personal-notebook.svg"
                title="Ready to start your growth journey?"
              />
            </StaggerItem>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <StaggerItem className="md:col-span-6" index={10}>
              <LineChartCard
                data={moodSeries.data}
                datasetLabel="Mood"
                description="Emotion trend over the past two weeks"
                labels={moodSeries.labels}
                title="Emotion Trend"
              />
            </StaggerItem>

            <StaggerItem className="md:col-span-6" index={11}>
              <BarChartCard
                data={studySeries.data}
                datasetLabel="Study Hours"
                description="Daily deep-focus study pattern"
                labels={studySeries.labels}
                title="Study Hours"
              />
            </StaggerItem>

            <StaggerItem className="md:col-span-12" index={12}>
              <LineChartCard
                data={readingSeries.data}
                datasetLabel="Reading Hours"
                description="Reading rhythm and consistency"
                labels={readingSeries.labels}
                title="Reading Trend"
              />
            </StaggerItem>
          </section>
        )}
      </div>
    </PageTransition>
  );
}

