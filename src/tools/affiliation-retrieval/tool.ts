import type { McpServer } from '@modelcontextprotocol/server';
import type { ScopusClient } from '../../scopus/client';
import { ScopusError } from '../../scopus/errors';
import { validateSchema } from '../../schemas/schema';
import { inputSchema, outputSchema } from './schemas';

export function registerAffiliationRetrieval(
  server: McpServer,
  client: ScopusClient,
): void {
  server.registerTool(
    'affiliation_retrieval',
    {
      title: 'Affiliation Retrieval',
      description:
        'Retrieve a Scopus institution profile by affiliation_id or eid. Returns the original Elsevier JSON, including profile data or one page of related documents/authors when requested through view. Access depends on entitlements; no linked records or additional pages are fetched automatically.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input, ctx) => {
      try {
        const { affiliation_id, eid, ...params } = input;
        const identifier = affiliation_id ?? eid;
        if (identifier === undefined) {
          throw new ScopusError(
            'INVALID_INPUT',
            'An affiliation identifier is required.',
          );
        }
        const kind = affiliation_id !== undefined ? 'affiliation_id' : 'eid';
        const response = await client.get(
          `/content/affiliation/${kind}/${encodeURIComponent(identifier)}`,
          params,
          ctx.mcpReq.signal,
        );
        const parsed = await validateSchema(outputSchema, response.body);
        if (parsed.issues) {
          throw new ScopusError(
            'INVALID_RESPONSE',
            'Scopus returned an unexpected affiliation retrieval response.',
            200,
            response.headers,
          );
        }
        return {
          structuredContent: parsed.value,
          content: [{ type: 'text', text: JSON.stringify(parsed.value) }],
          _meta: { 'scopus-mcp/headers': response.headers },
        };
      } catch (error) {
        const failure =
          error instanceof ScopusError
            ? error
            : new ScopusError(
                'INTERNAL_ERROR',
                'The affiliation retrieval could not be completed.',
              );
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                code: failure.code,
                message: failure.message,
                status: failure.status,
              }),
            },
          ],
          _meta: { 'scopus-mcp/headers': failure.headers },
        };
      }
    },
  );
}
