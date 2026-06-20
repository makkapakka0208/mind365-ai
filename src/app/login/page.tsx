"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";

type Mode = "login" | "register" | "forgot";

export default function LoginPage() {
  const { signIn, signUp, resetPassword, user, loading, authConfigured } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    router.replace("/");
    return null;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const trimmedEmail = email.trim();

    if (mode === "forgot") {
      if (!trimmedEmail) {
        setError("请输入注册时使用的邮箱");
        setSubmitting(false);
        return;
      }
      const result = await resetPassword(trimmedEmail);
      if (result.error) {
        setError(result.error);
      } else {
        setError("✓ 重置链接已发送，请查收邮件。");
      }
      setSubmitting(false);
      return;
    }

    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("请输入邮箱和密码");
      setSubmitting(false);
      return;
    }

    if (trimmedPassword.length < 6) {
      setError("密码至少需要 6 个字符");
      setSubmitting(false);
      return;
    }

    const result =
      mode === "register"
        ? await signUp(trimmedEmail, trimmedPassword)
        : await signIn(trimmedEmail, trimmedPassword);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    if (mode === "register") {
      setError("注册成功。如果开启了邮件验证，请先完成验证后再登录。");
      setSubmitting(false);
      return;
    }

    router.replace("/");
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          background: "linear-gradient(160deg, var(--m-paper-hi), var(--m-paper-lo))",
          color: "var(--m-ink)",
        }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-4"
          style={{
            borderColor: "var(--m-rule)",
            borderTopColor: "var(--m-accent)",
          }}
        />
      </div>
    );
  }

  const isForgot = mode === "forgot";
  const isSuccessMsg = error?.startsWith("✓") || error?.startsWith("注册成功");

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
            慢一点，写下来，继续成长。
          </p>
          <p className="mt-3 text-xs leading-6" style={{ color: "var(--m-ink3)" }}>
            登录用于开启 Supabase 同步；不登录也可以先在本地缓存里继续使用。
          </p>
        </div>

        {/* 登录 / 注册 Tab（忘记密码时隐藏） */}
        {!isForgot && (
          <div className="mb-6 flex rounded-xl p-1" style={{ background: "rgba(0,0,0,0.05)" }}>
            {(["login", "register"] as const).map((m) => {
              const active = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  className="flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200"
                  style={{
                    background: active ? "var(--m-base-light)" : "transparent",
                    color: active ? "var(--m-ink)" : "var(--m-ink2)",
                    boxShadow: active ? "var(--m-shadow-out)" : "none",
                  }}
                  onClick={() => switchMode(m)}
                >
                  {m === "login" ? "登录" : "注册"}
                </button>
              );
            })}
          </div>
        )}

        {/* 忘记密码标题 */}
        {isForgot && (
          <div className="mb-6">
            <h2 className="text-base font-medium" style={{ color: "var(--m-ink)" }}>
              重置密码
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--m-ink3)" }}>
              输入注册邮箱，我们会向你发送一封密码重置邮件。
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--m-ink2)" }}
              htmlFor="login-email"
            >
              邮箱
            </label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={submitting}
            />
          </div>

          {!isForgot && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--m-ink2)" }}
                  htmlFor="login-password"
                >
                  密码
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: "var(--m-accent)" }}
                    onClick={() => switchMode("forgot")}
                  >
                    忘记密码？
                  </button>
                )}
              </div>
              <Input
                id="login-password"
                type="password"
                placeholder="至少 6 个字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                disabled={submitting}
              />
            </div>
          )}

          {error ? (
            <div
              className="rounded-xl px-3 py-2 text-sm"
              style={{
                background: isSuccessMsg
                  ? "rgba(76,175,80,0.08)"
                  : "rgba(220,80,60,0.08)",
                color: isSuccessMsg ? "var(--m-success)" : "#c0392b",
              }}
            >
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting
              ? "处理中..."
              : isForgot
              ? "发送重置邮件"
              : mode === "register"
              ? "注册"
              : "登录"}
          </Button>
        </form>

        {isForgot ? (
          <div className="mt-4">
            <Button
              className="w-full"
              type="button"
              variant="secondary"
              onClick={() => switchMode("login")}
            >
              返回登录
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <Button
              className="w-full"
              onClick={() => router.replace("/")}
              type="button"
              variant="secondary"
            >
              先进入本地模式
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
