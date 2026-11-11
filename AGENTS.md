# Repository Guidelines

## Project Structure

ICPC Thinking Lab is a TypeScript application with a React frontend and a standalone Node.js backend. `client/main.tsx` boots the frontend, `app/page.tsx` assembles the workspace, and `app/globals.css` holds shared styles. Put reusable UI in `components/`, React hooks in `hooks/`, and shared domain logic in `lib/`. Static assets live in `public/`.

`server/main.ts` routes the standalone API. Server features, SQLite migrations, and tests live in `server/`, with deployment scripts in `deploy/`.

## Build, Test, and Development

Use Node.js 22.13 or newer and the pnpm version pinned in `package.json`.

- `pnpm install --frozen-lockfile` installs locked dependencies.
- `pnpm run build:standalone` builds the frontend and Node.js server into `release/`.
- `pnpm run dev:standalone` starts Vite with hot reload at port 5174 and proxies API requests to port 5180. Start the backend separately from `release/` with `node --env-file=../.env.local server.mjs`. Set `PORT=5180` and `APP_ORIGIN=http://127.0.0.1:5174` in `.env.local`.
- `pnpm run typecheck` checks types. `pnpm run lint` runs ESLint. `pnpm test` runs the Node test runner. `pnpm run format` runs Prettier. CI (`.github/workflows/ci.yml`) runs lint, typecheck, build and tests.

## Coding Style

Use two-space indentation for new TypeScript and TSX. Follow neighboring code conventions and use PascalCase for React components, camelCase for functions and variables, and kebab-case for module filenames. Use the existing locale helpers for user-facing strings and add English translations in `lib/locales/en.json`.

## Testing

Use Node’s test runner and assertions. Name tests `server/<feature>.test.mjs`. Build the standalone release first so integration tests exercise current code, then run `pnpm test`. Add targeted regression coverage for changed behavior. The project has no documented numeric coverage threshold.

## Commits and Pull Requests

Use short imperative subjects such as “Keep tutor sessions out of problem training routes.” In pull requests, describe the behavior change and verification. Link relevant issues and attach screenshots for visible UI changes. Include reproduction steps, Node/pnpm versions, and redacted errors when reporting bugs. Commit `pnpm-lock.yaml` with dependency changes. Keep real environment files, API keys, databases, and user conversations out of Git.
