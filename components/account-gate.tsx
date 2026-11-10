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
  site_model_access: number;
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
      <p>{ui("修改密码后，其他设备上的登录会失效。")}</p>
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
  const [registering,setRegistering]=useState(false),[confirmation,setConfirmation]=useState("");
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
    if(user)sessionStorage.removeItem("icpc-browser-models:"+user.id);
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
            {ui("思维练习场")}<small>ICPC THINKING WORKSPACE</small>
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
                if(registering&&password!==confirmation)throw Error("两次新密码不一致");
                const data = await api(registering?"/api/register":"/api/auth", { username, password });
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
            <p>{ui(registering?"注册后请配置自己的 API Key；网站密钥需管理员授权。":"登录继续训练，或注册一个新账号。")}</p>
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
                autoComplete={registering?"new-password":"current-password"}
                maxLength={200}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {registering&&<label>{ui("再次输入新密码")}<input type="password" autoComplete="new-password" required maxLength={200} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>}
            {error && (
              <div className="form-error" role="alert">
                {ui(error)}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                ui(registering?"注册并开始训练":"登录训练空间")
              )}
              <ArrowRight size={16} />
            </button>
            <button type="button" className="text-button" disabled={busy} onClick={()=>{setRegistering(!registering);setError("");setPassword("");setConfirmation("");}}>{ui(registering?"已有账号？返回登录":"没有账号？注册")}</button>
          </form>
        )}
      </div>
    </main>
  );
}
