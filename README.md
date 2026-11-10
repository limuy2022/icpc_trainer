# 思维练习场 · ICPC Thinking Lab

**简体中文** | [English](README.en.md)

可自托管的 ICPC AI 思维陪练平台。按 Codeforces 难度和标签选题，通过讨论观察、分级提示、检验猜想和复盘，练习从「没思路」走到「再想一步」。适合个人和朋友小范围使用。

模型服务可配置，不绑定 GLM 或任何单一厂商。前端使用 React + TypeScript + Vite，后端使用 Node.js + SQLite。界面支持简体中文与 English 切换，入口位于登录页和侧栏，语言偏好保存在当前浏览器。首次访问按浏览器语言选择；后续陪练回答与新图示标签跟随所选语言。历史对话、草稿和题目原文不会被自动改写；题面的「中文译文」仍是独立的阅读选项。切换界面语言不调用模型。

## 功能

- Codeforces 题库按评分、标签、题号和题名筛选；个人等级分预设为 `rating−100` 至 `rating+300`。
- 获取题面、提取时间/内存限制、AI 中文翻译、原文对照和缓存；公式与样例保留。
- 分级提示、反例检验、复盘与按需完整解法；支持 LaTeX、代码高亮和消息编辑/撤回。
- AI 可在聊天中生成交互图示，也可点击「画图讲解」请求逐步演示。
- 训练记录、草稿、跨设备同步、JSON 导入导出、同难度用时趋势和模型调用/Token 统计。
- 管理员手动开户，无公开注册；后台管理多个模型、独立密钥和默认模型。
- 深浅主题、跟随系统、手机布局、SQLite 备份。

## 快速开始

需要 **Node.js ≥ 22.13** 和 **pnpm 12.17.0**（由 `packageManager` 固定）。

```bash
git clone https://github.com/limuy2022/icpc_trainer.git
cd icpc_trainer
pnpm install --frozen-lockfile
pnpm run build:standalone
mkdir -p data
cp .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

将生成的随机值填入 `.env.local` 的 `MODEL_ENCRYPTION_KEY`。模型变量可全部留空，首次登录后通过管理员面板配置。

创建首个管理员（生成随机密码，写入本地文件，不打印密码）：

```bash
cd release
printf '%s' '{"username":"admin","output":"../data/initial-admin.txt"}' | node --env-file=../.env.local admin.mjs init-admin
node --env-file=../.env.local server.mjs
```

访问 <http://127.0.0.1:5182>，使用 `data/initial-admin.txt` 中的凭据登录并修改密码。没有内置默认密码；管理员初始化仅运行一次。后续账号由管理员创建。

### 本地开发

支持的账号版应用使用独立 Node.js 后端。将 `.env.local` 的 `PORT` 设为 `5180`、`APP_ORIGIN` 设为 `http://127.0.0.1:5174`；从 `release/` 运行上述后端，再在仓库根目录另开终端：

```bash
pnpm run dev:standalone
```

访问 <http://127.0.0.1:5174>。前端热更新，`/api` 代理到后端；修改后端需重新构建并重启。`pnpm run dev` / `build` 及 Cloudflare/Sites 文件是早期脚手架入口，不是当前账号版的部署方式。

## 配置模型

### 推荐：管理员面板

登录后添加模型，填写显示名称、提供方、API Base URL、模型 ID 和 API Key。支持多个模型、不同服务商和不同密钥；可切换默认模型、停用模型。用户只选择已启用模型，无法读取密钥。

通用提供方使用 **OpenAI Chat Completions 兼容接口**：请求发送到 `Base URL + /chat/completions`，采用 Bearer 鉴权及标准 messages/content 响应。不直接支持仅提供 Responses API 或 Anthropic Messages 协议的接口，需要兼容网关。服务商自己的套餐和端点限制仍需自行确认。

Base URL 必须是标准公网 HTTPS 地址，不包含 `/chat/completions`、账号或查询参数，不支持 localhost/内网模型。示意：`https://api.example.com/v1`。GLM 也可以使用，但应选择 GLM 提供方以启用相应思考参数。

### 可选：环境变量初始化

