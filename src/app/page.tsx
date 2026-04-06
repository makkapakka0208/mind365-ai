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

import { MobileGreeting } from "@/components/layout/mobile-greeting";
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
  text: "人生发财靠康波。认清所处的宏观周期，在低谷时疯狂蓄力，在拐点时果断出击。",
  author: "周金涛",
  book: "康德拉季耶夫周期理论",
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
      : "- 匿名";

  const favoriteQuotes = quotes.slice(0, 3);

  const statsCards: Array<{
    label: string;
    value: string;
    hint: string;
    icon: typeof Sparkles;
    tone?: "primary" | "accent";
  }> = [
    { label: "今日情绪", value: todayLog ? `${todayLog.mood}/10` : "-", hint: "记录今天的心境温度", icon: Sparkles },
    { label: "学习时长", value: todayLog ? `${todayLog.studyHours.toFixed(1)} h` : "0 h", hint: "专注投入的累计时长", icon: Brain },
    { label: "阅读时长", value: `${readingHoursToday.toFixed(1)} h`, hint: "今天的阅读节奏", icon: BookOpen, tone: "accent" },
    { label: "成长记录", value: `${logs.length}`, hint: "累计写下的日记数量", icon: TrendingUp },
  ];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1280px] space-y-8">
        <MobileGreeting />
        <PageTitle
          description="把情绪、学习和思考放在同一个视角里，日常成长会更清晰。"
          eyebrow="Mind365"
          icon={LayoutDashboard}
          rightSlot={
            <div
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2"
              style={{
                background: "var(--m-base-light)",
                border: "1px solid var(--m-rule)",
                boxShadow: "var(--m-shadow-out)",
              }}
            >
              <Calendar size={14} />
              {formatDate(today)}
            </div>
          }
          title="成长概览"
        />

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <StaggerItem className="md:col-span-12" index={0}>
            <Panel className="relative overflow-hidden px-6 py-5 sm:px-8 sm:py-6" interactive>
              <Image
                alt="soft landscape"
                className="pointer-events-none object-cover opacity-10"
                fill
                src="/illustrations/among-nature.svg"
              />
              <div className="relative mx-auto max-w-4xl text-center flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <Quote size={16} style={{ color: "var(--m-accent)" }} />
                  <p className="text-xs font-medium uppercase tracking-[0.2em]" style={{ color: "var(--m-ink3)" }}>今日金句</p>
                </div>
                <p className="text-lg font-medium tracking-wide sm:text-xl leading-relaxed" style={{ color: "var(--m-ink)" }}>
                  {displayQuote.text}
                </p>
                <p className="mt-2 text-xs italic" style={{ color: "var(--m-ink2)" }}>{quoteSource}</p>
              </div>
            </Panel>
          </StaggerItem>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {statsCards.map((card, index) => (
            <StaggerItem className="md:col-span-3" index={index + 1} key={card.label}>
              <SummaryCard className="h-full" hint={card.hint} icon={card.icon} label={card.label} tone={card.tone} value={card.value} />
            </StaggerItem>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <StaggerItem className="md:col-span-6" index={5}>
            <Panel className="flex h-full flex-col justify-between p-6" interactive>
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>阅读进度</h3>
                  <span className="text-sm" style={{ color: "var(--m-ink2)" }}>{readingProgress}%</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "var(--m-rule)" }}>
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ width: `${readingProgress}%`, background: "var(--m-accent)" }}
                  />
                </div>
                <p className="mt-3 text-sm" style={{ color: "var(--m-ink2)" }}>
                  今天 {readingHoursToday.toFixed(1)}h / 目标 {readingTargetHours}h
                </p>
              </div>
              <Illustration alt="reading illustration" className="mt-5 max-w-[220px]" src="/illustrations/reading-time.svg" />
            </Panel>
          </StaggerItem>

          <StaggerItem className="md:col-span-6" index={6}>
            <Panel className="relative flex h-full flex-col justify-between overflow-hidden p-6" interactive>
              <div className="relative">
                <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>灵感角落</h3>
                <p className="mt-3 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  你不需要拥有一个完美的今天。只要留住一个清醒的瞬间，成长就还在继续。
                </p>
              </div>
              <div className="relative mt-5 space-y-4">
                <Illustration alt="inspiration illustration" className="max-w-[220px]" src="/illustrations/ideas.svg" />
                <div className="flex flex-wrap gap-2">
                  <Link href="/daily-log">
                    <Button size="sm" variant="primary">写日记</Button>
                  </Link>
                  <Link href="/notes">
                    <Button size="sm" variant="ghost">深度思考</Button>
                  </Link>
                </div>
              </div>
            </Panel>
          </StaggerItem>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <StaggerItem className="md:col-span-12" index={7}>
            <Panel className="p-6 lg:p-7" interactive>
              <h3 className="text-lg font-semibold" style={{ color: "var(--m-ink)" }}>最近一段反思</h3>
              <p className="mt-4 max-w-4xl text-sm leading-8 lg:text-[15px]" style={{ color: "var(--m-ink)" }}>
                {latestReflection ? latestReflection.thoughts : "先写下一句真实的感受，它会帮你看见下一步。"}
              </p>
            </Panel>
          </StaggerItem>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <StaggerItem className="md:col-span-6" index={8}>
            <Panel className="flex h-full flex-col justify-between p-6" interactive>
              <div className="mb-5 flex items-center gap-2">
                <Quote size={18} style={{ color: "var(--m-accent)" }} />
                <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>收藏金句</h3>
              </div>

              {favoriteQuotes.length === 0 ? (
                <div
                  className="rounded-xl p-4 text-sm"
                  style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}
                >
                  保存第一条金句后，这里会成为你的灵感墙。
                </div>
              ) : (
                <div className="space-y-3">
                  {favoriteQuotes.map((quote, idx) => (
                    <div
                      className="rounded-xl p-4"
                      key={idx}
                      style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", boxShadow: "var(--m-shadow-in)" }}
                    >
                      <p className="text-sm leading-7" style={{ color: "var(--m-ink)" }}>&ldquo;{quote.text}&rdquo;</p>
                      <p className="mt-2 text-xs" style={{ color: "var(--m-ink3)" }}>
                        {quote.author || "佚名"}
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
                  <Sparkles size={18} style={{ color: "var(--m-accent)" }} />
                  <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>温柔提醒</h3>
                </div>
                <p className="text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  你的进步不一定喧闹，但它一直真实存在。继续写，继续学，继续认真感受。
                </p>
              </div>
              <Illustration alt="inspiration illustration" className="mt-5 max-w-[240px]" src="/illustrations/among-nature.svg" />
            </Panel>
          </StaggerItem>
        </section>

        {logs.length === 0 ? (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <StaggerItem className="md:col-span-12" index={10}>
              <EmptyState
                description="先写下一条日记，这里就会开始呈现你的情绪、学习与阅读趋势。"
                icon={Sparkles}
                illustrationAlt="notebook illustration"
                illustrationSrc="/illustrations/personal-notebook.svg"
                title="准备开始你的成长旅程了吗？"
              />
            </StaggerItem>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <StaggerItem className="md:col-span-6" index={10}>
              <LineChartCard data={moodSeries.data} datasetLabel="情绪" description="过去两周的情绪变化" labels={moodSeries.labels} title="情绪趋势" />
            </StaggerItem>
            <StaggerItem className="md:col-span-6" index={11}>
              <BarChartCard data={studySeries.data} datasetLabel="学习" description="最近两周的学习投入" labels={studySeries.labels} title="学习时长" />
            </StaggerItem>
            <StaggerItem className="md:col-span-12" index={12}>
              <LineChartCard data={readingSeries.data} datasetLabel="阅读" description="阅读节奏与连续性" labels={readingSeries.labels} title="阅读趋势" />
            </StaggerItem>
          </section>
        )}
      </div>
    </PageTransition>
  );
}
