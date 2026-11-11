"use client"
import LanguageSwitch from "@/components/language-switch"
import ThemeSwitch from "@/components/theme-switch"
import { t as ui, useLocale } from "@/lib/locale"
import type { Account } from "@/lib/types"
import type { WorkspaceView } from "@/lib/workspace-route"
import {
  BarChart3,
  BookOpen,
  Code2,
  History,
  LogOut,
  MessageCircle,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react"

/** Primary workspace navigation: views, personal shortcuts, account footer. */
export default function WorkspaceSidebar({
  user,
  view,
  isLesson,
  mobileMenu,
  closeMobileMenu,
  navigate,
  hasActiveTraining,
  aiConfigured,
  setRatingModal,
  setPasswordModal,
  setSettings,
  pauseAllAndLogout,
}: {
  user: Account
  view: string
  isLesson: boolean
  mobileMenu: boolean
  closeMobileMenu: () => void
  navigate: (view: WorkspaceView) => void
  hasActiveTraining: boolean
  aiConfigured: boolean
  setRatingModal: (open: boolean) => void
  setPasswordModal: (open: boolean) => void
  setSettings: (open: boolean) => void
  pauseAllAndLogout: () => Promise<void>
}) {
  useLocale()
  return (
    <>
      {mobileMenu && (
        <button
          className="mobile-menu-backdrop"
          aria-label={ui("关闭导航")}
          onClick={closeMobileMenu}
        />
      )}
      <aside
        id="workspace-navigation"
        className={"sidebar" + (mobileMenu ? " mobile-open" : "")}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a"))
            closeMobileMenu()
        }}
      >
        <button
          className="mobile-menu-close"
          aria-label={ui("收起导航")}
          onClick={closeMobileMenu}
        >
          <X size={22} />
        </button>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            navigate("bank")
          }}
        >
          <span className="brand-icon">
            <Code2 size={25} />
          </span>
          <span>
            {ui("思维练习场")}
            <small>ICPC THINKING LAB</small>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            { id: "bank", icon: BookOpen, label: ui("发现题目") },
            { id: "training", icon: MessageCircle, label: ui("思维陪练") },
            { id: "assistant", icon: Sparkles, label: ui("算法助教") },
            { id: "lessons", icon: BookOpen, label: ui("专题学习") },
            { id: "history", icon: History, label: ui("训练记录") },
            { id: "statistics", icon: BarChart3, label: ui("训练统计") },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={
                view === id || (id === "lessons" && isLesson)
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => navigate(id as WorkspaceView)}
            >
              <Icon size={19} />
              {ui(label)}
              {id === "training" && hasActiveTraining && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">{ui("一点训练共识")}</span>
          <p>
            {ui("先有一个观察，")}
            <br />
            {ui("再向答案走一步。")}
          </p>
          <span>{ui("允许卡住，也允许猜错。")}</span>
          <div className="note-line" />
        </div>
        <div className="sidebar-bottom">
          <div className="appearance-controls">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
          {user.role === "admin" && (
            <button
              className={view === "admin" ? "nav-item active" : "nav-item"}
              onClick={() => navigate("admin")}
            >
              <ShieldCheck size={18} />
              {ui("管理员面板")}
            </button>
          )}
          <button className="nav-item" onClick={() => setRatingModal(true)}>
            <Target size={18} />
            {ui("个人等级分")}
          </button>
          <button className="nav-item" onClick={() => setPasswordModal(true)}>
            <Settings2 size={18} />
            {ui("修改密码")}
          </button>
          <button className="nav-item" onClick={() => void pauseAllAndLogout()}>
            <LogOut size={18} />
            {ui("退出登录")}
          </button>
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={18} />
            {ui("陪练模型")}
            <span className={aiConfigured ? "connection on" : "connection"} />
          </button>
          <div className="profile">
            <div className="avatar">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <div>
              {user.username}
              <small>
                {user.role === "admin" ? ui("管理员") : ui("训练成员")}{" "}
                {ui("· 记录保存到服务器")}
              </small>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
