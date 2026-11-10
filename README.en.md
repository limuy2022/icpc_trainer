# ICPC Thinking Lab · 思维练习场

[简体中文](README.md) | **English**

A self-hosted AI coaching platform for ICPC problem solving. Find Codeforces problems by rating and tags, discuss observations, request progressive hints, test conjectures, and review your reasoning. Designed for individuals and small private groups.

Model providers are configurable: no GLM subscription or specific vendor is required. Built with React, TypeScript, Vite, Node.js, and SQLite. The interface supports **Simplified Chinese and English**, with selectors on the login page and in the sidebar. Preferences are saved in the current browser; first visits follow the browser language. New coaching replies and visualization labels follow your selected language. Existing conversations, notes, and original statements are preserved; Chinese statement translation remains a separate reading option. Switching the interface language does not call a model.

## Features

- Codeforces filters by rating, tags, problem ID, and title; personal rating presets from `rating−100` to `rating+300`.
- Problem retrieval, separate time/memory metadata, AI Chinese translation, side-by-side originals, and caching.
- Progressive hints, counterexamples, reviews, and optional full solutions; LaTeX, syntax highlighting, message editing and recall.
- Interactive explanations inside AI replies, with an explicit “画图讲解” (visual explanation) action.
- Saved sessions and notes, cross-device sync, JSON import/export, solve-time trends, model-call and token statistics.
- Public registration with personal API keys; administrators grant site-model access per account.
- Light/dark/system themes, mobile layouts, and SQLite backups.

## Quick start

Requires **Node.js ≥ 22.13** and **pnpm 12.17.0**, pinned in `packageManager`.

```bash
git clone https://github.com/limuy2022/icpc_trainer.git
cd icpc_trainer
pnpm install --frozen-lockfile
pnpm run build:standalone
mkdir -p data
cp .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set `MODEL_ENCRYPTION_KEY` in `.env.local` to the generated random value. You can leave all model settings empty and configure them in the admin panel after signing in.

Create the first administrator. A random password is written to a local file, never printed:

```bash
cd release
printf '%s' '{"username":"admin","output":"../data/initial-admin.txt"}' | node --env-file=../.env.local admin.mjs init-admin
node --env-file=../.env.local server.mjs
```

Open <http://127.0.0.1:5182>, sign in with the credentials in `data/initial-admin.txt`, and change the password. There is no built-in default password. Initialization runs once. Users can then register themselves, or administrators can create accounts.

### Development

The supported account-based application uses the standalone Node.js backend. Set `PORT=5180` and `APP_ORIGIN=http://127.0.0.1:5174` in `.env.local`, run the backend from `release/` as above, then open a second terminal in the repository root:

```bash
pnpm run dev:standalone
```

Visit <http://127.0.0.1:5174>. Vite provides frontend hot reload and proxies `/api` to the backend. Rebuild and restart for backend changes. The generic `dev` / `build` commands and Cloudflare/Sites files are legacy scaffolding, not the supported deployment for the account-based application.

## Model configuration

### Recommended: admin panel

Add a display label, provider, API Base URL, model ID, and API key. Multiple models and providers can have separate keys. Administrators can change the default or disable models; members can select enabled models but cannot read keys.

The generic provider uses **OpenAI Chat Completions-compatible APIs**: requests go to `Base URL + /chat/completions`, with Bearer authentication and standard messages/content responses. Responses-only APIs and Anthropic Messages APIs require a compatible gateway. Check your provider's endpoint and subscription rules.

The Base URL must be a public, standard HTTPS URL without `/chat/completions`, embedded credentials, or query parameters. Localhost/private-network models are not supported. Example placeholder: `https://api.example.com/v1`. GLM remains supported; select its provider option for GLM-specific thinking parameters.

### Optional: environment bootstrap

```dotenv
AI_API_KEY=your-server-side-key
AI_BASE_URL=https://api.example.com/v1
AI_MODEL=your-model-id
AI_MODEL_LABEL=My coaching model
AI_PROVIDER=openai-compatible
```

These are placeholders, not a working service. Setting `AI_API_KEY` requires both `AI_BASE_URL` and `AI_MODEL`. `AI_PROVIDER` accepts `openai-compatible` (default) or `glm`.

Bootstrap settings create a model **only when the database has no models**; they never overwrite admin configuration. Environment keys are read server-side for each call; restart after changing environment files. Use the panel to edit model endpoints/labels or add models later.

