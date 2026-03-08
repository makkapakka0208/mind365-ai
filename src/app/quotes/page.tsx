"use client";

import { Lightbulb, Quote as QuoteIcon, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { getTodayISODate, parseISODate } from "@/lib/date";
import { saveQuote } from "@/lib/storage";
import { useQuotesStore } from "@/lib/storage-store";
import type { Quote } from "@/types";
import { refreshQuotes } from "@/lib/storage";
import { useEffect } from "react";



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
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");

  const quotes = useQuotesStore();
  const dailyQuote = getDailyQuote(quotes);
  useEffect(() => {
    refreshQuotes();
  }, []);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const quote: Quote = {
      id: crypto.randomUUID(),
      text: text.trim(),
      author: author.trim(),
      book: book.trim(),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    saveQuote(quote);
    setText("");
    setAuthor("");
    setBook("");
    setTags("");
    setMessage("已保存到你的灵感书库。");
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="把那些值得反复回看的句子，整理成一座自己的灵感书库。"
        eyebrow="灵感书库"
        icon={Lightbulb}
        title="灵感书库"
      />

      <StaggerItem index={0}>
        <Panel className="relative overflow-hidden p-6 sm:p-7" interactive>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/16 via-purple-500/14 to-pink-500/16" />
          <div className="relative grid items-center gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">今日推荐</p>
              {dailyQuote ? (
                <>
                  <div className="mt-3 flex gap-2">
                    <QuoteIcon className="mt-1 text-indigo-200" size={18} />
                    <p className="text-lg leading-8 text-slate-100">{dailyQuote.text}</p>
                  </div>
                  <p className="mt-3 text-sm italic text-slate-300">
                    {dailyQuote.author || "佚名"}
                    {dailyQuote.book ? ` · ${dailyQuote.book}` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-300">保存第一条金句后，这里会出现今天的推荐语录。</p>
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
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              金句内容
              <Textarea
                className="min-h-28"
                onChange={(event) => setText(event.target.value)}
                placeholder="写下一句值得反复回看的话..."
                required
                value={text}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-200">
                作者
                <Input
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="作者姓名"
                  type="text"
                  value={author}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                书名 / 来源
                <Input
                  onChange={(event) => setBook(event.target.value)}
                  placeholder="书籍、影视或文章来源"
                  type="text"
                  value={book}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-200">
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
              {message ? <span className="text-sm text-emerald-300">{message}</span> : null}
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
                  <span className="mt-1 rounded-xl border border-white/15 bg-gradient-to-r from-indigo-500/30 via-purple-500/25 to-pink-500/30 p-2 text-indigo-100">
                    <QuoteIcon size={15} />
                  </span>
                  <div>
                    <p className="leading-7 text-slate-100">{quote.text}</p>
                    <p className="mt-3 text-sm text-slate-300">
                      {quote.author || "佚名"}
                      {quote.book ? ` · ${quote.book}` : ""}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {quote.tags.map((tag) => (
                        <span
                          className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-300"
                          key={`${quote.id}-${tag}`}
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

