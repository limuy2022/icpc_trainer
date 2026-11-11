"use client"
import { t as ui, currentLocale, useLocale } from "@/lib/locale"
import type { AdminUserRow } from "@/lib/api-types"
import Modal from "@/components/workspace/modal"
import { Plus, Users } from "lucide-react"
import { useState } from "react"
import type { AdminMutation } from "./panel-types"

/** Account administration table plus the manual account creation modal. */
export default function UsersSection({
  users,
  busy,
  error,
  mutate,
}: {
  users: AdminUserRow[]
  busy: boolean
  error: string
  mutate: AdminMutation
}) {
  useLocale()
  const [userForm, setUserForm] = useState(false),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("member")
  return (
    <section className="admin-section">
      <div className="panel-heading">
        <h2>
          <Users size={17} />
          {ui("账号管理")}
        </h2>
        <button
          className="primary"
          onClick={() => {
            setUserForm(true)
            setUsername("")
            setPassword("")
            setRole("member")
          }}
        >
          <Plus size={15} />
          {ui("添加账号")}
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{ui("账号")}</th>
              <th>{ui("权限")}</th>
              <th>{ui("网站模型")}</th>
              <th>{ui("状态")}</th>
              <th>{ui("最近登录")}</th>
              <th>{ui("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.role === "admin" ? ui("管理员") : ui("成员")}</td>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={ui("允许 {0} 使用网站密钥", [u.username])}
                      checked={
                        u.role === "admin" || Boolean(u.site_model_access)
                      }
                      disabled={busy || u.role === "admin"}
                      onChange={(e) =>
                        void mutate(
                          "/api/admin/users",
                          { id: u.id, site_model_access: e.target.checked },
                          "PATCH",
                        )
                      }
                    />
                    {ui("允许使用网站密钥")}
                  </label>
                </td>
                <td>
                  {u.disabled
                    ? ui("已停用")
                    : u.must_change_password
                      ? ui("待设置密码")
                      : ui("正常")}
                </td>
                <td>
                  {u.last_login
                    ? new Date(u.last_login).toLocaleString(currentLocale())
                    : "—"}
                </td>
                <td>
                  <button
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        "/api/admin/users",
                        { id: u.id, disabled: !u.disabled },
                        "PATCH",
                      )
                    }
                  >
                    {u.disabled ? ui("启用") : ui("停用")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const newPassword = window.prompt(
                        ui(
                          "输入临时新密码，对方下次登录必须修改。此处不会显示旧密码。",
                        ),
                      )
                      if (newPassword)
                        void mutate(
                          "/api/admin/users",
                          { id: u.id, password: newPassword },
                          "PATCH",
                        )
                    }}
                  >
                    {ui("重置密码")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {userForm && (
        <Modal
          label={ui("添加账号")}
          closeLabel={ui("关闭添加账号")}
          onClose={() => setUserForm(false)}
        >
          <form
            className="account-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                await mutate(
                  "/api/admin/users",
                  { username, password, role },
                  "POST",
                )
              ) {
                setUserForm(false)
                setPassword("")
              }
            }}
          >
            <h2>{ui("手动添加账号")}</h2>
            <label>
              {ui("用户名")}
              <input
                required
                pattern="[a-zA-Z0-9_.\-]{3,40}"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              {ui("临时密码")}
              <input
                type="password"
                autoComplete="new-password"
                required
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => setPassword("123456")}
            >
              {ui("使用默认密码 123456")}
            </button>
            <label>
              {ui("权限")}
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">{ui("成员")}</option>
                <option value="admin">{ui("管理员")}</option>
              </select>
            </label>
            <p>{ui("首次登录必须修改临时密码。")}</p>
            {error && <div className="form-error">{ui(error)}</div>}
            <button className="primary" disabled={busy}>
              {ui("创建账号")}
            </button>
          </form>
        </Modal>
      )}
    </section>
  )
}
