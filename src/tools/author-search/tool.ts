import type { McpServer } from '@modelcontextprotocol/server';
import { validateSchema } from '../../schemas/schema';
import type { ScopusClient } from '../../scopus/client';
import { ScopusError } from '../../scopus/errors';
import { inputSchema, outputSchema } from './schemas';

export function registerAuthorSearch(
  server: McpServer,
  client: ScopusClient,
): void {
  server.registerTool(
    'author_search',
    {
      title: 'Author Search',
      description:
        'Search Scopus author profiles using native queries, or supply co-author to find an author’s collaborators. Returns one page of native Elsevier JSON, including search-results and pagination. Example: AUTHLASTNAME(Smith) AND AUTHFIRST(John). Credentials come from the server environment. Access depends on your Scopus entitlements.',
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
          '/content/search/author',
          {
            ...input,
            view: input.view ?? 'STANDARD',
            count: input.count ?? 25,
          },
          ctx.mcpReq.signal,
        );
        const parsed = await validateSchema(outputSchema, response.body);
        if (parsed.issues) {
          throw new ScopusError(
            'INVALID_RESPONSE',
            'Scopus returned an unexpected author search response.',
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
                'The author search could not be completed.',
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
