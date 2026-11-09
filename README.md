# 思维练习场 · ICPC Thinking Lab

Codeforces 选题与 AI 思维陪练。使用 Vinext / React，部署为 Cloudflare Worker。

## 本地运行

```bash
npm install
npm run dev
```

打开开发服务器打印的地址。在左下角「AI 设置」输入 OpenAI API Key 和账号可用模型 ID（默认 `gpt-4.1`）。Key 只在页面内存中保存，刷新后清除，通过本站服务端调用 `https://api.openai.com/v1/responses`，不写入本地存储或源码。模型调用消耗用户 API 额度。没有 Key 时可以筛选题目、计时、写草稿、保存记录，但不能生成 AI 回复。

## 功能

- 官方 CF problemset.problems API，按难度、标签交集、题号或题名筛选，分页、随机选题和排序。
- 默认隐藏题目标签。排除已完成训练的题，按本机手动记录判断，不代表 CF AC。
- CF API 不可用时回退到 `lib/cf-snapshot.json` 的真实题库快照，界面显示快照时间。
- 尝试读取 CF 题面。若被拦截或网络不可用，需要打开原题后手动粘贴完整题面、约束和样例。题面文本的公式格式可能丢失，以 CF 原题为准。
- 陪练包含思路讨论、三级提示、猜想检验、完整解法和复盘。每次仅发送当前题面、草稿和最近 30 条对话，API 参数 `store:false`。
- AI 回复支持 Markdown、表格、代码和 LaTeX。教练通过推导辅助训练，没有官方题解验证或代码执行能力。
- 每道题记录思考时间、草稿、对话、提示层级和结果。数据存在当前浏览器 localStorage，每 10 秒保存计时，离开训练或结束时立即保存。可导出 JSON。刷新后计时暂停。

## 验证与构建

```bash
npx tsc --noEmit
npm run build
```

API 输入校验、筛选、排除、随机选题及错误响应可通过本地 `/api/*` 检查。真实 AI 调用需要用户自己的 Key，部署时不内置凭据。

## 数据与接口

- CF API 文档：https://codeforces.com/apiHelp/methods#problemset.problems
- OpenAI 文本生成文档：https://developers.openai.com/api/docs/guides/text

`.openai/hosting.json` 保存站点身份，更新时复用。生产构建在 `dist/server/`。
