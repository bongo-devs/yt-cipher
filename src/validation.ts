import type { ApiRequest, RequestContext } from "./types.ts";

type Next = (ctx: RequestContext) => Promise<Response>;
type ValidationSchema = {
    [key: string]: (value: unknown) => boolean;
};

const signatureRequestSchema: ValidationSchema = {
    player_url: (val) => typeof val === 'string',
};

const stsRequestSchema: ValidationSchema = {
    player_url: (val) => typeof val === 'string',
};

const resolveUrlRequestSchema: ValidationSchema = {
    player_url: (val) => typeof val === 'string',
    stream_url: (val) => typeof val === 'string',
};

function validateObject(obj: ApiRequest, schema: ValidationSchema): { isValid: boolean, errors: string[] } {
    const errors: string[] = [];
    const fields = obj as Record<string, unknown>;
    for (const key in schema) {
        if (!Object.hasOwn(fields, key) || !schema[key](fields[key])) {
            errors.push(`'${key}' is missing or invalid`);
        }
    }
    return { isValid: errors.length === 0, errors };
}

export function withValidation(handler: Next): Next {
    return async (ctx: RequestContext) => {
        const { pathname } = new URL(ctx.req.url);

        let schema: ValidationSchema;
        if (pathname === '/decrypt_signature') {
            schema = signatureRequestSchema;
        } else if (pathname === '/get_sts') {
            schema = stsRequestSchema;
        } else if (pathname === '/resolve_url') {
            schema = resolveUrlRequestSchema;
        } else {
            return await handler(ctx);
        }

        const { isValid, errors } = validateObject(ctx.body, schema);

        if (!isValid) {
            return new Response(JSON.stringify({ error: `Invalid request body: ${errors.join(', ')}` }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        return await handler(ctx);
    };
}
