"use client";

import { Brain, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { saveNote } from "@/lib/storage";
import { useNotesStore } from "@/lib/storage-store";
import type { Note } from "@/types";

export default function NotesPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");

  const notes = useNotesStore();

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
    setMessage("笔记已保存，继续把想法写清楚。")
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="把长段思考沉淀成能反复使用的判断和洞察。"
        eyebrow="深度思考"
        icon={Brain}
        title="深度思考"
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <StaggerItem index={0}>
          <Panel className="p-6">
            <form className="grid gap-4" onSubmit={onSubmit}>
              <label className="grid gap-2 text-sm font-medium text-slate-200">
                标题
                <Input
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="这条笔记想回答什么问题？"
                  required
                  type="text"
                  value={title}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                内容
                <Textarea
                  className="min-h-48"
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="把你的长段思考写下来..."
                  required
                  value={content}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                标签
                <Input
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="策略, 反思, 系统"
                  type="text"
                  value={tags}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" type="submit" variant="secondary">
                  保存
                </Button>
                {message ? <span className="text-sm text-emerald-300">{message}</span> : null}
              </div>
            </form>
          </Panel>
        </StaggerItem>

        <StaggerItem index={1}>
          <Panel className="p-6" interactive>
            <h3 className="text-base font-semibold text-slate-100">思考提示</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              很多时候，写下问题的过程，就是理解问题的过程。把模糊的感受写成明确的判断。
            </p>
            <Illustration
              alt="thinking illustration"
              className="mt-5 max-w-[250px]"
              src="/illustrations/personal-notebook.svg"
            />
          </Panel>
        </StaggerItem>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          description="你的长段想法会逐渐沉淀在这里，成为之后可复用的卡片。"
          icon={Sparkles}
          illustrationAlt="thinking notebook illustration"
          illustrationSrc="/illustrations/personal-notebook.svg"
          title="还没有深度笔记"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {notes.map((note, index) => (
            <StaggerItem index={index} key={note.id}>
              <Panel className="p-5" interactive>
                <h3 className="text-lg font-semibold tracking-tight text-slate-100">{note.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-200">{note.content}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {note.tags.map((tag) => (
                    <span
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-300"
                      key={`${note.id}-${tag}`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </Panel>
            </StaggerItem>
          ))}
        </div>
      )}
    </PageTransition>
  );
}

