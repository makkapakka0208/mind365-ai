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
    setMessage("Note saved. Keep thinking deeply.");
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="Turn deep reflections into reusable wisdom cards."
        eyebrow="Deep Thinking"
        icon={Brain}
        title="Deep Thinking"
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <StaggerItem index={0}>
          <Panel className="p-6">
            <form className="grid gap-4" onSubmit={onSubmit}>
              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Title
                <Input
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What question does this note answer?"
                  required
                  type="text"
                  value={title}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Content
                <Textarea
                  className="min-h-48"
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Write your long-form thinking here..."
                  required
                  value={content}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Tags
                <Input
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="strategy, reflection, systems"
                  type="text"
                  value={tags}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" type="submit" variant="secondary">
                  Save Note
                </Button>
                {message ? <span className="text-sm text-emerald-300">{message}</span> : null}
              </div>
            </form>
          </Panel>
        </StaggerItem>

        <StaggerItem index={1}>
          <Panel className="p-6" interactive>
            <h3 className="text-base font-semibold text-slate-100">Thinking Prompt</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Clarity comes from writing. The act of naming your thought is often the act of understanding it.
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
          description="Your long-form ideas will appear here as reusable cards."
          icon={Sparkles}
          illustrationAlt="thinking notebook illustration"
          illustrationSrc="/illustrations/personal-notebook.svg"
          title="No deep-thinking notes yet"
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

