import type { McpServer } from '@modelcontextprotocol/server';
import type { ScopusClient } from '../../scopus/client.js';
import { ScopusError } from '../../scopus/errors.js';
import { inputSchema, outputSchema } from './schemas.js';

export function registerScopusSearch(
  server: McpServer,
  client: ScopusClient,
): void {
  server.registerTool(
    'scopus_search',
    {
      title: 'Scopus Search',
      description:
        'Search Scopus publications with its native query syntax. Returns one page of the original Elsevier JSON, including search-results, entry and pagination. Example: TITLE-ABS-KEY(machine learning) AND PUBYEAR > 2020. Credentials come from the server environment. Access to views and cursor pagination depends on your Scopus entitlements.',
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
        const response = await client.get(
          '/content/search/scopus',
          input,
          ctx.mcpReq.signal,
        );
        const parsed = outputSchema.safeParse(response.body);
        if (!parsed.success) {
          throw new ScopusError(
            'INVALID_RESPONSE',
            'Scopus returned an unexpected search response.',
            200,
            response.headers,
          );
        }
        return {
          structuredContent: parsed.data,
          content: [{ type: 'text', text: JSON.stringify(parsed.data) }],
          _meta: { 'scopus-mcp/headers': response.headers },
        };
      } catch (error) {
        const failure =
          error instanceof ScopusError
            ? error
            : new ScopusError(
                'INTERNAL_ERROR',
                'The Scopus search could not be completed.',
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