```dotenv
AI_API_KEY=your-server-side-key
AI_BASE_URL=https://api.example.com/v1
AI_MODEL=your-model-id
AI_MODEL_LABEL=My coaching model
AI_PROVIDER=openai-compatible
```

这些是占位示例，不是可直接使用的服务。填写 `AI_API_KEY` 时，必须同时填写 `AI_BASE_URL` 与 `AI_MODEL`；`AI_PROVIDER` 可选 `openai-compatible`（默认）或 `glm`。

环境变量仅在数据库**没有任何模型**时创建首个模型，不会覆盖后台现有配置。环境密钥每次调用从服务端读取；修改环境密钥需重启服务。后续修改模型地址、名称或新增模型请使用后台。

旧的 `GLM_API_KEY` / `GLM_MODEL` 配置仍兼容。新初始化优先使用通用配置；已有 `builtin-glm` 模型继续读取旧 GLM 密钥，不会误用通用密钥。若要迁移旧模型，可在后台给它保存新 Key，或添加新的模型后切换默认模型。

推理等级按账号和模型保存。通用接口默认不发送额外推理参数，非默认等级使用 `reasoning_effort`，要求服务商支持；不支持时选「模型默认」。GLM 使用型号对应的思考参数。所选模型和等级用于后续陪练，以及首次翻译或明确请求重新翻译；阅读已有译文不受模型切换影响。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `PORT` | 本地示例 `5182`，生产示例 `18461`；只监听 `127.0.0.1` |
| `APP_ORIGIN` | 浏览器访问地址；生产环境填写自己的 HTTPS 域名 |
| `COOKIE_SECURE` | 本地 HTTP 为 `false`，生产 HTTPS 为 `true` |
| `DATABASE_PATH` | SQLite 路径，相对路径基于服务工作目录；生产建议绝对路径 |
| `MODEL_ENCRYPTION_KEY` | 64 位十六进制随机值，必须长期保存，用于加密后台模型密钥 |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | 可选的首个模型配置 |
| `AI_MODEL_LABEL` / `AI_PROVIDER` | 可选显示名称和提供方 |

密钥、数据库及环境文件不应进入 Git 或前端。后台密钥采用 AES-256-GCM 加密，密码采用带独立盐的 scrypt，数据库仅保存登录令牌哈希。**丢失加密主密钥后，数据库中的模型 Key 无法恢复。**

## 自托管部署

构建产物在 `release/`，生产只需 Node.js，不需要 pnpm。推荐代码与数据分离：

```text
~/apps/icpc-trainer/
├── current/             # release/ 内容，普通目录，仅保留一份构建
└── shared/
    ├── app.env          # 权限 0600
    ├── icpc.sqlite
    └── backups/
```

1. 将构建产物复制到 `current/`。将 `.env.example` 复制到 `shared/app.env`，填写独立随机加密密钥、自己的 `APP_ORIGIN`、`COOKIE_SECURE=true`、`PORT=18461` 和数据库绝对路径。
2. 从 `current/` 运行管理员初始化命令，将 `--env-file` 指向 `../shared/app.env`；初始凭据写入 `../shared/initial-admin.txt`。
3. `deploy/*.service` 使用 systemd 用户服务的 `%h`，默认安装位置为 `~/apps/icpc-trainer`，Node 路径为 `/usr/bin/node`；使用其他位置时先编辑模板。

```bash
mkdir -p ~/.config/systemd/user
cp deploy/icpc-trainer.service deploy/icpc-trainer-backup.service deploy/icpc-trainer-backup.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now icpc-trainer.service icpc-trainer-backup.timer
```

需要开机后无登录常驻时，由服务器管理员为部署账号启用 Linger。检查 `systemctl --user status icpc-trainer`，通过 Nginx/Caddy 等反向代理提供 HTTPS。

`deploy/icpc-trainer.nginx.conf` 是带占位符的模板。可根据服务器布局手动替换；可选的自动脚本适用于 Nginx 主配置内有顶层 `http {` 的系统，需先检查与已有站点的兼容性：

```bash
sudo env DOMAIN=trainer.example.com APP_PORT=18461 bash deploy/install-nginx.sh
```

