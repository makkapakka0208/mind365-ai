"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Mail } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";

export default function LoginPage() {
  const { signIn, signUp, user, loading, configError } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  // If already authenticated, redirect
  if (!loading && user) {
    router.replace("/");
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const trimmedEmail = email.trim();
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

    if (isSignUp) {
      const result = await signUp(trimmedEmail, trimmedPassword);
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
      } else if (result.needsEmailConfirmation) {
        // Email confirmation required — show dedicated screen
        setConfirmationSent(true);
        setSubmitting(false);
      } else {
        // Email confirmation disabled in Supabase — user is logged in immediately
        router.replace("/");
      }
    } else {
      const result = await signIn(trimmedEmail, trimmedPassword);
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
      } else {
        router.replace("/");
      }
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          background: "linear-gradient(160deg, #FDFAF3 0%, #F8F1E4 50%, #F3EAD8 100%)",
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

  if (configError) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{
          background: "linear-gradient(160deg, #FDFAF3 0%, #F8F1E4 50%, #F3EAD8 100%)",
          color: "var(--m-ink)",
          fontFamily: "'Noto Serif SC', serif",
        }}
      >
        <Panel className="w-full max-w-sm p-8 text-center">
          <p className="text-sm font-medium" style={{ color: "#c0392b" }}>
            服务配置错误
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--m-ink2)" }}>
            NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY 未正确配置，请检查 Vercel 环境变量后重新部署。
          </p>
        </Panel>
      </div>
    );
  }

  // Email confirmation pending screen
  if (confirmationSent) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{
          background: "linear-gradient(160deg, #FDFAF3 0%, #F8F1E4 50%, #F3EAD8 100%)",
          color: "var(--m-ink)",
          fontFamily: "'Noto Serif SC', serif",
        }}
      >
        <Panel className="w-full max-w-sm p-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "var(--m-accent)",
              color: "#fff",
              boxShadow: "var(--m-shadow-out)",
            }}
          >
            <Mail size={28} />
          </div>
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--m-ink)", fontFamily: "'Noto Serif SC', serif" }}
          >
            请验证您的邮箱
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--m-ink2)" }}>
            我们已向 <strong style={{ color: "var(--m-ink)" }}>{email}</strong> 发送了一封验证邮件。
            <br />
            请点击邮件中的链接完成注册，然后回到此页面登录。
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--m-ink2)" }}>
            没收到邮件？请检查垃圾邮件文件夹。
          </p>
          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={() => {
              setConfirmationSent(false);
              setIsSignUp(false);
              setPassword("");
            }}
          >
            去登录
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: "linear-gradient(160deg, #FDFAF3 0%, #F8F1E4 50%, #F3EAD8 100%)",
        color: "var(--m-ink)",
        fontFamily: "'Noto Serif SC', serif",
      }}
    >
      <Panel className="w-full max-w-sm p-8">
        {/* Brand header */}
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
        </div>

        {/* Tab switcher */}
        <div
          className="mb-6 flex rounded-xl p-1"
          style={{ background: "var(--m-surface-sunken, rgba(0,0,0,0.05))" }}
        >
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(null); }}
            className="flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200"
            style={{
              background: !isSignUp ? "var(--m-surface)" : "transparent",
              color: !isSignUp ? "var(--m-ink)" : "var(--m-ink2)",
              boxShadow: !isSignUp ? "var(--m-shadow-out)" : "none",
            }}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(null); }}
            className="flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200"
            style={{
              background: isSignUp ? "var(--m-surface)" : "transparent",
              color: isSignUp ? "var(--m-ink)" : "var(--m-ink2)",
              boxShadow: isSignUp ? "var(--m-shadow-out)" : "none",
            }}
          >
            注册
          </button>
        </div>

        {/* Form */}
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

          <div>
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--m-ink2)" }}
              htmlFor="login-password"
            >
              密码
            </label>
            <Input
              id="login-password"
              type="password"
              placeholder="至少 6 个字符"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              disabled={submitting}
            />
          </div>

          {error && (
            <div
              className="rounded-xl px-3 py-2 text-sm"
              style={{
                background: "rgba(220,80,60,0.08)",
                color: "#c0392b",
              }}
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "处理中…" : isSignUp ? "注册" : "登录"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
