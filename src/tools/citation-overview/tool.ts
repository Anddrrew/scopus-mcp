import type { McpServer } from '@modelcontextprotocol/server';
import type { ScopusClient } from '../../scopus/client';
import { ScopusError } from '../../scopus/errors';
import { inputSchema, outputSchema } from './schemas';

export function registerCitationOverview(
  server: McpServer,
  client: ScopusClient,
): void {
  server.registerTool(
    'citation_overview',
    {
      title: 'Citation Overview',
      description:
        'Retrieve yearly citation counts and summaries for Scopus documents. Supply one native document identifier type, with comma-separated values for multiple documents. Returns the original Elsevier JSON in one request. Citation Overview access must be enabled for your API key.',
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
          '/content/abstract/citations',
          input,
          ctx.mcpReq.signal,
        );
        const parsed = outputSchema.safeParse(response.body);
        if (!parsed.success) {
          throw new ScopusError(
            'INVALID_RESPONSE',
            'Scopus returned an unexpected citation overview response.',
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
                'The citation overview could not be completed.',
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
