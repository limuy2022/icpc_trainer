# 思维练习场 · ICPC Thinking Lab

面向 OI → ICPC 过渡的私人 AI 思维陪练平台：按 Codeforces 难度与标签选题，通过表达观察、分级提示、检验猜想和复盘训练解题思维。

React + TypeScript 前端、Node.js 服务、SQLite 持久化。支持管理员手动开户、模型管理、中英题面、公式渲染、深浅主题和手机浏览器布局。

## 本地快速开始

需要 Node.js >= 22.13 和 npm。

```bash
git clone git@github.com:limuy2022/icpc_trainer.git
cd icpc_trainer
npm ci
npm run build:standalone
mkdir -p data
cp .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

将最后生成的随机值填入 `.env.local` 的 `MODEL_ENCRYPTION_KEY`，长期保存，不要提交。可选填写自己的 `GLM_API_KEY`，也可以登录后在管理面板添加模型。

创建首个管理员（自动生成密码，写入本地文件）：

```bash
cd release
printf '%s' '{"username":"admin","output":"../data/initial-admin.txt"}' | node --env-file=../.env.local admin.mjs init-admin
node --env-file=../.env.local server.mjs
```

打开 <http://127.0.0.1:5182>，使用 `data/initial-admin.txt` 中的凭据登录，按页面提示设置密码。没有公开注册入口，也没有内置默认密码。管理员初始化只运行一次。

前端热更新开发时，将 `.env.local` 中的 `PORT` 改为 `5180`、`APP_ORIGIN` 改为 `http://127.0.0.1:5174`，重新启动后端，再在项目根目录另开终端运行 `npm run dev:standalone`，访问 `http://127.0.0.1:5174`。Vite 会将 `/api` 代理到本地 5180 端口。生产环境使用下面的独立部署方式。


## 账号与管理

只接受管理员手动开户，没有注册接口。密码使用独立随机盐的 scrypt 哈希。登录令牌为随机值，数据库只存令牌哈希。生产 Cookie 为 HttpOnly、Secure、SameSite=Lax。首次登录或管理员重置密码后必须设置自己的密码。停用账号或重置密码会撤销旧会话。

管理员面板提供添加/停用账号、重置密码，添加/编辑/切换默认模型，以及调用记录、操作记录和数据库备份。成员不能访问管理接口。模型 Key 只在服务端使用，后台保存的 Key 用 AES-256-GCM 加密，API 不返回原值。

## 数据

训练记录按账号存入 SQLite，启用 WAL、外键和写入锁等待。浏览器保留按账号隔离的未同步备份。保存使用版本比较和三方合并。保存响应丢失时可幂等重试；另一页面先保存时会读取最新版本并合并独立改动。并发草稿保留双方内容，其他字段的不同版本可在训练页“保留的版本”中查看。旧版冲突缓存会在重新加载时自动恢复。支持个人 JSON 导出、导入和旧版浏览器记录迁移。

服务端训练保存会在编辑停止 1 秒后触发，计时每 10 秒同步。尚未发送的对话输入不保存。退出页面前应确认显示“已保存到服务器”。数据库有每日备份，保留最近 14 份，管理员也可以下载完整 SQLite 备份。同一服务器上的备份不能替代异地备份。

## 独立部署构建

需要 Node.js >=22.13（推荐当前 LTS）。生产发布包没有额外 npm 运行依赖。

```bash
npm install
npm run build:standalone
node server/integration.test.mjs
node server/statement.test.mjs
node server/sync-translation.test.mjs
node server/statement-header.test.mjs
```

产物在 `release/`，不要把本地数据库或密钥打包进去。

环境变量配置在发布目录之外的权限 0600 文件中，参考以下变量名（不要提交真实值）：

```dotenv
PORT=18461
APP_ORIGIN=https://icpc.limuy.top
COOKIE_SECURE=true
DATABASE_PATH=/home/limuy/apps/icpc-trainer/shared/icpc.sqlite
MODEL_ENCRYPTION_KEY=64位十六进制随机密钥
GLM_API_KEY=服务端密钥
GLM_MODEL=GLM-5.3
```

`MODEL_ENCRYPTION_KEY` 必须长期保留，丢失后无法解密数据库中的模型 Key。GLM 环境密钥会在数据库还没有模型时作为默认模型加入。以后可通过后台配置其他 OpenAI Chat Completions 兼容模型。

从 `release/` 运行 `node --env-file=/absolute/path/app.env server.mjs`。服务只监听 127.0.0.1，TLS 由现有 Nginx 提供。

首次管理员初始化使用 `node --env-file=/absolute/path/app.env admin.mjs init-admin`，标准输入为 JSON。支持 username、password，以及用于写入初始密码的 output 文件路径。省略 password 会生成随机密码。初始凭据文件权限为 0600，密码不打印到日志。已有管理员时不能重复初始化。

## 更新应用（单份程序）

从 Git 检出需要部署的提交后，在本地运行：

```bash
bash deploy/update.sh limuy.top
```

