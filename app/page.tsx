"use client";
import {t as ui,useLocale,currentLocale} from "@/lib/locale";
import { reasoningLabels, type ReasoningLevel } from "@/lib/reasoning";
import XcpcProfileForm from "@/components/xcpc-profile-form";
import RatingForm from "@/components/rating-form";
import { ratingRange } from "@/lib/rating-range";
import StatisticsPanel from "@/components/statistics-panel";
import { reviseConversation } from "@/lib/conversation";
import {conversationBranch,branchHash,applyJobReply,type CoachJob} from "@/lib/coach-job";
import { trainingStats } from "@/lib/training-stats";
import { splitStatement } from "@/lib/statement-header";
import {translationSource} from "@/lib/translation-source";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {newAssistantSession} from "@/lib/assistant";
import {LessonLibrary} from "@/components/lesson-learning";
import {newLessonSession,lessonDefinition,setLessonMastered} from "@/lib/lessons";
import LearnerMemoryEditor from "@/components/learner-memory-editor";
import BrowserModelManager from "@/components/browser-model-manager";
import {readBrowserModels,browserModelMetadata,browserCompletion,browserModelPayload,readBrowserPreferences} from "@/lib/browser-models";
import {protectStatement,restoreStatement} from "@/lib/translation-format";
import {translationInstructions} from "@/lib/translation-prompt";
import AccountGate, { PasswordForm, type Account } from "@/components/account-gate";
import AdminPanel from "@/components/admin-panel";
import WorkspaceSidebar from "@/components/workspace/sidebar";
import Modal from "@/components/workspace/modal";
import ModelSettingsModal from "@/components/workspace/model-settings-modal";
import FinishModal from "@/components/workspace/finish-modal";
import HistoryView from "@/components/workspace/history-view";
import BankView from "@/components/workspace/bank-view";
import ChatView from "@/components/workspace/chat-view";
import { useTrainingSync } from "@/hooks/use-training-sync";
import { useCoachJobs } from "@/hooks/use-coach-jobs";
import { useWorkspaceRoute } from "@/hooks/use-workspace-route";
import { sessionView } from "@/lib/workspace-route";
import {
        Menu,
  ArrowUpRight,
            ChevronRight,
                                                    CheckCircle2,
      } from "lucide-react";
