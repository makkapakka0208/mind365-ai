"use client";

import { Brain, Lightbulb, Quote as QuoteIcon, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { getTodayISODate, parseISODate } from "@/lib/date";
import { refreshNotes, refreshQuotes, saveNote, saveQuote } from "@/lib/storage";
import { useNotesStore, useQuotesStore } from "@/lib/storage-store";
import type { Note, Quote } from "@/types";

type Tab = "quotes" | "notes";

function getDailyQuote(quotes: Quote[]): Quote | null {
  if (quotes.length === 0) return null;
  const today = parseISODate(getTodayISODate());
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayNumber = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000);
  return quotes[dayNumber % quotes.length] ?? null;
}

function formatPreview(content: string) {
  return content.trim().replace(/\s+/g, " ");
}

// ── Tab segmented control ──────────────────────────────────────
function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; Icon: typeof Lightbulb }[] = [
    { id: "quotes", label: "金句收藏", Icon: Lightbulb },
    { id: "notes",  label: "深度思考", Icon: Brain },
  ];

  return (
    <div
      className="inline-flex rounded-xl p-1"
      style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-medium transition-all duration-200"
            key={id}
            onClick={() => onChange(id)}
            style={
              isActive
                ? {
                    background: "var(--m-base-light)",
                    boxShadow: "var(--m-shadow-out)",
                    color: "var(--m-accent)",
                  }
                : { color: "var(--m-ink3)" }
            }
            type="button"
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Quotes section ─────────────────────────────────────────────
function QuotesSection() {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [book, setBook] = useState("");
  const [readingHours, setReadingHours] = useState(0);
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");

  const quotes = useQuotesStore();
  const dailyQuote = getDailyQuote(quotes);

  useEffect(() => { void refreshQuotes(); }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quote: Quote = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      text: text.trim(),
      author: author.trim(),
      book: book.trim(),
      readingHours: Number.isFinite(readingHours) ? Math.max(0, readingHours) : 0,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    await saveQuote(quote);
    setText(""); setAuthor(""); setBook(""); setReadingHours(0); setTags("");
    setMessage("已保存到你的灵感书库。");
  };

  return (
    <div className="space-y-5">
      {/* Daily quote */}
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
                    <QuoteIcon className="mt-1 shrink-0" size={18} style={{ color: "var(--m-accent)" }} />
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

      {/* Add quote form */}
      <StaggerItem index={1}>
        <Panel className="p-6">
          <div className="border-b border-dashed pb-5" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
            <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>NEW QUOTE</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
              收录一句值得回看的话
            </h2>
          </div>
          <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              金句内容
              <Textarea
                className="min-h-28"
                onChange={(e) => setText(e.target.value)}
                placeholder="写下一句值得反复回看的话..."
                required
                value={text}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                作者
                <Input onChange={(e) => setAuthor(e.target.value)} placeholder="作者姓名" type="text" value={author} />
              </label>
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                书名 / 来源
                <Input onChange={(e) => setBook(e.target.value)} placeholder="书籍、影视或文章来源" type="text" value={book} />
              </label>
              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                阅读时长
                <Input min={0} onChange={(e) => setReadingHours(Number(e.target.value) || 0)} placeholder="0.5" step={0.5} type="number" value={readingHours} />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              标签
              <Input onChange={(e) => setTags(e.target.value)} placeholder="心态, 勇气, 平静" type="text" value={tags} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" type="submit" variant="primary">保存</Button>
              {message && <span className="text-sm" style={{ color: "var(--m-success)" }}>{message}</span>}
            </div>
          </form>
        </Panel>
      </StaggerItem>

      {/* Quote cards */}
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
                    className="mt-1 shrink-0 rounded-xl p-2"
                    style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", boxShadow: "var(--m-shadow-out)", color: "var(--m-accent)" }}
                  >
                    <QuoteIcon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="leading-7" style={{ color: "var(--m-ink)" }}>{quote.text}</p>
                    <p className="mt-3 text-sm" style={{ color: "var(--m-ink2)" }}>
                      {quote.author || "佚名"}{quote.book ? ` · ${quote.book}` : ""}
                    </p>
                    {quote.readingHours > 0 && (
                      <p className="mt-2 text-xs" style={{ color: "var(--m-ink3)" }}>
                        阅读 {quote.readingHours.toFixed(1)} h
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quote.tags.map((tag) => (
                        <span className="rounded-full px-3 py-1 text-xs" key={`${quote.id}-${tag}`}
                          style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}>
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
    </div>
  );
}

// ── Notes section ──────────────────────────────────────────────
function NotesSection() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const notes = useNotesStore();
  useEffect(() => { refreshNotes(); }, []);

  const sortedNotes = useMemo(() => [...notes].reverse(), [notes]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((cur) => cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note: Note = {
      id: crypto.randomUUID(),
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    saveNote(note);
    setTitle(""); setContent(""); setTags("");
    setMessage("笔记已保存，继续把想法慢慢写清楚。");
  };

  return (
    <div className="space-y-5">
      {/* Add note form */}
      <Panel className="p-6 md:p-7">
        <div className="border-b border-dashed pb-5" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
          <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>NEW ESSAY</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
            写下一段值得沉淀的思考
          </h2>
          <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
            不用急着把问题一次想清楚。先把判断、疑问和线索放下来，它们会在复盘里慢慢长出结构。
          </p>
        </div>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            标题
            <Input onChange={(e) => setTitle(e.target.value)} placeholder="这篇文章想回答什么问题？" required type="text" value={title} />
          </label>
          <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            内容
            <Textarea
              className="min-h-56"
              onChange={(e) => setContent(e.target.value)}
              placeholder="把你的长段思考、书评或者随笔写下来..."
              required
              value={content}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            标签
            <Input onChange={(e) => setTags(e.target.value)} placeholder="结构化, 反思, 阅读" type="text" value={tags} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" type="submit" variant="secondary">保存文章</Button>
            {message && <span className="text-sm" style={{ color: "var(--m-success)" }}>{message}</span>}
          </div>
        </form>
      </Panel>

      {/* Notes list */}
      {sortedNotes.length === 0 ? (
        <EmptyState
          description="你的长篇想法会在这里慢慢沉淀成一条个人专栏。写下第一篇后，阅读流就会开始形成。"
          icon={Sparkles}
          illustrationAlt="thinking notebook illustration"
          illustrationSrc="/illustrations/reading-time.svg"
          title="还没有深度文章"
        />
      ) : (
        <div className="space-y-4">
          {sortedNotes.map((note) => {
            const isExpanded = expandedIds.includes(note.id);
            return (
              <Panel className="p-6 md:p-7" interactive key={note.id}>
                <div className="border-b border-dashed pb-4" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
                  <h3 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.04em]" style={{ color: "var(--m-ink)" }}>
                    {note.title}
                  </h3>
                </div>
                <p
                  className="mt-5 text-[15px] leading-8"
                  style={isExpanded
                    ? { color: "var(--m-ink2)" }
                    : { color: "var(--m-ink2)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden" }}
                >
                  {formatPreview(note.content)}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {note.tags.map((tag) => (
                      <span className="rounded-full px-3 py-1 text-xs" key={`${note.id}-${tag}`}
                        style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <button
                    className="rounded-full px-4 py-2 text-sm transition-all"
                    onClick={() => toggleExpanded(note.id)}
                    style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
                    type="button"
                  >
                    {isExpanded ? "收起" : "展开阅读"}
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("quotes");

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="把值得反复回看的句子和长篇思考，收进同一座灵感书库里。"
        eyebrow="灵感书库"
        icon={Lightbulb}
        title="灵感书库"
      />

      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === "quotes" ? <QuotesSection /> : <NotesSection />}
    </PageTransition>
  );
}
