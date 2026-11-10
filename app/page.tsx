"use client";
import LanguageSwitch from "@/components/language-switch";
import {t as ui,useLocale,currentLocale} from "@/lib/locale";
import { reasoningLabels, type ReasoningLevel } from "@/lib/reasoning";
import RatingForm from "@/components/rating-form";
import { ratingRange, difficultyOptions } from "@/lib/rating-range";
import StatisticsPanel from "@/components/statistics-panel";
import { reviseConversation, matchesConversation } from "@/lib/conversation";
import { readChatResponse } from "@/lib/chat-response";
import { trainingStats } from "@/lib/training-stats";
import { splitStatement } from "@/lib/statement-header";
import {translationSource} from "@/lib/translation-source";
import { useEffect, useMemo, useRef, useState } from "react";
import ReasoningDetails from "@/components/reasoning-details";
import RecoveredVersions from "@/components/recovered-versions";
import Text from "@/components/markdown-text";
import DifficultyBadge, { DifficultyGuide } from "@/components/difficulty-badge";
import ThemeSwitch from "@/components/theme-switch";
import AccountGate, {
  PasswordForm,
  type Account,
} from "@/components/account-gate";
import AdminPanel from "@/components/admin-panel";
import { useTrainingSync } from "@/hooks/use-training-sync";
import { useWorkspaceRoute } from "@/hooks/use-workspace-route";
import ProblemStatement from "@/components/problem-statement";
import {
  Pencil,
  Undo2,
  BarChart3,
  Menu,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  History,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  Shuffle,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
  NotebookPen,
  CircleHelp,
  CheckCircle2,
  ShieldCheck,
  LogOut,
  Upload,
} from "lucide-react";
import type { Problem, Session, Message } from "@/lib/types";
import { tagLabels, problemUrl } from "@/lib/types";
type Bank = {
  items: Problem[];
  total: number;
  bankTotal: number;
  source: string;
  updatedAt: string;
};
const outcomes = {
  training: "训练中",
  independent: "独立解出",
  assisted: "提示后解出",
  review: "待重练",
};
const fmt = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const renderMarkdown=(text:string)=><Text text={text}/>;
const renderPlain=(text:string)=>text;
export default function Home() {
  useLocale();
  return (
    <>
      <AccountGate>
        {(user, logout) => (
          <Workspace key={user.id} user={user} logout={logout} />
        )}
      </AccountGate>
    </>
  );
}
function Workspace({
  user,
  logout,
}: {
  user: Account;
  logout: () => Promise<void>;
}) {
  useLocale();
  const {view,current,open:openRoute}=useWorkspaceRoute(user.id,user.role==="admin");
  const { sessions, setSessions, loaded, syncState, save } = useTrainingSync(
    user.id,
  );
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    if (!mobileMenu) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileMenu(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mobileMenu]);
  const [efforts, setEfforts] = useState<Record<string,ReasoningLevel>>({});
  const [modelSettingsBusy,setModelSettingsBusy]=useState(false),[modelSettingsError,setModelSettingsError]=useState("");
  const [models, setModels] = useState<any[]>([]),
    [modelId, setModelId] = useState(""),
    [passwordModal, setPasswordModal] = useState(false);
  const selectedModel=models.find(m=>m.id===modelId);
  const supportedEfforts=selectedModel?.reasoningOptions || [{value:"default",label:ui("模型默认")}];
  const reasoningEffort:ReasoningLevel=supportedEfforts.some((option:any)=>option.value===efforts[modelId])?efforts[modelId]:"default";
  const importInput = useRef<HTMLInputElement>(null);
  const [bank, setBank] = useState<Bank | null>(null),
    [loading, setLoading] = useState(true),
    [bankError, setBankError] = useState("");
  const [cfRating, setCfRating] = useState<number|null>(user.cf_rating ?? null);
  const [ratingModal, setRatingModal] = useState(false);
  const preset = ratingRange(cfRating);
  const [min, setMin] = useState(() => ratingRange(user.cf_rating).min),
    [max, setMax] = useState(() => ratingRange(user.cf_rating).max),
    [tags, setTags] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("popular"),
    [page, setPage] = useState(1),
    [hideTags, setHideTags] = useState(true),
    [exclude, setExclude] = useState(true);
  const [settings, setSettings] = useState(false),
    [aiConfigured, setAiConfigured] = useState(false),
    [model, setModel] = useState("");
  const [retryMode, setRetryMode] = useState("discuss");
  const sending=useRef(false);
  const sendStartedAt=useRef(0);
  const [partialReply,setPartialReply]=useState<{sessionId:string;text:string;reasoning?:string}|null>(null);
  const chatAbort=useRef<AbortController|null>(null);
  useEffect(()=>()=>chatAbort.current?.abort(),[]);
  const [chatRequestId,setChatRequestId]=useState("");
  const [allowUnverified, setAllowUnverified] = useState(false);
  const [messageEdit, setMessageEdit] = useState<{ sessionId: string; index: number; original: string; content: string } | null>(null);
  const [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [chatError, setChatError] = useState(""),
    [statementBusy, setStatementBusy] = useState(false),
    [statementError, setStatementError] = useState(""),
    [editor, setEditor] = useState(false),
    [now, setNow] = useState(Date.now()),
    [toast, setToast] = useState(""),
    [finish, setFinish] = useState(false),
    [takeaway, setTakeaway] = useState("");
  const [statementLanguage, setStatementLanguage] = useState<
    "original" | "zh" | "compare"
  >("original");
  const [statementFont, setStatementFont] = useState(17);
  const [translations, setTranslations] = useState<
    Record<
      string,
      { text: string; original: string; model: string }
    >
  >({});
  const [translating, setTranslating] = useState<string | null>(null),
    [translationErrors, setTranslationErrors] = useState<
      Record<string, string>
    >({});
  const translationRequests=useRef(new Set<string>());
  const chatEnd = useRef<HTMLDivElement>(null),
    requestId = useRef(0),
    sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const session = sessions.find((s) => s.id === current);
  const statementParts=useMemo(()=>splitStatement(session?.statement||"",session?.statementMetadata),[session?.statement,session?.statementMetadata]);
  const sourceText=useMemo(()=>translationSource(session?.statement||""),[session?.statement]);
  const translation =
    session && translations[session.id]?.original === sourceText
      ? translations[session.id]
      : undefined;
  const completed = useMemo(()=>sessions.filter((s) => s.outcome === "independent" || s.outcome === "assisted"),[sessions]);
  const summary = useMemo(()=>trainingStats(sessions),[sessions]);
  const elapsed = session
    ? session.elapsed +
      (session.startedAt
        ? Math.max(0, Math.floor((now - session.startedAt) / 1000))
        : 0)
    : 0;
  const totalMinutes = Math.floor(
    sessions.reduce(
      (v, s) =>
        v +
        s.elapsed +
        (s.startedAt ? Math.max(0, Math.floor((now - s.startedAt) / 1000)) : 0),
      0,
    ) / 60,
  );
  async function refreshModels() {
    try {
      const r = await fetch("/api/config");
      const c = (await r.json()) as any;
      if (!r.ok) return;
      setAiConfigured(Boolean(c.configured));
      setModels(c.models || []);
      setEfforts(c.preferences?.efforts || {});
      setModel(c.model || "");
      setModelId((prev) =>
        c.models.some((m: any) => m.id === prev) ? prev : c.models.some((m:any)=>m.id===c.preferences?.selectedModelId)?c.preferences.selectedModelId:c.models[0]?.id || "",
      );
    } catch {}
  }
  useEffect(() => {
    void refreshModels();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const exclusions = exclude
    ? completed.map((s) => s.problem.id).join(",")
    : "";
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setBankError("");
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        min: String(min),
        max: String(max),
        tags: tags.join(";"),
        q: query,
        sort,
        page: String(page),
        exclude: exclusions,
      });
      fetch("/api/problems?" + params, { signal: controller.signal })
        .then(async (r) => {
          const d = (await r.json()) as Bank & {
            error?: string;
            text?: string;
          };
          if (!r.ok) throw Error(d.error || "请求失败");
          setBank(d);
        })
        .catch((e) => {
          if (e.name !== "AbortError")
            setBankError(e.message || ui("题库加载失败，请重试"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [min, max, tags, query, sort, page, exclusions]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session?.messages.length, busy]);
  useEffect(()=>{
    const container=chatEnd.current?.parentElement;
    if(partialReply?.sessionId===session?.id && container && container.scrollHeight-container.scrollTop-container.clientHeight<180)
      chatEnd.current?.scrollIntoView({block:"nearest"});
  },[partialReply,session?.id]);
  function patch(id: string, change: Partial<Session>) {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...change } : s)),
    );
  }
  function pauseAll() {
    setSessions((prev) =>
      prev.map((s) =>
        s.startedAt
          ? {
              ...s,
              elapsed:
                s.elapsed +
                Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000)),
              startedAt: null,
            }
          : s,
      ),
    );
  }
  function navigate(next: typeof view) {
    if (next !== "training") pauseAll();
    openRoute(next);
  }
  useEffect(()=>{
    requestId.current++;
    setMobileMenu(false);
    setMessageEdit(null);
    setStatementError("");
    if(view!=="training"){pauseAll();return;}
    if(!loaded || !current)return;
    const restored=sessionsRef.current.find(s=>s.id===current);
    if(!restored){openRoute("training",null,true);setToast("这条训练记录不存在或不属于当前账号，请重新选择。");return;}
    const timestamp=Date.now();
    setSessions(previous=>previous.map(s=>s.id===current
      ? s.outcome==="training"&&!s.startedAt?{...s,startedAt:timestamp}:s
      : s.startedAt?{...s,elapsed:s.elapsed+Math.max(0,Math.floor((timestamp-s.startedAt)/1000)),startedAt:null}:s));
    if(!restored.statement)void loadStatement(restored.problem,restored.id);
  },[view,current,loaded]);
  async function loadStatement(p: Problem, id: string) {
    const token = ++requestId.current;
    setStatementBusy(true);
    setStatementError("");
    try {
      const r = await fetch(
        `/api/statement?contest=${p.contestId}&index=${p.index}`,
      );
      const d = (await r.json()) as {
        error?: string;
        text: string;
        metadata?: Session["statementMetadata"];
        format?: "markdown";
        source?: Session["statementSource"];
        fetchedAt?: string;
      };
      if (!r.ok) throw Error(d.error || "请求失败");
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id && !s.statement
            ? {
                ...s,
                statement: d.text || "",
                statementMetadata: d.metadata,
                statementFormat: d.format,
                statementSource: d.source,
                statementFetchedAt: d.fetchedAt,
              }
            : s,
        ),
      );
    } catch (e) {
      if (token === requestId.current) setStatementError((e as Error).message);
    } finally {
      if (token === requestId.current) setStatementBusy(false);
    }
  }
  function start(p: Problem) {
    if (!loaded) {
      setToast("训练记录尚未加载，请稍后重试");
      return;
    }
    pauseAll();
    const previous = sessions.find(
      (s) => s.problem.id === p.id && s.outcome === "training",
    );
    let id = previous?.id;
    if (previous) {
      patch(previous.id, { startedAt: Date.now() });
    } else {
      id = crypto.randomUUID();
      const next: Session = {
        id,
        problem: p,
        messages: [],
        statement: "",
        notes: "",
        hints: 0,
        elapsed: 0,
        startedAt: Date.now(),
        createdAt: new Date().toISOString(),
        outcome: "training",
        takeaway: "",
      };
      setSessions((prev) => [next, ...prev]);
    }
    setMessageEdit(null);
    openRoute("training",id!);
    setDraft("");
    setChatError("");
    setStatementError("");
    setEditor(false);
  }
  function resume(s: Session) {
    pauseAll();
    setMessageEdit(null);
    openRoute("training",s.id);
    setDraft("");
    setChatError("");
    setStatementError("");
    setEditor(false);
    patch(s.id, { startedAt: s.outcome === "training" ? Date.now() : null });
  }
  async function random() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        min: String(min),
        max: String(max),
        tags: tags.join(";"),
        q: query,
        exclude: exclusions,
        random: "1",
      });
      const r = await fetch("/api/problems?" + params);
      const d = (await r.json()) as Bank & { error?: string };
      if (!r.ok) throw Error(d.error || "请求失败");
      if (d.items.length) start(d.items[0]);
      else setToast("当前条件没有匹配的题目，试试放宽难度或标签。");
    } catch {
      setToast("随机选题失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }
  async function translateStatement(forceRefresh=false) {
    if (!session) return;
    const id = session.id,
      original = translationSource(session.statement);
    if (
      !forceRefresh && translations[id]?.original === original
    )
      return;
    const requestKey=session.problem.id+"\0"+original;
    if (translationRequests.current.has(requestKey)) return;
    if (!aiConfigured) {
      setSettings(true);
      return;
    }
    translationRequests.current.add(requestKey);
    setTranslating(id);
    setTranslationErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: splitStatement(original).text,
          problemId: session.problem.id,
          modelId,
          reasoningEffort,
          forceRefresh,
        }),
      });
      const data = (await response.json()) as {
        text: string;
        model: string;
        error?: string;
      };
      if (!response.ok) throw Error(data.error || "翻译失败，请重试");
      setTranslations((prev) => ({
        ...prev,
        [id]: { text: data.text, original, model: data.model },
      }));
    } catch (e) {
      setTranslationErrors((prev) => ({ ...prev, [id]: (e as Error).message }));
    } finally {
      translationRequests.current.delete(requestKey);
      setTranslating((prev) => (prev === id ? null : prev));
    }
  }
  function recallMessage(index: number) {
    if (!session || busy) return;
    const message = session.messages[index];
    if (message?.role !== "user") return;
    const following = session.messages.length - index - 1;
    if (!window.confirm(ui("撤回这条消息{0}？原内容会放回输入框，旧对话保留在历史版本中。",[following ? `，并移除后续 ${following} 条消息` : ""]))) return;
    if (draft.trim() && draft !== message.content && !window.confirm(ui("输入框中有未发送内容，是否用撤回的消息替换？"))) return;
    const revised = reviseConversation(session,index);
    patch(session.id, {messages:revised.messages,messagesVersion:revised.messagesVersion,recoveredVersions:revised.recoveredVersions});
    setDraft(message.content);setMessageEdit(null);setChatError("");
    setToast("消息已撤回，原内容已放回输入框");
  }
  async function send(mode = "discuss", edit?: { index: number; original: string; content: string }, retry = false) {
    if (!session || busy || sending.current || !loaded) return;
    if (!aiConfigured) {
      setSettings(true);
      return;
    }
    if (session.statement.trim().length < 60) {
      setEditor(true);
      setChatError("请先补充题面、约束和样例，再开始陪练。");
      return;
    }
    if (
      mode === "solution" &&
      !window.confirm(
        ui("确定现在查看完整解法吗？这道题将计入「看过解法」，你仍可以继续讨论。"),
      )
    )
      return;
    const prompts: Record<string, string> = {
      visualize: ui("请用一个可交互、能逐步演示的小图解释我们当前讨论的观察或我的卡点，先不要揭晓后续解法。"),
      hint1: ui("我卡住了，请给一条观察方向，先不要揭晓关键解法。"),
      hint2: ui("请给第二层提示，帮我找到一个关键性质。"),
      hint3: ui("请给第三层提示，帮我建立主要模型，留下一步让我推。"),
      counterexample: ui("请检验我刚才的猜想。若不成立，给一个小反例。"),
      review:
        ui("请根据我们实际讨论的过程做一次复盘，指出我的卡点和可以迁移的思考方法。"),
      solution: ui("我选择查看完整解法，请解释推导和证明。"),
    };
    if (edit && session.messages[edit.index]?.content !== edit.original) {
      setChatError("这条消息已在另一页面修改，请取消编辑后重新打开。");return;
    }
    const content = edit ? edit.content.trim() : retry ? (session.messages.at(-1)?.role === "user" ? session.messages.at(-1)!.content : "") : draft.trim() || prompts[mode];
    if (!content) return;
    const id = session.id;
    const last = session.messages[session.messages.length - 1];
    if (edit && session.messages.length > edit.index + 1 && !window.confirm(ui("修改后会移除这条消息之后的回复和讨论，并重新生成回答。旧对话将保留在历史版本中，是否继续？"))) return;
    const revised = edit ? reviseConversation(session,edit.index,content) : undefined;
    const messagesVersion = revised?.messagesVersion || session.messagesVersion;
    const messages: Message[] = revised
      ? revised.messages
      : last?.role === "user" && last.content === content
        ? session.messages
        : [...session.messages, { role: "user", content }];
    sending.current=true;
    sendStartedAt.current=Date.now();
    setBusy(true);
    setPartialReply(null);
    setChatRequestId("");
    setChatError("");
    if (!edit && (!retry || draft.trim() === content)) setDraft("");
    setMessageEdit(null);
    patch(id, {
      messages,
      ...(revised ? {messagesVersion, recoveredVersions: revised.recoveredVersions} : {}),
      ...(mode.startsWith("hint")
        ? { hints: Math.max(session.hints, Number(mode.slice(-1))) }
        : {}),
      ...(mode === "solution" ? { hints: 4 } : {}),
    });
    const controller=new AbortController();chatAbort.current=controller;
    try {
      const res = await fetch("/api/coach", {
        signal:controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: splitStatement(session.statement).text,
          problem: `${session.problem.id} ${session.problem.name}`,
          problemId: session.problem.id,
          allowUnverified,
          language: currentLocale(),
          stream: true,
          notes: session.notes,
          modelId,
          reasoningEffort,
          mode,
          messages,
        }),
      });
      const data = await readChatResponse(res,{
        delta:text=>setPartialReply(previous=>({sessionId:id,text:(previous?.sessionId===id?previous.text:"")+text,reasoning:previous?.sessionId===id?previous.reasoning:undefined})),
        reasoning:text=>setPartialReply(previous=>({sessionId:id,text:previous?.sessionId===id?previous.text:"",reasoning:(previous?.sessionId===id?previous.reasoning||"":"")+text})),
        status:data=>{if(data.editorial)patch(id,{editorialReference:data.editorial});if(data.requestId)setChatRequestId(data.requestId);},
      });
      const latest = sessionsRef.current.find(s => s.id === id);
      if (!latest || !matchesConversation(latest,messages,messagesVersion)) {
        throw Error("对话已在另一页面变化，本次回复未写入旧分支。请在当前对话重试。");
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id && matchesConversation(s,messages,messagesVersion)
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  { role: "assistant", content: data.text, ...(data.reasoning?{reasoning:data.reasoning}:{}) },
                ],
              }
            : s,
        ),
      );
      setPartialReply(null);
    } catch (e) {
      setChatError(controller.signal.aborted?"已停止生成，未完成内容未写入历史。":(e as Error).message);
      setRetryMode(mode);
      if (!edit && !retry) setDraft(content);
    } finally {
      chatAbort.current=null;
      sending.current=false;
      setBusy(false);
    }
  }
  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          sessions.map((s) => ({
            ...s,
            startedAt: null,
            elapsed:
              s.elapsed +
              (s.startedAt
                ? Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000))
                : 0),
          })),
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "icpc-training-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function complete(outcome: Session["outcome"]) {
    if (!session) return;
    patch(session.id, {
      outcome:
        outcome === "independent" && session.hints > 0 ? "assisted" : outcome,
      takeaway,
      elapsed,
      completedAt: outcome === "review" ? undefined : new Date().toISOString(),
      startedAt: null,
    });
    setFinish(false);
    setToast("训练已记录。完成状态由你手动标记，未同步 CF 判题。");
    openRoute("history");
  }
  const doneIds = new Set(completed.map((s) => s.problem.id));
  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-menu-backdrop" aria-label={ui("关闭导航")} onClick={() => setMobileMenu(false)} />}
      <aside id="workspace-navigation" className={"sidebar" + (mobileMenu ? " mobile-open" : "")} onClick={(event) => { if ((event.target as HTMLElement).closest("button, a")) setMobileMenu(false); }}>
        <button className="mobile-menu-close" aria-label={ui("收起导航")} onClick={() => setMobileMenu(false)}><X size={22} /></button>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("bank");
          }}
        >
          <span className="brand-icon">
            <Code2 size={25} />
          </span>
          <span>
            {ui("思维练习场")}<small>ICPC THINKING LAB</small>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            { id: "bank", icon: BookOpen, label: ui("发现题目") },
            { id: "training", icon: MessageCircle, label: ui("思维陪练") },
            { id: "history", icon: History, label: ui("训练记录") },
            { id: "statistics", icon: BarChart3, label: ui("训练统计") },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={view === id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(id as typeof view)}
            >
              <Icon size={19} />
              {ui(label)}
              {id === "training" &&
                sessions.some((s) => s.outcome === "training") && (
                  <span className="nav-dot" />
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">{ui("一点训练共识")}</span>
          <p>
            {ui("先有一个观察，")}<br />
            {ui("再向答案走一步。")}</p>
          <span>{ui("允许卡住，也允许猜错。")}</span>
          <div className="note-line" />
        </div>
        <div className="sidebar-bottom">
          <div className="appearance-controls"><LanguageSwitch /><ThemeSwitch /></div>
          {user.role === "admin" && (
            <button
              className={view === "admin" ? "nav-item active" : "nav-item"}
              onClick={() => navigate("admin")}
            >
              <ShieldCheck size={18} />
              {ui("管理员面板")}</button>
          )}
          <button className="nav-item" onClick={() => setRatingModal(true)}><Target size={18}/>{ui("个人等级分")}</button>
          <button className="nav-item" onClick={() => setPasswordModal(true)}>
            <Settings2 size={18} />
            {ui("修改密码")}</button>
          <button
            className="nav-item"
            onClick={async () => {
              pauseAll();
              await save();
              await logout();
            }}
          >
            <LogOut size={18} />
            {ui("退出登录")}</button>
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={18} />
            {ui("陪练模型")}<span className={aiConfigured ? "connection on" : "connection"} />
          </button>
          <div className="profile">
            <div className="avatar">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <div>
              {user.username}
              <small>
                {user.role === "admin" ? ui("管理员") : ui("训练成员")} {ui("· 记录保存到服务器")}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <button className="mobile-menu-toggle" aria-label={ui("打开导航")} aria-expanded={mobileMenu} aria-controls="workspace-navigation" onClick={() => setMobileMenu(true)}><Menu size={22} /></button>
            <span className="muted">{ui("我的工作台")}</span>
            <ChevronRight size={14} />
            <span>
              {view === "bank"
                ? ui("发现题目")
                : view === "training"
                  ? ui("思维陪练")
                  : view === "statistics"
                    ? ui("训练统计")
                  : view === "admin"
                    ? ui("管理后台")
                    : ui("训练记录")}
            </span>
          </div>
          <button className="quiet" onClick={() => setSettings(true)}>
            <span className={aiConfigured ? "connection on" : "connection"} />
            {aiConfigured ? ui("AI 已配置") : ui("连接你的 AI")}
            <ArrowUpRight size={14} />
          </button>
        </header>
        {view === "admin" && user.role === "admin" && (
          <AdminPanel onModelsChanged={refreshModels} />
        )}
        {view === "statistics" && <StatisticsPanel save={save} />}
        {view === "bank" && (
          <main className="main-content">
            <section className="hero">
              <div>
                <div className="eyebrow">
                  <span />{ui("从 OI 到 ICPC，每次多一个观察")}</div>
                <h1>
                  {ui("把「没思路」，")}<br />
                  {ui("练成")}<span>{ui("「再想一步」。")}</span>
                </h1>
                <p>
                  {ui("找到刚好有挑战的题。把第一反应说出来，")}<br className="desktop-break" />{ui("让 AI 陪你举例、找反例、推导，直到自己走通。")}</p>
                <button className="primary" onClick={random} disabled={loading}>
                  <Shuffle size={17} />
                  {ui("为我挑一道题")}<ArrowRight size={17} />
                </button>
                <span className="hero-caption">
                  {ui("当前筛选 ·")}{min}–{max}
                  {tags.length ? ui(" · {0} 个标签",[tags.length]) : ""}
                </span>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-label">THE THINKING PROCESS</div>
                <svg viewBox="0 0 380 180">
                  <defs>
                    <pattern
                      id="dots"
                      width="17"
                      height="17"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="1" cy="1" r="1" fill="#d4ddd1" />
                    </pattern>
                  </defs>
                  <rect width="380" height="180" fill="url(#dots)" />
                  <path
                    d="M35 133 C90 133 64 45 130 58 S183 165 225 110 S271 28 334 43"
                    fill="none"
                    stroke="#a3bca5"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                  />
                  <circle
                    cx="35"
                    cy="133"
                    r="8"
                    fill="#dce6d5"
                    stroke="#6b8b71"
                  />
                  <circle
                    cx="130"
                    cy="58"
                    r="9"
                    fill="#dce6d5"
                    stroke="#6b8b71"
                  />
                  <circle
                    cx="225"
                    cy="110"
                    r="9"
                    fill="#dce6d5"
                    stroke="#6b8b71"
                  />
                  <circle cx="334" cy="43" r="18" fill="#245645" />
                  <path
                    d="m327 43 5 5 8-10"
                    fill="none"
                    stroke="#e3f5b0"
                    strokeWidth="2.5"
                  />
                  <text x="14" y="162">
                    {ui("观察")}</text>
                  <text x="110" y="33">
                    {ui("猜想")}</text>
                  <text x="206" y="143">
                    {ui("验证")}</text>
                  <text x="314" y="83">
                    {ui("突破")}</text>
                </svg>
                <div className="art-foot">
                  <span>{ui("01 — 不是每条路都笔直")}</span>
                  <span>↗</span>
                </div>
              </div>
            </section>
            <section className="stats-grid">
              <div>
                <span className="stat-icon">
                  <Target size={19} />
                </span>
                <div>
                  <span>{ui("已完成训练")}</span>
                  <strong>
                    {summary.completedProblems}
                    <small>{ui("道")}</small>
                  </strong>
                </div>
              </div>
              <div>
                <span className="stat-icon">
                  <Clock3 size={19} />
                </span>
                <div>
                  <span>{ui("累计思考时间")}</span>
                  <strong>
                    {totalMinutes}
                    <small>{ui("分钟")}</small>
                  </strong>
                </div>
              </div>
              <div>
                <span className="stat-icon">
                  <Lightbulb size={19} />
                </span>
                <div>
                  <span>{ui("独立解出")}</span>
                  <strong>
                    {summary.independentProblems}
                    <small>{ui("道")}</small>
                  </strong>
                </div>
              </div>
              <div>
                <span className="stat-icon">
                  <TrendingUp size={19} />
                </span>
                <div>
                  <span>{ui("我的起步区间")}</span>
                  <strong className="rating-stat">
                    {min}
                    <span>—</span>
                    {max}
                  </strong>
                </div>
              </div>
            </section>
            <div className="section-title">
              <div>
                <h2>
                  {ui("找到你的下一道题")}<span>PROBLEM EXPLORER</span>
                </h2>
                <p>{ui("难一点点，刚好能让思考发生。")}</p>
              </div>
              <div className="bank-indicator">
                <span className="connection on" />
                {bank
                  ? ui("{0} 道 CF 题目",[bank.bankTotal.toLocaleString()])
                  : ui("正在连接 Codeforces")}
              </div>
            </div>
            <div className="rating-preset"><div><strong>{cfRating == null ? ui("尚未设置个人等级分") : ui("我的 CF 等级分 · {0}",[cfRating])}</strong><span>{ui("默认难度")}{preset.min}–{preset.max}{cfRating == null ? "" : ui(" · 等级分 −100 / +300")}</span></div><div><button className="text-button" onClick={()=>setRatingModal(true)}>{cfRating==null?ui("设置等级分"):ui("修改等级分")}</button>{(min!==preset.min||max!==preset.max)&&<button className="secondary" onClick={()=>{setMin(preset.min);setMax(preset.max);setPage(1);}}>{ui("应用个人预设")}</button>}</div></div>
            <section className="filter-panel">
              <div className="filter-top">
                <label className="range-label">
                  {ui("难度范围")}<select
                    aria-label={ui("最低难度")}
                    value={min}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMin(v);
                      if (v > max) setMax(v);
                      setPage(1);
                    }}
                  >
                    {difficultyOptions(min).map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                  <span>—</span>
                  <select
                    aria-label={ui("最高难度")}
                    value={max}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMax(v);
                      if (v < min) setMin(v);
                      setPage(1);
                    }}
                  >
                    {difficultyOptions(max).map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="search-box">
                  <Search size={16} />
                  <input
                    aria-label={ui("搜索题目")}
                    placeholder={ui("搜索题号或题名")}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <select
                  className="sort-select"
                  aria-label={ui("排序方式")}
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="popular">{ui("最多人通过")}</option>
                  <option value="rating">{ui("难度从低到高")}</option>
                  <option value="recent">{ui("最近的比赛")}</option>
                </select>
              </div>
              <div className="tag-filter">
                <span className="filter-label">{ui("训练标签")}</span>
                <button
                  className={!tags.length ? "tag selected" : "tag"}
                  onClick={() => {
                    setTags([]);
                    setPage(1);
                  }}
                >
                  {ui("全部")}</button>
                {Object.entries(tagLabels)
                  .slice(0, 12)
                  .map(([tag, label]) => (
                    <button
                      className={tags.includes(tag) ? "tag selected" : "tag"}
                      key={tag}
                      onClick={() => {
                        setTags((prev) =>
                          prev.includes(tag)
                            ? prev.filter((t) => t !== tag)
                            : [...prev, tag],
                        );
                        setPage(1);
                      }}
                    >
                      {ui(label)}
                    </button>
                  ))}
                <select
                  aria-label={ui("更多标签")}
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      setTags((prev) => [
                        ...new Set([...prev, e.target.value]),
                      ]);
                    setPage(1);
                  }}
                >
                  <option value="">{ui("更多标签 ＋")}</option>
                  {Object.entries(tagLabels)
                    .slice(12)
                    .map(([v, l]) => (
                      <option key={v} value={v}>
                        {ui(l)}
                      </option>
                    ))}
                </select>
              </div>
              {tags.some(
                (t) => !Object.keys(tagLabels).slice(0, 12).includes(t),
              ) && (
                <div className="extra-tags">
                  {tags
                    .filter(
                      (t) => !Object.keys(tagLabels).slice(0, 12).includes(t),
                    )
                    .map((t) => (
                      <button
                        className="tag selected"
                        key={t}
                        onClick={() => {
                          setTags(tags.filter((x) => x !== t));
                          setPage(1);
                        }}
                      >
                        {ui(tagLabels[t])} ×
                      </button>
                    ))}
                </div>
              )}
              <div className="filter-bottom">
                <label>
                  <input
                    type="checkbox"
                    checked={exclude}
                    onChange={(e) => {
                      setExclude(e.target.checked);
                      setPage(1);
                    }}
                  />
                  {ui("排除已完成训练的题")}</label>
                <label>
                  <input
                    type="checkbox"
                    checked={hideTags}
                    onChange={(e) => setHideTags(e.target.checked)}
                  />
                  <EyeOff size={14} />
                  {ui("隐藏题目标签，保留思考空间")}</label>
                <span>{ui("多标签按「全部符合」筛选")}</span>
              </div>
            </section>
            <div className="result-heading">
              <span>
                {loading
                  ? ui("正在筛选…")
                  : ui("找到 {0} 道题目",[bank?.total.toLocaleString() || 0])}
                <span className="result-sub">
                  {bank?.source === "snapshot"
                    ? ui("CF 暂不可用 · 使用 {0} 快照",[new Date(bank.updatedAt).toLocaleDateString("zh-CN")])
                    : ui("来自 Codeforces 官方题库")}
                </span>
              </span>
              <button
                className="text-button"
                onClick={random}
                disabled={loading}
              >
                <Shuffle size={14} />
                {ui("随机挑一题")}</button>
            </div>
            <DifficultyGuide />
            <div className="problem-table">
              <div className="table-head">
                <span>{ui("题目 / PROBLEM")}</span>
                <span>{ui("难度")}</span>
                <span>{ui("通过人数")}</span>
                <span>{ui("开始训练")}</span>
              </div>
              {bankError ? (
                <div className="empty">
                  <CircleHelp />
                  <h3>{ui("题库暂时没加载出来")}</h3>
                  <p>{bankError}</p>
                  <button onClick={() => setPage((p) => (p === 1 ? 2 : 1))}>
                    {ui("重新加载")}</button>
                </div>
              ) : loading ? (
                <div className="empty">
                  <LoaderCircle className="spin" />
                  <p>{ui("正在寻找下一道挑战…")}</p>
                </div>
              ) : !bank?.items.length ? (
                <div className="empty">
                  <Search />
                  <h3>{ui("暂时没有匹配的题目")}</h3>
                  <p>{ui("试试放宽难度范围，或减少标签。")}</p>
                  <button
                    onClick={() => {
                      setTags([]);
                      setQuery("");
                      setMin(preset.min);
                      setMax(preset.max);
                      setPage(1);
                    }}
                  >
                    {ui("重置筛选")}</button>
                </div>
              ) : (
                bank.items.map((p) => (
                  <div className="problem-row" key={p.id}>
                    <div className="problem-name">
                      <span className="problem-id">{p.id}</span>
                      <div>
                        <a
                          href={problemUrl(p)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.name}
                          <ArrowUpRight size={13} />
                        </a>
                        <DifficultyBadge rating={p.rating} />
                        <div className="problem-tags">
                          {hideTags ? (
                            <span>
                              <EyeOff size={11} />
                              {ui("标签已隐藏")}</span>
                          ) : (
                            p.tags.map((t) => (
                              <span key={t}>{ui(tagLabels[t] || t)}</span>
                            ))
                          )}
                          {doneIds.has(p.id) && (
                            <span className="done-tag">{ui("已训练")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <span
                        className={
                          p.rating >= 1900 ? "rating orange" : "rating"
                        }
                      >
                        <span />
                        {p.rating}
                      </span>
                    </div>
                    <span className="solved-count">
                      {p.solvedCount.toLocaleString()}
                    </span>
                    <button className="row-start" onClick={() => start(p)}>
                      {ui("去思考")}<ArrowUpRight size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="pagination">
              <span>{ui("CF Rating 用于选题参考 · 完成记录由你手动标记")}</span>
              <div>
                <button
                  aria-label={ui("上一页")}
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {page} / {Math.max(1, Math.ceil((bank?.total || 0) / 12))}
                </span>
                <button
                  aria-label={ui("下一页")}
                  disabled={page * 12 >= (bank?.total || 0) || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <footer>
              <Code2 size={15} />
              {ui("训练的是走向答案的过程。")}<span>BUILT FOR THE NEXT OBSERVATION</span>
            </footer>
          </main>
        )}
        {view === "training" && !loaded && <div className="empty" role="status"><LoaderCircle className="spin" size={20}/><p>{ui("正在恢复训练记录…")}</p><p>{ui(syncState)}</p></div>}
        {view === "training" && loaded && !session && (
          <main className="main-content">
            <div className="empty large-empty">
              <MessageCircle size={38} />
              <h2>{ui("从一道题，一句话开始。")}</h2>
              <p>{ui("挑一道题，把你的第一反应告诉 AI 陪练。")}</p>
              <button className="primary" onClick={() => navigate("bank")}>
                {ui("去发现题目")}<ArrowRight size={16} />
              </button>
              {sessions
                .filter((s) => s.outcome === "training")
                .map((s) => (
                  <button
                    className="resume-button"
                    key={s.id}
                    onClick={() => resume(s)}
                  >
                    {ui("继续")}{s.problem.id} · {s.problem.name}
                    <ArrowRight size={14} />
                  </button>
                ))}
            </div>
          </main>
        )}
        {view === "training" && session && (
          <main className="training-content">
            <div className="training-heading">
              <div>
                <button
                  className="back-button"
                  onClick={() => navigate("bank")}
                >
                  <ChevronLeft size={15} />
                  {ui("题库")}</button>
                <h1>
                  <span>{session.problem.id}</span>
                  {session.problem.name}
                </h1>
                <div className="training-meta">
                  <span className="rating">
                    <span />
                    {session.problem.rating}
                  </span>
                  <DifficultyBadge rating={session.problem.rating} />
                  <a
                    href={problemUrl(session.problem)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ui("打开 CF 原题")}<ExternalLink size={13} />
                  </a>
                  <span>{ui(outcomes[session.outcome])}</span>
                </div>
              </div>
              <div className="training-actions">
                <button
                  className="timer"
                  onClick={() =>
                    session.startedAt
                      ? patch(session.id, { elapsed, startedAt: null })
                      : patch(session.id, { startedAt: Date.now() })
                  }
                >
                  {session.startedAt ? <Pause size={15} /> : <Play size={15} />}
                  <span>{fmt(elapsed)}</span>
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setTakeaway(session.takeaway);
                    setFinish(true);
                  }}
                >
                  <Flag size={15} />
                  {ui("结束并记录")}</button>
              </div>
            </div>
            <nav className="mobile-training-jump" aria-label={ui("训练区域")}><a href="#problem-reader" onClick={e=>{e.preventDefault();document.getElementById("problem-reader")?.scrollIntoView({block:"start"});}}>{ui("阅读题目")}</a><a href="#ai-coach" onClick={e=>{e.preventDefault();document.getElementById("ai-coach")?.scrollIntoView({block:"start"});}}>{ui("与 AI 讨论")}</a></nav>
            <div className="training-grid">
              <section id="problem-reader" className="statement-panel">
                <div className="panel-heading">
                  <h2>
                    <BookOpen size={17} />
                    {ui("题目工作区")}</h2>
                  <button
                    className="text-button"
                    onClick={() => setEditor(!editor)}
                  >
                    {editor ? ui("保存题面") : ui("编辑 / 粘贴题面")}
                  </button>
                </div>
                <div className="statement-help">
                  {ui("题面会自动读取并缓存，来源显示在正文下方。可编辑或粘贴修正。")}</div>
                {statementBusy && (
                  <div className="inline-loading">
                    <LoaderCircle size={16} className="spin" />
                    {ui("正在读取 CF 题面…")}</div>
                )}
                {statementError && (
                  <div className="warning">
                    {ui(statementError)}
                    <button onClick={() => setEditor(true)}>{ui("粘贴题面")}</button>
                    <button
                      onClick={() => loadStatement(session.problem, session.id)}
                    >
                      {ui("重试读取")}</button>
                  </div>
                )}
                {editor ? (
                  <textarea
                    className="statement-editor"
                    aria-label={ui("题面内容")}
                    value={session.statement}
                    onChange={(e) =>
                      patch(session.id, { statement: e.target.value })
                    }
                    placeholder={ui("粘贴完整题面、输入输出约束与样例。AI 会基于这里的内容陪练。")}
                  />
                ) : session.statement ? (
                  <>
                    <div className="statement-toolbar">
                      <div
                        className="statement-language"
                        role="group"
                        aria-label={ui("题面语言")}
                      >
                        <button
                          className={
                            statementLanguage === "original" ? "selected" : ""
                          }
                          onClick={() => setStatementLanguage("original")}
                        >
                          {ui("英文原文")}</button>
                        <button
                          className={
                            statementLanguage === "zh" ? "selected" : ""
                          }
                          onClick={() => {
                            setStatementLanguage("zh");
                            void translateStatement();
                          }}
                        >
                          {ui("中文译文")}</button>
                        <button
                          className={
                            statementLanguage === "compare" ? "selected" : ""
                          }
                          onClick={() => {setStatementLanguage("compare");void translateStatement();}}
                        >
                          {ui("中英对照")}</button>
                      </div>
                      <div className="statement-font">
                        <button
                          aria-label={ui("缩小题面字体")}
                          onClick={() =>
                            setStatementFont((v) => Math.max(15, v - 1))
                          }
                        >
                          A−
                        </button>
                        <span>{statementFont}px</span>
                        <button
                          aria-label={ui("放大题面字体")}
                          onClick={() =>
                            setStatementFont((v) => Math.min(22, v + 1))
                          }
                        >
                          A＋
                        </button>
                      </div>
                    </div>
                    <div
                      className={
                        "statement-text " +
                        (statementLanguage === "compare"
                          ? "statement-columns"
                          : "")
                      }
                      style={{ fontSize: statementFont }}
                    >
                      {statementLanguage !== "zh" && (
                        <section>
                          {statementLanguage === "compare" && (
                            <h3 className="statement-column-label">{ui("英文原文")}</h3>
                          )}
                          <ProblemStatement
                            text={session.statement}
                            metadata={statementParts.metadata}
                            render={session.statementFormat === "markdown" ? renderMarkdown : renderPlain}
                          />
                        </section>
                      )}
                      {statementLanguage !== "original" && (
                        <section>
                          {statementLanguage === "compare" && (
                            <h3 className="statement-column-label">{ui("中文译文")}</h3>
                          )}
                          {translation ? (
                            <>
                              <div className="translation-notice">
                                {ui("AI 译文 ·")}{translation.model} {ui("· 公式与样例保持原样")}
                                <button type="button" className="text-button" disabled={translating===session.id} onClick={()=>void translateStatement(true)}>{ui(translating===session.id?"正在重新翻译…":"用当前模型重新翻译")}</button>
                              </div>
                              {translationErrors[session.id]&&<div className="form-error" role="alert">{ui(translationErrors[session.id])}</div>}
                              <ProblemStatement metadata={statementParts.metadata} text={translation.text} render={renderMarkdown} />
                            </>
                          ) : (
                            <div className="translation-empty">
                              {translating === session.id ? (
                                <>
                                  <LoaderCircle size={19} className="spin" />
                                  <p>{ui("正在准备中文译文，原文仍可随时查看…")}</p>
                                </>
                              ) : (
                                <>
                                  <p>
                                    {ui("优先读取已有译文；没有译文时才使用当前模型生成。切换陪练模型不会重新翻译。")}</p>
                                  {translationErrors[session.id] && (
                                    <div className="form-error" role="alert">
                                      {translationErrors[session.id]}
                                    </div>
                                  )}
                                  <button
                                    className="primary"
                                    onClick={() => void translateStatement()}
                                  >
                                    <Sparkles size={16} />
                                    {translationErrors[session.id]
                                      ? ui("重试翻译")
                                      : ui("查看中文译文")}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </section>
                      )}
                    </div>
                    {session.statementSource && (
                      <div className="statement-source">
                        {ui("来源：")}<a
                          href={session.statementSource.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {session.statementSource.name}
                          <ExternalLink size={11} />
                        </a>
                        {session.statementFetchedAt && (
                          <span>
                            {ui("读取于")}{" "}
                            {new Date(
                              session.statementFetchedAt,
                            ).toLocaleDateString(currentLocale())}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : !statementBusy && !statementError ? (
                  <div className="empty">
                    <p>{ui("请从 CF 原题复制题面到这里。")}</p>
                    <button onClick={() => setEditor(true)}>{ui("粘贴题面")}</button>
                  </div>
                ) : null}
                <div className="notes-heading">
                  <NotebookPen size={16} />
                  {ui("我的观察与草稿")}<span>{ui(syncState)}</span>
                </div>
                <RecoveredVersions versions={session.recoveredVersions}/>
                <textarea
                  className="notes-editor"
                  aria-label={ui("观察草稿")}
                  placeholder={
                    ui("暴力怎么做？最小例子是什么？哪个量不会变？\n先留住一个可以确定的事实。")
                  }
                  value={session.notes}
                  onChange={(e) => patch(session.id, { notes: e.target.value })}
                />
              </section>
              <section id="ai-coach" className="coach-panel">
                <div className="panel-heading">
                  <h2>
                    <span className="coach-avatar">
                      <Sparkles size={16} />
                    </span>
                    {ui("AI 思维陪练")}</h2>
                  <span className="coach-state">
                    {aiConfigured ? (
                      <>
                        <span className="connection on" />
                        {ui("按需调用")}</>
                    ) : (
                      <button onClick={() => setSettings(true)}>
                        {ui("连接 AI")}<ArrowUpRight size={12} />
                      </button>
                    )}
                  </span>
                </div>
                <div className="coach-principle">
                  <Lightbulb size={15} />
                  {ui("每次只推进一小步，先把你的想法说出来。")}</div>
                <div className="editorial-reference">
                  {session.editorialReference?.status === "ready" ? <span>{ui("最近回复已参考官方题解")}{session.editorialReference.stale ? ui("（旧缓存）") : ""} · <a href={session.editorialReference.url} target="_blank" rel="noreferrer">{ui("来源链接（含剧透）")}</a></span> : <span>{session.editorialReference?.status === "unavailable" ? ui("官方题解暂不可用；独立推导尚未核验") : ui("回复前会获取当前题目的官方题解，仅供教练核验")}</span>}
                  <label><input type="checkbox" checked={allowUnverified} disabled={busy} onChange={e=>setAllowUnverified(e.target.checked)}/>{ui("允许无题解推导")}</label>
                </div>
                <div className="chat-messages" aria-live="polite">
                  {!session.messages.length && (
                    <div className="coach-intro">
                      <span className="intro-symbol">
                        <MessageCircle size={24} />
                      </span>
                      <h3>{ui("你读完后的第一反应是什么？")}</h3>
                      <p>
                        {ui("一个猜想、一个暴力，甚至一句「我卡在这里」，都可以作为起点。")}</p>
                      <div>
                        <span>{ui("举例观察")}</span>
                        <span>{ui("检验猜想")}</span>
                        <span>{ui("证明与建模")}</span>
                      </div>
                    </div>
                  )}
                  {session.messages.map((m, i) => (
                    <div key={i} className={"chat-message " + m.role}>
                      <div className="message-label">
                        {m.role === "user"
                          ? ui("你 · 正在思考")
                          : ui("AI · 陪你推一步")}
                      </div>
                      {m.role==="assistant"&&m.reasoning&&<ReasoningDetails text={m.reasoning}/>}
                      {messageEdit?.sessionId === session.id && messageEdit.index === i ? (
                        <div className="message-edit">
                          <textarea autoFocus aria-label={ui("编辑已发送消息")} value={messageEdit.content} disabled={busy} onChange={e=>setMessageEdit({...messageEdit,content:e.target.value})}/>
                          <p>{ui("保存后将从这里重新生成回复，后续对话会移入历史版本。")}</p>
                          <div><button className="secondary" disabled={busy} onClick={()=>setMessageEdit(null)}>{ui("取消")}</button><button className="primary" disabled={busy || !messageEdit.content.trim() || messageEdit.content.trim()===messageEdit.original} onClick={()=>void send("discuss",messageEdit)}>{ui("保存并重新生成")}</button></div>
                        </div>
                      ) : <Text text={m.content} allowVisuals={m.role === "assistant"} />}
                      {m.role === "user" && !(messageEdit?.sessionId === session.id && messageEdit.index === i) && <div className="message-actions">
                        <button disabled={busy} aria-label={ui("编辑第 {0} 条消息",[i+1])} onClick={()=>setMessageEdit({sessionId:session.id,index:i,original:m.content,content:m.content})}><Pencil size={13}/>{ui("编辑")}</button>
                        <button disabled={busy} aria-label={ui("撤回第 {0} 条消息",[i+1])} onClick={()=>recallMessage(i)}><Undo2 size={13}/>{ui("撤回")}</button>
                      </div>}
                    </div>
                  ))}
                  {partialReply?.sessionId === session.id && (partialReply.text||partialReply.reasoning) && <div className="chat-message assistant partial-reply">
                    <div className="message-label">{ui(busy?"正在生成，完成后自动保存":"未完成的回复（未写入历史）")}</div>
                    {partialReply.reasoning&&<ReasoningDetails text={partialReply.reasoning} live/>}
                    {partialReply.text&&<Text text={partialReply.text}/>}
                  </div>}
                  {busy && (
                    <div className="thinking">
                      <LoaderCircle size={15} className="spin" />
                      {ui("正在检验思路… 已等待 {0} 秒",[Math.max(0,Math.floor((now-sendStartedAt.current)/1000))])}<button type="button" className="text-button" onClick={()=>chatAbort.current?.abort()}>{ui("停止生成")}</button></div>
                  )}
                  <div ref={chatEnd} />
                </div>
                {chatError && <div className="chat-error" role="alert">{ui(chatError)}{chatRequestId&&<small>{ui("请求编号")} · {chatRequestId}</small>}{session.messages.at(-1)?.role === "user" && <button disabled={busy} onClick={()=>void send(retryMode,undefined,true)}>{ui("重试回复")}</button>}</div>}
                <div className="coach-controls">
                  <div className="hint-buttons">
                    <button disabled={busy} onClick={() => send("visualize")}><Sparkles size={13}/>{ui("画图讲解")}</button>
                    {[1, 2, 3].map((level) => (
                      <button
                        key={level}
                        disabled={busy}
                        className={session.hints >= level ? "used-hint" : ""}
                        onClick={() => send("hint" + level)}
                      >
                        <Lightbulb size={13} />
                        {level} {ui("级提示")}</button>
                    ))}
                    <button
                      disabled={busy || !session.messages.length}
                      onClick={() => send("counterexample")}
                    >
                      <Target size={13} />
                      {ui("检验猜想")}</button>
                  </div>
                  <form
                    className="composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    <textarea
                      aria-label={ui("你的解题思路")}
                      placeholder={ui("写下你的想法，点击发送…")}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing &&
                          !window.matchMedia("(pointer: coarse)").matches
                        ) {
                          e.preventDefault();
                          send();
                        }
                      }}
                    />
                    <div>
                      <span>{ui("先尝试表达，再获得提示")}</span>
                      <button
                        aria-label={ui("发送思路")}
                        className="send-button"
                        type="submit"
                        disabled={busy || !draft.trim()}
                      >
                        {busy ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <Send size={17} />
                        )}
                      </button>
                    </div>
                  </form>
                  <div className="coach-bottom">
                    <button
                      disabled={busy || !session.messages.length}
                      onClick={() => send("review")}
                    >
                      <NotebookPen size={13} />
                      {ui("复盘这次思考")}</button>
                    <button disabled={busy} onClick={() => send("solution")}>
                      {ui("查看完整解法")}<ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </main>
        )}
        {view === "history" && (
          <main className="main-content history-page">
            <div className="section-title history-title">
              <div>
                <div className="eyebrow">MY THINKING JOURNAL</div>
                <h1>{ui("每一次卡住，都留下线索。")}</h1>
                <p>
                  {sessions.length} {ui("次训练 ·")}{sessions.filter(s => s.outcome === "training" || s.outcome === "review").length} {ui("道待继续 ·")}{sessions.filter(s => s.outcome === "independent" || s.outcome === "assisted").length} {ui("道已完成")}</p>
              </div>
              <button
                className="secondary"
                onClick={exportData}
                disabled={!sessions.length}
              >
                <Download size={16} />
                {ui("导出记录")}</button>
            </div>
            {!sessions.length ? (
              <div className="empty large-empty">
                <NotebookPen size={36} />
                <h3>{ui("你的第一条思考记录，还在下一道题里。")}</h3>
                <button className="primary" onClick={() => navigate("bank")}>
                  {ui("挑一道题")}<ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <div className="history-groups">
                {[
                  { title: ui("未完成"), subtitle: ui("接着上次的观察，继续向前一步。"), icon: Clock3, items: sessions.filter(s => s.outcome === "training" || s.outcome === "review"), empty: ui("目前没有未完成的训练，去挑一道新题吧。"), kind: "pending" },
                  { title: ui("已完成"), subtitle: ui("已经走通的题，和留下的思考。"), icon: CheckCircle2, items: sessions.filter(s => s.outcome === "independent" || s.outcome === "assisted"), empty: ui("完成训练并标记解出后，会收录在这里。"), kind: "finished" },
                ].map(group => <section className={"history-group " + group.kind} key={group.kind}>
                  <div className="history-group-heading"><div><h2><group.icon size={18} />{group.title}<span>{group.items.length}</span></h2><p>{group.subtitle}</p></div></div>
                  {group.items.length ? <div className="history-list">
                {group.items.map((s) => (
                  <article key={s.id}>
                    <div className="history-date">
                      {new Date(s.createdAt).toLocaleDateString(currentLocale(), {
                        month: "short",
                        day: "numeric",
                      })}
                      <span>CF {s.problem.rating}</span>
                    </div>
                    <div className="history-main">
                      <h3>
                        <span>{s.problem.id}</span>
                        {s.problem.name}
                      </h3>
                      <div>
                        <DifficultyBadge rating={s.problem.rating} />
                        <span className={"outcome " + s.outcome}>
                          {ui(outcomes[s.outcome])}
                        </span>
                        <span>
                          <Clock3 size={13} />
                          {fmt(
                            s.elapsed +
                              (s.startedAt
                                ? Math.max(
                                    0,
                                    Math.floor((now - s.startedAt) / 1000),
                                  )
                                : 0),
                          )}
                        </span>
                        <span>
                          {s.hints === 4 ? ui("已查看解法") : ui("{0} 级提示",[s.hints])}
                        </span>
                        <span>
                          {s.messages.filter((m) => m.role === "user").length}{" "}
                          {ui("轮思考")}</span>
                      </div>
                      {s.takeaway && <p>{s.takeaway}</p>}
                    </div>
                    <button className="row-start" onClick={() => resume(s)}>
                      {s.outcome === "training" ? ui("继续训练") : s.outcome === "review" ? ui("重新练习") : ui("查看复盘")}
                      <ArrowUpRight size={15} />
                    </button>
                  </article>
                ))}
                  </div> : <div className="history-group-empty">{group.empty}</div>}
                </section>)}
              </div>
            )}
            <div className="history-data-heading"><span>{ui("记录与备份")}</span><span className="history-sync" role="status"><span className="connection on" />{ui(syncState)}</span></div>
        <div className="import-toolbar">
          <button
            className="secondary"
            onClick={() => importInput.current?.click()}
          >
            <Upload size={15} />
            {ui("导入 JSON 备份")}</button>
          <button
            className="text-button"
            onClick={() => {
              try {
                const old = JSON.parse(
                  localStorage.getItem("icpc-sessions-v1") || "[]",
                );
                if (!Array.isArray(old) || !old.length) {
                  setToast("此浏览器没有旧版记录");
                  return;
                }
                if (
                  !window.confirm(
                    ui("将本浏览器旧版训练记录导入当前账号？请确认这些记录属于你。"),
                  )
                )
                  return;
                const ids = new Set(sessions.map((s) => s.id));
                setSessions((prev) => [
                  ...prev,
                  ...old
                    .filter((s) => !ids.has(s.id))
                    .map((s) => ({ ...s, startedAt: null })),
                ]);
                setToast("旧版记录已合并，正在同步");
              } catch {
                setToast("旧版记录无法读取，请从 JSON 备份导入");
              }
            }}
          >
            {ui("迁移本浏览器旧版记录")}</button>

        </div>
          </main>
        )}
      </div>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const parsed = JSON.parse(await file.text());
            if (
              !Array.isArray(parsed) ||
              parsed.some(
                (x) => !x?.id || !x?.problem?.id || !Array.isArray(x.messages),
              )
            )
              throw Error("记录文件格式无效");
            const existing = new Set(sessions.map((s) => s.id));
            setSessions((prev) => [
              ...prev,
              ...parsed
                .filter((x) => !existing.has(x.id))
                .map((x) => ({ ...x, startedAt: null })),
            ]);
            setToast("记录已合并，正在保存到服务器");
          } catch (err) {
            setToast((err as Error).message);
          }
          e.target.value = "";
        }}
      />

      {ratingModal && <div className="modal-overlay"><section className="modal"><button className="modal-close" aria-label={ui("关闭等级分设置")} onClick={()=>setRatingModal(false)}><X size={19}/></button><RatingForm rating={cfRating} onSaved={rating=>{setCfRating(rating);const next=ratingRange(rating);setMin(next.min);setMax(next.max);setPage(1);setRatingModal(false);setToast("个人等级分已保存，选题难度已更新");}}/></section></div>}
      {passwordModal && (
        <div className="modal-overlay">
          <section className="modal">
            <button
              className="modal-close"
              onClick={() => setPasswordModal(false)}
              aria-label={ui("关闭修改密码")}
            >
              <X size={19} />
            </button>
            <PasswordForm
              done={() => {
                setPasswordModal(false);
                setToast("密码已更新，其他设备已退出登录");
              }}
            />
          </section>
        </div>
      )}
      {settings && (
        <div className="modal-overlay" onClick={() => setSettings(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={ui("陪练模型")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label={ui("关闭设置")}
              onClick={() => setSettings(false)}
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              <Sparkles size={25} />
            </span>
            <h2>{ui("选择陪练模型")}</h2>
            <p>
              {ui("选择管理员已启用的模型。API Key 只保存在服务端，页面无法读取。题面、草稿和对话会发送给你选择的模型服务商。")}</p>
            <label>
              {ui("当前陪练模型")}<select
                value={modelId}
                disabled={modelSettingsBusy}
                onChange={(e) => {
                  setModelSettingsError("");
                  setModelId(e.target.value);
                  setModel(
                    models.find((m) => m.id === e.target.value)?.model || "",
                  );
                }}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {m.model}
                    {m.is_default ? ui("（默认）") : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>{ui("推理等级")}<select aria-label={ui("推理等级")} value={reasoningEffort} disabled={modelSettingsBusy||!models.length} onChange={e=>setEfforts(prev=>({...prev,[modelId]:e.target.value as ReasoningLevel}))}>{supportedEfforts.map((option:any)=><option key={option.value} value={option.value}>{ui(option.label)}</option>)}</select></label>
            <p className="reasoning-help">{/glm-5\.3/i.test(selectedModel?.model||"")?ui("GLM-5.3 始终开启思考，可选择轻度、增强或深度；模型默认使用服务商默认等级。"):/glm-/i.test(selectedModel?.model||"")?ui("按当前 GLM 型号提供可用思考选项。"):ui("非默认等级通过 reasoning_effort 发送，兼容接口需要支持该参数；不支持时请选模型默认。")}{ui("更高等级可能增加等待时间与 Token 消耗。设置用于后续陪练和翻译，按账号和模型保存。")}</p>
            {modelSettingsError&&<div className="form-error" role="alert">{ui(modelSettingsError)}</div>}
            <div className="settings-note">
              <CheckCircle2 size={16} />
              <span>
                {ui(syncState)}。
                {user.role === "admin"
                  ? ui("添加或修改模型请进入管理员面板。")
                  : ui("模型配置由管理员维护。")}
              </span>
            </div>
            <div className="modal-actions">
              <span className="muted">{ui("密钥不会返回浏览器")}</span>
              <button className="primary" disabled={modelSettingsBusy||!models.length} onClick={async () => {
                setModelSettingsBusy(true);setModelSettingsError("");
                try {const response=await fetch("/api/model-preferences",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({modelId,reasoningEffort})});const data=await response.json() as {error?:string;preferences:{efforts:Record<string,ReasoningLevel>}};if(!response.ok)throw Error(data.error||"设置保存失败");setEfforts(data.preferences.efforts);setSettings(false);setToast(ui("已保存模型设置：{0}",[ui(reasoningLabels[reasoningEffort])]));}catch(e){setModelSettingsError((e as Error).message);}finally{setModelSettingsBusy(false);}
              }}>
                {modelSettingsBusy?ui("正在保存…"):ui("保存并开始思考")}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
      {finish && session && (
        <div className="modal-overlay" onClick={() => setFinish(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={ui("记录训练结果")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label={ui("关闭")}
              onClick={() => setFinish(false)}
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              <Flag size={25} />
            </span>
            <h2>{ui("这次思考，带走什么？")}</h2>
            <p>
              {session.problem.id} · {fmt(elapsed)} ·{" "}
              {session.hints === 4
                ? ui("查看过完整解法")
                : ui("使用至 {0} 级提示",[session.hints])}
              {ui("。训练结果由你标记，不代表 CF 已通过。")}</p>
            <label>
              {ui("一句可以迁移的观察")}<textarea
                rows={4}
                value={takeaway}
                onChange={(e) => setTakeaway(e.target.value)}
                placeholder={ui("比如：遇到拆分很难维护时，试着把操作顺序倒过来。")}
              />
            </label>
            <div className="finish-options">
              <button
                className="primary"
                onClick={() =>
                  complete(session.hints ? "assisted" : "independent")
                }
              >
                <CheckCircle2 size={16} />
                {session.hints ? ui("提示后解出") : ui("独立解出")}
              </button>
              <button className="secondary" onClick={() => complete("review")}>
                {ui("还没走通，待重练")}</button>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {ui(toast)}
        </div>
      )}
    </div>
  );
}
