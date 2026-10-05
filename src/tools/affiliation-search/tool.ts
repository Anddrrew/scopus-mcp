import type { McpServer } from '@modelcontextprotocol/server';
import type { ScopusClient } from '../../scopus/client';
import { ScopusError } from '../../scopus/errors';
import { inputSchema, outputSchema } from './schemas';

export function registerAffiliationSearch(
  server: McpServer,
  client: ScopusClient,
): void {
  server.registerTool(
    'affiliation_search',
    {
      title: 'Affiliation Search',
      description:
        'Search Scopus institution profiles using native affiliation query syntax. Returns one page of native Elsevier JSON, including search-results and pagination. Example: AFFIL(university) AND AFFIL(London). Credentials come from the server environment. Access depends on your Scopus entitlements.',
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
          '/content/search/affiliation',
          input,
          ctx.mcpReq.signal,
        );
        const parsed = outputSchema.safeParse(response.body);
        if (!parsed.success) {
          throw new ScopusError(
            'INVALID_RESPONSE',
            'Scopus returned an unexpected affiliation search response.',
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
                'The affiliation search could not be completed.',
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