脚本构建并上传临时包、在临时目录解包验证，先备份数据库，再短暂停止服务、替换 `current/` 并启动检查。成功后不保留旧代码版本，临时包和解包目录会清理。服务器没有 `releases/` 目录。失败时可从 Git 重新构建所需提交再部署；数据库和模型加密主密钥仍需通过独立备份保护，Git 不包含这些数据。

## 服务器布局与操作

- 应用 `/home/limuy/apps/icpc-trainer/current/` 为普通目录，只保留当前构建，不使用版本目录或软链接。
- 数据与环境配置 `/home/limuy/apps/icpc-trainer/shared/`。
- 用户服务 `icpc-trainer.service`，由 `systemctl --user` 管理，开机常驻依赖用户 Linger。
- 备份定时器 `icpc-trainer-backup.timer`，每天运行并保留最近 14 份。
- Nginx 新配置 `/etc/nginx/icpc-trainer.conf`。当前服务器 443 由已有 stream 转到 127.0.0.1:8443，新虚拟主机沿用此结构。

```bash
systemctl --user status icpc-trainer
journalctl --user -u icpc-trainer -n 50
systemctl --user restart icpc-trainer
systemctl --user start icpc-trainer-backup.service
```

部署目录中的 `deploy/install-nginx.sh` 需要 sudo。它先备份现有配置，只添加本项目独立 include，先测试再 reload，不改现有虚拟主机或 stream 分流。首次 TLS 证书通过现有 Certbot/ACME 账号申请，DNS 的 icpc 记录须已指向本服务器。证书申请失败时不会启用错误的 TLS 配置。

`deploy/install-renewal.sh` 由管理员用 sudo 执行，按用户要求启用服务器自带的 `certbot-renew.timer`，自动检查所有 Certbot 管理的证书。续期成功时执行 Nginx 配置检查和 reload。脚本也会做一次全站 staging dry-run；若有旧域名验证失败，定时器仍然启用，但应根据失败输出修复相应域名。

恢复数据库前，先停止应用和备份任务，将现有数据库及 WAL/SHM 文件保留到单独目录，再放回所选备份。恢复时必须使用匹配的加密主密钥配置。先验证备份后再覆盖运行数据。

## CF 和 AI

CF 题库按难度、标签交集、题号和题名筛选，API 不可用时显示快照来源和时间。CF 题面优先尝试原站；遇到网络拦截时，使用 Codeforces Pro 的公开题面存档 https://github.com/codewithsathya/codeforces-problems 。该来源非官方，界面会标注来源链接和读取时间。正文提取仅限 problem-statement 区域，不读取侧栏、题解或用户信息。数学公式和样例转为 Markdown 显示。读取成功后缓存到 SQLite 七天，过期刷新失败时保留旧缓存。两个来源都失败时仍可粘贴题面。

2026-11-09 核验存档目录有 11,450 个 HTML 文件，对本项目 11,194 道带 Rating 的题库快照覆盖 11,122 道，覆盖率约 99.36%。这是当次目录比对结果，不代表未来一直完整。读取按需进行，不批量下载整个存档。题面默认使用 17px 字体，可调至 15–22px。题面支持英文、中文译文和对照视图；首次点击中文译文使用当前陪练模型翻译，后续从服务器缓存读取。公式、样例代码块与插图在翻译前保护并在生成后原样恢复，不完整返回不会缓存。翻译为 AI 生成，仍可随时切回原文核对。

AI 回复支持 Markdown、表格、代码和公式。分级提示、检验猜想、复盘与完整解法均按需调用，不能代替实际判题。

GLM Coding Plan 的套餐适用范围由智谱规定。当前按用户要求使用 Coding 专用端点，不自动切换按量计费服务。

- CF API https://codeforces.com/apiHelp/methods#problemset.problems
- GLM 套餐 https://docs.bigmodel.cn/cn/coding-plan/faq

原有 `.openai/hosting.json` 保留旧 Sites 项目身份，当前账号版以独立 Node 部署为准，不覆盖旧站点。


## 开源许可与第三方内容

本项目代码采用 [MIT License](LICENSE)，版权归 limuy2022 所有。依赖及随仓库提供的第三方文件遵循各自许可证，参见 `vendor/` 和 `scripts/vite/` 中的许可文件。

Codeforces 题目、题面、插图及公共存档内容的权利归其原作者或权利人所有，不因本项目的 MIT 许可而改变。请遵守对应服务的使用条款。AI 译文和陪练回复可能有误，应结合原题核对。

## 洛谷风格难度估算

题库、训练页和训练记录在保留原始 CF 题目评分的同时，展示带“估”标记的彩色难度。使用洛谷现行八档体系，非洛谷对本题的实际评级，也不是选手 Rating 的换算。

| CF 题目评分 | 本站估算 |
| --- | --- |
| 800 | 入门（红） |
| 900–1100 | 普及-（橙） |
| 1200–1500 | 普及（黄） |
| 1600–1900 | 普及+/提高-（绿） |
| 2000–2200 | 提高（青） |
| 2300–2600 | 提高+/省选-（蓝） |
| 2700–3000 | 省选/NOI-（紫） |
| 3100+ | NOI/NOI+/CTS（黑） |

