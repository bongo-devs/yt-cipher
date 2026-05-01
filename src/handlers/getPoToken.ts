import { potManager } from "../pot.ts";
import type {
  PoTokenRequest,
  PoTokenResponse,
  RequestContext,
} from "../types.ts";

export async function handleGetPoToken(ctx: RequestContext): Promise<Response> {
  const { visitorData, videoId, client } = ctx.body as PoTokenRequest;

  try {
    const potData = await potManager.generatePoToken(visitorData, videoId, client);

    const response: PoTokenResponse = {
      visitorDataToken: potData.visitorDataToken,
      visitorData: potData.visitorData,
      videoIdToken: potData.videoIdToken,
      expiresAt: potData.expiresAt.toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error generating PoToken:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