Legacy `GLM_API_KEY` / `GLM_MODEL` settings remain supported. Generic settings take precedence for new initialization. Existing `builtin-glm` rows keep using the legacy GLM key, never a different provider's generic key. To migrate, save a new key for the old model in the panel, or add a new model and make it the default.

Reasoning preferences are saved per account and model. Generic APIs receive no extra reasoning parameters by default; non-default levels send `reasoning_effort` and require provider support. Choose the default level if unsupported. GLM uses model-specific thinking parameters. The selected model and reasoning level apply to future coaching, initial translations, and explicit retranslation requests; reading existing translations is independent of model changes.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Local example: `5182`; production example: `18461`. Binds to `127.0.0.1` only. |
| `APP_ORIGIN` | Browser-facing origin; use your HTTPS domain in production. |
| `COOKIE_SECURE` | `false` for local HTTP; `true` for production HTTPS. |
| `DATABASE_PATH` | SQLite path; relative to the server working directory. Prefer an absolute path in production. |
| `MODEL_ENCRYPTION_KEY` | Persistent random 64-character hex key for stored model credentials. |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | Optional initial model configuration. |
| `AI_MODEL_LABEL` / `AI_PROVIDER` | Optional display label and provider. |

Keep keys, environment files, and databases out of Git and frontend bundles. Stored model credentials use AES-256-GCM; passwords use salted scrypt; only hashes of login tokens are stored. **Losing the encryption key makes stored model API keys unrecoverable.**

## Self-hosting

Build output is in `release/`. Production requires Node.js, with no pnpm runtime dependency. Keep code separate from persistent data:

```text
~/apps/icpc-trainer/
├── current/             # contents of release/, one ordinary directory
└── shared/
    ├── app.env          # mode 0600
    ├── icpc.sqlite
    └── backups/
```

1. Copy the build to `current/`. Copy `.env.example` to `shared/app.env`; set a new encryption key, your `APP_ORIGIN`, `COOKIE_SECURE=true`, `PORT=18461`, and the absolute database path.
2. Initialize the administrator from `current/`, using `--env-file=../shared/app.env` and writing credentials to `../shared/initial-admin.txt`.
3. The `deploy/*.service` templates use systemd's `%h` for the deployment user's home, defaulting to `~/apps/icpc-trainer` and `/usr/bin/node`. Edit them for different locations.

```bash
mkdir -p ~/.config/systemd/user
cp deploy/icpc-trainer.service deploy/icpc-trainer-backup.service deploy/icpc-trainer-backup.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now icpc-trainer.service icpc-trainer-backup.timer
```

A server administrator can enable Linger for the deployment account to run without an active login. Check `systemctl --user status icpc-trainer`. Provide HTTPS through a reverse proxy such as Nginx or Caddy.

`deploy/icpc-trainer.nginx.conf` contains placeholders for manual adaptation. The optional installer expects a top-level `http {` block in the Nginx main configuration; review compatibility with existing sites first:

```bash
sudo env DOMAIN=trainer.example.com APP_PORT=18461 bash deploy/install-nginx.sh
```

It requires Nginx, Certbot, and correct DNS. It backs up the main configuration, adds a dedicated include, requests a certificate (follow Certbot account setup prompts on first use), and checks configuration before reload. TLS listens on `443` by default; an existing stream proxy may require an explicit `TLS_LISTEN=127.0.0.1:8443`. Adapt the listener to your server.

Use your distribution's existing Certbot renewal schedule where possible. The optional `deploy/install-renewal.sh` **requires `certbot-renew.service/timer`** and enables renewal for all Certbot-managed certificates, with a Nginx reload hook; it is not a single-site script.

Optionally run `python3 deploy/provision-env.py user@your-server --origin https://trainer.example.com` to create an initial environment file using hidden key input. Leave the key empty to configure models in the panel. For a bootstrap model, also pass `--base-url` and `--model`; the key is still entered privately. Existing environment files are never overwritten.

### Updating

After creating the directories, services, and backup task above, run locally:

```bash
bash deploy/update.sh user@your-server
# Custom remote directory and health-check port (service settings must match):
bash deploy/update.sh user@your-server /srv/icpc-trainer 18461
```

The script builds, uploads, and validates a temporary bundle, backs up the database, briefly stops the application, replaces `current/`, and checks health. It retains no old build directories; rebuild a desired Git revision to recover. Updates do not change Nginx, certificates, or model environment files.

