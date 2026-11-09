# 思维练习场 · ICPC Thinking Lab

Codeforces 选题与 AI 思维陪练。使用 Vinext / React，部署为 Cloudflare Worker。

## 本地运行

```bash
npm install
npm run dev
```

线上使用 GLM Coding Plan 专用地址 `https://open.bigmodel.cn/api/coding/paas/v4/chat/completions`，模型默认为 `GLM-5.3`。服务端通过 Cloudflare runtime `env.GLM_API_KEY` 读取密钥，`GLM_MODEL` 可设置模型。部署时用 Sites 的加密环境变量配置，禁止将真实密钥写入源码、manifest、客户端代码或构建产物。

本地开发可在未跟踪的 `.dev.vars` 中配置 `GLM_API_KEY`、`GLM_MODEL`。页面 `/api/config` 只返回是否已配置、服务商和模型名称，浏览器不能读取密钥。当前站点保持仅所有者可访问。题面、草稿和最近对话会发送给智谱。

智谱官方说明 Coding Plan 限于指定工具与产品，自建网站应使用标准 API 服务。当前按用户明确要求连接 Coding 专用接口并验证了可响应，不自动切换标准接口或其他付费端点。接口连通不保证套餐适用性与计费归属，须以智谱官方规定为准。

## 功能

- 官方 CF problemset.problems API，按难度、标签交集、题号或题名筛选，分页、随机选题和排序。
- 默认隐藏题目标签。排除已完成训练的题，按本机手动记录判断，不代表 CF AC。
- CF API 不可用时回退到 `lib/cf-snapshot.json` 的真实题库快照，界面显示快照时间。
- 尝试读取 CF 题面。若被拦截或网络不可用，需要打开原题后手动粘贴完整题面、约束和样例。题面文本的公式格式可能丢失，以 CF 原题为准。
- 陪练包含思路讨论、三级提示、猜想检验、完整解法和复盘。每次仅发送当前题面、草稿和最近 30 条对话，通过 Chat Completions 调用。
- AI 回复支持 Markdown、表格、代码和 LaTeX。教练通过推导辅助训练，没有官方题解验证或代码执行能力。
- 每道题记录思考时间、草稿、对话、提示层级和结果。数据存在当前浏览器 localStorage，每 10 秒保存计时，离开训练或结束时立即保存。可导出 JSON。刷新后计时暂停。

## 验证与构建

```bash
npx tsc --noEmit
npm run build
```

API 输入校验、筛选、排除、随机选题及错误响应可通过本地 `/api/*` 检查。真实 AI 调用依赖运行时加密配置，部署包不内置凭据。

## 数据与接口

- CF API 文档：https://codeforces.com/apiHelp/methods#problemset.problems
- GLM Coding Plan 文档：https://docs.bigmodel.cn/cn/coding-plan/quick-start
- GLM 套餐适用说明：https://docs.bigmodel.cn/cn/coding-plan/faq

`.openai/hosting.json` 保存站点身份，更新时复用。生产构建在 `dist/server/`。
