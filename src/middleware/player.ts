import { getPlayerScript } from "../player.ts";
import type { PlayerRequest, RequestContext } from "../types.ts";

type Next = (ctx: RequestContext) => Promise<Response>;

export function withPlayer(handler: Next): Next {
    return async (ctx: RequestContext) => {
        try {
            const { player_url } = ctx.body as PlayerRequest;
            const playerScript = getPlayerScript(player_url);
            const newCtx = { ...ctx, playerScript };
            return await handler(newCtx);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return new Response(JSON.stringify({ error: `Player script error: ${message}` }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
    };
}