脚本需要 Nginx、Certbot 和正确 DNS；会备份主配置、添加独立 include、申请证书（首次申请时按 Certbot 提示完成账号设置）并在 reload 前检查配置。默认 TLS 监听 `443`；已有 stream 分流时可显式设置 `TLS_LISTEN=127.0.0.1:8443`。不要直接复制与自己服务器不同的监听布局。

续期优先使用发行版现有 Certbot 定时任务。可选 `deploy/install-renewal.sh` **仅适用于提供 `certbot-renew.service/timer` 的系统**，它为所有 Certbot 证书启用续期，并添加 Nginx reload hook，不是单站点脚本。

可选 `python3 deploy/provision-env.py user@your-server --origin https://trainer.example.com` 通过隐藏输入创建初次配置，留空 Key 后从后台配置模型；它不会覆盖已有环境文件。使用环境模型时另传 `--base-url`、`--model`，Key 仍由隐藏输入提供。

### 更新

已有上述目录、服务和备份任务后，在本地运行：

```bash
bash deploy/update.sh user@your-server
# 自定义远端目录、健康检查端口（服务配置也需匹配）：
bash deploy/update.sh user@your-server /srv/icpc-trainer 18461
```

脚本构建、上传并验证临时包，先备份数据库，再短暂停止应用、替换 `current/` 并检查健康状态。不保留旧构建，失败时从 Git 重新构建所需提交。更新不会修改 Nginx、证书或模型环境文件。

## 数据与统计口径

- 训练按账号保存到 SQLite（WAL），浏览器保留未同步副本。编辑停止约 1 秒后保存，计时约 10 秒同步；离开前确认「已保存到服务器」。尚未发送的聊天输入不保存。
- 并发保存进行版本比较和合并，冲突内容保留在历史版本中。支持个人 JSON 导入导出；编辑/撤回消息不退回已消耗的 Token 或提示等级。
- 备份程序在数据库旁的 `backups/` 保存最近 14 份；每日自动备份需启用上述 timer。后台可下载备份，同机备份不能替代异地备份。恢复前停止服务，并保留现有数据库与 WAL/SHM；使用匹配的加密主密钥。
- 用时趋势按精确 CF 题目评分展示，默认排除重做，使用训练计时器（含讨论），并非 CF 提交时间。少量样本不应当作能力结论。
- 调用量与 Token 按接口实际返回记录，缺失用量标记为未报告；成员只看自己的数据，管理员可查看站点用量。

## 题目、AI 与限制

