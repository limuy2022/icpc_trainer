"use client";
import LanguageSwitch from "@/components/language-switch";
import {t as ui,useLocale} from "@/lib/locale";
import { useEffect, useState } from "react";
import ThemeSwitch from "./theme-switch";
import { ArrowRight, Code2, LoaderCircle, LogOut } from "lucide-react";
export type Account = {
  id: string;
  username: string;
  role: "admin" | "member";
  must_change_password: number;
  cf_rating: number | null;
};
export async function api(
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw Error(data.error || "请求失败");
  return data;
}
export function PasswordForm({
  done,
  required = false,
}: {
  done: () => void;
  required?: boolean;
}) {
  useLocale();
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="account-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (next !== confirm) {
          setError("两次新密码不一致");
          return;
        }
        setBusy(true);
        try {
          await api(
            "/api/account",
            { currentPassword: current, newPassword: next },
            "PATCH",
          );
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{required ? ui("首次登录，请设置自己的密码") : ui("修改密码")}</h2>
      <p>{ui("账号由管理员创建。修改密码后，其他设备上的登录会失效。")}</p>
      <label>
        {ui("当前密码")}<input
          autoComplete="current-password"
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>
      <label>
        {ui("新密码")}<input
          autoComplete="new-password"
          type="password"
          maxLength={200}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>
      <label>
        {ui("再次输入新密码")}<input
          autoComplete="new-password"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {error && (
        <div className="form-error" role="alert">
          {ui(error)}
        </div>
      )}
      <button className="primary" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={16} /> : ui("保存新密码")}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
export default function AccountGate({
  children,
}: {
  children: (user: Account, logout: () => Promise<void>) => React.ReactNode;
}) {
  useLocale();
  const [user, setUser] = useState<Account | null>(null),
    [ready, setReady] = useState(false),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const data = await api("/api/auth");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function logout() {
    await api("/api/auth", undefined, "DELETE");
    setUser(null);
    setPassword("");
  }
  if (!ready)
    return (
      <div className="auth-shell">
        <LoaderCircle className="spin" />
      </div>
    );
  if (user && !user.must_change_password) return <>{children(user, logout)}</>;
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="appearance-controls"><LanguageSwitch /><ThemeSwitch /></div>
        <div className="auth-brand">
          <span className="brand-icon">
            <Code2 size={25} />
          </span>
          <span>
            {ui("思维练习场")}<small>PRIVATE ICPC WORKSPACE</small>
          </span>
        </div>
        {user ? (
          <>
            <PasswordForm required done={() => void refresh()} />
            <button className="text-button" onClick={logout}>
              <LogOut size={14} />
              {ui("退出登录")}</button>
          </>
        ) : (
          <form
            className="account-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              try {
                const data = await api("/api/auth", { username, password });
                setUser(data.user);
                setPassword("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="eyebrow">{ui("一个小范围的训练空间")}</div>
            <h1>{ui("从一次思考开始。")}</h1>
            <p>{ui("仅限管理员开通的账号登录，不开放注册。")}</p>
            <label>
              {ui("账号")}<input
                autoComplete="username"
                autoCapitalize="none"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              {ui("密码")}<input
                autoComplete="current-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {ui(error)}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                ui("登录训练空间")
              )}
              <ArrowRight size={16} />
            </button>
            <small>{ui("需要账号？请联系管理员。")}</small>
          </form>
        )}
      </div>
    </main>
  );
}
