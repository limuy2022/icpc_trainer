import { env } from "cloudflare:workers";
import { environmentModel } from "@/lib/model-environment";
export async function GET() {
  const config = environmentModel(env as unknown as Record<string,string|undefined>);
  return Response.json({configured:Boolean(config),provider:config?.provider || "",model:config?.model || ""}, {headers:{"Cache-Control":"no-store"}});
}