题库使用 [Codeforces API](https://codeforces.com/apiHelp/methods#problemset.problems)；不可用时使用随仓库提供的快照并显示时间。题面优先读取原站，受阻时尝试[非官方公开存档](https://github.com/codewithsathya/codeforces-problems)，并标注来源；均失败时可手动粘贴。题面缓存七天，刷新失败保留旧缓存。

陪练回复前会从题目页的 Contest materials → Tutorial/Editorial 定位官方博客，使用 CF `blogEntry.view` 读取正文，并按题号提取当前题的小节；题目原页受阻时可用公共题面存档发现链接，但题解正文仍来自 CF 官方接口。不会用社区题解冒充官方，也不会把整场题解或评论发给模型。无法明确匹配题号时视为未获取。

题解只在服务端作为参考注入，不直接展示解法；陪练仍遵守分级提示，不因其他做法与题解不同就判错。聊天显示最近一次回复的参考状态和带剧透提示的来源链接。题解缓存七天，刷新失败可使用明确标记的旧缓存；失败请求短暂冷却，避免反复抓取。首次获取最多额外等待约 18 秒。

默认未获取官方题解时不调用模型。用户可显式勾选「允许无题解推导」，此时界面及回复会标注未核验。题解格式不统一、仅有视频或 CF 访问受阻时可能无法读取。官方题解能减少模型误判，但不能保证证明、反例或可视化绝对正确。

标题与时间/内存限制单独存储，只有正文发给翻译和陪练模型。译文保护公式、样例与插图，可随时对照原文。题面、草稿和对话会发送给所选服务商；AI 可能出错，本项目不提供在线判题。

交互图示通过 `icpc-visual` 围栏承载 HTML/SVG/JavaScript，在无同源权限的隔离 iframe 中运行，CSP 限制网络请求，只对 AI 回复启用。支持重新演示和查看源码；图示准确性取决于模型。

洛谷风格彩色难度是基于 CF 题目分数的**近似分档**，不是官方评级或选手等级分换算。分界见 [`lib/difficulty.ts`](lib/difficulty.ts)。

## 验证与贡献

```bash
pnpm exec tsc --noEmit
pnpm run build:standalone
node --test server/*.test.mjs
```

欢迎提交 Issue 和 PR。请提供复现步骤、Node/pnpm 版本和已脱敏的错误信息；不要提交 Key、真实环境文件、数据库或用户对话。变更依赖请使用 pnpm，并提交 `pnpm-lock.yaml`。

## 许可

代码采用 [MIT License](LICENSE)。依赖及第三方文件遵循各自许可证，见 `vendor/` 与 `scripts/vite/`。Codeforces 题目、题面和插图的权利归原作者或权利人所有，不因本项目的 MIT 许可而改变。

### 聊天连接与排错

陪练使用流式回答与心跳，收到文字即显示；模型生成最长等待 180 秒。只有明确完成的回复写入对话，断流或输出达到上限时显示诊断、保留已收到的临时文字，并允许重试。临时未完成回复不作为下一轮的模型上下文。

后台最近调用记录包含请求编号、耗时、错误分类和结束原因，用于区分上游 HTTP 失败、网络/超时、空回复、无效数据及输出限制。服务日志仅输出这些诊断字段，不记录 Key、完整提示词或对话正文。历史调用没有诊断字段时显示为空，不根据旧 HTTP 状态臆测具体原因。

### 页面位置恢复

导航会更新网址片段，如 `#/history`、`#/statistics`、`#/training/<session-id>`。刷新、直接打开书签及浏览器前进/后退会恢复对应页面；训练页等待当前账号记录加载后恢复选中的训练，计时仅从恢复后继续，不计离线时间。没有明确网址片段时，使用该账号在当前浏览器保存的上次位置。管理页仍需管理员权限；失效或非本账号训练链接会回到训练选择界面并提示。

### 常用厂商预设

管理员面板 → 模型管理 → 添加/编辑模型提供常用厂商列表：OpenAI、DeepSeek、智谱 GLM（普通 API / Coding Plan）、阿里云百炼（北京 / 新加坡）、Moonshot/Kimi、硅基流动和 OpenRouter。预设自动填写 Base URL 与接口类型，旁边附官方文档链接；模型 ID 按账号权限填写，仍支持自定义接口地址。预设来源集中在 `lib/model-presets.ts`，核验于 2026-11-10。

切换到不同地址的预设会清空未保存的 Key 和模型 ID；编辑已有模型并更换接口地址时，服务端也要求重新填写 Key。仅修改显示名称或模型 ID、接口地址不变时，可留空保留原密钥。

### 自动获取模型 ID

添加/编辑模型时，填写 Base URL 和 API Key 后点击「获取模型列表」，服务端通过兼容接口的 `GET /models` 返回模型 ID，可在下拉列表中选择，仍可手动输入。编辑已有模型且地址未变时，可留空 Key，使用服务端已保存的密钥查询；更换地址必须重新填写 Key。更改地址或 Key 会清除旧查询结果，避免串用其他厂商列表。

此功能仅限管理员，不生成回答、不计入陪练调用量；返回内容只保留去重后的模型 ID，不转发原始响应或密钥。部分厂商不提供模型目录、权限不同或目录中含非聊天模型时，请按厂商文档确认后手动填写。

### 译文跨模型复用

已有中文译文按题号与题面正文复用，切换陪练模型、推理等级或刷新页面不会自动重新生成。正文发生变化时才视为新的翻译内容；仅头部元信息、行尾格式或首尾空白变化不会失效。旧缓存仅在能验证其原始正文哈希时接入复用，不按题号盲目复用不同题面版本。

译文显示实际生成它的模型。需要新模型的版本时，点击「用当前模型重新翻译」；等待期间保留原译文，失败时也不会删除原译文。同一正文的并发首次请求共享一次生成。
