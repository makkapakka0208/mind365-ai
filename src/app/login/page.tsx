"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";

export default function LoginPage() {
  const { signIn, signUp, user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    const result = isSignUp
      ? await signUp(trimmedEmail, trimmedPassword)
      : await signIn(trimmedEmail, trimmedPassword);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else if (isSignUp) {
      setError(null);
      // For sign-up, show success message (email confirmation may be needed)
      setError("注册成功！如需邮箱验证，请查看收件箱。");
      setSubmitting(false);
    } else {
      // signIn success — onAuthStateChange will update user, then redirect
      router.replace("/");
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
                background: error.startsWith("注册成功")
                  ? "rgba(76,175,80,0.08)"
                  : "rgba(220,80,60,0.08)",
                color: error.startsWith("注册成功") ? "var(--m-success)" : "#c0392b",
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

        {/* Toggle sign in / sign up */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-sm transition-colors duration-200"
            style={{ color: "var(--m-accent)" }}
          >
            {isSignUp ? "已有账号？点此登录" : "没有账号？点此注册"}
          </button>
        </div>
      </Panel>
    </div>
  );
}