参考 [洛谷难度体系](https://help.luogu.com.cn/manual/luogu/problem/difficulty) 与 [社区难度对照表](https://www.luogu.com/article/my22kz4j)，核验于 2026-11-09。社区参考范围存在重叠，本站按表中分界统一归类；不同题目的思维和实现难度可能偏离估算。规则集中在 `lib/difficulty.ts`，可运行 `node server/difficulty.test.mjs` 验证边界。


题面读取时会把标题、时间限制、内存限制和输入输出文件方式从 HTML 头部提取为独立 `metadata`，训练记录保存在 `statementMetadata`；`text` / `statement` 只存正文。中英文界面共用这份信息栏，不让模型翻译限制字段。翻译和陪练接口在服务端再次拆分旧格式，发给模型的题面只包含正文；数据范围、输入输出格式说明及样例仍保留。翻译缓存使用新的正文版本键。首次启动新版时，在事务内迁移旧训练记录和题面缓存，保留草稿和对话并更新记录版本；迁移前请保留数据库备份。

相关回归检查：`node server/metadata-ai.test.mjs`、`node server/metadata-migration.test.mjs`。


## 用户训练与模型用量统计

导航中的“训练统计”展示当前账号完成题数、独立解出题数、训练与思考时间、讨论轮数、实际模型调用及输入/输出/总 Token；可按模型、用途和最近 30 天（北京时间）查看明细。管理员在“用户统计”查看各账号汇总，普通成员只能访问自己的 `/api/stats`。

- 完成题数按题号去重，仅“独立解出”“提示后解出”计入；训练中和待重练不计入完成。
- 每个实际发出的模型请求记一次，区分陪练、翻译、旧版未分类调用。HTTP 失败、超时和网络失败保留记录；缓存命中不新增调用，共享在途翻译只记实际发起者的一次调用。
- 优先保存接口报告的 `total_tokens`，未报告总量时仅在输入、输出均有效时相加。缺失或部分用量标记为“未报告完整用量”，不估算消耗。Token 是已知用量累计，不代表账单或套餐剩余额度。
- 历史输入/输出日志可以汇总，旧版没有保存的请求失败或 Token 无法补回。旧版总 Token 从已记录输入和输出相加，不推断用途。
- 模型名称随请求保存，删除模型配置后仍能查看后续日志中的历史模型名称；不保存模型密钥到用量表。

验证：`node server/model-request.test.mjs` 与 `node server/integration.test.mjs`。

Markdown 代码块支持 C/C++、Python、Java、JavaScript/TypeScript、Rust、Go、Shell 和 JSON 语法高亮，随深浅主题切换，并提供语言标签与复制按钮。支持 `cpp17` / `c++17` 等常见 C++ 标记；未标注语言或不支持的语言保持原文，`text` / 样例数据不做语言猜测。长行在代码块内部横向滚动。复制保留缩进与换行，公式分隔符处理不会改写代码块中的字符串。验证：`node server/markdown.test.mjs`。


聊天中每条用户消息提供“编辑”“撤回”。编辑保存后从修改处重新生成回复；撤回会将原内容放回输入框。两者都移除当前对话中受影响的后续消息，操作前提示范围，旧对话保存在“历史版本”中以便查看。回复生成期间禁用编辑/撤回；失败可重试回复。编辑保留输入框中原有未发送内容，撤回覆盖未发送内容前会询问。

编辑/撤回创建新的对话分支版本。跨页面同步时，旧分支不会重新追加到新分支；并发修改选择较新分支，另一份内容保存在历史版本。提示暴露等级与已发生的模型调用/Token 用量不回退。当前训练统计中的讨论轮数只统计当前分支。验证：`node server/conversation.test.mjs`、`node server/sync-translation.test.mjs`。

个人 CF 等级分可从导航或题库筛选区设置，保存到账号的 `users.cf_rating`，跨刷新和设备生效。下次加载默认按 `rating−100` 到 `rating+300` 筛选（按题库 800–3500 边界截取），非整百等级分保持精确范围。保存等级分立即应用新范围；手动筛选在当前页面保留，并提供“应用个人预设”按钮。留空恢复未设置状态与默认 1400–1800。`/api/profile` 只允许读取和修改当前账号的等级分，支持 0–5000 的整数。验证：`node server/rating-range.test.mjs` 与 `node server/integration.test.mjs`。

“训练统计”新增同难度用时曲线：选择精确 CF 题目评分与独立/提示后解出方式，查看单题用时、近 5 题滚动中位数和记录明细。默认排除同题重做，只取该题首次有效解出记录；可手动包含重做。未完成、待重练、非正用时、无有效日期的记录不进入图表。累计至少 6 条符合筛选的记录时，使用最近 N 题与此前 N 题中位数比较（N=min(5, floor(样本数/2))），少量样本不生成变化百分比。

新完成训练保存 `completedAt`；旧记录没有完成日期时使用 `createdAt` 并标明。图表使用训练计时器的累计时长（含讨论），不是 CF 提交耗时；曲线仅反映已解出样本，不能单独作为能力结论。图表按需加载，不增加题库首屏的图表代码开销。验证：`node server/time-trend.test.mjs`、`node server/integration.test.mjs`。
