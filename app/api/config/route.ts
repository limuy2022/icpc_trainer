import { env } from "cloudflare:workers";
export async function GET() {
  const config = env as unknown as { GLM_API_KEY?: string; GLM_MODEL?: string };
  return Response.json(
    {
      configured: Boolean(config.GLM_API_KEY),
      provider: "GLM Coding Plan",
      model: config.GLM_MODEL || "GLM-5.3",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
