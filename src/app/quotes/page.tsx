"use client";

import { Lightbulb, Quote as QuoteIcon, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { getTodayISODate, parseISODate } from "@/lib/date";
import { refreshQuotes, saveQuote } from "@/lib/storage";
import { useQuotesStore } from "@/lib/storage-store";
import type { Quote } from "@/types";

function getDailyQuote(quotes: Quote[]): Quote | null {
  if (quotes.length === 0) {
    return null;
  }

  const today = parseISODate(getTodayISODate());
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayNumber = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000);

  return quotes[dayNumber % quotes.length] ?? null;
}

export default function QuotesPage() {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [book, setBook] = useState("");
  const [readingHours, setReadingHours] = useState(0);
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");

  const quotes = useQuotesStore();
  const dailyQuote = getDailyQuote(quotes);

  useEffect(() => {
    void refreshQuotes();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const quote: Quote = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      text: text.trim(),
      author: author.trim(),
      book: book.trim(),
      readingHours: Number.isFinite(readingHours) ? Math.max(0, readingHours) : 0,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    await saveQuote(quote);
    setText("");
    setAuthor("");
    setBook("");
    setReadingHours(0);
    setTags("");
    setMessage("已保存到你的灵感书库。");
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="把那些值得反复回看的句子，整理成一座自己的灵感书库，也顺手把阅读时长记在同一处。"
        eyebrow="灵感书库"
        icon={Lightbulb}
        title="灵感书库"
      />

      <StaggerItem index={0}>
        <Panel className="relative overflow-hidden p-6 sm:p-7" interactive>
          <div className="relative grid items-center gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em]" style={{ color: "var(--m-ink2)" }}>
                今日推荐
              </p>
              {dailyQuote ? (
                <>
                  <div className="mt-3 flex gap-2">
                    <QuoteIcon className="mt-1" size={18} style={{ color: "var(--m-accent)" }} />
                    <p className="text-lg leading-8" style={{ color: "var(--m-ink)" }}>
                      {dailyQuote.text}
                    </p>
                  </div>
                  <p className="mt-3 text-sm italic" style={{ color: "var(--m-ink2)" }}>
                    {dailyQuote.author || "佚名"}
                    {dailyQuote.book ? ` · ${dailyQuote.book}` : ""}
                    {dailyQuote.readingHours > 0 ? ` · 阅读 ${dailyQuote.readingHours.toFixed(1)}h` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm" style={{ color: "var(--m-ink2)" }}>
                  保存第一条金句后，这里会出现今天的推荐语录。
                </p>
              )}
            </div>

            <Illustration
              alt="books and ideas illustration"
              className="mx-auto w-full max-w-[250px]"
              src="/illustrations/ideas.svg"
            />
          </div>
        </Panel>
      </StaggerItem>

      <StaggerItem index={1}>
        <Panel className="p-6">
          <form className="grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              金句内容
              <Textarea
                className="min-h-28"
                onChange={(event) => setText(event.target.value)}
                placeholder="写下一句值得反复回看的话..."
                required
                value={text}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                作者
                <Input
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="作者姓名"
                  type="text"
                  value={author}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                书名 / 来源
                <Input
                  onChange={(event) => setBook(event.target.value)}
                  placeholder="书籍、影视或文章来源"
                  type="text"
                  value={book}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                阅读时长
                <Input
                  min={0}
                  onChange={(event) => setReadingHours(Number(event.target.value) || 0)}
                  placeholder="0.5"
                  step={0.5}
                  type="number"
                  value={readingHours}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              标签
              <Input
                onChange={(event) => setTags(event.target.value)}
                placeholder="心态, 勇气, 平静"
                type="text"
                value={tags}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" type="submit" variant="primary">
                保存
              </Button>
              {message ? (
                <span className="text-sm" style={{ color: "var(--m-success)" }}>
                  {message}
                </span>
              ) : null}
            </div>
          </form>
        </Panel>
      </StaggerItem>

      {quotes.length === 0 ? (
        <EmptyState
          description="保存第一条金句后，这里会逐渐变成你的私人提醒墙。"
          icon={Sparkles}
          illustrationAlt="relaxed reading illustration"
          illustrationSrc="/illustrations/relaxed-reading.svg"
          title="还没有收藏金句"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {quotes.map((quote, index) => (
            <StaggerItem index={index} key={quote.id}>
              <Panel className="p-5" interactive>
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 rounded-xl p-2"
                    style={{
                      background: "var(--m-base)",
                      border: "1px solid var(--m-rule)",
                      boxShadow: "var(--m-shadow-out)",
                      color: "var(--m-accent)",
                    }}
                  >
                    <QuoteIcon size={15} />
                  </span>
                  <div>
                    <p className="leading-7" style={{ color: "var(--m-ink)" }}>
                      {quote.text}
                    </p>
                    <p className="mt-3 text-sm" style={{ color: "var(--m-ink2)" }}>
                      {quote.author || "佚名"}
                      {quote.book ? ` · ${quote.book}` : ""}
                    </p>
                    {quote.readingHours > 0 ? (
                      <p className="mt-2 text-xs" style={{ color: "var(--m-ink3)" }}>
                        阅读 {quote.readingHours.toFixed(1)} h
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {quote.tags.map((tag) => (
                        <span
                          className="rounded-full px-3 py-1 text-xs"
                          key={`${quote.id}-${tag}`}
                          style={{
                            background: "var(--m-base)",
                            border: "1px solid var(--m-rule)",
                            color: "var(--m-ink2)",
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            </StaggerItem>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
