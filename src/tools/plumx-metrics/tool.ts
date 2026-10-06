import type { McpServer } from '@modelcontextprotocol/server';
import type { ScopusClient } from '../../scopus/client';
import { validateSchema } from '../../schemas/schema';
import { ScopusError } from '../../scopus/errors';
import { inputSchema, outputSchema } from './schemas';

export function registerPlumxMetrics(
  server: McpServer,
  client: ScopusClient,
): void {
  server.registerTool(
    'plumx_metrics',
    {
      title: 'PlumX Metrics',
      description:
        'Retrieve native PlumX metrics for one publication or artifact by identifier. Returns the original Elsevier JSON, including metric categories, count types and sources. Requires active Scopus access. HTTP 404 can mean that no metrics are available or that the identifier is unknown.',
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
          `/analytics/plumx/${input.idType}/${encodeURIComponent(input.idValue)}`,
          { reqId: input.reqId },
          ctx.mcpReq.signal,
        );
        const parsed = await validateSchema(outputSchema, response.body);
        if (parsed.issues) {
          throw new ScopusError(
            'INVALID_RESPONSE',
            'Elsevier returned an unexpected PlumX metrics response.',
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
                'The PlumX metrics request could not be completed.',
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
