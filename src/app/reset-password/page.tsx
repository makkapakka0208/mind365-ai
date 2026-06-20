"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";

export default function ResetPasswordPage() {
  const { updatePassword, user, loading } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase redirects here with an access_token in the URL hash after
  // the user clicks the reset-password email link. The SDK picks it up
  // automatically via onAuthStateChange, so we only need to wait until
  // the session is hydrated (loading === false) before allowing the form.
  const sessionReady = !loading;

  // If the user somehow lands here while already logged in normally,
  // they can still change their password — no forced redirect needed.

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => router.replace("/"), 2500);
      return () => clearTimeout(t);
    }
  }, [done, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirm) {
      setError("请输入新密码和确认密码");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setDone(true);
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: "linear-gradient(160deg, var(--m-paper-hi), var(--m-paper-lo))",
        color: "var(--m-ink)",
        fontFamily: "'Noto Serif SC', serif",
      }}
    >
      <Panel className="w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "var(--m-accent)",
              color: "#fff",
              boxShadow: "var(--m-shadow-out)",
            }}
          >
            <BookOpen size={28} />
          </div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--m-ink)", fontFamily: "'Noto Serif SC', serif" }}
          >
            Mind365
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--m-ink2)" }}>
            设置新密码
          </p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle size={40} style={{ color: "var(--m-success)" }} />
            <p className="text-sm" style={{ color: "var(--m-ink2)" }}>
              密码已重置，正在跳转…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--m-ink2)" }}
                htmlFor="new-password"
              >
                新密码
              </label>
              <Input
                id="new-password"
                type="password"
                placeholder="至少 6 个字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={submitting || !sessionReady}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--m-ink2)" }}
                htmlFor="confirm-password"
              >
                确认新密码
              </label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="再次输入新密码"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={submitting || !sessionReady}
              />
            </div>

            {error ? (
              <div
                className="rounded-xl px-3 py-2 text-sm"
                style={{
                  background: "rgba(220,80,60,0.08)",
                  color: "#c0392b",
                }}
              >
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting || !sessionReady}
            >
              {submitting ? "处理中..." : "确认重置密码"}
            </Button>
          </form>
        )}

        {!done && (
          <div className="mt-4">
            <Button
              className="w-full"
              type="button"
              variant="secondary"
              onClick={() => router.replace("/login")}
            >
              返回登录
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
