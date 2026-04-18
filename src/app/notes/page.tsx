"use client";

import { Brain, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { refreshNotes, saveNote } from "@/lib/storage";
import { useNotesStore } from "@/lib/storage-store";
import type { Note } from "@/types";

function formatPreview(content: string) {
  return content.trim().replace(/\s+/g, " ");
}

export default function NotesPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const notes = useNotesStore();

  useEffect(() => {
    refreshNotes();
  }, []);

  const sortedNotes = useMemo(() => [...notes].reverse(), [notes]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const note: Note = {
      id: crypto.randomUUID(),
      title: title.trim(),
      content: content.trim(),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    saveNote(note);
    setTitle("");
    setContent("");
    setTags("");
    setMessage("笔记已保存，继续把想法慢慢写清楚。");
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="把长篇的感受、书评和随笔收进一条安静的阅读流里。这里不追求热闹，只留下值得反复翻看的判断、线索和洞见。"
        eyebrow="深度思考"
        icon={Brain}
        title="深度思考"
      />

      <div className="mx-auto w-[90%] max-w-[1120px] space-y-6">
        <Panel className="p-6 md:p-7">
          <div className="border-b border-dashed pb-5" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
            <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
              NEW ESSAY
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
              写下一段值得沉淀的思考
            </h2>
            <p className="mt-3 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
              不用急着把问题一次想清楚。先把你的判断、疑问和线索放下来，它们会在之后的复盘里慢慢长出结构。
            </p>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              标题
              <Input
                onChange={(event) => setTitle(event.target.value)}
                placeholder="这篇文章想回答什么问题？"
                required
                type="text"
                value={title}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              内容
              <Textarea
                className="min-h-56"
                onChange={(event) => setContent(event.target.value)}
                placeholder="把你的长段思考、书评或者随笔写下来..."
                required
                value={content}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              标签
              <Input
                onChange={(event) => setTags(event.target.value)}
                placeholder="结构化, 反思, 阅读"
                type="text"
                value={tags}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" type="submit" variant="secondary">
                保存文章
              </Button>
              {message ? (
                <span className="text-sm" style={{ color: "var(--m-success)" }}>
                  {message}
                </span>
              ) : null}
            </div>
          </form>
        </Panel>

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
              const preview = formatPreview(note.content);

              return (
                <Panel className="p-6 md:p-7" interactive key={note.id}>
                  <div className="border-b border-dashed pb-4" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
                    <h3 className="text-[1.7rem] font-semibold leading-tight tracking-[-0.04em]" style={{ color: "var(--m-ink)" }}>
                      {note.title}
                    </h3>
                  </div>

                  <p
                    className="mt-5 text-[15px] leading-8"
                    style={
                      isExpanded
                        ? { color: "var(--m-ink2)" }
                        : {
                            color: "var(--m-ink2)",
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 4,
                            overflow: "hidden",
                          }
                    }
                  >
                    {preview}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {note.tags.map((tag) => (
                        <span
                          className="rounded-full px-3 py-1 text-xs"
                          key={`${note.id}-${tag}`}
                          style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}
                        >
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
    </PageTransition>
  );
}