import type { Problem, Session, Message } from "@/lib/types";
import { api } from "@/lib/api-client";
import type {
  ConfigResponse,
  LearnerMemoryResponse,
  ModelOption,
  PreparedCoachRequest,
  ProblemsResponse,
  ReasoningOption,
  StatementResponse,
  TranslateResponse,
} from "@/lib/api-types";
type Bank = ProblemsResponse;
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
  const [memoryOpen,setMemoryOpen]=useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    if (!mobileMenu) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileMenu(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mobileMenu]);
  const [efforts, setEfforts] = useState<Record<string,ReasoningLevel>>({});
  const [models, setModels] = useState<ModelOption[]>([]),
    [modelId, setModelId] = useState(""),
    [passwordModal, setPasswordModal] = useState(false);
  const selectedModel=models.find(m=>m.id===modelId);
  const supportedEfforts=selectedModel?.reasoningOptions || [{value:"default",label:ui("模型默认")}];
  const reasoningEffort:ReasoningLevel=supportedEfforts.some((option:ReasoningOption)=>option.value===efforts[modelId])?efforts[modelId]:"default";
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
  const [personalModelsOpen,setPersonalModelsOpen]=useState(false);
  const [allowUnverified, setAllowUnverified] = useState(false);
  const [messageEdit, setMessageEdit] = useState<{ sessionId: string; index: number; original: string; content: string } | null>(null);
  const [draft, setDraft] = useState(""),
    [statementBusy, setStatementBusy] = useState(false),
    [statementError, setStatementError] = useState(""),
    [editor, setEditor] = useState(false),
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
  const composerInput=useRef<HTMLTextAreaElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null),
    requestId = useRef(0),
    sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const {
    busy,setBusy,chatError,setChatError,chatRequestId,setChatRequestId,
    partialReply,setPartialReply,stopGeneration,generationSessionId,
    sendStartedAt,sending,directGeneration,directAbort,activeJob,
    submittingJob,pollJobs,
  } = useCoachJobs(user.id, loaded, sessionsRef, setSessions, setToast);
  const isLesson=view==="lesson";
  const isAssistant=view==="assistant"||isLesson;
  const assistantChats=sessions.filter(s=>sessionView(s)==="assistant");
  const selectedSession=sessions.find(s=>s.id===current);
  const session=view==="assistant"
    ? (selectedSession&&sessionView(selectedSession)==="assistant"?selectedSession:assistantChats.find(s=>!s.assistantArchived))
    : selectedSession&&sessionView(selectedSession)===view&&(!isLesson||lessonDefinition(selectedSession.lesson))?selectedSession:undefined;
  const sessionId=session?.id;
  useEffect(()=>{
    if(!loaded||view!=="assistant")return;
    if(sessionId){if(current!==sessionId)openRoute("assistant",sessionId,true);return;}
    setSessions(prev=>prev.some(s=>s.kind==="assistant"&&!s.lesson&&!s.assistantArchived)?prev:[newAssistantSession(),...prev]);
  },[loaded,view,current,sessionId,openRoute,setSessions]);
  const statementParts=useMemo(()=>splitStatement(session?.statement||"",session?.statementMetadata),[session?.statement,session?.statementMetadata]);
  const sourceText=useMemo(()=>translationSource(session?.statement||""),[session?.statement]);
  const translation =
    session && translations[session.id]?.original === sourceText
      ? translations[session.id]
      : undefined;
  const trainingSessions = useMemo(()=>sessions.filter(s=>sessionView(s)==="training"),[sessions]);
  const completed = useMemo(()=>trainingSessions.filter(s=>s.outcome==="independent"||s.outcome==="assisted"),[trainingSessions]);
  const summary = useMemo(()=>trainingStats(sessions),[sessions]);
  const nowStamp = Date.now()
  const totalMinutes = Math.floor(
    sessions.reduce(
      (v, s) =>
        v +
        s.elapsed +
        (s.startedAt ? Math.max(0, Math.floor((nowStamp - s.startedAt) / 1000)) : 0),
      0,
    ) / 60,
  );
  const refreshModels = useCallback(async () => {
    try {
      const c = await api<ConfigResponse>("/api/config");
      const local=readBrowserModels(user.id).map(browserModelMetadata);
      const combined:ModelOption[]=[...(c.models||[]),...local];
      const preferences=readBrowserPreferences(user.id);
      setAiConfigured(combined.length>0);
      setModels(combined);
      setEfforts({...c.preferences?.efforts,...preferences.efforts});
      setModel(c.model || "");
      setModelId((prev) =>
        combined.some((m) => m.id === prev) ? prev : combined.some((m)=>m.id===preferences.selectedModelId)?String(preferences.selectedModelId):combined.some((m)=>m.id===c.preferences?.selectedModelId)?String(c.preferences.selectedModelId):combined[0]?.id || "",
      );
    } catch {/* intentionally ignored */}
  }, [user.id]);
  useEffect(() => {
    void refreshModels();
    const localChanged=()=>void refreshModels();window.addEventListener("icpc-browser-models",localChanged);
    return () => window.removeEventListener("icpc-browser-models",localChanged);
  }, [refreshModels]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const exclusions = exclude
    ? completed.map((s) => s.problem.id).join(",")
    : "";
  useEffect(() => {
    if(view!=="bank")return;
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
      api<Bank>("/api/problems?" + params, { signal: controller.signal })
        .then((d) => {
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
  }, [view, min, max, tags, query, sort, page, exclusions]);
  useEffect(() => {
    if(!["training","assistant","lesson"].includes(view)||!loaded)return;
    const container=chatEnd.current?.parentElement;
    if(container)container.scrollTop=container.scrollHeight;
  },[view,session?.id,loaded]);
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
  const pauseAll = useCallback(() => {
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
  }, [setSessions]);
  const loadStatement = useCallback(async (p: Problem, id: string) => {
    const token = ++requestId.current;
    setStatementBusy(true);
    setStatementError("");
    try {
      const d = await api<StatementResponse>(
        `/api/statement?contest=${p.contestId}&index=${p.index}`,
      );
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
  }, [setSessions]);
  function openAssistantConversation(id:string){setDraft("");setChatError("");setMessageEdit(null);openRoute("assistant",id);}
  function newAssistantConversation(){const next=newAssistantSession();setSessions(prev=>[next,...prev]);openAssistantConversation(next.id);}
  function updateAssistantConversation(id:string,change:Partial<Session>){
    patch(id,change);
    if(change.assistantArchived===true&&session?.id===id)openRoute("assistant",null,true);
  }
  async function rememberLesson(){
    if(!session?.lesson)return;const definition=lessonDefinition(session.lesson);if(!definition)return;
    try{
      const currentMemory=await api<LearnerMemoryResponse>("/api/learner-memory");
      const name=definition.topic.memoryName;
      const algorithms=[...currentMemory.memory.algorithms],index=algorithms.findIndex((entry)=>entry.name===name);
      const entry={name,level:session.lesson.mastery,note:index>=0?algorithms[index].note:""};if(index>=0)algorithms[index]=entry;else algorithms.push(entry);
      await api("/api/learner-memory",{method:"PATCH",body:{memory:{...currentMemory.memory,algorithms},revision:currentMemory.revision}});setToast("专题自评已存入学习记忆");
    }catch(error){setToast((error as Error).message);}
  }
  function quoteLesson(quote:string){
    setDraft(previous=>[previous.trimEnd(),quote].filter(Boolean).join("\n\n")+"\n\n");
    const input=composerInput.current;
    input?.focus({preventScroll:true});
    input?.scrollIntoView({block:"nearest"});
    requestAnimationFrame(()=>{
      if(input&&document.activeElement===input)input.setSelectionRange(input.value.length,input.value.length);
    });
  }
  function startLesson(topicId:string){
    const existing=sessionsRef.current.find(s=>s.lesson?.topicId===topicId);
    const next=existing||newLessonSession(topicId,sessionsRef.current.find(s=>s.kind==="assistant"&&!s.lesson)?.assistantProfile);
    if(!existing)setSessions(prev=>[next,...prev]);
    setDraft("");setChatError("");setMessageEdit(null);openRoute("lesson",next.id);
  }
  function navigate(next: typeof view) {
    if (next !== "training") pauseAll();
    openRoute(next,next==="training"&&selectedSession&&sessionView(selectedSession)!=="training"?null:undefined);
  }
  useEffect(()=>{
    requestId.current++;
    setMobileMenu(false);
    setMessageEdit(null);
    setStatementError("");
    setStatementBusy(false);
    if(view!=="training"){pauseAll();return;}
    if(!loaded || !current)return;
    const restored=sessionsRef.current.find(s=>s.id===current);
    if(!restored){openRoute("training",null,true);setToast("这条训练记录不存在或不属于当前账号，请重新选择。");return;}
    const restoredView=sessionView(restored);
    if(restoredView!=="training"){
      openRoute(restoredView,restored.id,true);
      return;
    }
    const timestamp=Date.now();
    setSessions(previous=>previous.map(s=>s.id===current
      ? s.outcome==="training"&&!s.startedAt?{...s,startedAt:timestamp}:s
      : s.startedAt?{...s,elapsed:s.elapsed+Math.max(0,Math.floor((timestamp-s.startedAt)/1000)),startedAt:null}:s));
    if(!restored.statement)void loadStatement(restored.problem,restored.id);
  },[view,current,loaded,loadStatement,openRoute,pauseAll,setSessions]);
  function start(p: Problem) {
    if (!loaded) {
      setToast("训练记录尚未加载，请稍后重试");
      return;
    }
    pauseAll();
    const previous = sessions.find(
      (s) => sessionView(s)==="training" && s.problem.id === p.id && s.outcome === "training",
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
    const view=sessionView(s);
    if(view==="assistant"){openAssistantConversation(s.id);return;}
    if(view==="lesson"){startLesson(s.lesson!.topicId);return;}
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
      const d = await api<Bank>("/api/problems?" + params);
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
      const local=readBrowserModels(user.id).find(m=>m.id===modelId);
      if(local){
        const cacheKey="icpc-browser-translation:"+user.id+":"+session.problem.id;
        let cached:{text:string;original:string;model:string}|null=null;try{cached=JSON.parse(localStorage.getItem(cacheKey)||"null");}catch{/* intentionally ignored */}
        if(!forceRefresh&&cached?.original===original){setTranslations(prev=>({...prev,[id]:cached}));return;}
        const {masked,kept}=protectStatement(splitStatement(original).text);
        const result=await browserCompletion(user.id,local,{...browserModelPayload(local,reasoningEffort),messages:[{role:"system",content:translationInstructions},{role:"user",content:masked}]});
        const value={text:restoreStatement(result.text,kept),original,model:local.model};
        try{localStorage.setItem(cacheKey,JSON.stringify(value));}catch{/* intentionally ignored */}
        setTranslations(prev=>({...prev,[id]:value}));return;
      }
      const data = await api<TranslateResponse>("/api/translate", {
        method: "POST",
        body: {
          text: splitStatement(original).text,
          problemId: session.problem.id,
          modelId,
          reasoningEffort,
          forceRefresh,
        },
      });
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
    if (!isAssistant&&session.statement.trim().length < 60) {
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
      lesson:ui("请开始讲解当前学习阶段，结合小例子逐步推进；如果是小测，先提问并等待我的回答。"),
      practice:ui("请根据当前讨论的知识点和我的等级分推荐几道练习，并说明筛选依据；没有题面时不要编造具体解法。"),
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
    generationSessionId.current=id;
    sending.current=true;submittingJob.current=true;
    sendStartedAt.current=Date.now();
    setBusy(true);
    setPartialReply(null);
    setChatRequestId("");
    setChatError("");
    if (!edit && (!retry || draft.trim() === content)) setDraft("");
    setMessageEdit(null);
    patch(id, {
      messages,
      ...(session.kind==="assistant"&&!session.lesson?{assistantArchived:false,...(!session.messages.length&&(!session.assistantTitle||session.assistantTitle==="新对话")?{assistantTitle:content.replace(/\s+/g," ").slice(0,36)}:{})}:{}),
      ...(revised ? {messagesVersion, recoveredVersions: revised.recoveredVersions} : {}),
      ...(mode.startsWith("hint")
        ? { hints: Math.max(session.hints, Number(mode.slice(-1))) }
        : {}),
      ...(mode === "solution" ? { hints: 4 } : {}),
    });
    const browserModel=readBrowserModels(user.id).find(m=>m.id===modelId);
    if(browserModel){
      const controller=new AbortController();directAbort.current=controller;directGeneration.current=true;
      activeJob.current=null;setRetryMode(mode);
        // Stream deltas arrive up to dozens of times per second; coalesce them
        // into one state update per tick so markdown re-renders stay bounded.
        let bufferText="",bufferReasoning="",flushTimer:ReturnType<typeof setTimeout>|undefined;
        const flushPartial=()=>{
          flushTimer=undefined;
          if(!bufferText&&bufferReasoning===undefined)return;
          setPartialReply(previous=>({
            sessionId:id,
            text:previous?.sessionId===id?previous.text+bufferText:bufferText,
            reasoning:bufferReasoning===undefined
              ?(previous?.sessionId===id?previous.reasoning:undefined)
              :(previous?.sessionId===id?previous.reasoning||"":"")+bufferReasoning,
          }));
          bufferText="";bufferReasoning="";
        };
        const schedulePartial=()=>{if(flushTimer===undefined)flushTimer=setTimeout(flushPartial,120);};
        const drainPartial=()=>{if(flushTimer!==undefined){clearTimeout(flushTimer);flushPartial();}};
      try{
        const expected=conversationBranch({messages,messagesVersion});
        const prepared=await api<PreparedCoachRequest>("/api/coach",{method:"POST",signal:controller.signal,body:{prepareOnly:true,browserModel:browserModelMetadata(browserModel),assistant:isAssistant,useLearningMemory:session.useLearningMemory!==false,lesson:session.lesson,assistantProfile:session.assistantProfile,statement:splitStatement(session.statement).text,problem:`${session.problem.id} ${session.problem.name}`,problemId:session.problem.id,allowUnverified,language:currentLocale(),notes:session.notes,reasoningEffort,mode,messages:messages.slice(-30).map(({role,content})=>({role,content}))}});
        if(prepared.editorial)patch(id,{editorialReference:prepared.editorial});
        const result=await browserCompletion(user.id,browserModel,prepared.payload,{signal:controller.signal,
          delta:text=>{bufferText+=text;schedulePartial();},
          reasoning:text=>{bufferReasoning=(bufferReasoning||"")+text;schedulePartial();},
        });
        drainPartial();
        const job:CoachJob={id:"browser-"+crypto.randomUUID(),sessionId:id,branchHash:"",status:"done",text:result.text,reasoning:result.reasoning||"",result:{...result,editorial:prepared.editorial,sources:prepared.sources,lesson:prepared.lesson},createdAt:new Date().toISOString()};
        setSessions(prev=>prev.map(s=>s.id===id?applyJobReply(s,job,conversationBranch(s)===expected):s));setPartialReply(null);
      }catch(error){drainPartial();setChatError(controller.signal.aborted?"已停止生成，未完成内容未写入历史。":(error as Error).message);if(!edit&&!retry)setDraft(content);}
      finally{directAbort.current=null;directGeneration.current=false;submittingJob.current=false;sending.current=false;setBusy(false);pollJobs.current();}
      return;
    }
    const jobId=crypto.randomUUID();activeJob.current=jobId;
    setRetryMode(mode);
    try {
      const hash=await branchHash(conversationBranch({messages,messagesVersion}));
      await api("/api/coach-jobs",{
        method:"POST",
        body:{jobId,sessionId:id,branchHash:hash,assistant:isAssistant,useLearningMemory:session.useLearningMemory!==false,lesson:session.lesson,assistantProfile:session.assistantProfile,sessionSnapshot:{...session,messages:messages.map(({role,content,generationId,lessonStage})=>({role,content,...(generationId?{generationId}:{}),...(lessonStage?{lessonStage}:{})})),messagesVersion,startedAt:null,elapsed:session.elapsed+(session.startedAt?Math.max(0,Math.floor((Date.now()-session.startedAt)/1000)):0),hints:mode==="solution"?4:mode.startsWith("hint")?Math.max(session.hints,Number(mode.slice(-1))):session.hints,recoveredVersions:undefined},statement:splitStatement(session.statement).text,problem:`${session.problem.id} ${session.problem.name}`,problemId:session.problem.id,allowUnverified,language:currentLocale(),notes:session.notes,modelId,reasoningEffort,mode,messages:messages.slice(-30).map(({role,content})=>({role,content}))},
      });
    }catch(error){setChatError((error as Error).message);if(!edit&&!retry)setDraft(content);}
    finally{submittingJob.current=false;pollJobs.current();}
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
      elapsed:
        session.elapsed +
        (session.startedAt
          ? Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000))
          : 0),
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
      <WorkspaceSidebar
        user={user}
        view={view}
        isLesson={isLesson}
        mobileMenu={mobileMenu}
        closeMobileMenu={() => setMobileMenu(false)}
        navigate={navigate}
        hasActiveTraining={trainingSessions.some(s=>s.outcome==="training")}
        aiConfigured={aiConfigured}
        setRatingModal={setRatingModal}
        setPasswordModal={setPasswordModal}
        setSettings={setSettings}
        pauseAllAndLogout={async () => { pauseAll(); await save(); await logout(); }}
      />
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
                  : view === "assistant" ? ui("算法助教") : ["lesson","lessons"].includes(view) ? ui("专题学习") : view === "statistics"
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
        {(view==="lessons"||(isLesson&&!session&&loaded))&&<LessonLibrary sessions={sessions} ready={loaded} onStart={startLesson} onMasteryChange={(topicId,mastered)=>setSessions(previous=>setLessonMastered(previous,topicId,mastered))}/>}
        {view === "bank" && (
          <BankView
            bank={bank}
            loading={loading}
            bankError={bankError}
            cfRating={cfRating}
            preset={preset}
            min={min}
            setMin={setMin}
            max={max}
            setMax={setMax}
            tags={tags}
            setTags={setTags}
            query={query}
            setQuery={setQuery}
            sort={sort}
            setSort={setSort}
            page={page}
            setPage={setPage}
            hideTags={hideTags}
            setHideTags={setHideTags}
            exclude={exclude}
            setExclude={setExclude}
            summaryCompleted={summary.completedProblems}
            summaryIndependent={summary.independentProblems}
            totalMinutes={totalMinutes}
            doneIds={doneIds}
            random={random}
            start={start}
            setRatingModal={setRatingModal}
          />
        )}
        <ChatView
          view={view}
          isAssistant={isAssistant}
          isLesson={isLesson}
          session={session}
          loaded={loaded}
          syncState={syncState}
          trainingSessions={trainingSessions}
          resume={resume}
          navigate={navigate}
          assistantChats={assistantChats}
          openAssistantConversation={openAssistantConversation}
          newAssistantConversation={newAssistantConversation}
          updateAssistantConversation={updateAssistantConversation}
          onOpenMemory={()=>setMemoryOpen(true)}
          busy={busy}
          chatError={chatError}
          chatRequestId={chatRequestId}
          retryMode={retryMode}
          send={send}
          messageEdit={messageEdit}
          setMessageEdit={setMessageEdit}
          recallMessage={recallMessage}
          partialReply={partialReply}
          generationSessionId={generationSessionId}
          stopGeneration={stopGeneration}
          sendStartedAt={sendStartedAt}
          editor={editor}
          setEditor={setEditor}
          statementBusy={statementBusy}
          statementError={statementError}
          loadStatement={loadStatement}
          statementLanguage={statementLanguage}
          setStatementLanguage={setStatementLanguage}
          statementFont={statementFont}
          setStatementFont={setStatementFont}
          translation={translation}
          translating={translating}
          translationErrors={translationErrors}
          translateStatement={translateStatement}
          statementParts={statementParts}
          allowUnverified={allowUnverified}
          setAllowUnverified={setAllowUnverified}
          patch={patch}
          aiConfigured={aiConfigured}
          setSettings={setSettings}
          rememberLesson={rememberLesson}
          quoteLesson={quoteLesson}
          chatEnd={chatEnd}
          composerInput={composerInput}
          draft={draft}
          setDraft={setDraft}
          onFinish={() => { if (session) { setTakeaway(session.takeaway); setFinish(true); } }}
        />
        {view === "history" && (
          <HistoryView
            sessions={sessions}
            trainingSessions={trainingSessions}
            completed={completed}
            syncState={syncState}
            resume={resume}
            navigate={navigate}
            exportData={exportData}
            setSessions={setSessions}
            setToast={setToast}
          />
        )}
      </div>

      {ratingModal && <Modal label={ui("等级分设置")} closeLabel={ui("关闭等级分设置")} onClose={()=>setRatingModal(false)}><RatingForm rating={cfRating} onSaved={rating=>{setCfRating(rating);const next=ratingRange(rating);setMin(next.min);setMax(next.max);setPage(1);setRatingModal(false);setToast("个人等级分已保存，选题难度已更新");}}/><XcpcProfileForm/></Modal>}
      {passwordModal && (
        <Modal label={ui("修改密码")} closeLabel={ui("关闭修改密码")} onClose={()=>setPasswordModal(false)}>
          <PasswordForm
            done={() => {
              setPasswordModal(false);
              setToast("密码已更新，其他设备已退出登录");
            }}
          />
        </Modal>
      )}
      {memoryOpen&&<Modal label={ui("学习记忆")} className="learner-memory-modal" onClose={()=>setMemoryOpen(false)}><LearnerMemoryEditor onSaved={()=>{setMemoryOpen(false);setToast("学习记忆已保存");}}/></Modal>}
      {personalModelsOpen&&<Modal label={ui("本机模型 Key")} className="personal-model-panel" onClose={()=>{setPersonalModelsOpen(false);setSettings(true);}}><BrowserModelManager userId={user.id}/></Modal>}
      {settings && (
        <ModelSettingsModal
          user={user}
          models={models}
          modelId={modelId}
          setModelId={setModelId}
          modelName={model}
          setModelName={setModel}
          reasoningEffort={reasoningEffort}
          supportedEfforts={supportedEfforts}
          selectedModel={selectedModel}
          efforts={efforts}
          setEfforts={setEfforts}
          syncState={syncState}
          onClose={() => setSettings(false)}
          onManageKeys={() => { setSettings(false); setPersonalModelsOpen(true); }}
          onSaved={(preferences) => { setEfforts({...efforts, ...preferences.efforts}); setSettings(false); setToast(ui("已保存模型设置：{0}", [ui(reasoningLabels[reasoningEffort])])); }}
          onBrowserSaved={() => { setSettings(false); setToast("已保存本机模型设置"); }}
        />
      )}
      {finish && session && (
        <FinishModal
          session={session}
          takeaway={takeaway}
          setTakeaway={setTakeaway}
          complete={complete}
          onClose={() => setFinish(false)}
        />
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
