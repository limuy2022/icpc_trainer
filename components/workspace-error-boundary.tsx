"use client"

import { Component, type ReactNode } from "react"
import { t as ui } from "@/lib/locale"

export default class WorkspaceErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="main-content">
        <div className="empty large-empty" role="alert">
          <h1>{ui("工作台加载遇到问题")}</h1>
          <p>{ui("请重新加载页面后再试。")}</p>
          <button className="primary" onClick={() => window.location.reload()}>
            {ui("重新加载")}
          </button>
        </div>
      </main>
    )
  }
}
