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
- Administrator-created accounts, no public registration; multiple models, separate keys, and default-model management.
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

Open <http://127.0.0.1:5182>, sign in with the credentials in `data/initial-admin.txt`, and change the password. There is no built-in default password. Initialization runs once; administrators create subsequent accounts.

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

Reasoning preferences are saved per account and model. Generic APIs receive no extra reasoning parameters by default; non-default levels send `reasoning_effort` and require provider support. Choose the default level if unsupported. GLM uses model-specific thinking parameters. Coaching and translation share the selected model and reasoning level.

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

Coaching streams answer text with heartbeats and a 180-second model-generation limit. Only explicitly completed replies enter conversation history. Interrupted or output-limited responses keep their temporary text visible, report a specific error, and allow retry; incomplete text is not sent as context on the next turn.

Recent admin call records include request IDs, durations, error categories, and finish reasons, distinguishing upstream HTTP failures, networking/timeouts, empty answers, invalid data, and output limits. Service logs contain only diagnostic metadata, not keys, full prompts, or conversation content. Older records have no diagnostic fields; an HTTP status alone does not establish the failure cause.

### Restoring your place

Navigation updates the URL fragment, such as `#/history`, `#/statistics`, or `#/training/<session-id>`. Refreshes, bookmarks, and browser Back/Forward restore the matching page. Training pages wait for the current account's records before restoring the selected session; timing resumes from restoration without counting offline time. When no explicit fragment is supplied, the browser restores the last location saved for that account. Admin permissions still apply; unavailable or other-account session links return to the session picker with a notice.

### Provider presets

Admin panel → Model management → Add/Edit model includes presets for OpenAI, DeepSeek, Zhipu GLM (standard API / Coding Plan), Alibaba Cloud (Beijing / Singapore), Moonshot/Kimi, SiliconFlow, and OpenRouter. Presets fill the Base URL and API type and link to official documentation. Enter a model ID available to your account; custom endpoints remain supported. Sources are maintained in `lib/model-presets.ts`, checked on 2026-11-10.

Changing to a preset with a different endpoint clears unsaved keys and model IDs. Changing an existing model's endpoint also requires a new key on the server. Renaming a model or changing its model ID without changing the endpoint can retain its stored key.

### Discovering model IDs

When adding or editing a model, fill in its Base URL and API key, then click **Fetch models**. The server requests the compatible `GET /models` endpoint and returns IDs for the picker; manual entry remains available. Existing models can reuse their server-stored key when the endpoint is unchanged. Changing the endpoint requires a new key. Changing the endpoint or key clears earlier discovery results.

Discovery is admin-only and generates no completions or coaching usage. Only deduplicated model IDs are returned, not raw provider responses or credentials. Some providers do not expose a model directory, restrict access, or include non-chat models; consult their documentation and use manual entry where needed.
