import type { McpServer } from '@modelcontextprotocol/server';
import type { ScopusClient } from '../../scopus/client';
import { ScopusError } from '../../scopus/errors';
import { validateSchema } from '../../schemas/schema';
import { inputSchema, outputSchema } from './schemas';

export function registerAuthorRetrieval(
  server: McpServer,
  client: ScopusClient,
): void {
  server.registerTool(
    'author_retrieval',
    {
      title: 'Author Retrieval',
      description:
        'Retrieve Scopus author profiles by author_id, eid, or orcid. Comma-separated author_id or eid values use one native batch request. Returns the original Elsevier JSON; view access depends on entitlements. Pagination and superseded-profile resolution are explicit.',
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
        const { author_id, eid, orcid, ...params } = input;
        const identifier = author_id ?? eid ?? orcid;
        if (identifier === undefined) {
          throw new ScopusError(
            'INVALID_INPUT',
            'An author identifier is required.',
          );
        }
        const kind =
          author_id !== undefined
            ? 'author_id'
            : eid !== undefined
              ? 'eid'
              : 'orcid';
        const batch = kind !== 'orcid' && identifier.includes(',');
        const path = batch
          ? '/content/author'
          : `/content/author/${kind}/${encodeURIComponent(identifier)}`;
        const response = await client.get(
          path,
          batch ? { ...params, [kind]: identifier } : params,
          ctx.mcpReq.signal,
        );
        const parsed = await validateSchema(outputSchema, response.body);
        if (parsed.issues) {
          throw new ScopusError(
            'INVALID_RESPONSE',
            'Scopus returned an unexpected author retrieval response.',
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
                'The author retrieval could not be completed.',
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