## Data and statistics

- Sessions are account-scoped in SQLite with WAL; browsers keep unsynced copies. Saving runs about one second after edits stop, and timers sync about every ten seconds. Confirm the server-saved indicator before leaving. Unsent chat input is not saved.
- Concurrent saves compare revisions and merge changes, retaining conflicts in history. Personal JSON import/export is supported. Message edits/recalls do not undo token usage or hint exposure.
- The backup program keeps the latest 14 files in `backups/` beside the database. Daily scheduling requires the timer above. Administrators can download a backup; same-server backups are not off-site protection. Stop the service before restoring, preserve the existing DB/WAL/SHM files, and restore with the matching encryption key.
- Solve-time trends compare exact CF problem ratings, exclude repeats by default, and use the training timer including discussion, not CF submission time. Small samples do not establish skill improvement.
- Calls and tokens use provider-reported usage; missing usage is marked unreported. Members see their own usage; administrators can inspect site usage.

## Problems, AI, and limitations

The problem bank uses the [Codeforces API](https://codeforces.com/apiHelp/methods#problemset.problems), falling back to a bundled, dated snapshot when unavailable. Statements try the original site, then an [unofficial public archive](https://github.com/codewithsathya/codeforces-problems), with source labels. Manual pasting remains available. Statements are cached for seven days; failed refreshes preserve old cache entries.

Before coaching, the server discovers the official Tutorial/Editorial link in the problem page's Contest materials, reads its body through CF's `blogEntry.view`, and extracts the current problem's section by explicit problem identity. If the original problem page is blocked, the public statement archive may supply the link; editorial content still comes from the official CF API. Community articles are not labelled official, and other problems' solutions and comments are not included. Ambiguous section matching is treated as unavailable.

The editorial is server-side reference material, not a solution automatically displayed to the learner. Hint levels still apply, and an alternative approach is not rejected simply for differing from the editorial. The chat shows the latest reply's reference status and a spoiler-labelled source link. References are cached for seven days; refresh failures can reuse clearly marked stale data. Failed fetches have a short cooldown. First retrieval can add up to about 18 seconds.

By default, no model call is made without an official reference. Users may explicitly enable “允许无题解推导” (allow reasoning without an editorial); the interface and reply then identify the result as unverified. Inconsistent editorial formats, video-only explanations, or CF network restrictions may prevent retrieval. Official references reduce mistakes but cannot guarantee correct proofs, counterexamples, or visuals.

Titles and time/memory limits are stored separately; coaching and translation receive the body. Translations protect formulas, samples, and images and can be checked against the original. Statements, notes, and conversations are sent to the selected model provider. AI can be wrong; the application is not an online judge.

Interactive `icpc-visual` blocks contain HTML/SVG/JavaScript rendered in a sandboxed iframe without same-origin privileges and with CSP restrictions on network requests. Only AI replies enable these blocks. Replay and source inspection are available; correctness depends on the model.

Luogu-style colored difficulty labels are **approximate CF problem-rating bands**, not official Luogu ratings or conversions of contestant ratings. See [`lib/difficulty.ts`](lib/difficulty.ts).

## Checks and contributions

```bash
pnpm exec tsc --noEmit
pnpm run build:standalone
node --test server/*.test.mjs
```

Issues and PRs are welcome. Include reproduction steps, Node/pnpm versions, and redacted errors. Never submit API keys, real environment files, databases, or user conversations. Use pnpm for dependency changes and commit `pnpm-lock.yaml`.

## License

Code is licensed under the [MIT License](LICENSE). Dependencies and third-party files retain their licenses; see `vendor/` and `scripts/vite/`. Codeforces problems, statements, and illustrations belong to their respective authors or rights holders and are not relicensed by this project's MIT license.

### Chat connections and diagnostics

Site-key coaching runs as an independent server-side job, with the browser periodically synchronizing output. Switching apps, losing the connection or refreshing does not cancel an accepted job; returning resumes delivery without another model call. There is no application-level generation deadline. “Stop generating” cancels the upstream request; provider and network limits may still apply. Provider-returned `reasoning_content` / `reasoning` text streams into an expandable reasoning section and is saved with completed answers. Subsequent ordinary chat sends final answers only. Models that expose no reasoning receive no fabricated reasoning display. Only explicitly completed replies enter conversation history. Interrupted or output-limited responses keep their temporary text visible, report a specific error, and allow retry; incomplete text is not sent as context on the next turn.

Recent admin call records include request IDs, durations, error categories, and finish reasons, distinguishing upstream HTTP failures, networking/timeouts, empty answers, invalid data, and output limits. Service logs contain only diagnostic metadata, not keys, full prompts, or conversation content. Older records have no diagnostic fields; an HTTP status alone does not establish the failure cause.

### Restoring your place

Navigation updates the URL fragment, such as `#/history`, `#/statistics`, or `#/training/<session-id>`. Refreshes, bookmarks, and browser Back/Forward restore the matching page. Training pages wait for the current account's records before restoring the selected session; timing resumes from restoration without counting offline time. When no explicit fragment is supplied, the browser restores the last location saved for that account. Admin permissions still apply; unavailable or other-account session links return to the session picker with a notice.

### Provider presets

Admin panel → Model management → Add/Edit model includes presets for OpenAI, DeepSeek, Zhipu GLM (standard API / Coding Plan), Alibaba Cloud (Beijing / Singapore), Moonshot/Kimi, SiliconFlow, and OpenRouter. Presets fill the Base URL and API type and link to official documentation. Enter a model ID available to your account; custom endpoints remain supported. Sources are maintained in `lib/model-presets.ts`, checked on 2026-11-10.

Changing to a preset with a different endpoint clears unsaved keys and model IDs. Changing an existing model's endpoint also requires a new key on the server. Renaming a model or changing its model ID without changing the endpoint can retain its stored key.

### Discovering model IDs

When adding or editing a model, fill in its Base URL and API key, then click **Fetch models**. The server requests the compatible `GET /models` endpoint and returns IDs for the picker; manual entry remains available. Existing models can reuse their server-stored key when the endpoint is unchanged. Changing the endpoint requires a new key. Changing the endpoint or key clears earlier discovery results.

Discovery is admin-only and generates no completions or coaching usage. Only deduplicated model IDs are returned, not raw provider responses or credentials. Some providers do not expose a model directory, restrict access, or include non-chat models; consult their documentation and use manual entry where needed.

### Reusing translations across models

Existing Chinese translations are reused by problem ID and statement body. Changing the coaching model or reasoning level, or refreshing the page, does not automatically regenerate them. Body edits create a new translation identity; metadata-only changes, line endings, and surrounding whitespace do not. Legacy caches are adopted only when their original body hash can be verified, never by problem ID alone.

The notice names the model that actually generated the translation. Use **Retranslate with current model** to request another version. The old translation remains visible during generation and after failures. Concurrent first-time requests for the same body share one generation.

### Output budgets and temporary passwords

Administrators can configure an output token limit per model, selecting either `max_tokens` or `max_completion_tokens` as required by the API. Coaching and translation use this setting. A blank limit omits the parameter and uses the provider default, avoiding small hardcoded budgets for models whose reasoning is enabled by default. Reasoning and final answers may share a budget; follow the model documentation.

Account creation offers a “Use default password 123456” button that fills the field only when clicked. Creation, resets, and password changes accept 1–200 characters; the former 12-character minimum is removed. New accounts and administrator-reset passwords still require a password change at next sign-in.

### Registration, personal keys and site-model access

The sign-in page offers public registration. Self-registration always creates an ordinary member with site-model access disabled, ignoring submitted roles, grants and ownership fields. Registrants can sign in immediately without changing their chosen password again. Registration is rate-limited by IP.

Open “Coaching model → Manage my API keys” to add browser models. Keys stay in the browser: sessionStorage by default, localStorage only when explicitly remembered, separated per account and not synchronized across devices. Signing out clears session-only keys. Coaching, tutoring, translation and model discovery call the selected provider directly; keys never pass through this site's server. CORS failures are reported without falling back to a server proxy.

The site can prepare key-free prompts and references, and completed conversations still sync to the account. Browser model configuration and local usage statistics are not uploaded. Site models retain server-side keys, background jobs and server statistics.

In account management, administrators can grant or revoke “Allow site keys” independently of a member's role. Subsequent requests recheck access for coaching, translation, model selection and discovery. Administrators can use site models. Existing accounts retain their access on upgrade; manually created accounts default to site access, which can be revoked. Self-registered accounts always default to no site access.

### Mobile backgrounding and reply recovery

For site models, `/api/coach-jobs` creates a job with its own cancellation signal, independent of the browser connection. SQLite stores status, progress and completed results. Visibility/network recovery or refresh resumes retrieval without another model call. Job IDs make submission idempotent; each account has at most one running job.

Completed replies carry a generation ID and are applied once. Changed conversation branches keep replies in recovered versions; unsynced trailing user turns can be recovered from job context. A result is acknowledged and its temporary text cleared only after the server confirms it exists in saved training history. Restarting the server marks unfinished jobs as interrupted, retaining partial output without automatically retrying the model.

### Free-form algorithm tutor

The sidebar Algorithm tutor offers independent conversations without a CF statement. It does not count toward solved problems or solve-time trends. Explanations adapt to the question by default, with manual examples-first, guided-question and structured options. Prior knowledge, goals and reference topic are saved per account. Existing math, syntax highlighting, interactive diagrams, message editing/recall, background recovery and site/personal key permissions apply.

The OI Wiki catalog has twelve fixed topics: DSU, binary search, greedy, basic DP, segment trees, shortest paths, prefix sums/differences, KMP, Fenwick trees, heavy-light decomposition, maximum flow and persistent segment trees. Match recent questions or select a topic; list a source only after retrieving its body, cached in memory for one day. This is not full-site search. Practice suggestions use CF topic tags and the account rating to select up to three candidates. Without statements, the tutor must not claim to have verified their solutions or suitability. External reference material is treated as data and retains its own licensing.

### Browser-direct limitations and migration

Browser endpoints require external HTTPS, prohibit this site's origin, URL credentials and query parameters, omit site cookies and reject redirects. Providers must support browser CORS; server-only APIs cannot be proxied by this site while keeping the key off the server. Legacy personal-model upload/discovery endpoints return 410; migration 013 removes old personal model rows while retaining shared site credentials. Deployers must separately clean any historical backups that contain old personal credentials.

Browser-direct requests cannot guarantee continued generation through backgrounding, offline periods or refresh. The server cannot hold the key to continue on the user's behalf. Partial output stays on the current page; retries are explicit. Site-key background generation remains supported. Model selection and discovered model IDs use scrollable selectable lists for mobile input.

### Staged algorithm lessons

The Topic lessons sidebar (`#/lessons`) offers 12 topics; training also links to the library through Learn an algorithm. Each topic has a separate conversation at `#/lesson/lesson-<topic-id>`, prerequisites and learning goals, inheriting the tutor profile's stated knowledge and explanation preference.

Seven stages cover prerequisites, intuition, algorithm/invariants, proof/complexity, implementation/edge cases, understanding checks and transfer practice. Request stage explanations, diagrams or follow-up questions, and revisit any stage. Quizzes ask before revealing answers. After a completed reply in the current stage, users can mark it studied and advance; understanding is separately self-assessed, never certified by a page turn or an unrun submission.

Progress, notes and conversations sync per account and restore on refresh. Concurrent progress merges preserve studied stages. Lessons are excluded from solved counts and solve-time trends. Site-model background recovery and browser-only personal key privacy remain unchanged. Topic definitions and instructions live in `lib/lessons.ts`; references use the fixed OI Wiki catalog and CF recommendations remain unverified candidates until their statements are checked.

### Tutor conversations and learning memory

Create, switch, rename and archive tutor conversations at `#/assistant/<session-id>`. The legacy `algorithm-assistant` conversation remains intact. New conversations have unique IDs and empty messages, notes, reference-topic selection and conversation preferences. Requests contain only the current conversation's messages. Archived chats can be restored. The one-generation-per-account limit remains; output from another conversation is not presented as a reply to the current one.

Learning memory separately stores confirmed background, long-term goals and up to 40 self-assessed algorithms (learning / can explain / can implement), with evidence or gaps. It does not automatically analyze old chats or infer proficiency. Topic lessons can explicitly save their self-assessment to memory. Owner-scoped storage and revision checks prevent cross-account reads and concurrent overwrites. Changes apply to future tutor and lesson requests, not existing replies.

Global and per-conversation switches control memory injection. Enabled memory adds background, goals and at most six entries, prioritizing relevant algorithms; other conversation histories are never appended. The context is labeled self-reported and current instructions take precedence. Edit, remove or clear and save the profile. Disabling memory does not change existing rating-based selection or current conversation preferences. Conversations and learning memory sync to the account; personal model keys remain browser-only.
