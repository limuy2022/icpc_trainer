import { build as viteBuild } from "vite";
import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
await viteBuild({ configFile: "vite.standalone.config.ts" });
await build({
  entryPoints: ["server/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "release/server.mjs",
  alias: { "@": process.cwd() },
  external: ["node:*"],
});
await build({
  entryPoints: ["server/cli.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "release/admin.mjs",
  external: ["node:*"],
});
await build({
  entryPoints: ["server/backup.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "release/backup.mjs",
  external: ["node:*"],
});
await mkdir("release/server", { recursive: true });
await cp("server/migrations", "release/server/migrations", { recursive: true });
console.log(
  "Standalone release built. Run from release/ with node --env-file=.env server.mjs",
);
