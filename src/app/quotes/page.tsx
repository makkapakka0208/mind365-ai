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
    setMessage("Quote saved to your inspiration library.");
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="Build a personal library of words that reset your focus and courage."
        eyebrow="Quote Library"
        icon={Lightbulb}
        title="Quote Library"
      />

      <StaggerItem index={0}>
        <Panel className="relative overflow-hidden p-6 sm:p-7" interactive>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/16 via-purple-500/14 to-pink-500/16" />
          <div className="relative grid items-center gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">Today&apos;s Inspiration</p>
              {dailyQuote ? (
                <>
                  <div className="mt-3 flex gap-2">
                    <QuoteIcon className="mt-1 text-indigo-200" size={18} />
                    <p className="text-lg leading-8 text-slate-100">{dailyQuote.text}</p>
                  </div>
                  <p className="mt-3 text-sm italic text-slate-300">
                    {dailyQuote.author || "Unknown"}
                    {dailyQuote.book ? ` · ${dailyQuote.book}` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-300">Save one quote and your daily recommendation will appear here.</p>
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
              Quote
              <Textarea
                className="min-h-28"
                onChange={(event) => setText(event.target.value)}
                placeholder="Write a line worth remembering..."
                required
                value={text}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Author
                <Input
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Author name"
                  type="text"
                  value={author}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Book / Source
                <Input
                  onChange={(event) => setBook(event.target.value)}
                  placeholder="Book or source"
                  type="text"
                  value={book}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Tags
              <Input
                onChange={(event) => setTags(event.target.value)}
                placeholder="mindset, courage, calm"
                type="text"
                value={tags}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" type="submit" variant="primary">
                Save Quote
              </Button>
              {message ? <span className="text-sm text-emerald-300">{message}</span> : null}
            </div>
          </form>
        </Panel>
      </StaggerItem>

      {quotes.length === 0 ? (
        <EmptyState
          description="After your first quote, this page becomes a beautiful wall of reminders."
          icon={Sparkles}
          illustrationAlt="relaxed reading illustration"
          illustrationSrc="/illustrations/relaxed-reading.svg"
          title="No quotes yet"
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
                      {quote.author || "Unknown"}
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

