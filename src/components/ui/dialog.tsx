"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--m-base-light)",
          border: "1px solid var(--m-rule)",
          boxShadow: "var(--m-shadow-out)",
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
            {title}
          </h3>
          <button
            className="rounded-full p-1.5 transition-colors hover:opacity-70"
            onClick={onClose}
            style={{ color: "var(--m-ink3)" }}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
