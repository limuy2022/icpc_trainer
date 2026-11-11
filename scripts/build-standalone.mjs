import { build as viteBuild } from "vite";
import { build } from "esbuild";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
/** Pre-compress static assets so serving them costs no runtime CPU. */
async function precompress() {
  const dir = "release/public/assets";
  let count = 0;
  for (const name of await readdir(dir)) {
    if (!/\.(js|css|ttf|svg|woff)$/.test(name)) continue;
    const body = await readFile(`${dir}/${name}`);
    await writeFile(`${dir}/${name}.gz`, gzipSync(body, { level: 9 }));
    count++;
  }
  console.log(`Pre-compressed ${count} static assets (nginx has no gzip here).`);
}
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
await precompress();
console.log(
  "Standalone release built. Run from release/ with node --env-file=.env server.mjs",
);
